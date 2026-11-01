import { env, filtersFor, isEvm, type Chain, type EvmChain } from '../config.js';
import { BURN_ADDRS, EVM, HELIUS_RPC } from '../chains.js';
import type { Security } from '../types.js';
import { getJson, throttle } from '../util.js';

// ---------- Solana: RugCheck tam rapor ----------
export async function solanaSecurity(mint: string): Promise<Security> {
  await throttle('rugcheck', 1200);
  const r = await getJson<any>(`https://api.rugcheck.xyz/v1/tokens/${mint}/report`, {}, 15_000);

  // Havuz/LP hesaplarını top holder hesabından çıkar (alan adları RugCheck sürümüne göre değişebiliyor).
  const poolAccts = new Set<string>();
  for (const m of r.markets ?? []) {
    for (const k of ['pubkey', 'liquidityA', 'liquidityB', 'liquidityAAccount', 'liquidityBAccount', 'mintLP']) {
      if (typeof m[k] === 'string') poolAccts.add(m[k]);
    }
  }
  const holders = (r.topHolders ?? []).filter(
    (h: any) => !poolAccts.has(h.address) && !poolAccts.has(h.owner) && !h.insider_pool,
  );
  const top10Pct = holders.slice(0, 10).reduce((s: number, h: any) => s + Number(h.pct ?? 0), 0);
  const lpLockedPct = Math.max(0, ...(r.markets ?? []).map((m: any) => Number(m.lp?.lpLockedPct ?? 0)));
  // Solana'da "vergi" = Token-2022 transfer fee extension.
  const feePct = Number(r.transferFee?.pct ?? 0);

  return {
    top10Pct,
    lpLockedPct,
    renounced: !r.mintAuthority && !r.freezeAuthority,
    buyTaxPct: feePct,
    sellTaxPct: feePct,
    honeypot: Boolean(r.rugged),
    holders: r.totalHolders != null ? Number(r.totalHolders) : null,
    holderAddrs: holders.slice(0, 20).map((h: any) => h.owner ?? h.address),
    flags: (r.risks ?? []).filter((x: any) => x.level === 'danger').map((x: any) => x.name),
    creator: typeof r.creator === 'string' ? r.creator : null,
  };
}

// Helius DAS ile holder sayımı (amount>0). Genç token'lar için 5 sayfa (5000) yeterli.
export async function solanaHolderCount(mint: string): Promise<number | null> {
  let count = 0;
  for (let page = 1; page <= 5; page++) {
    await throttle('helius-das', 150);
    const j = await getJson<any>(HELIUS_RPC(), {
      method: 'POST',
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'getTokenAccounts', params: { mint, page, limit: 1000 } }),
    });
    const accts: any[] = j.result?.token_accounts ?? [];
    count += accts.filter((a) => Number(a.amount) > 0).length;
    if (accts.length < 1000) return count;
  }
  return count; // tavan: büyüme ölçümü 5000 üstünde düzleşir
}

// ---------- EVM (BSC 56 / Base 8453): GoPlus + honeypot.is ----------
export async function evmSecurity(chain: EvmChain, token: string, pair: string): Promise<Security> {
  const id = EVM[chain].id;
  const addr = token.toLowerCase();
  await throttle('goplus', 1100);
  const [g, hp] = await Promise.all([
    getJson<any>(`https://api.gopluslabs.io/api/v1/token_security/${id}?contract_addresses=${addr}`, {}, 15_000),
    getJson<any>(`https://api.honeypot.is/v2/IsHoneypot?address=${addr}&chainID=${id}&pair=${pair}`, {}, 15_000).catch(
      () => null,
    ),
  ]);
  const t = g.result?.[addr];
  if (!t) throw new Error('goplus: veri yok');

  const pairL = pair.toLowerCase();
  const holders = (t.holders ?? []).filter(
    (h: any) => h.address?.toLowerCase() !== pairL && h.is_locked !== 1 && !BURN_ADDRS.has(h.address?.toLowerCase()),
  );
  const top10Pct = holders.slice(0, 10).reduce((s: number, h: any) => s + Number(h.percent ?? 0) * 100, 0);
  const lpLockedPct =
    (t.lp_holders ?? [])
      .filter((h: any) => h.is_locked === 1 || BURN_ADDRS.has(h.address?.toLowerCase()))
      .reduce((s: number, h: any) => s + Number(h.percent ?? 0), 0) * 100;

  const owner = String(t.owner_address ?? '').toLowerCase();
  const renounced =
    (owner === '' || BURN_ADDRS.has(owner)) && t.can_take_back_ownership !== '1' && t.hidden_owner !== '1';

  const sellTaxPct = Math.max(Number(t.sell_tax || 0) * 100, Number(hp?.simulationResult?.sellTax ?? 0));
  const buyTaxPct = Math.max(Number(t.buy_tax || 0) * 100, Number(hp?.simulationResult?.buyTax ?? 0));
  const flags = [
    t.is_mintable === '1' && 'mintable',
    t.transfer_pausable === '1' && 'pausable',
    t.is_blacklisted === '1' && 'blacklist',
    t.slippage_modifiable === '1' && 'tax_modifiable',
    t.is_proxy === '1' && 'proxy',
    t.is_anti_whale === '1' && t.anti_whale_modifiable === '1' && 'anti_whale_mod',
    t.trading_cooldown === '1' && 'trading_cooldown',
    t.personal_slippage_modifiable === '1' && 'personal_tax',
    t.external_call === '1' && 'external_call',
  ].filter(Boolean) as string[];

  return {
    top10Pct,
    lpLockedPct,
    renounced,
    buyTaxPct,
    sellTaxPct,
    honeypot: t.is_honeypot === '1' || t.cannot_sell_all === '1' || hp?.honeypotResult?.isHoneypot === true,
    holders: t.holder_count != null ? Number(t.holder_count) : null,
    holderAddrs: holders.filter((h: any) => h.is_contract !== 1).slice(0, 20).map((h: any) => h.address.toLowerCase()),
    flags,
    creator: typeof t.creator_address === 'string' && t.creator_address ? t.creator_address : null,
  };
}

export async function security(chain: Chain, token: string, pair: string): Promise<Security> {
  if (chain === 'solana') return solanaSecurity(token);
  if (isEvm(chain)) return evmSecurity(chain, token, pair);
  throw new Error(`desteklenmeyen ağ: ${chain}`);
}

// GoPlus holder_count önbellekli olabilir; EVM'de büyüme sinyali bu yüzden daha kaba.
export async function holderCount(chain: Chain, token: string, pair: string): Promise<number | null> {
  if (chain === 'solana') return env('HELIUS_API_KEY', false) ? solanaHolderCount(token) : null;
  return isEvm(chain) ? (await evmSecurity(chain, token, pair)).holders : null;
}

export const lpOk = (s: Security, chain: Chain) => {
  const f = filtersFor(chain);
  return !f.require_lp_locked || s.lpLockedPct >= f.min_lp_locked_pct;
};
