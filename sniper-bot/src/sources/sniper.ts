import { PublicKey } from '@solana/web3.js';
import { Contract, id as keccakId, zeroPadValue, getAddress } from 'ethers';
import { filtersFor, isEvm, type Chain, type EvmChain } from '../config.js';
import { EVM, evmProvider, solConn } from '../chains.js';
import { norm, rugLinkPct } from '../trap.js';
import { jsonl, throttle } from '../util.js';
import { gmgnTokenStats } from './gmgn.js';

// Erken alıcı analizi (ilk sniper_slots slot / sniper_blocks blok):
// - pct: erken alıcıların BUGÜN tuttuğu arz %
// - holdMin: erken alıcıların medyan tutma süresi (satmayan = şu ana kadarki süre)
// - quickFlipPct: quick_flip_min içinde %50+ satan erken alıcı %
// - rugLinkPct: daha önce rug olmuş token'larda da erken alıcı olan cüzdan % (trap.ts)
// - bundledPct: dev'in ödediği (fee payer = dev) ya da launch slot/bloğunda alan erken alıcı %
// - devSoldPct: dev'in elindekinin satılan %'si — LP kilitli olsa bile dev token'ı pair'e boşaltabilir
// Her erken alıcı early_buyers.jsonl'e, dev devs.jsonl'e yazılır → rug korelasyonu, küme, dev geçmişi.
export interface SniperInfo {
  pct: number | null;
  buyers: number;
  wallets: string[];
  holdMin: number | null;
  quickFlipPct: number | null;
  rugLinkPct: number | null;
  bundledPct: number | null;
  dev: string | null;
  devSoldPct: number | null;
}

interface Buyer {
  wallet: string;
  buys: number;
  bought: number; // token birimi (SOL: ui, BSC: wei → Number yaklaşık)
  buyTs: number; // ms
  held: number;
  sold: boolean;
  holdMin: number;
  bundled: boolean;
  account?: string; // SOL token hesabı
}

interface Early {
  buyers: Buyer[];
  supply: number;
  dev: string | null;
  devSoldPct: number | null;
}

export async function sniperPct(chain: Chain, token: string, pair: string, pairCreatedAt: number, creator?: string | null): Promise<SniperInfo | null> {
  const g = await gmgnTokenStats(chain, token).catch(() => null);
  const r = await (chain === 'solana' ? solanaEarly(token, creator) : isEvm(chain) ? evmEarly(chain, token, pair, pairCreatedAt, creator) : null);
  if (!r) return g?.sniperPct != null ? { pct: g.sniperPct, buyers: 0, wallets: [], holdMin: null, quickFlipPct: null, rugLinkPct: null, bundledPct: null, dev: creator ?? null, devSoldPct: null } : null;
  const { buyers, supply, dev, devSoldPct } = r;
  for (const b of buyers) jsonl('early_buyers.jsonl', { chain, token, wallet: b.wallet, buys: b.buys, holdMin: Math.round(b.holdMin), sold: b.sold, bundled: b.bundled });
  if (dev) jsonl('devs.jsonl', { chain, token, dev, devSoldPct: devSoldPct == null ? null : Math.round(devSoldPct) });
  const others = buyers.filter((b) => !dev || norm(chain, b.wallet) !== norm(chain, dev));
  const n = buyers.length;
  const held = buyers.reduce((s, b) => s + b.held, 0);
  const holds = buyers.map((b) => b.holdMin).sort((a, b) => a - b);
  const wallets = buyers.map((b) => b.wallet);
  return {
    pct: g?.sniperPct ?? (n === 0 ? 0 : supply ? (held / supply) * 100 : null),
    buyers: n,
    wallets,
    holdMin: n ? holds[Math.floor(n / 2)] : null,
    quickFlipPct: n ? (buyers.filter((b) => b.sold && b.holdMin <= filtersFor(chain).quick_flip_min).length / n) * 100 : null,
    rugLinkPct: n ? rugLinkPct(chain, token, wallets) : null,
    bundledPct: others.length ? (others.filter((b) => b.bundled).length / others.length) * 100 : null,
    dev,
    devSoldPct,
  };
}

