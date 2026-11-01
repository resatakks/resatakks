// Sabah Raporu analiz bölümleri. Hepsi botun KENDİ kayıtlarından (candidates/outcomes/early_buyers/trades.jsonl)
// türetilen geçmiş-veri TAHMİNLERİDİR; yatırım tavsiyesi değildir.
// "Önerilen günlük max risk" = config daily_loss_cap × veri-temelli ölçek (yalnız küçültür) → mekanik limit.
import { CHAINS, cfg, filtersFor, nativeSymbol, riskFor, type Chain } from './config.js';
import { evaluate } from './filters.js';
import { grid, rowChain, scoreResults, shadowSince, simulate, type Row } from './optimizer.js';
import { save, state } from './state.js';
import { readJsonl } from './util.js';

const DAY = 86_400_000;
const enabledChains = () => CHAINS.filter((c) => cfg.chains[c].enabled);
const isRug = (r: Row) => r.path.some(([, p]) => p <= -80);
const isPump = (r: Row) => r.path.some(([, p]) => p >= 50);
const pct = (a: number, b: number) => (b ? (a / b) * 100 : 0);
const sign = (x: number, d = 4) => `${x >= 0 ? '+' : ''}${x.toFixed(d)}`;
const reasonsOf = (r: Row) => evaluate(r.metrics, filtersFor(rowChain(r)));
const ofChain = (rows: Row[], c: Chain) => rows.filter((r) => rowChain(r) === c);

export const TRAP_REASONS = new Set([
  'trap_score', 'trap_wallet', 'dev_sell', 'dev_serial', 'early_dump', 'rug_cluster', 'bundle', 'sniper_flip', 'sniper_rug_link', 'wash_trading',
  'dev_sniper_hybrid', 'smart_trap', 'wash_ring', 'insider_exit', 'rug_ring', 'sync_swarm', 'coordinated_dump', 'funding_cluster', 'coordinated_group', 'smart_sync',
]);
const COMBO = ['dev_sniper_hybrid', 'smart_trap', 'wash_ring', 'insider_exit', 'rug_ring', 'coordinated_dump', 'coordinated_group', 'trap_wallet'];
const SECURITY = new Set(['honeypot', 'top10', 'lp_lock', 'renounce', 'sell_tax', 'buy_tax']);

const DEFAULT_USD = { sol: 160, bnb: 600, eth: 3000, mon: 0.019 } as const;
const riskKey = (c: Chain) => nativeSymbol(c).toLowerCase() as keyof typeof DEFAULT_USD;
export const toUsd = (c: Chain, native: number) => native * (cfg.nightly.usd_ref?.[riskKey(c)] ?? DEFAULT_USD[riskKey(c)]);

function realCloses(c: Chain, fromMs: number, toMs = Infinity) {
  return readJsonl<any>('trades.jsonl').filter((t) => t.ev === 'close' && t.chain === c && Date.parse(t.ts) >= fromMs && Date.parse(t.ts) < toMs);
}

// ---------- Detaylı tuzak analizi (ağ bazında + tuzak filtresinin isabeti) ----------
export function trapDetail(rows: Row[], since: number): string[] {
  const L = ['🔬 <b>Detaylı tuzak analizi</b> (ağ bazında)'];
  for (const c of enabledChains()) {
    const win = ofChain(rows, c).filter((r) => Date.parse(r.ts) >= since);
    const trapped = win.filter((r) => reasonsOf(r).some((x) => TRAP_REASONS.has(x)));
    const combo = new Map<string, number>();
    for (const r of win) for (const x of reasonsOf(r)) if (COMBO.includes(x)) combo.set(x, (combo.get(x) ?? 0) + 1);
    L.push(`${c}: gece ${win.length} aday · tuzakla elenen ${trapped.length} (%${pct(trapped.length, win.length).toFixed(0)})`);
    if (combo.size) L.push(`  kombo/oto-eleme: ${[...combo].map(([k, v]) => `${k} ${v}`).join(', ')}`);

    // İsabet: geçmişte tuzakla elenen ve izlemesi biten adaylar gerçekten ne oldu?
    const hist = ofChain(rows, c).filter((r) => r.done && r.path.length && Date.parse(r.ts) >= Date.now() - 14 * DAY);
    const elim = hist.filter((r) => reasonsOf(r).some((x) => TRAP_REASONS.has(x)));
    const pass = hist.filter((r) => reasonsOf(r).length === 0);
    if (elim.length >= 5) {
      L.push(
        `  isabet (14g, ${elim.length} elenen): rug oldu %${pct(elim.filter(isRug).length, elim.length).toFixed(0)} · ` +
          `+%50 yaptı (kaçırılan) %${pct(elim.filter(isPump).length, elim.length).toFixed(0)}` +
          (pass.length ? ` · geçenlerde rug %${pct(pass.filter(isRug).length, pass.length).toFixed(0)}` : ''),
      );
    } else L.push(`  isabet: veri az (${elim.length} biten elenen aday; ≥5 gerekir)`);
  }
  return L;
}

