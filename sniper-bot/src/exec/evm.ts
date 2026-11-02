import { Contract, MaxUint256, formatEther, parseEther, parseUnits } from 'ethers';
import { cfg, type EvmChain } from '../config.js';
import { EVM, evmProvider, evmWallet, type EvmRoute } from '../chains.js';
import type { Executor, Fill } from './types.js';

// V2 arayüzü (Pancake V2 / Uniswap V2) ve Aerodrome (Route[] yollu) router'ları.
const V2_ABI = [
  'function getAmountsOut(uint amountIn, address[] path) view returns (uint[] amounts)',
  'function swapExactETHForTokensSupportingFeeOnTransferTokens(uint amountOutMin, address[] path, address to, uint deadline) payable',
  'function swapExactTokensForETHSupportingFeeOnTransferTokens(uint amountIn, uint amountOutMin, address[] path, address to, uint deadline)',
];
const AERO_ABI = [
  'function getAmountsOut(uint amountIn, (address from, address to, bool stable, address factory)[] routes) view returns (uint[] amounts)',
  'function swapExactETHForTokensSupportingFeeOnTransferTokens(uint amountOutMin, (address from, address to, bool stable, address factory)[] routes, address to, uint deadline) payable',
  'function swapExactTokensForETHSupportingFeeOnTransferTokens(uint amountIn, uint amountOutMin, (address from, address to, bool stable, address factory)[] routes, address to, uint deadline)',
];
const ERC20_ABI = [
  'function balanceOf(address) view returns (uint256)',
  'function decimals() view returns (uint8)',
  'function allowance(address,address) view returns (uint256)',
  'function approve(address,uint256) returns (bool)',
];

const deadline = () => Math.floor(Date.now() / 1000) + 60;
const minOut = (amt: bigint, bps: number) => (amt * BigInt(10_000 - bps)) / 10_000n;

// BSC sabit gasPrice; Base EIP-1559 (provider'ın önerisi) + tavan.
async function gas(chain: EvmChain): Promise<Record<string, bigint>> {
  if (chain === 'bsc') return { gasPrice: parseUnits(String(cfg.exec.bsc_gas_price_gwei), 'gwei') };
  const fd = await evmProvider(chain).getFeeData();
  const cap = parseUnits(String(chain === 'monad' ? (cfg.exec.monad_max_fee_gwei ?? 200) : (cfg.exec.base_max_fee_gwei ?? 0.5)), 'gwei');
  const max = fd.maxFeePerGas && fd.maxFeePerGas < cap ? fd.maxFeePerGas : cap;
  const tip = fd.maxPriorityFeePerGas && fd.maxPriorityFeePerGas < max ? fd.maxPriorityFeePerGas : max / 10n;
  return { maxFeePerGas: max, maxPriorityFeePerGas: tip };
}

function pathFor(r: EvmRoute, from: string, to: string): unknown[] {
  return r.kind === 'aero' ? [{ from, to, stable: false, factory: r.factory! }] : [from, to];
}
const abi = (r: EvmRoute) => (r.kind === 'aero' ? AERO_ABI : V2_ABI);

async function quote(chain: EvmChain, r: EvmRoute, amountIn: bigint, from: string, to: string): Promise<bigint> {
  const a: bigint[] = await new Contract(r.router, abi(r), evmProvider(chain)).getAmountsOut(amountIn, pathFor(r, from, to));
  return a[a.length - 1];
}

// Rotalar sırayla; ilk > 0 quote veren seçilir. Token başına seçilen rota önbellekte (aynı rotadan satılır).
const chosen = new Map<string, EvmRoute>();
async function best(chain: EvmChain, token: string, amountIn: bigint, buy: boolean): Promise<{ r: EvmRoute; out: bigint } | null> {
  const w = EVM[chain].wrapped;
  const key = `${chain}:${token.toLowerCase()}`;
  const order = chosen.has(key) ? [chosen.get(key)!, ...EVM[chain].routes.filter((x) => x !== chosen.get(key))] : EVM[chain].routes;
  for (const r of order) {
    try {
      const out = await quote(chain, r, amountIn, buy ? w : token, buy ? token : w);
      if (out > 0n) {
        chosen.set(key, r);
        return { r, out };
      }
    } catch {
      /* bu rotada havuz yok */
    }
  }
  return null;
}

export async function evmQuoteBuy(chain: EvmChain, token: string, sizeNative: number): Promise<{ out: bigint; decimals: number } | null> {
  const q = await best(chain, token, parseEther(sizeNative.toFixed(8)), true);
  if (!q) return null;
  const erc = new Contract(token, ERC20_ABI, evmProvider(chain));
  return { out: q.out, decimals: Number(await erc.decimals()) };
}

// Not: bonding curve (four.meme, Clanker/Flaunch V4) veya yalnız V3 havuzundaki token'lar → canRoute false.
export function evmExecutor(chain: EvmChain): Executor {
  return {
    chain,

    async canRoute(token, sizeNative) {
      return (await best(chain, token, parseEther(sizeNative.toFixed(8)), true)) != null;
    },

    async buy(token, sizeNative): Promise<Fill> {
      const w = evmWallet(chain);
      const value = parseEther(sizeNative.toFixed(8));
      const q = await best(chain, token, value, true);
      if (!q) throw new Error('rota yok');
      const erc = new Contract(token, ERC20_ABI, w);
      const before: bigint = await erc.balanceOf(w.address);
      const r = new Contract(q.r.router, abi(q.r), w);
      const tx = await r.swapExactETHForTokensSupportingFeeOnTransferTokens(
        minOut(q.out, cfg.exec.slippage_bps),
        pathFor(q.r, EVM[chain].wrapped, token),
        w.address,
        deadline(),
        { value, ...(await gas(chain)) },
      );
      const rc = await tx.wait();
      const after: bigint = await erc.balanceOf(w.address);
      return { tokenRaw: after - before, decimals: Number(await erc.decimals()), spentNative: sizeNative, sig: rc?.hash };
    },

    async quoteSell(token, raw) {
      const q = await best(chain, token, raw, false);
      return q ? Number(formatEther(q.out)) : 0;
    },

    async sell(token, raw) {
      const w = evmWallet(chain);
      const erc = new Contract(token, ERC20_ABI, w);
      const have: bigint = await erc.balanceOf(w.address);
      const amt = raw > have ? have : raw;
      const q = await best(chain, token, amt, false);
      if (!q) throw new Error('satış rotası yok');
      if ((await erc.allowance(w.address, q.r.router)) < amt) {
        await (await erc.approve(q.r.router, MaxUint256, await gas(chain))).wait();
      }
      const before = await evmProvider(chain).getBalance(w.address);
      const r = new Contract(q.r.router, abi(q.r), w);
      const tx = await r.swapExactTokensForETHSupportingFeeOnTransferTokens(
        amt,
        minOut(q.out, cfg.exec.sell_slippage_bps),
        pathFor(q.r, token, EVM[chain].wrapped),
        w.address,
        deadline(),
        await gas(chain),
      );
      const rc = await tx.wait();
      const after = await evmProvider(chain).getBalance(w.address);
      return { outNative: Number(formatEther(after - before)), sig: rc?.hash }; // gas dahil net
    },

    async balance() {
      return Number(formatEther(await evmProvider(chain).getBalance(evmWallet(chain).address)));
    },
  };
}
