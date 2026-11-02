// Tuzak tespiti: kendi geçmişinden (early_buyers / devs / wash_groups / outcomes / wallet_events)
// rug ortağı cüzdanları, wash halkalarını, dev+sniper hibritlerini ve tekrar eden rug kümelerini skorlar.
// Hem sinyal anında (scanner) hem raporda (nightly, discover-wallets) aynı skorlar kullanılır.
import { CHAINS, cfg, normAddr, wallets, type Chain } from './config.js';
import { loadRows } from './optimizer.js';
import { trapRisk } from './smartmoney.js';
import type { Metrics } from './types.js';
import { readJsonl } from './util.js';

export const RUG_MIN_PCT = -80;
const CACHE_MS = 10 * 60_000;

export const norm = normAddr;
const tk = (chain: string, token: string) => `${chain}:${norm(chain, token)}`;

interface WalletHist {
  chain: string;
  address: string;
  tokens: Set<string>; // erken alıcı olduğu token'lar
  rugTokens: Set<string>; // bunlardan rug olanlar
  soldInRug: number; // rug token'ında analiz anında zaten satmıştı
  maxBuys: number; // tek token'da ilk slot/bloklarda en fazla alım
  quickFlips: number;
  devOf: Set<string>; // dev olduğu token'lar
  devRugs: number;
  washTokens: Set<string>; // wash grubunda göründüğü token'lar
  syncTokens: Set<string>; // senkron (aynı blok, tekrarlayan) grupta göründüğü token'lar
  fundedTokens: Set<string>; // bu cüzdanın ≥2 erken alıcıyı fonladığı token'lar (funders.jsonl)
  rugPartners: Map<string, number>; // aynı rug'da birlikte erken alan cüzdan → kaç rug
}

interface Hist {
  at: number;
  finished: number;
  rugged: Set<string>;
  earlyByToken: Map<string, Set<string>>; // chain:token → erken alıcı (norm)
  wallets: Map<string, WalletHist>; // chain:wallet
}

let cache: Hist | null = null;

export function history(force = false): Hist {
  if (!force && cache && Date.now() - cache.at < CACHE_MS) return cache;
  const rugged = new Set<string>();
  let finished = 0;
  for (const o of readJsonl<any>('outcomes.jsonl')) {
    finished++;
    if (o.minPct <= RUG_MIN_PCT) rugged.add(tk(o.chain, o.token));
  }
  const ws = new Map<string, WalletHist>();
  const get = (chain: string, a: string) => {
    const k = `${chain}:${norm(chain, a)}`;
    let w = ws.get(k);
    if (!w)
      ws.set(
        k,
        (w = { chain, address: a, tokens: new Set(), rugTokens: new Set(), soldInRug: 0, maxBuys: 0, quickFlips: 0, devOf: new Set(), devRugs: 0, washTokens: new Set(), syncTokens: new Set(), fundedTokens: new Set(), rugPartners: new Map() }),
      );
    return w;
  };

  const earlyByToken = new Map<string, Set<string>>();
  for (const e of readJsonl<any>('early_buyers.jsonl')) {
    const t = tk(e.chain, e.token);
    const w = get(e.chain, e.wallet);
    if (w.tokens.has(t)) continue;
    w.tokens.add(t);
    w.maxBuys = Math.max(w.maxBuys, e.buys ?? 1);
    if (e.sold && (e.holdMin ?? Infinity) <= cfg.filters.quick_flip_min) w.quickFlips++;
    if (rugged.has(t)) {
      w.rugTokens.add(t);
      if (e.sold) w.soldInRug++;
    }
    (earlyByToken.get(t) ?? earlyByToken.set(t, new Set()).get(t)!).add(norm(e.chain, e.wallet));
  }
  for (const d of readJsonl<any>('devs.jsonl')) {
    if (!d.dev) continue;
    const w = get(d.chain, d.dev);
    const t = tk(d.chain, d.token);
    if (w.devOf.has(t)) continue;
    w.devOf.add(t);
    if (rugged.has(t)) w.devRugs++;
  }
  for (const g of readJsonl<any>('wash_groups.jsonl')) for (const a of g.wallets ?? []) get(g.chain, a).washTokens.add(tk(g.chain, g.token));
  for (const g of readJsonl<any>('funders.jsonl')) if (g.funder) get(g.chain, g.funder).fundedTokens.add(tk(g.chain, g.token));
  for (const g of readJsonl<any>('sync_groups.jsonl')) for (const a of g.wallets ?? []) get(g.chain, a).syncTokens.add(tk(g.chain, g.token));

  // rug kümeleri: aynı rug'da birlikte erken alan çiftler
  for (const t of rugged) {
    const set = [...(earlyByToken.get(t) ?? [])];
    const chain = t.slice(0, t.indexOf(':'));
    for (const a of set) {
      const w = ws.get(`${chain}:${a}`)!;
      for (const b of set) if (a !== b) w.rugPartners.set(b, (w.rugPartners.get(b) ?? 0) + 1);
    }
  }
  return (cache = { at: Date.now(), finished, rugged, earlyByToken, wallets: ws });
}

