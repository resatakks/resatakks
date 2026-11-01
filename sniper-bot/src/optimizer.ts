// Filtre + çıkış optimizasyonu (walk-forward) ve gölge-paper simülasyonu.
// Config'i ASLA otomatik değiştirmez; yalnız öneri üretir. Yalnız botun KENDİ kayıtlarından öğrenir
// (candidates/outcomes/trades.jsonl) — dışarıdan hazır cüzdan/sinyal listesi kullanılmaz.
import { cfg, filtersFor, type Chain, type Config } from './config.js';
import { evaluate } from './filters.js';
import { signalTrapScore } from './trap.js';
import type { Metrics } from './types.js';
import { readJsonl, utcDay } from './util.js';

type Filters = Config['filters'];
type Exit = Pick<Config['exit'], 'take_profit_pct' | 'stop_loss_pct' | 'trailing_activate_pct' | 'trailing_distance_pct' | 'max_hold_min'>;
type Path = [number, number][];

export interface Row {
  ts: string;
  key: string;
  symbol: string;
  stage: string;
  fails: string[];
  metrics: Metrics;
  path: Path;
  done: boolean; // izleme süresi doldu mu
  launchpad?: string;
}

const MIN_N_TRAIN = 20;
const MIN_N_TEST = 8;
export const rowChain = (r: Row) => r.key.slice(0, r.key.indexOf(':')) as Chain;
export const COST_PCT = cfg.exec.paper_extra_slippage_pct * 2 + 1.5; // gidiş-dönüş slippage + ücret varsayımı

