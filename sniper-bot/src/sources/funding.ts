import { PublicKey } from '@solana/web3.js';
import { env, filtersFor, isEvm, type Chain } from '../config.js';
import { evmProvider, solConn } from '../chains.js';
import { norm } from '../trap.js';
import { getJson, jsonl, throttle } from '../util.js';

// Koordineli cüzdan grubu (fonlama kümesi): erken alıcıları kim fonladı?
// Bilinen kalıp (Bubblemaps kümeleri, Rugproof vakası): dev/operatör tek cüzdandan çok sayıda TAZE cüzdana native
// gönderir, bu cüzdanlar launch'ta arzı toplar ve birlikte satar. Ayrı adresler bağımsız alıcı gibi görünür.
// - freshPct: ilk işlemi fresh_wallet_hours içinde olan erken alıcı %
// - commonPct: en büyük ortak-fonlayıcı grubunun kontrol edilen erken alıcılara oranı
// - devPct: doğrudan dev tarafından fonlanan erken alıcı %
// Borsa/köprü sıcak cüzdanları herkesi fonlar → "hub" sayılıp gruplanmaz (SOL: ≥1000 imza, EVM: nonce ≥ 1000).
export interface FundInfo {
  checked: number;
  freshPct: number | null;
  commonPct: number | null;
  devPct: number | null;
  topFunder: string | null;
  group: string[];
}

interface Origin {
  funder: string | null;
  firstTs: number | null; // ms
}

const ETHERSCAN_ID: Partial<Record<Chain, number>> = { bsc: 56, base: 8453, monad: 143 }; // Blast Etherscan v2'de yok
const hubCache = new Map<string, boolean>();

export async function fundingCheck(chain: Chain, token: string, wallets: string[], dev: string | null): Promise<FundInfo | null> {
  const f = filtersFor(chain);
  const ws = wallets.filter((w) => !dev || norm(chain, w) !== norm(chain, dev)).slice(0, f.funding_max_wallets ?? 12);
  if (ws.length < 3) return null;
  const origins: { wallet: string; o: Origin }[] = [];
  for (const w of ws) {
    const o = await (chain === 'solana' ? solOrigin(w) : isEvm(chain) ? evmOrigin(chain, w) : Promise.resolve(null)).catch(() => null);
    if (o) origins.push({ wallet: w, o });
  }
  if (origins.length < 3) return null; // veri yok (anahtar yok / API hatası) → bilinmiyor
  const now = Date.now();
  const fresh = origins.filter((x) => x.o.firstTs != null && now - x.o.firstTs <= (f.fresh_wallet_hours ?? 48) * 3_600_000).length;
  const by = new Map<string, string[]>();
  for (const { wallet, o } of origins) {
    if (!o.funder || (await isHub(chain, o.funder))) continue;
    const k = norm(chain, o.funder);
    (by.get(k) ?? by.set(k, []).get(k)!).push(wallet);
  }
  const top = [...by].sort((a, b) => b[1].length - a[1].length)[0];
  const devN = dev ? (by.get(norm(chain, dev))?.length ?? 0) : 0;
  const info: FundInfo = {
    checked: origins.length,
    freshPct: (fresh / origins.length) * 100,
    commonPct: top && top[1].length >= 2 ? (top[1].length / origins.length) * 100 : 0,
    devPct: (devN / origins.length) * 100,
    topFunder: top && top[1].length >= 2 ? top[0] : null,
    group: top && top[1].length >= 2 ? top[1] : [],
  };
  for (const [funder, g] of by) if (g.length >= 2) jsonl('funders.jsonl', { chain, token, funder, wallets: g, dev: dev ? norm(chain, dev) === funder : false });
  return info;
}

// ---- Solana: cüzdanın en eski imzası → o tx'te cüzdana SOL gönderen (yoksa fee payer) ----
async function solOrigin(wallet: string): Promise<Origin | null> {
  const conn = solConn();
  await throttle('sol-rpc', 120);
  const sigs = await conn.getSignaturesForAddress(new PublicKey(wallet), { limit: 1000 });
  if (!sigs.length) return null;
  if (sigs.length >= 1000) return { funder: null, firstTs: null }; // eski/yoğun cüzdan → taze değil, köken bilinmiyor
  const oldest = sigs[sigs.length - 1];
  await throttle('sol-rpc', 120);
  const tx = await conn.getParsedTransaction(oldest.signature, { maxSupportedTransactionVersion: 0 });
  const firstTs = (oldest.blockTime ?? tx?.blockTime ?? 0) * 1000 || null;
  if (!tx) return { funder: null, firstTs };
  const ixs = [...tx.transaction.message.instructions, ...(tx.meta?.innerInstructions ?? []).flatMap((i) => i.instructions)];
  for (const ix of ixs as any[]) {
    const p = ix.parsed;
    if (ix.program === 'system' && (p?.type === 'transfer' || p?.type === 'transferWithSeed') && p.info?.destination === wallet) return { funder: p.info.source, firstTs };
  }
  const payer = tx.transaction.message.accountKeys[0]?.pubkey.toBase58() ?? null;
  return { funder: payer && payer !== wallet ? payer : null, firstTs };
}

// ---- EVM: Etherscan v2 ilk tx (asc) → gelen tx ise from = fonlayıcı ----
async function evmOrigin(chain: Chain, wallet: string): Promise<Origin | null> {
  const key = env('ETHERSCAN_API_KEY', false);
  const id = ETHERSCAN_ID[chain];
  if (!key || !id) return null;
  await throttle('etherscan', 220); // ücretsiz katman 5 istek/sn
  const r = await getJson<any>(
    `https://api.etherscan.io/v2/api?chainid=${id}&module=account&action=txlist&address=${wallet}&startblock=0&endblock=99999999&page=1&offset=1&sort=asc&apikey=${key}`,
  );
  const tx = Array.isArray(r?.result) ? r.result[0] : null;
  if (!tx) return null; // hata ya da hiç dış tx yok (ör. yalnız internal tx ile fonlanmış)
  const incoming = String(tx.to).toLowerCase() === wallet.toLowerCase();
  return { funder: incoming ? String(tx.from).toLowerCase() : null, firstTs: Number(tx.timeStamp) * 1000 };
}

async function isHub(chain: Chain, funder: string): Promise<boolean> {
  const k = `${chain}:${norm(chain, funder)}`;
  if (hubCache.has(k)) return hubCache.get(k)!;
  let hub = false;
  try {
    if (chain === 'solana') {
      await throttle('sol-rpc', 120);
      hub = (await solConn().getSignaturesForAddress(new PublicKey(funder), { limit: 1000 })).length >= 1000;
    } else if (isEvm(chain)) hub = (await evmProvider(chain).getTransactionCount(funder)) >= 1000;
  } catch {
    hub = false;
  }
  if (hubCache.size > 5000) hubCache.clear();
  hubCache.set(k, hub);
  return hub;
}