// ---- Solana ----
async function solanaEarly(mint: string, creator?: string | null): Promise<Early | null> {
  const conn = solConn();
  const mintPk = new PublicKey(mint);
  let before: string | undefined;
  const sigs: { signature: string; slot: number; err: unknown; blockTime?: number | null }[] = [];
  let exhausted = false;
  for (let i = 0; i < filtersFor('solana').sniper_sig_pages; i++) {
    await throttle('sol-rpc', 120);
    const page = await conn.getSignaturesForAddress(mintPk, { before, limit: 1000 });
    sigs.push(...page);
    if (page.length < 1000) {
      exhausted = true;
      break;
    }
    before = page[page.length - 1].signature;
  }
  if (!exhausted || sigs.length === 0) return null; // en eskiye inemedik → bilinmiyor

  const oldest = sigs.reverse();
  const firstSlot = oldest[0].slot;
  const early = oldest.filter((s) => !s.err && s.slot <= firstSlot + filtersFor('solana').sniper_slots).slice(0, 60);

  const by = new Map<string, Buyer>();
  let dev = creator ?? null;
  let devInitial = 0;
  for (const s of early) {
    await throttle('sol-rpc', 120);
    const tx = await conn.getParsedTransaction(s.signature, { maxSupportedTransactionVersion: 0 });
    if (!tx?.meta) continue;
    const keys = tx.transaction.message.accountKeys;
    const feePayer = keys[0]?.pubkey.toBase58();
    if (!dev && s.signature === oldest[0].signature) dev = feePayer ?? null; // creator yoksa: oluşturma tx'inin ödeyicisi
    const pre = new Map<number, number>();
    for (const b of tx.meta.preTokenBalances ?? []) if (b.mint === mint) pre.set(b.accountIndex, b.uiTokenAmount.uiAmount ?? 0);
    for (const b of tx.meta.postTokenBalances ?? []) {
      if (b.mint !== mint || !b.owner) continue;
      const delta = (b.uiTokenAmount.uiAmount ?? 0) - (pre.get(b.accountIndex) ?? 0);
      if (b.owner === dev) devInitial = Math.max(devInitial, b.uiTokenAmount.uiAmount ?? 0);
      if (delta <= 0) continue;
      // bundle: dev başka cüzdana alım yaptırıyor (fee payer = dev) ya da oluşturma slot'unda alım
      const bundled = b.owner !== dev && (feePayer === dev || s.slot === firstSlot);
      const cur = by.get(b.owner);
      if (cur) {
        cur.buys++;
        cur.bought += delta;
        cur.bundled ||= bundled;
      } else if (by.size < filtersFor('solana').sniper_max_buyers) {
        by.set(b.owner, {
          bundled,
          wallet: b.owner,
          buys: 1,
          bought: delta,
          buyTs: (tx.blockTime ?? s.blockTime ?? 0) * 1000,
          held: 0,
          sold: false,
          holdMin: 0,
          account: keys[b.accountIndex]?.pubkey.toBase58(),
        });
      }
    }
  }
  const buyers = [...by.values()];

  // dev satışı: launch'taki en yüksek bakiye → bugün
  let devSoldPct: number | null = null;
  if (dev && devInitial > 0) {
    await throttle('sol-rpc', 120);
    const accts = await conn.getParsedTokenAccountsByOwner(new PublicKey(dev), { mint: mintPk }).catch(() => null);
    if (accts) {
      const now = accts.value.reduce((s, a) => s + Number(a.account.data.parsed.info.tokenAmount.uiAmount ?? 0), 0);
      devSoldPct = Math.max(0, ((devInitial - now) / devInitial) * 100);
    }
  }
  if (!buyers.length) return { buyers, supply: 0, dev, devSoldPct };

  await throttle('sol-rpc', 120);
  const supply = (await conn.getTokenSupply(mintPk)).value.uiAmount ?? 0;
  const now = Date.now();
  for (const b of buyers) {
    await throttle('sol-rpc', 120);
    const accts = await conn.getParsedTokenAccountsByOwner(new PublicKey(b.wallet), { mint: mintPk });
    b.held = accts.value.reduce((s, a) => s + Number(a.account.data.parsed.info.tokenAmount.uiAmount ?? 0), 0);
    b.sold = b.held < b.bought * 0.5;
    let endTs = now;
    if (b.sold && b.account) {
      // token hesabının alımdan sonraki ilk işlemi ≈ satış zamanı
      await throttle('sol-rpc', 120);
      const hist = await conn.getSignaturesForAddress(new PublicKey(b.account), { limit: 1000 }).catch(() => []);
      const after = hist.map((h) => (h.blockTime ?? 0) * 1000).filter((t) => t > b.buyTs);
      if (after.length) endTs = Math.min(...after);
    }
    b.holdMin = b.buyTs ? Math.max(0, (endTs - b.buyTs) / 60_000) : 0;
  }
  return { buyers, supply, dev, devSoldPct };
}

const ERC20 = ['function balanceOf(address) view returns (uint256)', 'function totalSupply() view returns (uint256)'];
const TRANSFER = keccakId('Transfer(address,address,uint256)');
const LOG_CHUNK = 2000;

