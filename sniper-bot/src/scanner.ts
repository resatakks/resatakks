import { cfg, filtersFor, isEvm, wallets, type Chain } from './config.js';
import { isEvmAddress } from './chains.js';
import { executor } from './exec/index.js';
import { evaluate } from './filters.js';
import { openPosition } from './positions.js';
import { canOpen, probeSize } from './risk.js';
import { activeEntries, confirmSolanaOnChain } from './smartmoney.js';
import { bestPairs, discover } from './sources/discovery.js';
import { holderCount, security } from './sources/security.js';
import { earlyDumpPct } from './sources/ohlcv.js';
import { sniperPct } from './sources/sniper.js';
import { washCheck } from './sources/wash.js';
import { state } from './state.js';
import { tg } from './telegram.js';
import { clusterCheck, comboFlags, syncRugLinkPct, devLinkedEarlyPct, devPrevRugs, signalTrapScore, suspectEarlyPct, suspects, trapLabels } from './trap.js';
import { track } from './tracker.js';
import type { Metrics, PairInfo } from './types.js';
import { errMsg, jsonl, log, queue, sleep } from './util.js';

const seen = new Map<string, number>();
const deep = queue(cfg.scan.deep_check_concurrency);

function fresh(chain: Chain, token: string) {
  const k = `${chain}:${token}`;
  const ttl = cfg.scan.seen_ttl_min * 60_000;
  const t = seen.get(k);
  if (t && Date.now() - t < ttl) return false;
  seen.set(k, Date.now());
  if (seen.size > 20_000) for (const [kk, v] of seen) if (Date.now() - v > ttl) seen.delete(kk);
  return true;
}

async function deepCheck(pi: PairInfo) {
  const f = filtersFor(pi.chain);
  const ageMin = (Date.now() - pi.pairCreatedAt) / 60_000;

  // 1) Güvenlik (ucuz ve en çok eleyen) — erken çık.
  const sec = await security(pi.chain, pi.token, pi.pair);
  const base: Metrics = {
    ...sec,
    liquidityUsd: pi.liquidityUsd,
    ageMin,
    sniperPct: null,
    smartWallets: [],
    kolWallets: [],
    holders0: null,
    holders1: null,
    holderGrowthPct: null,
  };
  // 1a) Seri rug'cu dev (kendi geçmişimiz, ücretsiz).
  base.devPrevRugs = devPrevRugs(pi.chain, pi.token, sec.creator);
  const early = evaluate(base, { ...f, max_sniper_pct: Infinity, sniper_unknown_pass: true, wash_unknown_pass: true, min_smart_entries: 0, min_smart_only: 0, require_holder_growth: false });
  if (early.length) return finish(pi, base, early, 'security');

  // 1b) Wash trading + senkron cüzdan (son ~100 swap / ~5 dk blok).
  const wash = await washCheck(pi.chain, pi.token, pi.pair).catch((e) => {
    log.warn('wash calc', { token: pi.token, err: errMsg(e) });
    return null;
  });
  base.washWallets = wash?.washWallets ?? null;
  base.washTradePct = wash?.washTradePct ?? null;
  base.syncTradePct = wash?.sync.syncTradePct ?? null;
  base.syncMaxWallets = wash?.sync.syncMaxWallets ?? null;
  base.syncRepeatWallets = wash?.sync.syncRepeatWallets ?? null;
  base.syncRugLinkPct = wash ? syncRugLinkPct(pi.chain, pi.token, wash.sync.group) : null;
  const washFail = evaluate(base, { ...f, max_sniper_pct: Infinity, sniper_unknown_pass: true, min_smart_entries: 0, min_smart_only: 0, require_holder_growth: false });
  if (washFail.length) return finish(pi, base, washFail, 'wash');

  // 2) Holder büyümesi: iki ölçüm arası pencere.
  base.holders0 = await holderCount(pi.chain, pi.token, pi.pair).catch(() => sec.holders);
  await sleep(f.holder_growth_window_sec * 1000);
  base.holders1 = await holderCount(pi.chain, pi.token, pi.pair).catch(() => null);
  if (base.holders0 && base.holders1 != null) base.holderGrowthPct = ((base.holders1 - base.holders0) / base.holders0) * 100;

  // 3) Smart money / KOL (webhook olayları + gerekirse RPC doğrulaması).
  if (pi.chain === 'solana' && wallets.solana.length) await confirmSolanaOnChain(pi.token);
  const sm = activeEntries(pi.chain, pi.token);
  base.smartWallets = sm.smart;
  base.kolWallets = sm.kol;

  // 4) Sniper oranı (en pahalı) yalnız smart money geçtiyse.
  if (sm.smart.length + sm.kol.length >= f.min_smart_entries) {
    const sn = await sniperPct(pi.chain, pi.token, pi.pair, pi.pairCreatedAt, sec.creator).catch((e) => {
      log.warn('sniper calc', { token: pi.token, err: errMsg(e) });
      return null;
    });
    base.sniperPct = sn?.pct ?? null;
    base.sniperBuyers = sn?.buyers;
    base.sniperHoldMin = sn?.holdMin ?? null;
    base.sniperQuickFlipPct = sn?.quickFlipPct ?? null;
    base.sniperRugLinkPct = sn?.rugLinkPct ?? null;
    base.sniperBundledPct = sn?.bundledPct ?? null;
    base.devSoldPct = sn?.devSoldPct ?? null;
    if (sn?.dev && !sec.creator) base.devPrevRugs = devPrevRugs(pi.chain, pi.token, sn.dev);
    const ws = sn?.wallets ?? [];
    const cl = clusterCheck(pi.chain, pi.token, ws);
    base.clusterRugs = cl?.rugs ?? null;
    base.clusterShared = cl?.maxShared ?? null;
    base.suspectEarlyPct = suspectEarlyPct(pi.chain, ws);
    base.devLinkedEarlyPct = devLinkedEarlyPct(pi.chain, pi.token, ws);

    // 5) İlk 8 dk dump (GeckoTerminal 1 dk mum).
    base.earlyDumpPct = await earlyDumpPct(pi.chain, pi.pair, pi.pairCreatedAt).catch((e) => {
      log.warn('ohlcv', { token: pi.token, err: errMsg(e) });
      return null;
    });

    // 6) Tetikleyen smart/KOL arasında tuzak cüzdanı: son rug'larda ≥2 kez önce satan ya da şüphe skoru yüksek.
    const traps = trapLabels();
    const bad = new Set(suspects(f.suspect_wallet_score).map((x) => x.address.toLowerCase()));
    const addrOf = new Map(wallets[pi.chain].map((w) => [w.label, w.address.toLowerCase()]));
    base.trapWallets = [...sm.smart, ...sm.kol].filter((l) => traps.has(l) || bad.has(addrOf.get(l) ?? ''));
  }

  // 7) Sinyal tuzak skoru: > max_trap_score → trap_score ile elenir.
  const ts = signalTrapScore(base);
  base.trapScore = ts.score;
  base.trapParts = ts.parts;
  base.comboFlags = comboFlags(base);

  const fails = evaluate(base, f);
  return finish(pi, base, fails, 'full');
}

