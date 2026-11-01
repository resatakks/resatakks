// Gece modu: start–end penceresinde her summary_every_min dakikada özet yazar,
// report_at'te Telegram'a "Sabah Raporu" atar, exitAtEnd ise end'de süreci kapatır.
import fs from 'node:fs';
import path from 'node:path';
import { CHAINS, DATA_DIR, cfg, nativeSymbol, riskFor, type Chain } from './config.js';
import { competitionSection, launchpadSection, opportunitySection, riskSection, safeExitSection, syncSection, fundingSection, missedSection, rugHitSection, trapDetail, TRAP_REASONS } from './insights.js';
import { loadRows, rejectCounts, runOptimization, shadowSince, fmtScore, type Row } from './optimizer.js';
import { scanStats } from './scanner.js';
import { trapRisk } from './smartmoney.js';
import { suspects, type SuspectKind } from './trap.js';
import { openPositions, save, state } from './state.js';
import { tg } from './telegram.js';
import { trackingSnapshot } from './tracker.js';
import { errMsg, localHHMM, log, readJsonl, utcDay } from './util.js';

const SUMMARY_FILE = path.join(DATA_DIR, 'nightly-summary.log');
const LAST_REPORT_FILE = path.join(DATA_DIR, 'nightly-last-report.txt');

const toMin = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};
const nowMin = () => toMin(localHHMM());

function inWindow(): boolean {
  const s = toMin(cfg.nightly.start);
  const e = toMin(cfg.nightly.end);
  const n = nowMin();
  return s <= e ? n >= s && n < e : n >= s || n < e; // 22:00–06:00 gibi gece yarısını aşan pencere de olur
}

// Bu gecenin başlangıç anı (ms).
function windowStartMs(): number {
  const back = (nowMin() - toMin(cfg.nightly.start) + 1440) % 1440;
  return Date.now() - back * 60_000;
}

function rowsNow(): Row[] {
  return loadRows(trackingSnapshot());
}

function realTrades(sinceMs: number) {
  return readJsonl<any>('trades.jsonl').filter((t) => t.ev === 'close' && Date.parse(t.ts) >= sinceMs);
}

function chainBlock(chain: Chain, rows: Row[], sinceMs: number) {
  const sym = nativeSymbol(chain);
  const sh = shadowSince(sinceMs, rows.filter((r) => r.key.startsWith(`${chain}:`)), riskFor(chain).probe_max);
  const real = realTrades(sinceMs).filter((t) => t.chain === chain);
  const realPnl = real.reduce((s, t) => s + Number(t.pnl ?? 0), 0);
  return { chain, sym, sh, real, realPnl };
}

function summaryLine(): string {
  const since = windowStartMs();
  const rows = rowsNow();
  const parts = CHAINS.filter((c) => cfg.chains[c].enabled).map((c) => {
    const b = chainBlock(c, rows, since);
    return `${c}: aday ${b.sh.candidates} geçen ${b.sh.passed} gölge ${b.sh.score.n}tr avg ${b.sh.score.avg.toFixed(1)}% · gerçek ${b.real.length}tr ${b.realPnl >= 0 ? '+' : ''}${b.realPnl.toFixed(4)} ${b.sym}`;
  });
  return `[${localHHMM()}] tarandı ${scanStats.discovered} ön-filtre ${scanStats.prefiltered} derin ${scanStats.deepChecked} · açık ${openPositions().length} · ${parts.join(' | ')}`;
}

const KIND_TR: Record<SuspectKind, string> = {
  smart_trap: 'smart tuzak',
  rug_accomplice: 'rug ortağı',
  sniper_bot: 'sniper bot',
  dev_sniper: 'dev+sniper',
  serial_dev: "seri rug'cu dev",
  wash_ring: 'wash halkası',
  rug_cluster: 'rug kümesi',
  sync_ring: 'senkron halka',
  funder_ring: 'fonlayıcı halkası',
};

