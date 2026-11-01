import type { Config } from './config.js';
import { comboFlags } from './trap.js';
import type { Metrics } from './types.js';

// Saf fonksiyon: canlı bot ve haftalık optimizasyon aynı mantığı kullanır.
export function evaluate(m: Metrics, f: Config['filters']): string[] {
  const fail: string[] = [];
  if (m.liquidityUsd < f.min_liquidity_usd) fail.push('liquidity');
  if (m.honeypot) fail.push('honeypot');
  if (m.top10Pct >= f.max_top10_pct) fail.push('top10');
  if (f.require_lp_locked && m.lpLockedPct < f.min_lp_locked_pct) fail.push('lp_lock');
  if (f.require_renounced && !m.renounced) fail.push('renounce');
  if (m.sellTaxPct >= f.max_sell_tax_pct) fail.push('sell_tax');
  if (m.buyTaxPct >= f.max_buy_tax_pct) fail.push('buy_tax');
  if (m.sniperPct == null ? !f.sniper_unknown_pass : m.sniperPct >= f.max_sniper_pct) fail.push('sniper');
  if (m.sniperQuickFlipPct != null && m.sniperQuickFlipPct >= f.max_sniper_quick_flip_pct) fail.push('sniper_flip');
  if (m.sniperRugLinkPct != null && m.sniperRugLinkPct >= f.max_sniper_rug_link_pct) fail.push('sniper_rug_link');
  if (m.washWallets === null || m.washTradePct === null) {
    if (!f.wash_unknown_pass) fail.push('wash_trading');
  } else if (m.washWallets !== undefined && m.washTradePct !== undefined &&
    m.washWallets >= f.wash_min_wallets && m.washTradePct >= f.max_wash_trade_pct) fail.push('wash_trading');
  if (m.smartWallets.length + m.kolWallets.length < f.min_smart_entries || m.smartWallets.length < f.min_smart_only)
    fail.push('smart_money');
  if (f.require_holder_growth && (m.holderGrowthPct == null || m.holderGrowthPct <= f.min_holder_growth_pct))
    fail.push('holder_growth');
  // tuzak filtreleri (veri yoksa elemez)
  if (m.earlyDumpPct != null && m.earlyDumpPct >= f.max_early_dump_pct) fail.push('early_dump');
  if (m.devSoldPct != null && m.devSoldPct >= f.max_dev_sold_pct) fail.push('dev_sell');
  if (m.devPrevRugs != null && m.devPrevRugs > f.max_dev_prev_rugs) fail.push('dev_serial');
  if (m.clusterRugs != null && m.clusterRugs >= f.cluster_min_rugs) fail.push('rug_cluster');
  if (m.sniperBundledPct != null && m.sniperBundledPct >= f.max_bundled_pct) fail.push('bundle');
  if (m.trapScore != null && m.trapScore > f.max_trap_score) fail.push('trap_score');
  if (m.trapWallets?.length) fail.push('trap_wallet');
  if (f.combo_rules) fail.push(...comboFlags(m));
  return fail;
}