// Gece raporu için sayaçlar (process ömrü boyunca).
export const scanStats = { discovered: 0, prefiltered: 0, deepChecked: 0, passed: 0, opened: 0, gated: 0 };

async function finish(pi: PairInfo, m: Metrics, fails: string[], stage: string) {
  scanStats.deepChecked++;
  jsonl('candidates.jsonl', { chain: pi.chain, token: pi.token, symbol: pi.symbol, pair: pi.pair, dex: pi.dex, launchpad: pi.launchpad, priceUsd: pi.priceUsd, stage, fails, metrics: m });
  track(pi); // geçen/kalan herkesin sonrası izlenir → haftalık optimizasyon
  if (fails.length) return;
  scanStats.passed++;

  const ex = executor(pi.chain);
  const size = probeSize(pi.chain, await ex.balance());
  if (size == null) return log.warn('bakiye yetersiz', { chain: pi.chain });
  const gate = canOpen(pi.chain, pi.token, size);
  if (!gate.ok) {
    scanStats.gated++;
    log.info('sinyal ama risk kapısı kapalı', { token: pi.token, reason: gate.reason });
    return tg(`🟡 Sinyal ${pi.symbol} (${pi.chain}) — girilmedi: ${gate.reason}`);
  }
  if (!(await ex.canRoute(pi.token, size))) return log.info('rota yok', { token: pi.token });
  try {
    await openPosition(pi, size, m);
    scanStats.opened++;
  } catch (e) {
    log.error('buy failed', { token: pi.token, err: errMsg(e) });
    await tg(`⚠️ ALIM BAŞARISIZ ${pi.symbol}: ${errMsg(e)}`);
  }
}

async function scanOnce(chain: Chain) {
  const tokens = (await discover(chain)).filter((t) => fresh(chain, t));
  scanStats.discovered += tokens.length;
  if (!tokens.length) return;
  const pairs = await bestPairs(chain, tokens);
  for (const pi of pairs.values()) {
    const age = (Date.now() - pi.pairCreatedAt) / 60_000;
    if (age < cfg.scan.min_pair_age_min) {
      seen.delete(`${chain}:${pi.token}`); // erken geldi, sonraki turda yeniden değerlendir
      continue;
    }
    if (age > cfg.scan.max_pair_age_min || pi.liquidityUsd < filtersFor(chain).min_liquidity_usd) continue;
    if (isEvm(chain) && !isEvmAddress(pi.pair)) continue; // Uniswap V4 / Clanker pool id → V2 rotası yok
    scanStats.prefiltered++;
    deep.push(() =>
      deepCheck(pi).catch((e) => log.warn('deep check', { token: pi.token, err: errMsg(e) })),
    );
  }
}

export function startScanner(chain: Chain) {
  const loop = async () => {
    if (!state.paused && deep.size < 20) {
      try {
        await scanOnce(chain);
      } catch (e) {
        log.warn('scan', { chain, err: errMsg(e) });
      }
    }
    setTimeout(loop, cfg.scan.interval_sec * 1000);
  };
  void loop();
}