// ---------- cüzdan şüphe skoru (0–100) ----------
export type SuspectKind = 'rug_accomplice' | 'smart_trap' | 'sniper_bot' | 'dev_sniper' | 'serial_dev' | 'wash_ring' | 'rug_cluster' | 'sync_ring' | 'funder_ring';

export interface Suspect {
  chain: string;
  address: string;
  label?: string; // wallets.yaml'daysa
  score: number;
  kinds: SuspectKind[];
  reasons: string[];
}

export function walletSuspicion(w: WalletHist): Suspect {
  const kinds: SuspectKind[] = [];
  const reasons: string[] = [];
  let s = 0;
  const rugs = w.rugTokens.size;
  if (rugs >= 2) {
    const rate = rugs / w.tokens.size;
    s += 20 + 30 * rate;
    kinds.push('rug_accomplice');
    reasons.push(`${rugs}/${w.tokens.size} erken girişi rug`);
    if (w.soldInRug / rugs >= 0.5) {
      s += 25;
      kinds.push('smart_trap');
      reasons.push(`rug'ların ${w.soldInRug}'inde rug'dan önce sattı`);
    }
  }
  if (w.maxBuys > 3) {
    s += 15;
    kinds.push('sniper_bot');
    reasons.push(`tek token'da ${w.maxBuys} erken alım`);
  }
  const otherTokens = [...w.tokens].filter((t) => !w.devOf.has(t)).length;
  if (w.devOf.size && otherTokens) {
    s += 25;
    kinds.push('dev_sniper');
    reasons.push(`${w.devOf.size} token'ın dev'i + ${otherTokens} başka token'da erken alıcı`);
  }
  if (w.devRugs >= 1) {
    s += 20 + 15 * Math.min(w.devRugs, 3);
    kinds.push('serial_dev');
    reasons.push(`dev'i olduğu ${w.devRugs} token rug`);
  }
  if (w.washTokens.size >= 2) {
    s += 25;
    kinds.push('wash_ring');
    reasons.push(`${w.washTokens.size} token'da wash grubunda`);
  } else if (w.washTokens.size === 1) {
    s += 10;
    reasons.push('1 token\'da wash grubunda');
  }
  if (w.syncTokens.size >= 2) {
    const syncRugs = [...w.syncTokens].filter((t) => history().rugged.has(t)).length;
    s += 20 + (syncRugs ? 15 : 0);
    kinds.push('sync_ring');
    reasons.push(`${w.syncTokens.size} token'da senkron grupta${syncRugs ? ` (${syncRugs} rug)` : ''}`);
  }
  if (w.fundedTokens.size >= 2) {
    const fr = [...w.fundedTokens].filter((t) => history().rugged.has(t)).length;
    s += 25 + 15 * Math.min(fr, 2);
    kinds.push('funder_ring');
    reasons.push(`${w.fundedTokens.size} token'da erken alıcıları fonladı${fr ? ` (${fr} rug)` : ''}`);
  }
  const partners = [...w.rugPartners.values()].filter((n) => n >= cfg.filters.cluster_min_rugs).length;
  if (partners >= cfg.filters.cluster_min_shared - 1) {
    s += 25;
    kinds.push('rug_cluster');
    reasons.push(`${partners} cüzdanla ≥${cfg.filters.cluster_min_rugs} rug'da birlikte erken`);
  }
  if (w.quickFlips >= 3) {
    s += 10;
    reasons.push(`${w.quickFlips} hızlı satış`);
  }
  return { chain: w.chain, address: w.address, score: Math.min(100, Math.round(s)), kinds, reasons };
}

