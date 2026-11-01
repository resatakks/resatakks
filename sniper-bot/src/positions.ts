import { randomUUID } from 'node:crypto';
import { CHAINS, cfg, nativeSymbol, paperOnly, type Chain } from './config.js';
import { executor } from './exec/index.js';
import { onClosed } from './risk.js';
import { exitsSince, pollSolanaHolders, smartBus } from './smartmoney.js';
import { openPositions, save, state } from './state.js';
import { tg } from './telegram.js';
import type { Metrics, PairInfo, Position } from './types.js';
import { errMsg, jsonl, log } from './util.js';

const fmt = (n: number) => n.toFixed(4);
const pctOf = (p: Position, v: number) => (v / p.sizeNative - 1) * 100;

export async function openPosition(pi: PairInfo, size: number, m: Metrics) {
  const ex = executor(pi.chain);
  const fill = await ex.buy(pi.token, size);
  if (fill.tokenRaw <= 0n) throw new Error('alım sonrası token bakiyesi 0');
  const pos: Position = {
    id: randomUUID().slice(0, 8),
    chain: pi.chain,
    token: pi.token,
    symbol: pi.symbol,
    pair: pi.pair,
    mode: paperOnly(pi.chain) ? 'paper' : 'live',
    openedAt: Date.now(),
    sizeNative: size,
    tokenRaw: fill.tokenRaw.toString(),
    decimals: fill.decimals,
    peakValueNative: size,
    lastValueNative: size,
    quoteFails: 0,
    triggerWallets: [...m.smartWallets, ...m.kolWallets],
    entrySig: fill.sig,
    status: 'open',
  };
  state.positions.push(pos);
  state.daily.trades++;
  save();
  jsonl('trades.jsonl', { ev: 'open', ...pos, metrics: m });
  await tg(
    `🟢 <b>${cfg.mode.toUpperCase()} BUY</b> ${pi.symbol} (${pi.chain})\n` +
      `${size} ${nativeSymbol(pi.chain)} · liq $${Math.round(pi.liquidityUsd)} · top10 ${m.top10Pct.toFixed(1)}%\n` +
      `smart: ${m.smartWallets.join(', ') || '-'} · kol: ${m.kolWallets.join(', ') || '-'}\n` +
      `<code>${pi.token}</code>`,
  );
}

async function closePosition(p: Position, reason: string) {
  if (p.status !== 'open') return;
  p.status = 'closing';
  save();
  const ex = executor(p.chain);
  try {
    const { outNative, sig } = await ex.sell(p.token, BigInt(p.tokenRaw));
    p.status = 'closed';
    p.exitReason = reason;
    p.exitValueNative = outNative;
    p.exitSig = sig;
    p.closedAt = Date.now();
    const pnl = outNative - p.sizeNative;
    const halt = onClosed(p.chain, pnl);
    save();
    jsonl('trades.jsonl', { ev: 'close', ...p, pnl, pnlPct: pctOf(p, outNative) });
    await tg(
      `${pnl >= 0 ? '✅' : '🔻'} <b>SELL</b> ${p.symbol} · ${reason}\n` +
        `${fmt(p.sizeNative)} → ${fmt(outNative)} ${nativeSymbol(p.chain)} (${pctOf(p, outNative).toFixed(1)}%)\n` +
        `bugün ${p.chain}: ${fmt(state.daily.realized[p.chain])}`,
    );
    if (halt) await tg(`⛔ Yeni giriş bugün kapalı: ${halt}`);
  } catch (e) {
    p.status = 'open'; // bir sonraki turda tekrar dener
    save();
    log.error('sell failed', { id: p.id, reason, err: errMsg(e) });
    await tg(`⚠️ SATIŞ BAŞARISIZ ${p.symbol} (${reason}): ${errMsg(e)}`);
  }
}

async function check(p: Position) {
  if (p.status !== 'open') return;
  const e = cfg.exit;

  const smartExits = exitsSince(p.chain, p.token, p.triggerWallets, p.openedAt);
  if (p.triggerWallets.length && smartExits.length >= e.smart_exit_count)
    return closePosition(p, `smart_exit(${smartExits.join(',')})`);

  let value: number;
  try {
    value = await executor(p.chain).quoteSell(p.token, BigInt(p.tokenRaw));
    p.quoteFails = 0;
  } catch (err) {
    p.quoteFails++;
    log.warn('quote fail', { id: p.id, n: p.quoteFails, err: errMsg(err) });
    if (p.quoteFails >= e.quote_fail_exit_after) return closePosition(p, 'no_quote');
    return;
  }
  p.lastValueNative = value;
  p.peakValueNative = Math.max(p.peakValueNative, value);
  const pct = pctOf(p, value);
  const peakPct = pctOf(p, p.peakValueNative);

  if (pct >= e.take_profit_pct) return closePosition(p, `tp(${pct.toFixed(1)}%)`);
  if (pct <= -e.stop_loss_pct) return closePosition(p, `sl(${pct.toFixed(1)}%)`);
  if (peakPct >= e.trailing_activate_pct && value <= p.peakValueNative * (1 - e.trailing_distance_pct / 100))
    return closePosition(p, `trail(peak ${peakPct.toFixed(1)}% → ${pct.toFixed(1)}%)`);
  if (Date.now() - p.openedAt > e.max_hold_min * 60_000) return closePosition(p, `timeout(${pct.toFixed(1)}%)`);
}

export async function closeAll(reason: string) {
  for (const p of openPositions()) await closePosition(p, reason);
}

export function startMonitor() {
  // Smart money satışı → beklemeden kontrol.
  smartBus.on('sell', (chain: Chain, token: string) => {
    for (const p of openPositions()) if (p.chain === chain && p.token === token) void check(p);
  });

  let tick = 0;
  const loop = async () => {
    tick++;
    for (const p of openPositions()) {
      try {
        // Webhook yedeği: ~30 sn'de bir tetikleyen cüzdanların bakiyesine bak.
        if (p.chain === 'solana' && p.triggerWallets.length && tick % 5 === 0) await pollSolanaHolders(p.token, p.triggerWallets);
        await check(p);
      } catch (err) {
        log.error('monitor', { id: p.id, err: errMsg(err) });
      }
    }
    save();
    setTimeout(loop, cfg.exit.poll_sec * 1000);
  };
  void loop();
}

export function statusText(): string {
  const open = openPositions();
  const lines = open.map(
    (p) => `• ${p.symbol} ${p.chain} ${pctOf(p, p.lastValueNative).toFixed(1)}% (peak ${pctOf(p, p.peakValueNative).toFixed(1)}%)`,
  );
  const d = state.daily;
  return [
    `<b>${cfg.mode.toUpperCase()}</b> ${state.paused ? '⏸ paused' : '▶️ running'}${state.haltedDay ? ` · halt ${state.haltedDay}` : ''}`,
    `bugün: ${CHAINS.map((c) => `${nativeSymbol(c)} ${fmt(d.realized[c] ?? 0)}`).join(' · ')} · ${d.trades} işlem`,
    `paper bakiye: ${CHAINS.map((c) => `${fmt(state.paperBalance[c] ?? 0)} ${nativeSymbol(c)}`).join(' · ')}`,
    `risk ölçeği: ${CHAINS.map((c) => `${c} ×${(state.riskScale?.[c] ?? 1).toFixed(2)}`).join(' · ')}`,
    `açık (${open.length}/${cfg.risk.max_concurrent}):`,
    ...lines,
  ].join('\n');
}