// ---------- Aynı anda birden fazla cüzdan (senkron blok) ----------
// Aday başına son ~100 swap'ta aynı slot/blokta aynı yönde ≥3 cüzdan; yüksek = koordineli cüzdan ≥ max_sync_repeat_wallets.
export function syncSection(rows: Row[], since: number): string[] {
  const L = ['👥 <b>Senkron cüzdan analizi</b> (aynı slot/blokta ≥3 cüzdan aynı yönde)'];
  for (const c of enabledChains()) {
    const f = filtersFor(c);
    const hi = (r: Row) => (r.metrics.syncRepeatWallets ?? 0) >= (f.max_sync_repeat_wallets ?? 3);
    const win = ofChain(rows, c).filter((r) => Date.parse(r.ts) >= since && r.metrics.syncTradePct != null);
    if (!win.length) {
      L.push(`${c}: senkron verisi yok (wash kontrolüne giren aday 0)`);
      continue;
    }
    const avg = win.reduce((s, r) => s + (r.metrics.syncTradePct ?? 0), 0) / win.length;
    const swarm = win.filter((r) => reasonsOf(r).includes('sync_swarm')).length;
    const coord = win.filter((r) => reasonsOf(r).includes('coordinated_dump')).length;
    L.push(`${c}: ${win.length} aday · ort. senkron trade %${avg.toFixed(0)} · koordineli grup ${win.filter(hi).length} · sync_swarm ${swarm} · coordinated_dump ${coord}`);
    const done = ofChain(rows, c).filter((r) => r.done && r.path.length && r.metrics.syncTradePct != null && Date.parse(r.ts) >= Date.now() - 14 * DAY);
    const a = done.filter(hi), b = done.filter((r) => !hi(r));
    if (a.length >= 3 && b.length >= 3)
      L.push(`  14g: koordineli grupta rug %${pct(a.filter(isRug).length, a.length).toFixed(0)} (${a.length}) vs diğerleri %${pct(b.filter(isRug).length, b.length).toFixed(0)} (${b.length})`);
    else L.push(`  14g isabet: veri az (koordineli ${a.length} / diğer ${b.length} biten; ikisi de ≥3 gerekir)`);
  }
  // En çok token'da senkron görülen cüzdanlar (sync_groups.jsonl) + kaçı rug
  const rugged = new Set(rows.filter((r) => r.done && isRug(r)).map((r) => r.key));
  const byW = new Map<string, Set<string>>();
  for (const g of readJsonl<any>('sync_groups.jsonl')) for (const w of g.wallets ?? []) (byW.get(`${g.chain}:${w}`) ?? byW.set(`${g.chain}:${w}`, new Set()).get(`${g.chain}:${w}`)!).add(`${g.chain}:${g.token}`);
  const top = [...byW].filter(([, t]) => t.size >= 2).sort((x, y) => y[1].size - x[1].size).slice(0, 8);
  if (top.length) {
    L.push('tekrarlayan senkron cüzdanlar (token / rug):');
    for (const [w, t] of top) L.push(`  · <code>${w}</code> ${t.size} / ${[...t].filter((k) => rugged.has(k)).length}`);
  } else L.push('tekrarlayan senkron cüzdan yok (≥2 token gerekir)');
  return L;
}

