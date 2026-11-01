import { LAMPORTS_PER_SOL } from '@solana/web3.js';
import { cfg, paperOnly, type Chain } from '../config.js';
import { SOL_MINT } from '../chains.js';
import { state, save } from '../state.js';
import { evmExecutor, evmQuoteBuy } from './evm.js';
import { jupQuote, mintDecimals, solanaExecutor } from './solana.js';
import type { Executor, Fill } from './types.js';

const live: Record<Chain, Executor> = { solana: solanaExecutor, bsc: evmExecutor('bsc'), base: evmExecutor('base'), blast: evmExecutor('blast') };
const haircut = (x: number) => x * (1 - cfg.exec.paper_extra_slippage_pct / 100);
const cut = (raw: bigint) => (raw * BigInt(Math.round(haircut(1) * 10_000))) / 10_000n;

async function paperBuyQuote(chain: Chain, token: string, size: number): Promise<Fill> {
  if (chain === 'solana') {
    const q = await jupQuote(SOL_MINT, token, BigInt(Math.floor(size * LAMPORTS_PER_SOL)), cfg.exec.slippage_bps);
    return { tokenRaw: cut(BigInt(q.outAmount)), decimals: await mintDecimals(token), spentNative: size, sig: 'paper' };
  }
  const q = await evmQuoteBuy(chain, token, size);
  if (!q) throw new Error('rota yok');
  return { tokenRaw: cut(q.out), decimals: q.decimals, spentNative: size, sig: 'paper' };
}

// Paper: gerçek quote'lar, sanal bakiye. Live ile aynı arayüz → aynı karar yolu.
function paperExecutor(chain: Chain): Executor {
  return {
    chain,
    canRoute: (t, s) => live[chain].canRoute(t, s),
    quoteSell: (t, raw) => live[chain].quoteSell(t, raw),
    async buy(token, size) {
      const fill = await paperBuyQuote(chain, token, size);
      state.paperBalance[chain] -= size;
      save();
      return fill;
    },
    async sell(token, raw) {
      const out = haircut(await live[chain].quoteSell(token, raw));
      state.paperBalance[chain] += out;
      save();
      return { outNative: out, sig: 'paper' };
    },
    async balance() {
      return state.paperBalance[chain];
    },
  };
}

// chains.<chain>.paper_only: live modda bile o ağ paper kalır (ör. Base önce paper'da gözlenir).
export const executor = (chain: Chain): Executor => (paperOnly(chain) ? paperExecutor(chain) : live[chain]);
