import fs from 'node:fs';
import path from 'node:path';
import YAML from 'yaml';

export type Chain = 'solana' | 'bsc' | 'base' | 'blast' | 'monad';
export const CHAINS: Chain[] = ['solana', 'bsc', 'base', 'blast', 'monad'];
export type EvmChain = Exclude<Chain, 'solana'>;
export const isEvm = (c: string): c is EvmChain => c === 'bsc' || c === 'base' || c === 'blast' || c === 'monad';
// EVM adresleri küçük harfe normalize edilir (Solana base58 büyük/küçük harf duyarlı).
export const normAddr = (chain: string, a: string) => (isEvm(chain) ? a.toLowerCase() : a);

export interface ChainRisk {
  paper_start_balance: number;
  probe_min: number;
  probe_max: number;
  probe_balance_pct: number;
  fee_reserve: number;
  daily_loss_cap: number;
  daily_profit_target: number;
}

export interface Config {
  mode: 'paper' | 'live';
  timezone: string;
  // paper_only: mode=live olsa bile bu ağ sanal bakiyeyle işlem görür (küçük sermayede tek ağı canlıya al)
  chains: Record<Chain, { enabled: boolean; paper_only?: boolean }>;
  scan: {
    interval_sec: number;
    min_pair_age_min: number;
    max_pair_age_min: number;
    deep_check_concurrency: number;
    seen_ttl_min: number;
    // GeckoTerminal new_pools sayfa sayısı (sayfa = 20 havuz, 2.1 sn). Solana'da 20 havuz ~1 dk'da dolar.
    gecko_pages?: Partial<Record<Chain, number>>;
    // Bu launchpad/dex kaynaklı token'lar taranmaz (GeckoTerminal dex id, ör. pump-fun, meteora-dbc).
    skip_launchpads?: string[];
  };
  filters: {
    min_liquidity_usd: number;
    max_top10_pct: number;
    require_lp_locked: boolean;
    min_lp_locked_pct: number;
    require_renounced: boolean;
    max_sell_tax_pct: number;
    max_buy_tax_pct: number;
    max_sniper_pct: number;
    sniper_slots: number;
    sniper_blocks: number;
    sniper_sig_pages: number;
    sniper_max_buyers: number;
    sniper_unknown_pass: boolean;
    quick_flip_min: number;
    max_sniper_quick_flip_pct: number;
    max_sniper_rug_link_pct: number;
    wash_window_sec: number;
    wash_min_wallets: number;
    wash_group_max: number;
    max_wash_trade_pct: number;
    sync_min_wallets?: number; // aynı slot/blokta aynı yönde bu kadar farklı cüzdan = senkron blok
    sync_repeat_min?: number; // bir cüzdan çifti bu kadar senkron blokta birlikte → koordineli
    max_sync_trade_pct?: number;
    max_sync_repeat_wallets?: number; // sync_swarm: trade% ≥ max_sync_trade_pct VE repeat ≥ bu
    max_sync_rug_link_pct?: number; // senkron grubun ≥ bu %'si başka rug'larda da senkron → ele
    wash_unknown_pass: boolean;
    early_dump_window_min: number;
    max_early_dump_pct: number;
    max_dev_sold_pct: number;
    max_dev_prev_rugs: number;
    cluster_min_shared: number;
    cluster_min_rugs: number;
    max_bundled_pct: number;
    max_trap_score: number;
    suspect_wallet_score: number;
    combo_rules: boolean;
    unknown_trap_penalty: number;
    min_smart_entries: number;
    min_smart_only: number;
    smart_lookback_min: number;
    require_holder_growth: boolean;
    holder_growth_window_sec: number;
    min_holder_growth_pct: number;
  };
  // Ağ bazlı filtre üstüne yazımı (BSC/Base blok süresi, vergi, likidite farkları)
  chain_filters?: Partial<Record<Chain, Partial<Config['filters']>>>;
  risk: {
    sol: ChainRisk;
    bnb: ChainRisk;
    eth: ChainRisk;
    mon?: ChainRisk; // Monad; yoksa chains.monad kapalı olmalı
    auto_scale: boolean; // Sabah Raporu'nun risk çarpanı daily_loss_cap'e uygulanır
    min_scale: number;
    max_concurrent: number;
    max_trades_per_day: number;
    cooldown_after_loss_min: number;
    max_consecutive_losses: number;
    reentry_block_hours: number;
    assumed_worst_loss_pct: number;
  };
  exit: {
    take_profit_pct: number;
    stop_loss_pct: number;
    trailing_activate_pct: number;
    trailing_distance_pct: number;
    max_hold_min: number;
    smart_exit_count: number;
    poll_sec: number;
    quote_fail_exit_after: number;
  };
  exec: {
    slippage_bps: number;
    sell_slippage_bps: number;
    sol_priority_max_lamports: number;
    bsc_gas_price_gwei: number;
    base_max_fee_gwei: number;
    monad_max_fee_gwei?: number; // Monad EIP-1559 tavanı (base fee ~100 gwei)
    paper_extra_slippage_pct: number;
  };
  tracking: { sample_every_min: number; track_for_min: number };
  nightly: {
    enabled: boolean;
    start: string;
    end: string;
    summary_every_min: number;
    summary_to_telegram: boolean;
    report_at: string;
    auto_report?: boolean; // false → report_at'te Telegram'a atmaz (yalnız data/ dosyası), rapor /rapor ile istenir
    usd_ref?: Partial<Record<'sol' | 'bnb' | 'eth' | 'mon', number>>; // rapordaki ≈$ karşılıkları
  };
}

