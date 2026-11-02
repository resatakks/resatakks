import { cfg, riskFor, type Chain } from './config.js';
import { openPositions, rollDay, state } from './state.js';
import { utcDay } from './util.js';

export function probeSize(chain: Chain, balance: number): number | null {
  const r = riskFor(chain);
  const free = balance - r.fee_reserve;
  const size = Math.min(r.probe_max, Math.max(r.probe_min, balance * (r.probe_balance_pct / 100)));
  return size <= free ? Number(size.toFixed(4)) : null;
}

// auto_scale açıksa Sabah Raporu'nun önerdiği ölçek (state.riskScale) günlük kayıp tavanını küçültür; asla büyütmez.
export function dailyCap(chain: Chain): number {
  const r = riskFor(chain);
  const s = cfg.risk.auto_scale ? Math.min(1, Math.max(cfg.risk.min_scale, state.riskScale?.[chain] ?? 1)) : 1;
  return r.daily_loss_cap * s;
}

export type Gate = { ok: true } | { ok: false; reason: string };

// Tüm sert sınırlar burada; tek yerden geçmeyen giriş yok.
export function canOpen(chain: Chain, token: string, size: number): Gate {
  rollDay();
  const r = riskFor(chain);
  const open = openPositions();
  const d = state.daily;
  const now = Date.now();

  if (state.paused) return { ok: false, reason: `paused: ${state.pauseReason ?? 'manual'}` };
  if (state.haltedDay === utcDay()) return { ok: false, reason: `günlük durdurma: ${state.haltReason ?? ''}` };
  if (open.length >= cfg.risk.max_concurrent) return { ok: false, reason: `max_concurrent (${cfg.risk.max_concurrent})` };
  if (open.some((p) => p.chain === chain && p.token === token)) return { ok: false, reason: 'zaten pozisyon var' };

  const reentryMs = cfg.risk.reentry_block_hours * 3_600_000;
  if (state.positions.some((p) => p.chain === chain && p.token === token && (p.closedAt ?? p.openedAt) > now - reentryMs))
    return { ok: false, reason: `son ${cfg.risk.reentry_block_hours} saatte işlem yapıldı` };

  if (d.trades >= cfg.risk.max_trades_per_day) return { ok: false, reason: 'max_trades_per_day' };
  if (d.lastLossAt && now - d.lastLossAt < cfg.risk.cooldown_after_loss_min * 60_000) {
    const left = Math.ceil((cfg.risk.cooldown_after_loss_min * 60_000 - (now - d.lastLossAt)) / 60_000);
    return { ok: false, reason: `kayıp sonrası cooldown (${left} dk)` };
  }
  if ((d.realized[chain] ?? 0) >= r.daily_profit_target) return { ok: false, reason: 'günlük kâr hedefi doldu' };

  const worst = cfg.risk.assumed_worst_loss_pct / 100;
  const realizedLoss = Math.max(0, -(d.realized[chain] ?? 0));
  const openRisk = open.filter((p) => p.chain === chain).reduce((s, p) => s + p.sizeNative * worst, 0);
  const cap = dailyCap(chain);
  if (realizedLoss + openRisk + size * worst > cap + 1e-9)
    return {
      ok: false,
      reason: `risk bütçesi: ${(realizedLoss + openRisk).toFixed(4)} + ${(size * worst).toFixed(4)} > ${cap.toFixed(4)}`,
    };

  return { ok: true };
}

function halt(reason: string) {
  state.haltedDay = utcDay();
  state.haltReason = reason;
  return reason;
}

// Pozisyon kapanınca çağrılır; günlük durdurmaları burada tetikler.
export function onClosed(chain: Chain, pnl: number): string | null {
  rollDay();
  const r = riskFor(chain);
  const d = state.daily;
  d.realized[chain] = (d.realized[chain] ?? 0) + pnl;
  if (pnl < 0) {
    d.consecutiveLosses++;
    d.lastLossAt = Date.now();
  } else d.consecutiveLosses = 0;

  if (-(d.realized[chain] ?? 0) >= dailyCap(chain)) return halt(`${chain} günlük kayıp limiti (${d.realized[chain].toFixed(4)})`);
  if ((d.realized[chain] ?? 0) >= r.daily_profit_target) return halt(`${chain} günlük kâr hedefi (+${d.realized[chain].toFixed(4)})`);
  if (d.consecutiveLosses >= cfg.risk.max_consecutive_losses) return halt(`${d.consecutiveLosses} ardışık kayıp`);
  return null;
}
