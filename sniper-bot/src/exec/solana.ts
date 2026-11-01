import { LAMPORTS_PER_SOL, PublicKey, VersionedTransaction } from '@solana/web3.js';
import { cfg } from '../config.js';
import { SOL_MINT, solConn, solKeypair, solPubkey } from '../chains.js';
import { getJson, sleep, throttle } from '../util.js';
import type { Executor, Fill } from './types.js';

const JUP = 'https://lite-api.jup.ag/swap/v1';

export async function jupQuote(inputMint: string, outputMint: string, amount: bigint, slippageBps: number) {
  await throttle('jup', 1100); // lite-api ~60 rpm
  const q = await getJson<any>(
    `${JUP}/quote?inputMint=${inputMint}&outputMint=${outputMint}&amount=${amount}&slippageBps=${slippageBps}&restrictIntermediateTokens=true`,
  );
  if (!q?.outAmount) throw new Error(`jup quote yok: ${q?.error ?? 'empty'}`);
  return q;
}

const decimalsCache = new Map<string, number>();
export async function mintDecimals(mint: string): Promise<number> {
  if (decimalsCache.has(mint)) return decimalsCache.get(mint)!;
  const info = await solConn().getParsedAccountInfo(new PublicKey(mint));
  const d = Number((info.value?.data as any)?.parsed?.info?.decimals ?? 6);
  decimalsCache.set(mint, d);
  return d;
}

async function tokenBalanceRaw(mint: string): Promise<bigint> {
  const r = await solConn().getParsedTokenAccountsByOwner(solKeypair().publicKey, { mint: new PublicKey(mint) });
  return r.value.reduce((s, a) => s + BigInt(a.account.data.parsed.info.tokenAmount.amount), 0n);
}

async function swap(quote: any): Promise<string> {
  const kp = solKeypair();
  const res = await getJson<any>(`${JUP}/swap`, {
    method: 'POST',
    body: JSON.stringify({
      quoteResponse: quote,
      userPublicKey: kp.publicKey.toBase58(),
      wrapAndUnwrapSol: true,
      dynamicComputeUnitLimit: true,
      dynamicSlippage: false,
      prioritizationFeeLamports: {
        priorityLevelWithMaxLamports: { maxLamports: cfg.exec.sol_priority_max_lamports, priorityLevel: 'veryHigh' },
      },
    }),
  });
  const tx = VersionedTransaction.deserialize(Buffer.from(res.swapTransaction, 'base64'));
  tx.sign([kp]);
  const conn = solConn();
  const sig = await conn.sendRawTransaction(tx.serialize(), { skipPreflight: true, maxRetries: 3 });
  const conf = await conn.confirmTransaction(
    { signature: sig, blockhash: tx.message.recentBlockhash, lastValidBlockHeight: res.lastValidBlockHeight },
    'confirmed',
  );
  if (conf.value.err) throw new Error(`swap fail ${sig}: ${JSON.stringify(conf.value.err)}`);
  return sig;
}

export const solanaExecutor: Executor = {
  chain: 'solana',

  async canRoute(token, sizeNative) {
    try {
      await jupQuote(SOL_MINT, token, BigInt(Math.floor(sizeNative * LAMPORTS_PER_SOL)), cfg.exec.slippage_bps);
      return true;
    } catch {
      return false;
    }
  },

  async buy(token, sizeNative): Promise<Fill> {
    const lamports = BigInt(Math.floor(sizeNative * LAMPORTS_PER_SOL));
    const before = await tokenBalanceRaw(token);
    const q = await jupQuote(SOL_MINT, token, lamports, cfg.exec.slippage_bps);
    const sig = await swap(q);
    let after = before;
    for (let i = 0; i < 5 && after === before; i++) {
      await sleep(1500);
      after = await tokenBalanceRaw(token);
    }
    return { tokenRaw: after - before, decimals: await mintDecimals(token), spentNative: sizeNative, sig };
  },

  async quoteSell(token, raw) {
    const q = await jupQuote(token, SOL_MINT, raw, cfg.exec.sell_slippage_bps);
    return Number(q.outAmount) / LAMPORTS_PER_SOL;
  },

  async sell(token, raw) {
    const have = await tokenBalanceRaw(token);
    const amt = raw > have ? have : raw;
    const before = await solConn().getBalance(solKeypair().publicKey);
    const q = await jupQuote(token, SOL_MINT, amt, cfg.exec.sell_slippage_bps);
    const sig = await swap(q);
    await sleep(1500);
    const after = await solConn().getBalance(solKeypair().publicKey);
    return { outNative: (after - before) / LAMPORTS_PER_SOL, sig }; // tx ücreti dahil net
  },

  async balance() {
    return (await solConn().getBalance(solPubkey())) / LAMPORTS_PER_SOL;
  },
};