const trackedLabel = new Map(CHAINS.flatMap((c) => wallets[c]).map((w) => [w.address.toLowerCase(), w.label]));

export function suspects(minScore = 40): Suspect[] {
  return [...history().wallets.values()]
    .map(walletSuspicion)
    .filter((x) => x.score >= minScore)
    .map((x) => ({ ...x, label: trackedLabel.get(x.address.toLowerCase()) }))
    .sort((a, b) => b.score - a.score);
}

export const suspicionOf = (chain: string, a: string) => {
  const w = history().wallets.get(`${chain}:${norm(chain, a)}`);
  return w ? walletSuspicion(w).score : 0;
};

// ---------- sinyal anı kontrolleri ----------
export function rugLinkPct(chain: Chain, token: string, ws: string[]): number | null {
  const h = history();
  if (!h.finished || !ws.length) return null; // geçmiş yok → bilinmiyor (filtre elemez)
  const self = tk(chain, token);
  const linked = ws.filter((a) => [...(h.wallets.get(`${chain}:${norm(chain, a)}`)?.rugTokens ?? [])].some((t) => t !== self)).length;
  return (linked / ws.length) * 100;
}

// Aynı ≥ cluster_min_shared erken alıcı kaç önceki rug'da birlikte erken girdi?
// Senkron grubun, kendi dışında rug olmuş bir token'da da senkron görülen kısmı (%)
export function syncRugLinkPct(chain: Chain, token: string, ws: string[]): number | null {
  const h = history();
  if (!h.finished || !ws.length) return null;
  const self = tk(chain, token);
  const linked = ws.filter((a) => [...(h.wallets.get(`${chain}:${norm(chain, a)}`)?.syncTokens ?? [])].some((t) => t !== self && h.rugged.has(t))).length;
  return (linked / ws.length) * 100;
}

// Launchpad erken satış oranı: bu ağ+launchpad'den son 14 günde erken dump (≥ max_early_dump_pct) ya da rug olan
// aday %. Botun kendi candidates/outcomes kayıtlarından; <10 örnekte null (bilinmiyor, ceza yok).
let lpCache: { at: number; m: Map<string, number | null> } | null = null;
export function launchpadDumpPct(chain: Chain, launchpad?: string): number | null {
  if (!launchpad) return null;
  if (!lpCache || Date.now() - lpCache.at > CACHE_MS) {
    const h = history();
    const since = Date.now() - 14 * 86_400_000;
    const agg = new Map<string, { n: number; bad: number }>();
    const seen = new Set<string>();
    for (const c of readJsonl<any>('candidates.jsonl')) {
      const t = tk(c.chain, c.token);
      if (!c.launchpad || seen.has(t) || Date.parse(c.ts) < since || c.metrics?.earlyDumpPct == null) continue;
      seen.add(t);
      const k = `${c.chain}:${c.launchpad}`;
      const e = agg.get(k) ?? agg.set(k, { n: 0, bad: 0 }).get(k)!;
      e.n++;
      if (c.metrics.earlyDumpPct >= cfg.filters.max_early_dump_pct || h.rugged.has(t)) e.bad++;
    }
    lpCache = { at: Date.now(), m: new Map([...agg].map(([k, e]) => [k, e.n >= 10 ? (e.bad / e.n) * 100 : null])) };
  }
  return lpCache.m.get(`${chain}:${launchpad}`) ?? null;
}

export function suspectOf(chain: string, a: string): Suspect | null {
  const w = history().wallets.get(`${chain}:${norm(chain, a)}`);
  return w ? walletSuspicion(w) : null;
}