// candidates.jsonl + outcomes.jsonl (+ istenirse devam eden izleme yolları) → satırlar
export function loadRows(inProgress: { chain: string; token: string; path: Path }[] = []): Row[] {
  const paths = new Map<string, { path: Path; done: boolean }>();
  for (const t of inProgress) paths.set(`${t.chain}:${t.token}`, { path: t.path, done: false });
  for (const o of readJsonl<any>('outcomes.jsonl')) paths.set(`${o.chain}:${o.token}`, { path: o.path, done: true });
  const seen = new Set<string>();
  const rows: Row[] = [];
  for (const c of readJsonl<any>('candidates.jsonl')) {
    const key = `${c.chain}:${c.token}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const p = paths.get(key);
    // trap skoru güncel ağırlıklarla yeniden hesaplanır → eski kayıtlar da yeni kurallarla değerlendirilir
    const metrics = c.metrics?.trapScore != null ? { ...c.metrics, trapScore: signalTrapScore(c.metrics).score } : c.metrics;
    rows.push({ ts: c.ts, key, symbol: c.symbol, stage: c.stage, fails: c.fails ?? [], metrics, path: p?.path ?? [], done: p?.done ?? false, launchpad: c.launchpad ?? c.dex });
  }
  return rows;
}

export function simulate(p: Path, e: Exit): number {
  let peak = 0;
  for (const [min, pct] of p) {
    if (min > e.max_hold_min) return pct - COST_PCT;
    peak = Math.max(peak, pct);
    if (pct >= e.take_profit_pct) return e.take_profit_pct - COST_PCT;
    if (pct <= -e.stop_loss_pct) return Math.max(pct, -100) - COST_PCT; // 5 dk örneklemede gap'i olduğu gibi yaz
    const peakVal = 1 + peak / 100;
    if (peak >= e.trailing_activate_pct && 1 + pct / 100 <= peakVal * (1 - e.trailing_distance_pct / 100)) return pct - COST_PCT;
  }
  return p[p.length - 1][1] - COST_PCT;
}

export interface Score {
  n: number;
  win: number;
  avg: number;
  pf: number;
  total: number;
}

export function scoreResults(r: number[]): Score {
  const wins = r.filter((x) => x > 0);
  const loss = r.filter((x) => x <= 0).reduce((s, x) => s - x, 0);
  const total = r.reduce((s, x) => s + x, 0);
  return { n: r.length, win: r.length ? wins.length / r.length : 0, avg: r.length ? total / r.length : 0, pf: loss ? wins.reduce((s, x) => s + x, 0) / loss : Infinity, total };
}

// f verilmezse her satır kendi ağının filtresiyle (filtersFor) değerlendirilir.
export const passes = (r: Row, f?: Filters) => evaluate(r.metrics, f ?? filtersFor(rowChain(r))).length === 0;

export function score(set: Row[], f: Filters | undefined, e: Exit): Score {
  return scoreResults(set.filter((x) => x.path.length && passes(x, f)).map((x) => simulate(x.path, e)));
}

// Az örnekle şişmiş ortalamayı cezalandır.
const objective = (s: Score) => (s.n < MIN_N_TRAIN ? -Infinity : s.avg * Math.sqrt(s.n));

export function* grid<T extends object>(base: T, axes: Partial<Record<keyof T, number[]>>): Generator<T> {
  const keys = Object.keys(axes) as (keyof T)[];
  const idx = keys.map(() => 0);
  for (;;) {
    const o = { ...base };
    keys.forEach((k, i) => ((o as any)[k] = axes[k]![idx[i]]));
    yield o;
    let i = 0;
    while (i < keys.length && ++idx[i] >= axes[keys[i]]!.length) idx[i++] = 0;
    if (i === keys.length) return;
  }
}

export const fmtScore = (s: Score) =>
  `n=${s.n} win=${(s.win * 100).toFixed(0)}% avg=${s.avg.toFixed(1)}% pf=${s.pf === Infinity ? '∞' : s.pf.toFixed(2)} toplam=${s.total.toFixed(0)}%`;

export interface OptResult {
  report: string;
  diff: string[];
  accept: boolean;
  rows: number;
  curTest: Score;
  newTest: Score;
}

// chain verilirse yalnız o ağın satırları + filtersFor(chain) → öneriler chain_filters.<chain>.* olarak yazılır.
export function runOptimization(all: Row[] = loadRows(), chain?: Chain): OptResult {
  const rows = all.filter((r) => r.done && r.path.length && (!chain || rowChain(r) === chain));
  const cut = Date.now() - 7 * 86_400_000;
  const train = rows.filter((r) => Date.parse(r.ts) < cut);
  const test = rows.filter((r) => Date.parse(r.ts) >= cut);
  const curF = chain ? filtersFor(chain) : cfg.filters;
  const curE: Exit = cfg.exit;
  const fKey = chain ? `chain_filters.${chain}` : 'filters';

  // 1) Filtreler (mevcut çıkışla)
  let bestF = curF;
  let bestFs = -Infinity;
  for (const f of grid(curF, {
    min_liquidity_usd: [5000, 8000, 12000, 20000],
    max_top10_pct: [20, 24, 28, 32],
    max_sniper_pct: [20, 25, 30, 40],
    min_smart_entries: [1, 2, 3],
    min_holder_growth_pct: [0, 0.1, 1, 3],
  })) {
    const s = objective(score(train, f, curE));
    if (s > bestFs) [bestF, bestFs] = [f, s];
  }
  // 1b) Tuzak eşikleri (en iyi temel filtrenin üstüne; ayrı ızgara → kombinasyon patlaması yok)
  for (const f of grid(bestF, {
    max_trap_score: [40, 50, 60, 70],
    max_early_dump_pct: [30, 45, 60],
    max_dev_sold_pct: [10, 20, 35],
    max_bundled_pct: [20, 30, 45],
  })) {
    const s = objective(score(train, f, curE));
    if (s > bestFs) [bestF, bestFs] = [f, s];
  }
  // 1c) Senkron cüzdan eşikleri
  for (const f of grid(bestF, {
    max_sync_trade_pct: [45, 55, 70],
    max_sync_repeat_wallets: [2, 3, 5],
    max_sync_rug_link_pct: [15, 25, 40],
  })) {
    const s = objective(score(train, f, curE));
    if (s > bestFs) [bestF, bestFs] = [f, s];
  }
  // 1d) Fonlama kümesi eşikleri
  for (const f of grid(bestF, {
    max_common_funder_pct: [20, 30, 45],
    max_fund_dev_pct: [5, 10, 20],
    max_fresh_wallet_pct: [40, 60, 80],
    max_launchpad_dump_pct: [45, 60, 75],
  })) {
    const s = objective(score(train, f, curE));
    if (s > bestFs) [bestF, bestFs] = [f, s];
  }

  // 2) Çıkışlar (en iyi filtreyle)
  let bestE = curE;
  let bestEs = -Infinity;
  for (const e of grid(curE, {
    take_profit_pct: [35, 55, 80, 120],
    stop_loss_pct: [15, 22, 30],
    trailing_activate_pct: [15, 25, 40],
    trailing_distance_pct: [8, 12, 18],
    max_hold_min: [60, 120, 240],
  })) {
    const s = objective(score(train, bestF, e));
    if (s > bestEs) [bestE, bestEs] = [e, s];
  }

  const curTrain = score(train, curF, curE);
  const curTest = score(test, curF, curE);
  const newTrain = score(train, bestF, bestE);
  const newTest = score(test, bestF, bestE);

  const diff: string[] = [];
  for (const k of Object.keys(bestF) as (keyof Filters)[]) if (bestF[k] !== curF[k]) diff.push(`${fKey}.${k}: ${curF[k]} → ${bestF[k]}`);
  for (const k of Object.keys(bestE) as (keyof Exit)[]) if (bestE[k] !== curE[k]) diff.push(`exit.${k}: ${curE[k]} → ${bestE[k]}`);

  const accept = diff.length > 0 && newTest.n >= MIN_N_TEST && newTest.avg > curTest.avg && newTest.avg > 0;
  const enough = train.length >= MIN_N_TRAIN;
  const report = [
    `# Optimizasyon ${utcDay()}${chain ? ` · ${chain}` : ''}`,
    `veri: ${rows.length} aday (train ${train.length} / test son 7 gün ${test.length}), maliyet varsayımı ${COST_PCT}%`,
    '',
    `mevcut  train: ${fmtScore(curTrain)}`,
    `mevcut  test : ${fmtScore(curTest)}`,
    `öneri   train: ${fmtScore(newTrain)}`,
    `öneri   test : ${fmtScore(newTest)}`,
    '',
    `## önerilen değişiklik`,
    diff.length ? diff.map((d) => `- ${d}`).join('\n') : enough ? '- yok' : `- yok (train örneği < ${MIN_N_TRAIN})`,
    '',
    `## karar: ${accept ? 'UYGULA (test dönemi de iyileşiyor)' : 'UYGULAMA (test iyileşmiyor veya örnek az)'}`,
    '',
    `## mevcut filtrelerde eleme nedenleri`,
    ...rejectCounts(all).map(([k, v]) => `- ${k}: ${v}`),
  ].join('\n');

  return { report, diff, accept, rows: rows.length, curTest, newTest };
}