export interface TrackedWallet {
  address: string;
  label: string;
  type: 'smart' | 'kol';
}

const ROOT = process.cwd();
export const DATA_DIR = process.env.DATA_DIR || path.join(ROOT, 'data');
fs.mkdirSync(DATA_DIR, { recursive: true });

export const cfg: Config = YAML.parse(
  fs.readFileSync(process.env.CONFIG_PATH || path.join(ROOT, 'config.yaml'), 'utf8'),
);

const rawWallets = YAML.parse(fs.readFileSync(path.join(ROOT, 'wallets.yaml'), 'utf8')) ?? {};
const evmList = (xs: TrackedWallet[] | undefined) => (xs ?? []).map((w) => ({ ...w, address: w.address.toLowerCase() }));
export const wallets: Record<Chain, TrackedWallet[]> = {
  solana: rawWallets.solana ?? [],
  bsc: evmList(rawWallets.bsc),
  base: evmList(rawWallets.base),
  blast: evmList(rawWallets.blast),
  monad: evmList(rawWallets.monad),
};

// Eski config.yaml'larla uyum: eksik ağ = kapalı
for (const c of CHAINS) cfg.chains[c] ??= { enabled: false };
cfg.filters.combo_rules ??= true;
cfg.filters.unknown_trap_penalty ??= 0;
cfg.filters.sync_min_wallets ??= 3;
cfg.filters.sync_repeat_min ??= 3;
cfg.filters.max_sync_trade_pct ??= 55;
cfg.filters.max_sync_repeat_wallets ??= 3;
cfg.filters.max_sync_rug_link_pct ??= 25;
cfg.risk.auto_scale ??= false;
cfg.risk.min_scale ??= 0.25;

const RISK_KEY = { solana: 'sol', bsc: 'bnb', base: 'eth', blast: 'eth', monad: 'mon' } as const; // Blast = ETH profili, günlük cap ağ başına ayrı sayılır
export const riskFor = (chain: Chain): ChainRisk => {
  const r = cfg.risk[RISK_KEY[chain]];
  if (!r) throw new Error(`config.yaml: risk.${RISK_KEY[chain]} yok (${chain} açık)`);
  return r;
};
for (const c of CHAINS) if (cfg.chains[c].enabled) riskFor(c); // eksik risk profili açılışta patlasın
export const nativeSymbol = (chain: Chain) => ({ solana: 'SOL', bsc: 'BNB', base: 'ETH', blast: 'ETH', monad: 'MON' })[chain];
export const filtersFor = (chain: Chain): Config['filters'] => ({ ...cfg.filters, ...(cfg.chain_filters?.[chain] ?? {}) });
export const paperOnly = (chain: Chain) => !isLiveMode() || Boolean(cfg.chains[chain].paper_only);
function isLiveMode() {
  return cfg.mode === 'live';
}

export function env(key: string, required = true): string {
  const v = process.env[key];
  if (!v && required) throw new Error(`missing env ${key}`);
  return v ?? '';
}

export const isLive = () => cfg.mode === 'live';

if (isLive() && process.env.LIVE_CONFIRM !== 'YES') {
  throw new Error('mode=live ama LIVE_CONFIRM=YES değil — paper moda dön veya env ekle');
}
