import fs from 'node:fs';
import path from 'node:path';
import { CHAINS, DATA_DIR, riskFor, type Chain } from './config.js';
import type { Position } from './types.js';
import { utcDay } from './util.js';

interface Daily {
  day: string;
  realized: Record<Chain, number>;
  trades: number;
  consecutiveLosses: number;
  lastLossAt: number;
}

export interface State {
  positions: Position[];
  paperBalance: Record<Chain, number>;
  daily: Daily;
  paused: boolean;
  pauseReason?: string;
  haltedDay?: string; // günlük cap/kâr hedefi/seri kayıp → bu gün yeni giriş yok
  haltReason?: string;
  riskScale?: Partial<Record<Chain, number>>; // Sabah Raporu önerisi (auto_scale) — 1 = config tavanı
}

const FILE = path.join(DATA_DIR, 'state.json');

const freshDaily = (): Daily => ({ day: utcDay(), realized: Object.fromEntries(CHAINS.map((c) => [c, 0])) as Record<Chain, number>, trades: 0, consecutiveLosses: 0, lastLossAt: 0 });

function load(): State {
  if (fs.existsSync(FILE)) {
    // yeni eklenen ağlar (ör. base) eski state.json'da yok → varsayılanla tamamla
    const s: State = JSON.parse(fs.readFileSync(FILE, 'utf8'));
    for (const c of CHAINS) {
      s.paperBalance[c] ??= riskFor(c).paper_start_balance;
      s.daily.realized[c] ??= 0;
    }
    return s;
  }
  return {
    positions: [],
    paperBalance: Object.fromEntries(CHAINS.map((c) => [c, riskFor(c).paper_start_balance])) as Record<Chain, number>,
    daily: freshDaily(),
    paused: false,
  };
}

export const state: State = load();

export function rollDay() {
  if (state.daily.day !== utcDay()) {
    state.daily = freshDaily();
    save();
  }
}

export function save() {
  const tmp = FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(state, null, 2));
  fs.renameSync(tmp, FILE);
}

export const openPositions = () => state.positions.filter((p) => p.status !== 'closed');