// Ortak fonlayıcının, kendi dışında rug olmuş kaç token'da erken alıcı fonladığı
export function funderPrevRugs(chain: Chain, token: string, funder: string): number | null {
  const h = history();
  if (!h.finished) return null;
  const w = h.wallets.get(`${chain}:${norm(chain, funder)}`);
  const self = tk(chain, token);
  return w ? [...w.fundedTokens].filter((t) => t !== self && h.rugged.has(t)).length : 0;
}

export function clusterCheck(chain: Chain, token: string, ws: string[]): { rugs: number; maxShared: number } | null {
  const h = history();
  if (!h.finished || !ws.length) return null;
  const self = tk(chain, token);
  const mine = new Set(ws.map((a) => norm(chain, a)));
  let rugs = 0;
  let maxShared = 0;
  for (const t of h.rugged) {
    if (t === self || !t.startsWith(chain + ':')) continue;
    const shared = [...(h.earlyByToken.get(t) ?? [])].filter((a) => mine.has(a)).length;
    maxShared = Math.max(maxShared, shared);
    if (shared >= cfg.filters.cluster_min_shared) rugs++;
  }
  return { rugs, maxShared };
}

export function devPrevRugs(chain: Chain, token: string, dev: string | null | undefined): number | null {
  if (!dev) return null;
  const w = history().wallets.get(`${chain}:${norm(chain, dev)}`);
  if (!w) return 0;
  const self = tk(chain, token);
  return [...w.devOf].filter((t) => t !== self && history().rugged.has(t)).length;
}

export function suspectEarlyPct(chain: Chain, ws: string[]): number | null {
  if (!history().finished || !ws.length) return null;
  return (ws.filter((a) => suspicionOf(chain, a) >= cfg.filters.suspect_wallet_score).length / ws.length) * 100;
}

// Dev+sniper hibrit: erken alıcılardan kaçı başka token'ların dev'i (kendi geçmişimizden)?
export function devLinkedEarlyPct(chain: Chain, token: string, ws: string[]): number | null {
  const h = history();
  if (!h.finished || !ws.length) return null;
  const self = tk(chain, token);
  const n = ws.filter((a) => [...(h.wallets.get(`${chain}:${norm(chain, a)}`)?.devOf ?? [])].some((t) => t !== self)).length;
  return (n / ws.length) * 100;
}

// İzlenen smart/KOL cüzdanlardan son rug'larda ≥2 kez rug'dan önce satanlar (10 dk önbellek).
let trapCache: { at: number; labels: Set<string> } | null = null;
export function trapLabels(): Set<string> {
  if (trapCache && Date.now() - trapCache.at < CACHE_MS) return trapCache.labels;
  const t = trapRisk(loadRows(), 10);
  return (trapCache = { at: Date.now(), labels: new Set(t.wallets.filter((w) => w.front >= 2).map((w) => w.label)) }).labels;
}

// ---------- sinyal tuzak skoru (0–100, sert) ----------
// Ağırlık toplamı 100'ü çok aşar: tek güçlü işaret (dev'in eski rug'u, tuzak cüzdan) ~40,
// iki orta işaret max_trap_score'u (varsayılan 50) geçirir. Kilit veri eksikse (null) küçük ceza:
// "bilinmiyor" güvenli sayılmaz.
const lin = (v: number | null | undefined, full: number) => (v == null ? 0 : Math.min(1, Math.max(0, v / full)));

