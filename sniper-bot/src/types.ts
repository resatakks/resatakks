import type { Chain } from './config.js';

export interface PairInfo {
  chain: Chain;
  token: string;
  symbol: string;
  pair: string;
  dex: string;
  priceUsd: number;
  liquidityUsd: number;
  fdvUsd: number;
  pairCreatedAt: number; // ms
  launchpad?: string; // ilk görüldüğü GeckoTerminal dex'i (pump-fun, meteora-dbc, four-meme …) — rapor kırılımı
}

export interface Security {
  top10Pct: number;
  lpLockedPct: number;
  renounced: boolean;
  buyTaxPct: number;
  sellTaxPct: number;
  honeypot: boolean;
  holders: number | null;
  holderAddrs: string[]; // havuz hariç ilk 20 holder (cüzdan keşfi için)
  creator?: string | null; // token/pool yaratıcısı (dev)
  flags: string[];
}

export interface Metrics extends Security {
  liquidityUsd: number;
  ageMin: number;
  sniperPct: number | null;
  sniperBuyers?: number;
  sniperHoldMin?: number | null; // erken alıcıların medyan tutma süresi (hâlâ tutan = token yaşı)
  sniperQuickFlipPct?: number | null; // quick_flip_min içinde satan erken alıcı %
  sniperRugLinkPct?: number | null; // daha önce rug olmuş token'larda da erken alıcı olanların %
  sniperBundledPct?: number | null; // dev'in ödediği ya da launch slot/bloğundaki erken alımlar %
  devSoldPct?: number | null; // dev'in elindekinin satılan/çıkan %'si (LP kilidinden bağımsız)
  devPrevRugs?: number | null; // bu dev'in daha önce rug olmuş token sayısı
  earlyDumpPct?: number | null; // launch sonrası ilk 8 dk zirveden en derin düşüş %
  clusterRugs?: number | null; // aynı ≥3 erken alıcının birlikte erken girdiği önceki rug sayısı
  clusterShared?: number | null; // o rug'larla en fazla ortak erken alıcı sayısı
  suspectEarlyPct?: number | null; // şüpheli skoru ≥ suspect_wallet_score olan erken alıcı %
  devLinkedEarlyPct?: number | null; // başka token'ların dev'i olan erken alıcı % (dev+sniper hibrit)
  comboFlags?: string[]; // birleşik tuzak kuralları (trap.ts comboFlags)
  trapWallets?: string[]; // sinyaldeki ≥2 rug'da önce satmış izlenen cüzdanlar
  trapScore?: number | null; // 0–100 sinyal tuzak skoru
  trapParts?: Record<string, number>;
  washWallets?: number | null;
  washTradePct?: number | null;
  smartWallets: string[];
  kolWallets: string[];
  holders0: number | null;
  holders1: number | null;
  holderGrowthPct: number | null;
}

export interface Position {
  id: string;
  chain: Chain;
  token: string;
  symbol: string;
  pair: string;
  mode: 'paper' | 'live';
  openedAt: number;
  sizeNative: number;
  tokenRaw: string; // bigint string
  decimals: number;
  peakValueNative: number;
  lastValueNative: number;
  quoteFails: number;
  triggerWallets: string[];
  entrySig?: string;
  status: 'open' | 'closing' | 'closed';
  exitReason?: string;
  exitValueNative?: number;
  closedAt?: number;
  exitSig?: string;
}