// ---------- Koordineli cüzdan grubu (fonlama kümesi) ----------
export function fundingSection(rows: Row[], since: number): string[] {
  const L = ['🧬 <b>Fonlama kümesi</b> (erken alıcıları aynı cüzdan / dev mi fonladı?)'];
  for (const c of enabledChains()) {
    const win = ofChain(rows, c).filter((r) => Date.parse(r.ts) >= since && r.metrics.fundCommonPct != null);
    if (!win.length) {
      L.push(`${c}: fonlama verisi yok (sniper kontrolüne giren aday 0${c === 'blast' ? '; Blast Etherscan v2\'de yok' : c !== 'solana' ? ' ya da ETHERSCAN_API_KEY yok' : ''})`);
      continue;
    }
    const avg = (k: 'fundCommonPct' | 'fundFreshPct') => win.reduce((s, r) => s + (r.metrics[k] ?? 0), 0) / win.length;
    const cl = win.filter((r) => reasonsOf(r).includes('funding_cluster')).length;
    const cg = win.filter((r) => reasonsOf(r).includes('coordinated_group')).length;
    L.push(`${c}: ${win.length} aday · ort. ortak fonlayıcı %${avg('fundCommonPct').toFixed(0)} · taze cüzdan %${avg('fundFreshPct').toFixed(0)} · dev-fonlu ${win.filter((r) => (r.metrics.fundDevPct ?? 0) > 0).length} · funding_cluster ${cl} · coordinated_group ${cg}`);
    const done = ofChain(rows, c).filter((r) => r.done && r.path.length && r.metrics.fundCommonPct != null && Date.parse(r.ts) >= Date.now() - 14 * DAY);
    const a = done.filter((r) => (r.metrics.fundCommonPct ?? 0) >= 20), b = done.filter((r) => (r.metrics.fundCommonPct ?? 0) < 20);
    if (a.length >= 3 && b.length >= 3)
      L.push(`  14g: ortak fonlayıcı ≥%20 olanlarda rug %${pct(a.filter(isRug).length, a.length).toFixed(0)} (${a.length}) vs diğerleri %${pct(b.filter(isRug).length, b.length).toFixed(0)} (${b.length})`);
    else L.push(`  14g isabet: veri az (kümeli ${a.length} / diğer ${b.length} biten; ikisi de ≥3 gerekir)`);
  }
  const rugged = new Set(rows.filter((r) => r.done && isRug(r)).map((r) => r.key));
  const byF = new Map<string, Set<string>>();
  for (const g of readJsonl<any>('funders.jsonl')) (byF.get(`${g.chain}:${g.funder}`) ?? byF.set(`${g.chain}:${g.funder}`, new Set()).get(`${g.chain}:${g.funder}`)!).add(`${g.chain}:${g.token}`);
  const top = [...byF].filter(([, t]) => t.size >= 2).sort((x, y) => y[1].size - x[1].size).slice(0, 8);
  if (top.length) {
    L.push('tekrarlayan fonlayıcılar (token / rug):');
    for (const [w, t] of top) L.push(`  · <code>${w}</code> ${t.size} / ${[...t].filter((k) => rugged.has(k)).length}`);
  } else L.push('tekrarlayan fonlayıcı yok (≥2 token gerekir)');
  return L;
}

