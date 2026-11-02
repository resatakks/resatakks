import { cfg, normAddr, type Chain } from '../config.js';
import type { PairInfo } from '../types.js';
import { getJson, throttle } from '../util.js';

const DEXS = 'https://api.dexscreener.com';
const GECKO = 'https://api.geckoterminal.com/api/v2';

// token → ilk görüldüğü launchpad/dex (GeckoTerminal dex id). Bonding curve'den mezun olup
// pumpswap/meteora'ya geçen token DexScreener'da yeni dex'iyle görünür; köken burada kalır.
const origin = new Map<string, string>();

// GeckoTerminal: yeni havuzlar (free ~30 rpm → 2.1 sn aralık). Sayfa sayısı scan.gecko_pages.
export async function geckoNewPools(chain: Chain): Promise<string[]> {
  const pages = Math.max(1, cfg.scan.gecko_pages?.[chain] ?? 1);
  const skip = new Set(cfg.scan.skip_launchpads ?? []);
  const out: string[] = [];
  for (let page = 1; page <= pages; page++) {
    await throttle('gecko', 2100);
    const j = await getJson<any>(`${GECKO}/networks/${chain}/new_pools?page=${page}`);
    for (const p of j.data ?? []) {
      const id = String(p.relationships?.base_token?.data?.id ?? '');
      const token = id.slice(id.indexOf('_') + 1);
      const dex = String(p.relationships?.dex?.data?.id ?? '');
      if (!token) continue;
      const k = `${chain}:${normAddr(chain, token)}`;
      if (dex && !origin.has(k)) origin.set(k, dex);
      if (skip.has(origin.get(k) ?? dex)) continue;
      out.push(token);
    }
    if ((j.data ?? []).length < 20) break;
  }
  if (origin.size > 50_000) origin.clear();
  return out;
}

// DexScreener: profil açan yeni token'lar (genelde dev/ekip aktif olanlar).
export async function dexsLatestProfiles(chain: Chain): Promise<string[]> {
  await throttle('dexs', 1100);
  const rows = await getJson<any[]>(`${DEXS}/token-profiles/latest/v1`);
  return rows.filter((r) => r.chainId === chain).map((r) => r.tokenAddress);
}

// Token başına en likit çift. /tokens/v1 tek çağrıda 30 adres alır (300 rpm).
export async function bestPairs(chain: Chain, tokens: string[]): Promise<Map<string, PairInfo>> {
  const out = new Map<string, PairInfo>();
  for (let i = 0; i < tokens.length; i += 30) {
    const chunk = tokens.slice(i, i + 30);
    await throttle('dexs', 250);
    const pairs = await getJson<any[]>(`${DEXS}/tokens/v1/${chain}/${chunk.join(',')}`);
    for (const p of pairs ?? []) {
      const token: string = p.baseToken?.address;
      if (!token) continue;
      const key = normAddr(chain, token);
      const liq = Number(p.liquidity?.usd ?? 0);
      const prev = out.get(key);
      if (prev && prev.liquidityUsd >= liq) continue;
      out.set(key, {
        chain,
        token: key,
        symbol: p.baseToken?.symbol ?? '?',
        pair: p.pairAddress,
        dex: p.dexId,
        priceUsd: Number(p.priceUsd ?? 0),
        liquidityUsd: liq,
        fdvUsd: Number(p.fdv ?? 0),
        pairCreatedAt: Number(p.pairCreatedAt ?? 0),
        launchpad: origin.get(`${chain}:${key}`) ?? p.dexId,
      });
    }
  }
  return out;
}

export async function discover(chain: Chain): Promise<string[]> {
  const [a, b] = await Promise.allSettled([geckoNewPools(chain), dexsLatestProfiles(chain)]);
  const set = new Set<string>();
  for (const r of [a, b]) if (r.status === 'fulfilled') r.value.forEach((t) => set.add(normAddr(chain, t)));
  return [...set];
}
