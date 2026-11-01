import { env, type Chain } from '../config.js';
import { getJson, throttle } from '../util.js';

export interface GmgnStats {
  sniperPct?: number;
  smartBuyers?: number;
  kolBuyers?: number;
}

// GMGN'in herkese açık, stabil bir veri API'si yok; web uç noktaları Cloudflare arkasında ve sık değişiyor.
// GMGN_API_BASE ile erişimin olan bir uç nokta (ör. kendi proxy'n / ücretli erişim) verirsen burası kullanılır,
// yoksa null döner ve bot on-chain hesaplara (sniper.ts) + kendi cüzdan listene (smartmoney.ts) düşer.
// Alan eşlemesini aldığın yanıtın şemasına göre düzenle.
export async function gmgnTokenStats(chain: Chain, token: string): Promise<GmgnStats | null> {
  const base = env('GMGN_API_BASE', false);
  if (!base) return null;
  await throttle('gmgn', 1500);
  const j = await getJson<any>(`${base.replace(/\/$/, '')}/token/${({ solana: 'sol', bsc: 'bsc', base: 'base' } as const)[chain]}/${token}`);
  const d = j.data ?? j;
  return {
    sniperPct: d.sniper_hold_rate != null ? Number(d.sniper_hold_rate) * 100 : undefined,
    smartBuyers: d.smart_buy_count != null ? Number(d.smart_buy_count) : undefined,
    kolBuyers: d.kol_buy_count != null ? Number(d.kol_buy_count) : undefined,
  };
}
