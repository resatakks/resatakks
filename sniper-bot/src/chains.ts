import { Connection, Keypair, PublicKey } from '@solana/web3.js';
import { JsonRpcProvider, Wallet } from 'ethers';
import bs58 from 'bs58';
import { env, isLive, type EvmChain } from './config.js';

export const HELIUS_RPC = () => `https://mainnet.helius-rpc.com/?api-key=${env('HELIUS_API_KEY')}`;

let _conn: Connection | null = null;
export const solConn = () => (_conn ??= new Connection(HELIUS_RPC(), 'confirmed'));

let _kp: Keypair | null = null;
export function solKeypair(): Keypair {
  if (!_kp) _kp = Keypair.fromSecretKey(bs58.decode(env('SOLANA_PRIVATE_KEY')));
  return _kp;
}
// Paper modda imza gerekmez; quote için herhangi bir geçerli pubkey yeter.
export const solPubkey = (): PublicKey =>
  isLive() ? solKeypair().publicKey : new PublicKey('11111111111111111111111111111111');


export const SOL_MINT = 'So11111111111111111111111111111111111111112';
export const QUOTE_MINTS = new Set([
  SOL_MINT,
  'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // USDC
  'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB', // USDT
]);

export const PANCAKE_V2_ROUTER = '0x10ED43C718714eb63d5aA57B78B54704E256024E';
export const WBNB = '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c';
export const BSC_QUOTE_TOKENS = new Set(
  [
    WBNB,
    '0x55d398326f99059fF775485246999027B3197955', // USDT
    '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d', // USDC
    '0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56', // BUSD
  ].map((a) => a.toLowerCase()),
);
export const BURN_ADDRS = new Set([
  '0x0000000000000000000000000000000000000000',
  '0x000000000000000000000000000000000000dead',
]);

// ---------- EVM ağları (BSC + Base) ----------
// Rotalar sırayla denenir; ilk sıfırdan büyük quote veren kullanılır.
// v2 = Uniswap V2 / Pancake V2 arayüzü, aero = Aerodrome (Route[] yollu, volatile havuz).
// Uniswap V3/V4 (Clanker, Flaunch vb.) havuzları desteklenmez → canRoute false / scanner atlar.
export interface EvmRoute {
  name: string;
  kind: 'v2' | 'aero';
  router: string;
  factory?: string;
}
export interface EvmNet {
  id: number;
  rpcEnv: string;
  keyEnv: string;
  wrapped: string;
  quotes: Set<string>;
  routes: EvmRoute[];
  secPerBlock: number; // varsayılan; ölçüm mümkünse blok zaman damgasından hesaplanır
  explorer: string;
}

export const WETH_BASE = '0x4200000000000000000000000000000000000006';
export const EVM: Record<EvmChain, EvmNet> = {
  bsc: {
    id: 56,
    rpcEnv: 'BSC_RPC_URL',
    keyEnv: 'BSC_PRIVATE_KEY',
    wrapped: WBNB,
    quotes: BSC_QUOTE_TOKENS,
    routes: [{ name: 'pancake_v2', kind: 'v2', router: PANCAKE_V2_ROUTER }],
    secPerBlock: 0.75,
    explorer: 'https://bscscan.com',
  },
  base: {
    id: 8453,
    rpcEnv: 'BASE_RPC_URL',
    keyEnv: 'BASE_PRIVATE_KEY',
    wrapped: WETH_BASE,
    quotes: new Set(
      [
        WETH_BASE,
        '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', // USDC
        '0xd9aAEc86B65D86f6A7B5B1b0c42FFA531710b6CA', // USDbC
      ].map((a) => a.toLowerCase()),
    ),
    // Adresler resmi deployment listelerinden; live öncesi basescan'de doğrula.
    routes: [
      { name: 'uniswap_v2', kind: 'v2', router: '0x4752ba5DBc23f44D87826276BF6Fd6b1C372aD24' },
      { name: 'aerodrome', kind: 'aero', router: '0xcF77a3Ba9A5CA399B7c97c74d54e5b1Beb874E43', factory: '0x420DD381b31aEf6683db6B902084cB0FFECe40Da' },
    ],
    secPerBlock: 2,
    explorer: 'https://basescan.org',
  },
};

const providers = new Map<EvmChain, JsonRpcProvider>();
export const evmProvider = (c: EvmChain) => {
  let p = providers.get(c);
  if (!p) providers.set(c, (p = new JsonRpcProvider(env(EVM[c].rpcEnv), EVM[c].id, { staticNetwork: true })));
  return p;
};
const signers = new Map<EvmChain, Wallet>();
export const evmWallet = (c: EvmChain) => {
  let w = signers.get(c);
  if (!w) signers.set(c, (w = new Wallet(env(EVM[c].keyEnv), evmProvider(c))));
  return w;
};
export const bscProvider = () => evmProvider('bsc');
export const isEvmAddress = (a: string) => /^0x[0-9a-fA-F]{40}$/.test(a);
