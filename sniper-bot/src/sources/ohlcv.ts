import { filtersFor, type Chain } from '../config.js';
import { getJson, throttle } from '../util.js';

const GECKO = 'https://api.geckoterminal.com/api/v2';

// İlk early_dump_window_min dakikadaki dump: launch'tan itibaren görülen zirveden (high) sonraki en düşük low'a düşüş %.
// Sniper/insider'ların ilk dakikalarda satıp grafiği "temizlenmiş" gibi göstermesini yakalar.
// Pencere henüz dolmadıysa eldeki dakikalarla hesaplanır; mum yoksa null (filtre elemez).
export async function earlyDumpPct(chain: Chain, pair: string, pairCreatedAt: number): Promise<number | null> {
  await throttle('gecko', 2100);
  const j = await getJson<any>(`${GECKO}/networks/${chain}/pools/${pair}/ohlcv/minute?aggregate=1&limit=100&currency=usd`);
  const list: number[][] = j?.data?.attributes?.ohlcv_list ?? [];
  const t0 = Math.floor(pairCreatedAt / 1000);
  const t1 = t0 + filtersFor(chain).early_dump_window_min * 60;
  const c = list.filter((x) => x[0] >= t0 - 60 && x[0] <= t1).sort((a, b) => a[0] - b[0]); // [ts, o, h, l, c, v]
  if (!c.length) return null;
  let peak = 0;
  let worst = 0;
  for (const [, , h, l] of c) {
    peak = Math.max(peak, h);
    if (peak > 0) worst = Math.max(worst, ((peak - l) / peak) * 100);
  }
  return worst;
}
