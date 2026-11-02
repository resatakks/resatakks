import fs from 'node:fs';
import path from 'node:path';
import { DATA_DIR, cfg } from './config.js';

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function getJson<T = any>(url: string, init: RequestInit = {}, timeoutMs = 10_000): Promise<T> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const r = await fetch(url, {
      ...init,
      signal: ctrl.signal,
      headers: { accept: 'application/json', 'content-type': 'application/json', ...(init.headers ?? {}) },
    });
    if (!r.ok) throw new Error(`HTTP ${r.status} ${url.split('?')[0]}`);
    return (await r.json()) as T;
  } finally {
    clearTimeout(t);
  }
}

// Aynı anahtar için çağrılar arasında en az minGapMs bırakır (ücretsiz API limitleri).
const nextSlot = new Map<string, number>();
export async function throttle(key: string, minGapMs: number) {
  const now = Date.now();
  const at = Math.max(now, nextSlot.get(key) ?? 0);
  nextSlot.set(key, at + minGapMs);
  if (at > now) await sleep(at - now);
}

export function jsonl(file: string, row: object) {
  fs.appendFileSync(path.join(DATA_DIR, file), JSON.stringify({ ts: new Date().toISOString(), ...row }) + '\n');
}

export function readJsonl<T = any>(file: string): T[] {
  const p = path.join(DATA_DIR, file);
  if (!fs.existsSync(p)) return [];
  return fs
    .readFileSync(p, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((l) => JSON.parse(l) as T);
}

function write(lvl: string, msg: string, extra?: object) {
  const line = `[${new Date().toISOString()}] ${lvl.toUpperCase()} ${msg}`;
  (lvl === 'error' ? console.error : console.log)(line, extra ? JSON.stringify(extra) : '');
  jsonl('bot.log.jsonl', { lvl, msg, ...extra });
}

export const log = {
  info: (m: string, x?: object) => write('info', m, x),
  warn: (m: string, x?: object) => write('warn', m, x),
  error: (m: string, x?: object) => write('error', m, x),
};

export const errMsg = (e: unknown) => (e instanceof Error ? e.message : String(e));

// Basit sınırlı paralellik kuyruğu.
export function queue(concurrency: number) {
  let active = 0;
  const pending: (() => Promise<void>)[] = [];
  const pump = () => {
    while (active < concurrency && pending.length) {
      const job = pending.shift()!;
      active++;
      job().finally(() => {
        active--;
        pump();
      });
    }
  };
  return {
    push(job: () => Promise<void>) {
      pending.push(job);
      pump();
    },
    get size() {
      return pending.length + active;
    },
  };
}

// Gün sınırı config timezone'una göre (Europe/Istanbul → gece seansı tek güne düşer).
export const utcDay = (d = new Date()) => d.toLocaleDateString('en-CA', { timeZone: cfg.timezone });
export const localHHMM = (d = new Date()) =>
  d.toLocaleTimeString('en-GB', { timeZone: cfg.timezone, hour: '2-digit', minute: '2-digit', hour12: false });
