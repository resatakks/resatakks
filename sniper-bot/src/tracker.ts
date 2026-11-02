import fs from 'node:fs';
import path from 'node:path';
import { CHAINS, DATA_DIR, cfg, type Chain } from './config.js';
import { bestPairs } from './sources/discovery.js';
import type { PairInfo } from './types.js';
import { errMsg, jsonl, log } from './util.js';

// Her değerlendirilen aday için fiyat yolu: [dakika, % değişim]. Haftalık optimizasyonun ham verisi.
export interface Tracked {
  chain: Chain;
  token: string;
  startedAt: number;
  p0: number;
  path: [number, number][];
}

const FILE = path.join(DATA_DIR, 'tracking.json');
const items: Tracked[] = fs.existsSync(FILE) ? JSON.parse(fs.readFileSync(FILE, 'utf8')) : [];

export function track(pi: PairInfo) {
  if (!pi.priceUsd || items.some((i) => i.chain === pi.chain && i.token === pi.token)) return;
  items.push({ chain: pi.chain, token: pi.token, startedAt: Date.now(), p0: pi.priceUsd, path: [] });
}

async function tick() {
  for (const chain of CHAINS) {
    const list = items.filter((i) => i.chain === chain);
    if (!list.length) continue;
    const prices = await bestPairs(chain, list.map((i) => i.token));
    for (const it of list) {
      const p = prices.get(it.token)?.priceUsd ?? 0; // pair kaybolduysa (rug) 0 → -100%
      it.path.push([Math.round((Date.now() - it.startedAt) / 60_000), p ? (p / it.p0 - 1) * 100 : -100]);
    }
  }
  const limit = cfg.tracking.track_for_min * 60_000;
  for (let i = items.length - 1; i >= 0; i--) {
    const it = items[i];
    if (Date.now() - it.startedAt < limit) continue;
    const pcts = it.path.map((x) => x[1]);
    jsonl('outcomes.jsonl', { ...it, maxPct: Math.max(...pcts, 0), minPct: Math.min(...pcts, 0) });
    items.splice(i, 1);
  }
  fs.writeFileSync(FILE, JSON.stringify(items));
}

export function startTracker() {
  setInterval(() => tick().catch((e) => log.warn('tracker', { err: errMsg(e) })), cfg.tracking.sample_every_min * 60_000);
}

// Devam eden izlemeler (gece raporu bitmemiş yolları da kullanır).
export const trackingSnapshot = (): Tracked[] => items.map((i) => ({ ...i, path: [...i.path] }));