async function blockAt(chain: EvmChain, tsSec: number): Promise<number> {
  const p = evmProvider(chain);
  let hi = await p.getBlockNumber();
  let lo = Math.max(0, hi - Math.ceil((8 * 3600) / EVM[chain].secPerBlock)); // ~8 saat; max_pair_age bunun altında
  while (lo < hi) {
    const mid = Math.floor((lo + hi) / 2);
    const b = await p.getBlock(mid);
    if (!b || b.timestamp < tsSec) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

// ---- EVM (BSC + Base): Transfer(pair → alıcı) logları ----
async function evmEarly(chain: EvmChain, token: string, pair: string, pairCreatedAt: number, creator?: string | null): Promise<Early | null> {
  if (!pairCreatedAt) return null;
  const f = filtersFor(chain);
  const p = evmProvider(chain);
  const pairTopic = zeroPadValue(pair, 32);
  const start = (await blockAt(chain, Math.floor(pairCreatedAt / 1000))) - 20;
  const logs = await p.getLogs({ address: token, topics: [TRANSFER, pairTopic], fromBlock: start, toBlock: start + 20 + f.sniper_blocks + 40 });
  if (!logs.length) return null;
  const first = logs[0].blockNumber;

  const by = new Map<string, Buyer & { buyBlock: number }>();
  for (const l of logs) {
    if (l.blockNumber > first + f.sniper_blocks) break;
    const w = getAddress('0x' + l.topics[2].slice(26));
    const amt = Number(BigInt(l.data));
    const cur = by.get(w);
    if (cur) {
      cur.buys++;
      cur.bought += amt;
    } else if (by.size < f.sniper_max_buyers) {
      by.set(w, { wallet: w, buys: 1, bought: amt, buyTs: 0, buyBlock: l.blockNumber, held: 0, sold: false, holdMin: 0, bundled: l.blockNumber === first }); // launch bloğunda = bundle
    }
  }
  const buyers = [...by.values()];
  const dev = creator ? getAddress(creator) : null;
  if (!buyers.length && !dev) return { buyers: [], supply: 0, dev, devSoldPct: null };

  const head = await p.getBlockNumber();
  const [b0, b1] = await Promise.all([p.getBlock(first), p.getBlock(head)]);
  const secPerBlock = b0 && b1 && head > first ? (b1.timestamp - b0.timestamp) / (head - first) : EVM[chain].secPerBlock;
  const firstTs = (b0?.timestamp ?? Math.floor(pairCreatedAt / 1000)) * 1000;

  const c = new Contract(token, ERC20, p);
  const supply = Number((await c.totalSupply()) as bigint);
  for (const b of buyers) {
    b.buyTs = firstTs + (b.buyBlock - first) * secPerBlock * 1000;
    b.held = Number((await c.balanceOf(b.wallet)) as bigint);
    b.sold = b.held < b.bought * 0.5;
  }

  // satış = erken alıcıdan pair'e ilk Transfer (yalnız satanlar için tarama).
  // Dev → pair transferleri de toplanır (launch bloğundan sonra; ilk likidite ekleme hariç) → devSoldPct.
  const sellers = buyers.filter((b) => b.sold);
  const firstSell = new Map<string, number>();
  let devSold = 0n;
  const devBal = dev ? ((await c.balanceOf(dev)) as bigint) : 0n;
  const from0 = [...sellers.map((b) => b.wallet), ...(dev ? [dev] : [])];
  if (from0.length) {
    const fromTopics = [...new Set(from0)].map((w) => zeroPadValue(w, 32));
    for (let from = first + 1; from <= head; from += LOG_CHUNK) {
      const sells = await p.getLogs({ address: token, topics: [TRANSFER, fromTopics, pairTopic], fromBlock: from, toBlock: Math.min(head, from + LOG_CHUNK - 1) });
      for (const l of sells) {
        const w = getAddress('0x' + l.topics[1].slice(26));
        if (w === dev) devSold += BigInt(l.data);
        if (!firstSell.has(w)) firstSell.set(w, l.blockNumber);
      }
      if (!dev && firstSell.size >= sellers.length) break;
    }
  }
  const devSoldPct = dev && devSold + devBal > 0n ? Number((devSold * 10_000n) / (devSold + devBal)) / 100 : null;
  for (const b of buyers) {
    const endBlock = b.sold ? (firstSell.get(b.wallet) ?? head) : head;
    b.holdMin = Math.max(0, ((endBlock - b.buyBlock) * secPerBlock) / 60);
  }
  return { buyers, supply, dev, devSoldPct };
}
