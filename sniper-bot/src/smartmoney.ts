import { EventEmitter } from 'node:events';
import { PublicKey } from '@solana/web3.js';
import { id as keccakId, zeroPadValue, getAddress } from 'ethers';
import { CHAINS, cfg, normAddr, wallets, type Chain, type EvmChain, type TrackedWallet } from './config.js';
import { EVM, QUOTE_MINTS, evmProvider, solConn } from './chains.js';
import type { Row } from './optimizer.js';
import { errMsg, jsonl, log, readJsonl, throttle } from './util.js';

interface WalletEvent {
  wallet: string;
  label: string;
  type: 'smart' | 'kol';
  side: 'buy' | 'sell';
  ts: number;
  source: string;
}

const events = new Map<string, WalletEvent[]>();
const key = (chain: Chain, token: string) => `${chain}:${normAddr(chain, token)}`;
const byAddr = Object.fromEntries(CHAINS.map((c) => [c, new Map(wallets[c].map((w) => [normAddr(c, w.address), w]))])) as Record<
  Chain,
  Map<string, TrackedWallet>
>;

// "sell" olayı → pozisyon yöneticisi anında kontrol eder.
export const smartBus = new EventEmitter();

function record(chain: Chain, token: string, w: TrackedWallet, side: 'buy' | 'sell', source: string, ts = Date.now()) {
  const k = key(chain, token);
  const list = events.get(k) ?? [];
  if (side === 'buy' && list.some((e) => e.wallet === w.address && e.side === 'buy')) return;
  const ev: WalletEvent = { wallet: w.address, label: w.label, type: w.type, side, ts, source };
  list.push(ev);
  events.set(k, list);
  jsonl('wallet_events.jsonl', { chain, token, ...ev });
  if (side === 'sell') smartBus.emit('sell', chain, k.slice(chain.length + 1), w.address);
}

// Pencere içinde alıp henüz satmamış izlenen cüzdanlar.
export function activeEntries(chain: Chain, token: string): { smart: string[]; kol: string[] } {
  const since = Date.now() - cfg.filters.smart_lookback_min * 60_000;
  const list = events.get(key(chain, token)) ?? [];
  const smart: string[] = [];
  const kol: string[] = [];
  for (const e of list) {
    if (e.side !== 'buy' || e.ts < since) continue;
    const sold = list.some((x) => x.wallet === e.wallet && x.side === 'sell' && x.ts > e.ts);
    if (!sold) (e.type === 'smart' ? smart : kol).push(e.label);
  }
  return { smart, kol };
}

export function exitsSince(chain: Chain, token: string, labels: string[], sinceMs: number): string[] {
  return (events.get(key(chain, token)) ?? [])
    .filter((e) => e.side === 'sell' && e.ts >= sinceMs && labels.includes(e.label))
    .map((e) => e.label);
}

// ---------- Solana: Helius Enhanced Webhook (tip: SWAP, adresler: wallets.yaml) ----------
export function handleHeliusWebhook(body: unknown) {
  if (!Array.isArray(body)) return;
  for (const tx of body as any[]) {
    for (const tt of tx.tokenTransfers ?? []) {
      if (!tt.mint || QUOTE_MINTS.has(tt.mint)) continue;
      const ts = tx.timestamp ? tx.timestamp * 1000 : Date.now();
      const to = byAddr.solana.get(tt.toUserAccount);
      const from = byAddr.solana.get(tt.fromUserAccount);
      if (to) record('solana', tt.mint, to, 'buy', 'helius', ts);
      if (from) record('solana', tt.mint, from, 'sell', 'helius', ts);
    }
  }
}

// Webhook kaçırdıysa: aday token için cüzdan bakiyelerini doğrudan sorgula.
export async function confirmSolanaOnChain(mint: string) {
  const mintPk = new PublicKey(mint);
  for (const w of wallets.solana) {
    try {
      await throttle('sol-rpc', 120);
      const r = await solConn().getParsedTokenAccountsByOwner(new PublicKey(w.address), { mint: mintPk });
      const bal = r.value.reduce((s, a) => s + Number(a.account.data.parsed.info.tokenAmount.uiAmount ?? 0), 0);
      if (bal > 0) record('solana', mint, w, 'buy', 'rpc');
    } catch (e) {
      log.warn('sol wallet check', { w: w.label, err: errMsg(e) });
    }
  }
}

// Açık pozisyon için: tetikleyen cüzdanlar bakiyeyi sıfırladı/yarıladı mı (webhook yedeği).
const lastBal = new Map<string, number>();
export async function pollSolanaHolders(mint: string, labels: string[]) {
  const mintPk = new PublicKey(mint);
  for (const w of wallets.solana.filter((x) => labels.includes(x.label))) {
    await throttle('sol-rpc', 120);
    const r = await solConn().getParsedTokenAccountsByOwner(new PublicKey(w.address), { mint: mintPk });
    const bal = r.value.reduce((s, a) => s + Number(a.account.data.parsed.info.tokenAmount.uiAmount ?? 0), 0);
    const k = `${w.address}:${mint}`;
    const prev = lastBal.get(k);
    lastBal.set(k, bal);
    if (prev != null && prev > 0 && bal < prev * 0.5) record('solana', mint, w, 'sell', 'rpc');
  }
}