// ---------- Rug isabet oranı (14g, ağ bazında) ----------
// yakalama = rug olan adayların kaçı elendi · kesinlik = elenenlerin kaçı gerçekten rug · sızan = filtreyi geçip rug olan
export function rugHitSection(rows: Row[]): string[] {
  const L = ['🎯 <b>Rug isabet oranı</b> (14g, izlemesi biten adaylar)'];
  for (const c of enabledChains()) {
    const hist = ofChain(rows, c).filter((r) => r.done && r.path.length && Date.parse(r.ts) >= Date.now() - 14 * DAY);
    if (hist.length < 10) {
      L.push(`${c}: veri az (${hist.length} biten aday; ≥10 gerekir)`);
      continue;
    }
    const rugs = hist.filter(isRug);
    const elim = hist.filter((r) => reasonsOf(r).length);
    const pass = hist.filter((r) => !reasonsOf(r).length);
    const caught = rugs.filter((r) => reasonsOf(r).length).length;
    const trapCaught = rugs.filter((r) => reasonsOf(r).some((x) => TRAP_REASONS.has(x))).length;
    const leaked = pass.filter(isRug);
    L.push(
      `${c}: ${hist.length} aday · rug ${rugs.length} (%${pct(rugs.length, hist.length).toFixed(0)}) · yakalama %${pct(caught, rugs.length).toFixed(0)} (tuzak filtreleriyle %${pct(trapCaught, rugs.length).toFixed(0)}) · ` +
        `kesinlik %${pct(elim.filter(isRug).length, elim.length).toFixed(0)} · geçen ${pass.length}, sızan rug ${leaked.length}`,
    );
    for (const r of leaked.slice(0, 3)) L.push(`  sızan: ${r.symbol} (${r.launchpad ?? '?'}) trap ${Math.round(r.metrics.trapScore ?? 0)}`);
  }
  return L;
}

// ---------- Kaçırılan yükselişler: elenip +%50 yapanlar ve filtre başına maliyet/fayda ----------
export function missedSection(rows: Row[], since: number): string[] {
  const L = ['🚀 <b>Kaçırılan yükselişler</b> (elenip ≥+%50 yapan adaylar)'];
  const maxPct = (r: Row) => Math.max(...r.path.map(([, p]) => p));
  const win = rows.filter((r) => Date.parse(r.ts) >= since && r.path.length && isPump(r) && reasonsOf(r).length);
  if (!win.length) L.push('pencerede elenip pump yapan aday yok');
  for (const r of win.sort((a, b) => maxPct(b) - maxPct(a)).slice(0, 10)) {
    const rug = isRug(r) ? ' → sonra rug' : '';
    L.push(`  · ${r.symbol} (${rowChain(r)}/${r.launchpad ?? '?'}) max +%${maxPct(r).toFixed(0)}${rug} · ${reasonsOf(r).slice(0, 4).join(', ')}`);
  }
  if (win.length > 10) L.push(`  … +${win.length - 10} daha`);
  // 14g filtre karnesi: tek başına elediği (tek sebep) adaylarda kaçırılan pump vs önlenen rug
  const hist = rows.filter((r) => r.done && r.path.length && Date.parse(r.ts) >= Date.now() - 14 * DAY);
  const by = new Map<string, { n: number; solo: number; pump: number; rug: number; soloPump: number; soloRug: number }>();
  for (const r of hist) {
    const rs = reasonsOf(r);
    for (const k of rs) {
      const e = by.get(k) ?? by.set(k, { n: 0, solo: 0, pump: 0, rug: 0, soloPump: 0, soloRug: 0 }).get(k)!;
      e.n++;
      if (isPump(r) && !isRug(r)) e.pump++;
      if (isRug(r)) e.rug++;
      if (rs.length === 1) {
        e.solo++;
        if (isPump(r) && !isRug(r)) e.soloPump++;
        if (isRug(r)) e.soloRug++;
      }
    }
  }
  const tab = [...by].filter(([, e]) => e.n >= 5).sort((a, b) => b[1].soloPump - a[1].soloPump || b[1].n - a[1].n).slice(0, 12);
  if (!tab.length) return [...L, 'filtre karnesi (14g): veri az (sebep başına ≥5 biten aday gerekir)'];
  L.push('filtre karnesi (14g · sebep: elenen → pump/rug · tek sebep olduğunda → pump/rug):');
  for (const [k, e] of tab) {
    const warn = e.solo >= 5 && e.soloPump > e.soloRug ? ' ⚠️ tek başına daha çok pump kaçırıyor' : '';
    L.push(`  · ${k}: ${e.n} → %${pct(e.pump, e.n).toFixed(0)}/%${pct(e.rug, e.n).toFixed(0)} · tek ${e.solo} → ${e.soloPump}/${e.soloRug}${warn}`);
  }
  L.push('pump = zirve ≥+%50 ve sonra −%80 görmedi; ileri dönük garanti değil, gevşetme kararı /rapor config önerisine bırakılır.');
  return L;
}