// "Tuzağa Düşme Risk Analizi": izlenen smart/KOL tuzak skoru + gece elenen tuzaklar + şüpheli cüzdan listesi.
export function trapAnalysis(rows: Row[], since: number): string[] {
  const L: string[] = ['🪤 <b>Tuzağa Düşme Risk Analizi</b>'];
  const trap = trapRisk(rows);
  if (trap.score == null) L.push('smart/KOL tuzak skoru: veri yok (smart/KOL girişli rug kaydı yok)');
  else {
    const lvl = trap.score >= 60 ? '🔴 yüksek' : trap.score >= 30 ? '🟠 orta' : '🟢 düşük';
    L.push(`smart/KOL tuzak skoru: ${trap.score}/100 ${lvl} (son ${trap.rugs.length} rug)`);
    for (const r of trap.rugs)
      L.push(`  · ${r.symbol} rug ${new Date(r.rugAt).toLocaleTimeString('tr-TR', { timeZone: cfg.timezone, hour: '2-digit', minute: '2-digit' })} — önce satan: ${r.front.join(', ') || '-'} · yakalanan: ${r.caught.join(', ') || '-'}`);
  }

  const win = rows.filter((r) => Date.parse(r.ts) >= since);
  const reasons = rejectCounts(win).filter(([k]) => TRAP_REASONS.has(k));
  L.push(`gece tuzak elemesi: ${reasons.length ? reasons.map(([k, v]) => `${k} ${v}`).join(', ') : 'yok'}`);
  const scored = win.filter((r) => r.metrics?.trapScore != null);
  if (scored.length) {
    const avg = scored.reduce((s, r) => s + (r.metrics.trapScore ?? 0), 0) / scored.length;
    const over = scored.filter((r) => (r.metrics.trapScore ?? 0) > cfg.filters.max_trap_score);
    L.push(`sinyal tuzak skoru: ort ${avg.toFixed(0)} · >${cfg.filters.max_trap_score} elenen ${over.length}/${scored.length}`);
    for (const r of over.sort((a, b) => (b.metrics.trapScore ?? 0) - (a.metrics.trapScore ?? 0)).slice(0, 5)) {
      const parts = Object.entries(r.metrics.trapParts ?? {}).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([k, v]) => `${k} ${v}`).join(', ');
      const rugged = r.path.some(([, p]) => p <= -80) ? ' → rug oldu ✅' : '';
      L.push(`  · ${r.symbol} ${r.metrics.trapScore} (${parts})${rugged}`);
    }
  }

  const sus = suspects(cfg.filters.suspect_wallet_score);
  const tracked = sus.filter((x) => x.label);
  const frontBad = trap.wallets.filter((w) => w.front >= 2).map((w) => w.label);
  const flagged = [...new Set([...tracked.map((x) => x.label!), ...frontBad])];
  if (flagged.length) L.push(`⚠️ izlenen cüzdanlarda şüpheli (wallets.yaml'dan çıkarmayı değerlendir): ${flagged.join(', ')}`);
  L.push(`şüpheli cüzdanlar (skor ≥ ${cfg.filters.suspect_wallet_score}): ${sus.length}`);
  for (const x of sus.slice(0, 10)) L.push(`  · ${x.chain} <code>${x.address}</code> ${x.score} — ${x.kinds.map((k) => KIND_TR[k]).join(', ')}${x.label ? ` [${x.label}]` : ''}`);
  if (sus.length > 10) L.push(`  … tam liste: npm run discover-wallets → data/suspect-wallets.json`);
  return L;
}

// /rapor alt bölümleri: /rapor tuzak | senkron | kacan | isabet | risk | firsat | rekabet | launchpad | cikis | config | <saat>
export const REPORT_PARTS = ['ozet', 'risk', 'firsat', 'rekabet', 'launchpad', 'tuzak', 'senkron', 'kacan', 'isabet', 'cikis', 'config'] as const;
export type ReportPart = (typeof REPORT_PARTS)[number];
export interface ReportOpts {
  sinceMs?: number; // varsayılan: nightly penceresi başlangıcı
  parts?: ReportPart[]; // varsayılan: hepsi
  title?: string;
}