export function rejectCounts(rows: Row[], f?: Filters): [string, number][] {
  const m = new Map<string, number>();
  for (const r of rows) for (const reason of evaluate(r.metrics, f ?? filtersFor(rowChain(r)))) m.set(reason, (m.get(reason) ?? 0) + 1);
  return [...m.entries()].sort((a, b) => b[1] - a[1]);
}

// Gölge paper: filtreyi geçen HER aday (risk kapısı engellese bile) mevcut çıkış kurallarıyla simüle edilir.
// Bitmemiş yolda sonuç "şu ana kadar" değeridir.
export interface Shadow {
  candidates: number;
  passed: number;
  rejects: [string, number][];
  trades: { symbol: string; key: string; pct: number; done: boolean }[];
  score: Score;
  probePnlNative: number; // her girişin probe_max ile yapıldığı varsayımı
}

export function shadowSince(sinceMs: number, rows: Row[], probe = cfg.risk.sol.probe_max): Shadow {
  const win = rows.filter((r) => Date.parse(r.ts) >= sinceMs);
  const passed = win.filter((r) => passes(r));
  const trades = passed
    .filter((r) => r.path.length)
    .map((r) => ({ symbol: r.symbol, key: r.key, pct: simulate(r.path, cfg.exit), done: r.done }));
  const s = scoreResults(trades.map((t) => t.pct));
  return {
    candidates: win.length,
    passed: passed.length,
    rejects: rejectCounts(win),
    trades,
    score: s,
    probePnlNative: trades.reduce((sum, t) => sum + (probe * t.pct) / 100, 0),
  };
}