// ---------- Önerilen günlük max risk (mekanik limit) ----------
export function riskBudget(c: Chain, rows: Row[], since: number): { scale: number; capNative: number; notes: string[] } {
  const r = riskFor(c);
  const mine = ofChain(rows, c);
  const notes: string[] = [];
  let scale = 1;
  const cut = (f: number, why: string) => {
    scale *= f;
    notes.push(`${why} ×${f}`);
  };
  const sh7 = shadowSince(Date.now() - 7 * DAY, mine, r.probe_max);
  if (sh7.score.n < 5) cut(0.75, `az veri (7g gölge ${sh7.score.n} işlem)`);
  else if (sh7.score.avg < 0) cut(0.5, `7g gölge ort ${sh7.score.avg.toFixed(1)}%`);

  const night = mine.filter((x) => Date.parse(x.ts) >= since);
  const trapRate = pct(night.filter((x) => reasonsOf(x).some((y) => TRAP_REASONS.has(y))).length, night.length);
  if (night.length >= 5 && trapRate >= 50) cut(0.75, `gece tuzak oranı %${trapRate.toFixed(0)}`);

  const prev = realCloses(c, since - DAY, since).reduce((s, t) => s + Number(t.pnl ?? 0), 0);
  if (prev <= -r.daily_loss_cap * 0.999) cut(0.5, `dün kayıp limiti doldu`);

  const last3 = realCloses(c, 0).slice(-3);
  if (last3.length === 3 && last3.every((t) => Number(t.pnl ?? 0) < 0)) cut(0.5, `son 3 gerçek işlem zarar`);

  scale = Math.min(1, Math.max(cfg.risk.min_scale ?? 0.25, scale));
  if (cfg.risk.auto_scale) {
    state.riskScale = { ...(state.riskScale ?? {}), [c]: scale };
    save();
  }
  return { scale, capNative: r.daily_loss_cap * scale, notes };
}

export function riskSection(rows: Row[], since: number): string[] {
  const L = ['🧯 <b>Önerilen günlük max risk</b> (mekanik limit: config tavanı × veri ölçeği; tavsiye değil)'];
  for (const c of enabledChains()) {
    const r = riskFor(c);
    const b = riskBudget(c, rows, since);
    const worst = r.probe_max * (cfg.risk.assumed_worst_loss_pct / 100);
    const probes = worst > 0 ? Math.floor(b.capNative / worst) : 0;
    L.push(
      `${c}${cfg.chains[c].paper_only ? ' (paper)' : ''}: ${b.capNative.toFixed(4)} ${nativeSymbol(c)} ≈ $${toUsd(c, b.capNative).toFixed(1)} ` +
        `(ölçek ${b.scale.toFixed(2)}) · ≈${probes} probe'luk kötü senaryo kaybı`,
    );
    if (b.notes.length) L.push(`  neden: ${b.notes.join(' · ')}`);
  }
  L.push(cfg.risk.auto_scale ? 'auto_scale açık → bugünkü daily_loss_cap bu ölçekle küçültüldü (asla büyütülmez).' : 'auto_scale kapalı → yalnız bilgi.');
  return L;
}