// /rapor [bölüm…] [saat] → ör. "/rapor", "/rapor tuzak", "/rapor risk cikis 6"
export function parseReportArgs(args: string[]): ReportOpts {
  const ascii = (a: string) => a.toLocaleLowerCase('tr').replace(/[çışğöü]/g, (ch) => ({ ç: 'c', ı: 'i', ş: 's', ğ: 'g', ö: 'o', ü: 'u' })[ch]!);
  const parts = args.map(ascii).filter((a): a is ReportPart => (REPORT_PARTS as readonly string[]).includes(a));
  const h = Number(args.find((a) => /^\d+(\.\d+)?$/.test(a)) ?? 24);
  return { sinceMs: Date.now() - Math.min(Math.max(h, 1), 24 * 14) * 3_600_000, parts: parts.length ? parts : undefined, title: `📊 <b>Rapor</b> · son ${h} sa` };
}

export function morningReport(opts: ReportOpts = {}): string {
  const since = opts.sinceMs ?? windowStartMs();
  const want = (p: ReportPart) => !opts.parts || opts.parts.includes(p);
  const rows = rowsNow();
  const L: string[] = [];
  L.push(`${opts.title ?? '☀️ <b>Sabah Raporu</b>'} · ${utcDay()} · ${cfg.mode.toUpperCase()}`);
  L.push(`pencere ${new Date(since).toLocaleString('tr-TR', { timeZone: cfg.timezone, hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' })}–${localHHMM()} (${cfg.timezone}) · fırsat/rekabet/launchpad her zaman son 24 sa`);
  if (want('ozet')) {
    L.push('');
    L.push(`<b>Tarama</b>: keşif ${scanStats.discovered} · ön-filtre geçen ${scanStats.prefiltered} · derin kontrol ${scanStats.deepChecked}`);
    L.push(`filtre geçen ${scanStats.passed} · risk kapısına takılan ${scanStats.gated} · açılan ${scanStats.opened}`);

    for (const c of CHAINS.filter((x) => cfg.chains[x].enabled)) {
      const b = chainBlock(c, rows, since);
      L.push('');
      L.push(`<b>${c.toUpperCase()}</b> — aday ${b.sh.candidates}, filtre geçen ${b.sh.passed}`);
      if (b.sh.rejects.length) L.push(`eleme: ${b.sh.rejects.slice(0, 6).map(([k, v]) => `${k} ${v}`).join(', ')}`);
      L.push(`gölge paper (geçen her aday, ${riskFor(c).probe_max} ${b.sym} probe): ${fmtScore(b.sh.score)}`);
      L.push(`gölge PnL ≈ ${b.sh.probePnlNative >= 0 ? '+' : ''}${b.sh.probePnlNative.toFixed(4)} ${b.sym}`);
      for (const t of b.sh.trades.slice(0, 8)) L.push(`  · ${t.symbol} ${t.pct >= 0 ? '+' : ''}${t.pct.toFixed(1)}%${t.done ? '' : ' (sürüyor)'}`);
      L.push(`gerçek ${cfg.mode}: ${b.real.length} kapanan işlem, PnL ${b.realPnl >= 0 ? '+' : ''}${b.realPnl.toFixed(4)} ${b.sym}`);
      for (const t of b.real.slice(0, 8))
        L.push(`  · ${t.symbol} ${t.exitReason} ${Number(t.pnlPct ?? 0) >= 0 ? '+' : ''}${Number(t.pnlPct ?? 0).toFixed(1)}%`);
      const day = state.daily.realized[c] ?? 0;
      L.push(`gün toplamı ${day >= 0 ? '+' : ''}${day.toFixed(4)} / limit −${riskFor(c).daily_loss_cap} / hedef +${riskFor(c).daily_profit_target}`);
    }

    const open = openPositions();
    L.push('');
    L.push(`<b>Açık pozisyon</b>: ${open.length ? open.map((p) => `${p.symbol}(${p.chain}) ${((p.lastValueNative / p.sizeNative - 1) * 100).toFixed(1)}%`).join(', ') : 'yok'}`);
    if (state.haltedDay === utcDay()) L.push(`⛔ günlük durdurma: ${state.haltReason}`);
    if (state.paused) L.push(`⏸ duraklatılmış: ${state.pauseReason}`);
  }

  if (want('risk')) L.push('', ...riskSection(rows, since));
  if (want('firsat')) L.push('', ...opportunitySection(rows));
  if (want('rekabet')) L.push('', ...competitionSection());
  if (want('launchpad')) L.push('', ...launchpadSection(rows));
  if (want('tuzak')) L.push('', ...trapAnalysis(rows, since), '', ...trapDetail(rows, since));
  if (want('tuzak') || want('senkron')) L.push('', ...syncSection(rows, since), '', ...fundingSection(rows, since));
  if (want('tuzak') || want('isabet') || want('kacan')) L.push('', ...rugHitSection(rows));
  if (want('kacan')) L.push('', ...missedSection(rows, since));
  if (want('cikis')) L.push('', ...safeExitSection(rows));
  if (!want('config')) return L.join('\n');

  // Optimizasyon ağ başına: yalnız o ağın kendi kayıtları + filtersFor(chain)
  L.push('');
  L.push('<b>Önerilen config</b> (botun kendi geçmişi, ağ başına):');
  for (const c of CHAINS.filter((x) => cfg.chains[x].enabled)) {
    const opt = runOptimization(rows, c);
    L.push(`${c} (${opt.rows} biten aday): karar ${opt.accept ? 'UYGULA' : 'UYGULAMA'} · test ${fmtScore(opt.newTest)}`);
    if (opt.diff.length) L.push(opt.diff.map((d) => `  · ${d}`).join('\n'));
  }
  L.push('config otomatik değişmez; uygulamak için config.yaml düzenle + redeploy.');

  return L.join('\n');
}

