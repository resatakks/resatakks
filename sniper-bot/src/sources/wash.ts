import { id as keccakId, zeroPadValue, getAddress } from 'ethers';
import { cfg, env, isEvm, type Chain, type EvmChain } from '../config.js';
import { EVM, evmProvider, getLogsChunked } from '../chains.js';
import { getJson, jsonl, throttle } from '../util.js';

// Wash trading: küçük bir cüzdan grubu (wash_group_max) wash_window_sec içinde hem alıp hem satıyor
// ve bu grup son trade'lerin max_wash_trade_pct'sinden fazlasını oluşturuyorsa hacim sahte sayılır.
export interface Trade {
  wallet: string;
  side: 'buy' | 'sell';
  ts: number; // ms
}

export interface WashInfo {
  washWallets: number; // gruptaki round-trip cüzdan sayısı
  washTradePct: number; // grubun trade'lerinin toplam trade'e oranı
  trades: number;
  group: string[]; // round-trip grubundaki cüzdanlar (wash_groups.jsonl → wash halkası tespiti)
}

export function detectWash(trades: Trade[], windowSec = cfg.filters.wash_window_sec, groupMax = cfg.filters.wash_group_max): WashInfo {
  const by = new Map<string, Trade[]>();
  for (const t of trades) (by.get(t.wallet) ?? by.set(t.wallet, []).get(t.wallet)!).push(t);
  const roundTrip: { wallet: string; n: number }[] = [];
  for (const [wallet, ts] of by) {
    const buys = ts.filter((t) => t.side === 'buy').map((t) => t.ts);
    const sells = ts.filter((t) => t.side === 'sell').map((t) => t.ts);
    if (buys.some((b) => sells.some((s) => Math.abs(s - b) <= windowSec * 1000))) roundTrip.push({ wallet, n: ts.length });
  }
  const group = roundTrip.sort((a, b) => b.n - a.n).slice(0, groupMax);
  const groupTrades = group.reduce((s, g) => s + g.n, 0);
  return { washWallets: group.length, washTradePct: trades.length ? (groupTrades / trades.length) * 100 : 0, trades: trades.length, group: group.map((g) => g.wallet) };
}

export async function washCheck(chain: Chain, token: string, pair: string): Promise<WashInfo | null> {
  const trades = chain === 'solana' ? await solanaTrades(token, pair) : isEvm(chain) ? await evmTrades(chain, token, pair) : null;
  if (!trades || trades.length < 10) return null; // az trade → karar verilemez
  const w = detectWash(trades);
  if (w.group.length >= 2) jsonl('wash_groups.jsonl', { chain, token, wallets: w.group, pct: Math.round(w.washTradePct) });
  return w;
}

// Helius Enhanced Transactions: pool adresindeki son SWAP'lar; trader = feePayer.
async function solanaTrades(mint: string, pair: string): Promise<Trade[] | null> {
  const key = env('HELIUS_API_KEY', false);
  if (!key) return null;
  await throttle('helius-api', 250);
  const txs = await getJson<any[]>(`https://api.helius.xyz/v0/addresses/${pair}/transactions?api-key=${key}&type=SWAP&limit=100`);
  const out: Trade[] = [];
  for (const tx of txs ?? []) {
    const fp: string = tx.feePayer;
    for (const t of tx.tokenTransfers ?? []) {
      if (t.mint !== mint) continue;
      if (t.toUserAccount === fp) out.push({ wallet: fp, side: 'buy', ts: tx.timestamp * 1000 });
      else if (t.fromUserAccount === fp) out.push({ wallet: fp, side: 'sell', ts: tx.timestamp * 1000 });
      else continue;
      break;
    }
  }
  return out;
}

const TRANSFER = keccakId('Transfer(address,address,uint256)');
const LOOKBACK_SEC = 300; // ~5 dk

// pair → cüzdan = alım, cüzdan → pair = satış
async function evmTrades(chain: EvmChain, token: string, pair: string): Promise<Trade[] | null> {
  const p = evmProvider(chain);
  const head = await p.getBlockNumber();
  const span = Math.ceil(LOOKBACK_SEC / EVM[chain].secPerBlock);
  const from = head - span;
  const pt = zeroPadValue(pair, 32);
  const [buys, sells, bHead, bFrom] = await Promise.all([
    getLogsChunked(chain, { address: token, topics: [TRANSFER, pt], fromBlock: from, toBlock: head }),
    getLogsChunked(chain, { address: token, topics: [TRANSFER, null, pt], fromBlock: from, toBlock: head }),
    p.getBlock(head),
    p.getBlock(from),
  ]);
  if (!bHead || !bFrom) return null;
  const spb = (bHead.timestamp - bFrom.timestamp) / span;
  const ts = (n: number) => (bFrom.timestamp + (n - from) * spb) * 1000;
  const lp = pair.toLowerCase();
  const out: Trade[] = [];
  for (const l of buys) out.push({ wallet: getAddress('0x' + l.topics[2].slice(26)), side: 'buy', ts: ts(l.blockNumber) });
  for (const l of sells) {
    const w = getAddress('0x' + l.topics[1].slice(26));
    if (w.toLowerCase() !== lp) out.push({ wallet: w, side: 'sell', ts: ts(l.blockNumber) });
  }
  return out;
}