// ---------- Bugün hangi ağda daha fazla fırsat var (son 24 saat) ----------
export function opportunitySection(rows: Row[]): string[] {
  const since = Date.now() - DAY;
  const out = enabledChains().map((c) => {
    const win = ofChain(rows, c).filter((r) => Date.parse(r.ts) >= since);
    const secPass = win.filter((r) => !reasonsOf(r).some((x) => SECURITY.has(x))).length;
    const passed = win.filter((r) => reasonsOf(r).length === 0);
    const done = win.filter((r) => r.done && r.path.length);
    const rug = pct(done.filter(isRug).length, done.length) / 100;
    const pump = pct(done.filter(isPump).length, done.length) / 100;
    const sh = scoreResults(passed.filter((r) => r.path.length).map((r) => simulate(r.path, cfg.exit)));
    return { c, n: win.length, secPass, passed: passed.length, done: done.length, rug, pump, sh, score: pump * (1 - rug) * Math.log(1 + secPass) };
  });
  const L = ['🎯 <b>Bugün hangi ağda daha fazla fırsat var</b> (son 24 sa, tahmin)'];
  for (const o of [...out].sort((a, b) => b.score - a.score))
    L.push(
      `${o.c}: aday ${o.n} · güvenlik geçen ${o.secPass} · tüm filtre geçen ${o.passed} · ` +
        `biten ${o.done}: +%50 %${(o.pump * 100).toFixed(0)} / rug %${(o.rug * 100).toFixed(0)} · gölge ort ${o.sh.n ? o.sh.avg.toFixed(1) + '%' : '-'} · skor ${o.score.toFixed(2)}`,
    );
  const best = [...out].sort((a, b) => b.score - a.score)[0];
  if (best && best.done >= 5 && best.score > 0) L.push(`→ en yüksek fırsat skoru: <b>${best.c}</b> (pump × (1−rug) × log(1+güvenli aday))`);
  else L.push('→ karşılaştırma için yeterli biten aday yok (ağ başına ≥5).');
  return L;
}

// ---------- Launchpad / dex kırılımı (pump.fun benzeri platformlar dahil, son 24 sa) ----------
export function launchpadSection(rows: Row[]): string[] {
  const since = Date.now() - DAY;
  const by = new Map<string, Row[]>();
  for (const r of rows) {
    if (Date.parse(r.ts) < since) continue;
    const k = `${rowChain(r)}/${r.launchpad ?? '?'}`;
    (by.get(k) ?? by.set(k, []).get(k)!).push(r);
  }
  const L = ['🚀 <b>Launchpad kırılımı</b> (son 24 sa · köken dex → aday / geçen / biten +%50 / rug)'];
  if (!by.size) return [...L, 'veri yok'];
  const list = [...by].map(([k, rs]) => {
    const done = rs.filter((r) => r.done && r.path.length);
    return { k, n: rs.length, passed: rs.filter((r) => reasonsOf(r).length === 0).length, done: done.length, pump: pct(done.filter(isPump).length, done.length), rug: pct(done.filter(isRug).length, done.length) };
  });
  for (const o of list.sort((a, b) => b.n - a.n).slice(0, 10))
    L.push(`${o.k}: ${o.n} / ${o.passed} / ${o.done ? `%${o.pump.toFixed(0)}` : '-'} / ${o.done ? `%${o.rug.toFixed(0)}` : '-'}`);
  L.push('bonding curve havuzları (pump-fun, meteora-dbc…) LP olmadığı için mezun olana kadar likidite filtresinde kalır.');
  return L;
}

// ---------- Bugün hangi ağda daha az rekabet var (son 24 saat erken alıcı verisi) ----------
export function competitionSection(): string[] {
  const since = Date.now() - DAY;
  const all = readJsonl<any>('early_buyers.jsonl').filter((e) => Date.parse(e.ts) >= since);
  const out = enabledChains().map((c) => {
    const ev = all.filter((e) => e.chain === c);
    const tokens = new Map<string, number>();
    const walletTokens = new Map<string, Set<string>>();
    const heavy = new Set<string>();
    for (const e of ev) {
      tokens.set(e.token, (tokens.get(e.token) ?? 0) + 1);
      const w = String(e.wallet).toLowerCase();
      (walletTokens.get(w) ?? walletTokens.set(w, new Set()).get(w)!).add(e.token);
      if ((e.buys ?? 1) > 3) heavy.add(w);
    }
    const bots = [...walletTokens].filter(([w, t]) => t.size >= 3 || heavy.has(w)).length;
    const avgBuyers = tokens.size ? ev.length / tokens.size : 0;
    const bundled = pct(ev.filter((e) => e.bundled).length, ev.length);
    const flip = pct(ev.filter((e) => e.sold && (e.holdMin ?? Infinity) <= cfg.filters.quick_flip_min).length, ev.length);
    const botShare = pct(bots, walletTokens.size);
    const sniperCap = Math.max(1, filtersFor(c).sniper_max_buyers);
    const idx = 40 * Math.min(1, avgBuyers / sniperCap) + 0.3 * botShare + 0.2 * flip + 0.1 * bundled;
    return { c, tokens: tokens.size, avgBuyers, bundled, flip, botShare, idx };
  });
  const L = ['🏁 <b>Bugün hangi ağda daha az rekabet var</b> (son 24 sa erken alıcılardan tahmin; düşük = az rekabet)'];
  for (const o of [...out].sort((a, b) => a.idx - b.idx))
    if (o.tokens < 3) L.push(`${o.c}: veri az (${o.tokens} token)`);
    else L.push(
      `${o.c}: ${o.tokens} token · token başına erken alıcı ${o.avgBuyers.toFixed(1)} · sniper-bot payı %${o.botShare.toFixed(0)} · ` +
        `hızlı satış %${o.flip.toFixed(0)} · bundle %${o.bundled.toFixed(0)} → rekabet ${o.idx.toFixed(0)}/100`,
    );
  const ok = out.filter((o) => o.tokens >= 3).sort((a, b) => a.idx - b.idx);
  L.push(ok.length >= 2 ? `→ en az rekabet: <b>${ok[0].c}</b>` : '→ karşılaştırma için yeterli veri yok (ağ başına ≥3 token).');
  return L;
}

