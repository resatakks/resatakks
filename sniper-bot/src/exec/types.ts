import type { Chain } from '../config.js';

export interface Fill {
  tokenRaw: bigint;
  decimals: number;
  spentNative: number;
  sig?: string;
}

export interface Executor {
  chain: Chain;
  /** sizeNative kadar native → token. */
  buy(token: string, sizeNative: number): Promise<Fill>;
  /** raw token satılsa kaç native gelir (gerçek quote). */
  quoteSell(token: string, raw: bigint): Promise<number>;
  sell(token: string, raw: bigint): Promise<{ outNative: number; sig?: string }>;
  balance(): Promise<number>;
  /** Rota var mı (Jupiter / Pancake V2). */
  canRoute(token: string, sizeNative: number): Promise<boolean>;
}