// ---------- EVM: Transfer log taraması (iki getLogs çağrısı / tur, ağ başına) ----------
const TRANSFER = keccakId('Transfer(address,address,uint256)');
const fromBlock: Partial<Record<EvmChain, number>> = {};
export async function pollEvm(chain: EvmChain) {
  if (!wallets[chain].length) return;
  const p = evmProvider(chain);
  const head = await p.getBlockNumber();
  const last = (fromBlock[chain] ??= head - 40);
  if (head <= last) return;
  const toBlock = Math.min(head, last + Math.min(400, EVM[chain].logRange ?? 400));
  const topics = wallets[chain].map((w) => zeroPadValue(w.address, 32));
  const [ins, outs] = await Promise.all([
    p.getLogs({ topics: [TRANSFER, null, topics], fromBlock: last + 1, toBlock }),
    p.getLogs({ topics: [TRANSFER, topics], fromBlock: last + 1, toBlock }),
  ]);
  for (const [logs, side, idx] of [
    [ins, 'buy', 2],
    [outs, 'sell', 1],
  ] as const) {
    for (const l of logs) {
      if (EVM[chain].quotes.has(l.address.toLowerCase())) continue;
      const addr = getAddress('0x' + l.topics[idx].slice(26)).toLowerCase();
      const w = byAddr[chain].get(addr);
      if (w) record(chain, l.address.toLowerCase(), w, side, 'logs');
    }
  }
  fromBlock[chain] = toBlock;
}

export function walletCounts() {
  return Object.fromEntries(CHAINS.map((c) => [c, wallets[c].length])) as Record<Chain, number>;
}

// ---------- Tuzağa düşme risk skoru ----------
// Son N rug'da (path min ≤ −80%) girişte görülen smart/KOL cüzdanlar rug ANINDAN önce sattı mı?
// Önce satan = takipçiyi exit liquidity yapıyor olabilir → onları kopyalamak tuzak.
// Skor 0–100 = rug başına "önce satan / giren" ortalaması. Satış görülmemesi = birlikte yakalandı ya da izlenmedi.
export interface TrapRisk {
  score: number | null;
  rugs: { symbol: string; key: string; rugAt: number; front: string[]; caught: string[] }[];
  wallets: { label: string; front: number; caught: number }[];
}

export function trapRisk(rows: Row[], lastN = 3): TrapRisk {
  const rugs = rows
    .filter((r) => r.metrics && (r.metrics.smartWallets?.length ?? 0) + (r.metrics.kolWallets?.length ?? 0) > 0 && r.path.some(([, pct]) => pct <= -80))
    .sort((a, b) => Date.parse(b.ts) - Date.parse(a.ts))
    .slice(0, lastN);
  if (!rugs.length) return { score: null, rugs: [], wallets: [] };

  const sells = new Map<string, { label: string; ts: number }[]>();
  for (const e of readJsonl<any>('wallet_events.jsonl')) {
    if (e.side !== 'sell') continue;
    const k = key(e.chain, e.token);
    (sells.get(k) ?? sells.set(k, []).get(k)!).push({ label: e.label, ts: e.ts });
  }

  const per = new Map<string, { label: string; front: number; caught: number }>();
  const out: TrapRisk['rugs'] = [];
  let sum = 0;
  for (const r of rugs) {
    const [chain, token] = [r.key.slice(0, r.key.indexOf(':')), r.key.slice(r.key.indexOf(':') + 1)] as [Chain, string];
    const rugMin = r.path.find(([, pct]) => pct <= -80)![0];
    const rugAt = Date.parse(r.ts) + rugMin * 60_000;
    const labels = [...new Set([...r.metrics.smartWallets, ...r.metrics.kolWallets])];
    const ss = sells.get(key(chain, token)) ?? [];
    const front = labels.filter((l) => ss.some((x) => x.label === l && x.ts < rugAt));
    const caught = labels.filter((l) => !front.includes(l));
    for (const l of labels) {
      const w = per.get(l) ?? { label: l, front: 0, caught: 0 };
      front.includes(l) ? w.front++ : w.caught++;
      per.set(l, w);
    }
    sum += front.length / labels.length;
    out.push({ symbol: r.symbol, key: r.key, rugAt, front, caught });
  }
  return {
    score: Math.round((sum / rugs.length) * 100),
    rugs: out,
    wallets: [...per.values()].sort((a, b) => b.front - a.front || b.caught - a.caught),
  };
}