// ---------- En güvenli çıkış stratejisi (son 14 gün, geçen adayların gerçek fiyat yolları) ----------
const p25 = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(0.25 * (s.length - 1))] ?? 0;
};

export function safeExitSection(rows: Row[]): string[] {
  const L = ['🚪 <b>En güvenli çıkış stratejisi</b> (14g geçen adaylar; kötü çeyrek (p25) en iyi, ort > 0 şartı)'];
  for (const c of enabledChains()) {
    const set = ofChain(rows, c).filter((r) => r.done && r.path.length && Date.parse(r.ts) >= Date.now() - 14 * DAY && reasonsOf(r).length === 0);
    const cur = set.map((r) => simulate(r.path, cfg.exit));
    if (set.length < 8) {
      L.push(`${c}: veri az (${set.length} biten geçen aday; ≥8 gerekir) → mevcut exit kalır`);
    } else {
      let best: { e: typeof cfg.exit; p: number; avg: number } | null = null;
      for (const e of grid(cfg.exit, {
        take_profit_pct: [30, 50, 80, 120],
        stop_loss_pct: [10, 15, 20, 30],
        trailing_activate_pct: [15, 20, 30],
        trailing_distance_pct: [8, 12, 18],
        max_hold_min: [60, 120, 240],
      })) {
        const res = set.map((r) => simulate(r.path, e));
        const avg = res.reduce((s, x) => s + x, 0) / res.length;
        const p = p25(res);
        if (avg > 0 && (!best || p > best.p)) best = { e, p, avg };
      }
      const curAvg = cur.reduce((s, x) => s + x, 0) / cur.length;
      L.push(`${c} (n=${set.length}): mevcut p25 ${p25(cur).toFixed(1)}% ort ${curAvg.toFixed(1)}%`);
      L.push(
        best
          ? `  → TP ${best.e.take_profit_pct} · SL ${best.e.stop_loss_pct} · trailing ${best.e.trailing_activate_pct}/${best.e.trailing_distance_pct} · max ${best.e.max_hold_min} dk → p25 ${best.p.toFixed(1)}% ort ${best.avg.toFixed(1)}%`
          : '  → pozitif ortalamalı ayar yok → bu ağda gerçek giriş için veri desteği yok (paper kal)',
      );
    }
    const closes = realCloses(c, Date.now() - 14 * DAY);
    if (closes.length) {
      const m = new Map<string, { n: number; pnl: number }>();
      for (const t of closes) {
        const k = String(t.exitReason ?? '?');
        const v = m.get(k) ?? { n: 0, pnl: 0 };
        m.set(k, { n: v.n + 1, pnl: v.pnl + Number(t.pnl ?? 0) });
      }
      L.push(`  gerçek çıkışlar (14g): ${[...m].map(([k, v]) => `${k} ${v.n} (${sign(v.pnl)} ${nativeSymbol(c)})`).join(', ')}`);
    }
  }
  return L;
}