function lastReportDay(): string {
  try {
    return fs.readFileSync(LAST_REPORT_FILE, 'utf8').trim();
  } catch {
    return '';
  }
}

async function sendMorning() {
  const text = morningReport();
  fs.writeFileSync(LAST_REPORT_FILE, utcDay());
  fs.writeFileSync(path.join(DATA_DIR, `sabah-raporu-${utcDay()}.txt`), text.replace(/<\/?b>/g, ''));
  if (cfg.nightly.auto_report === false) return log.info('sabah raporu dosyaya yazıldı (auto_report: false → /rapor ile iste)');
  // Telegram 4096 karakter sınırı
  for (let i = 0; i < text.length; i += 3900) await tg(text.slice(i, i + 3900));
  log.info('sabah raporu gönderildi');
}

const reportCatchUp = () => {
  const n = nowMin();
  const end = toMin(cfg.nightly.end);
  return n >= toMin(cfg.nightly.report_at) && n >= end && n < end + 180;
};

export function startNightly({ exitAtEnd = false } = {}) {
  let lastSummaryAt = 0;
  let sawWindow = inWindow();
  log.info('nightly başladı', { window: `${cfg.nightly.start}-${cfg.nightly.end}`, report: cfg.nightly.report_at, exitAtEnd });

  const tick = async () => {
    const inside = inWindow();
    if (inside) {
      sawWindow = true;
      if (Date.now() - lastSummaryAt >= cfg.nightly.summary_every_min * 60_000) {
        lastSummaryAt = Date.now();
        const line = summaryLine();
        fs.appendFileSync(SUMMARY_FILE, line + '\n');
        if (cfg.nightly.summary_to_telegram) await tg(`🌙 ${line}`);
      }
      if (nowMin() >= toMin(cfg.nightly.report_at) && lastReportDay() !== utcDay()) await sendMorning();
    } else if (!exitAtEnd && reportCatchUp() && lastReportDay() !== utcDay()) {
      await sendMorning(); // Railway restart/redeploy 07:45'i kaçırdıysa pencere bitiminden sonraki 3 saat içinde at
    } else if (sawWindow && exitAtEnd) {
      if (lastReportDay() !== utcDay()) await sendMorning(); // report_at kaçtıysa (geç başlatma) kapanışta at
      save();
      log.info('nightly bitti, çıkılıyor');
      setTimeout(() => process.exit(0), 2000); // son Telegram/log yazımı için
    }
  };

  setInterval(() => tick().catch((e) => log.warn('nightly', { err: errMsg(e) })), 30_000);
  void tick().catch((e) => log.warn('nightly', { err: errMsg(e) }));
}