export function signalTrapScore(m: Metrics): { score: number; parts: Record<string, number> } {
  const cr = m.clusterRugs ?? 0;
  const p: Record<string, number> = {
    rug_link: 30 * lin(m.sniperRugLinkPct, 15),
    quick_flip: 20 * lin(m.sniperQuickFlipPct, 40),
    short_hold: m.sniperHoldMin == null ? 0 : 15 * (1 - lin(m.sniperHoldMin - 3, 27)),
    dev_sold: 30 * lin(m.devSoldPct, 20),
    dev_prev_rug: m.devPrevRugs ? 40 : 0,
    early_dump: 20 * lin(m.earlyDumpPct, 35),
    rug_cluster: cr >= cfg.filters.cluster_min_rugs ? 35 : cr === 1 ? 12 : 0,
    bundled: 20 * lin(m.sniperBundledPct, 15),
    suspect_early: 25 * lin(m.suspectEarlyPct, 15),
    dev_sniper: 25 * lin(m.devLinkedEarlyPct, 10),
    trap_wallet: m.trapWallets?.length ? 40 : 0,
    wash: 15 * lin(m.washTradePct, 15),
    // senkron trade% popüler token'da doğal olarak ~%40 (1 Kas ölçümü) → yalnız %40 üstü sayılır
    sync: 10 * lin((m.syncTradePct ?? 0) - 40, 30) + 20 * lin(m.syncRepeatWallets, 6),
    sync_rug: 30 * lin(m.syncRugLinkPct, 20),
    // fonlama kümesi: Bubblemaps ölçeği — bundle/küme arzı %5–15 orta, >%15 ciddi
    common_funder: 30 * lin(m.fundCommonPct, 30),
    fund_dev: 35 * lin(m.fundDevPct, 10),
    fresh: 15 * lin((m.fundFreshPct ?? 0) - 30, 50),
    funder_rug: m.fundPrevRugs ? 45 : 0,
    smart_sync: (m.smartSynced?.length ?? 0) >= 2 ? 20 : 0,
    // launchpad erken satış oranı: geçmişte bu launchpad'in adaylarının çoğu ilk dakikalarda dump/rug olduysa
    launchpad_dump: 25 * lin((m.launchpadDumpPct ?? 0) - 30, (cfg.filters.max_launchpad_dump_pct ?? 60) - 30),
  };
  // yalnız tam kontrole (sniper analizi) giren sinyalde eksik veri cezası
  if (m.sniperBuyers != null || m.sniperPct != null) {
    const unknown = [m.sniperQuickFlipPct, m.sniperBundledPct, m.devSoldPct, m.earlyDumpPct, m.washTradePct].filter((x) => x == null).length;
    p.unknown = Math.min(16, 4 * unknown) + (cfg.filters.unknown_trap_penalty ?? 0) * unknown;
  }
  for (const k of Object.keys(p)) if (!p[k]) delete p[k];
  for (const k of Object.keys(p)) p[k] = Math.round(p[k]);
  return { score: Math.min(100, Object.values(p).reduce((s, x) => s + x, 0)), parts: p };
}

// ---------- birleşik kurallar (skordan bağımsız, tek başına eler) ----------
// Tek işaret eşiğin altında kalsa bile birlikte görülünce bilinen tuzak kalıbı:
export function comboFlags(m: Metrics): string[] {
  const out: string[] = [];
  const v = (x: number | null | undefined) => x ?? 0;
  const tracked = m.smartWallets.length + m.kolWallets.length;
  if ((v(m.devSoldPct) >= 10 && v(m.sniperBundledPct) >= 15) || (v(m.devLinkedEarlyPct) >= 1 && v(m.sniperBundledPct) >= 15)) out.push('dev_sniper_hybrid');
  if ((tracked && (m.trapWallets?.length ?? 0) / tracked >= 0.5) || (m.trapWallets?.length && (v(m.sniperQuickFlipPct) >= 30 || v(m.earlyDumpPct) >= 25))) out.push('smart_trap');
  if (v(m.washTradePct) >= 10 && v(m.suspectEarlyPct) >= 10) out.push('wash_ring');
  if (v(m.earlyDumpPct) >= 30 && v(m.sniperQuickFlipPct) >= 40) out.push('insider_exit');
  if (v(m.clusterRugs) >= 1 && v(m.sniperRugLinkPct) >= 10) out.push('rug_ring');
  if (v(m.fundCommonPct) >= 20 && (v(m.syncRepeatWallets) >= 2 || v(m.sniperBundledPct) >= 10 || v(m.fundFreshPct) >= 50)) out.push('coordinated_group');
  if (v(m.syncRepeatWallets) >= 3 && (v(m.earlyDumpPct) >= 20 || v(m.devSoldPct) >= 5 || v(m.washTradePct) >= 10)) out.push('coordinated_dump');
  return out;
}
