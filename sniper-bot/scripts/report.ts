// Haftalık işlem + cüzdan isabet raporu. Kullanım: npm run report
import { CHAINS, nativeSymbol } from '../src/config.js';
import { readJsonl } from '../src/util.js';

const since = Date.now() - 7 * 86_400_000;
const closes = readJsonl<any>('trades.jsonl').filter((t) => t.ev === 'close' && Date.parse(t.ts) >= since);

const byReason = new Map<string, { n: number; pnl: number }>();
for (const t of closes) {
  const k = String(t.exitReason).replace(/\(.*/, '');
  const v = byReason.get(k) ?? { n: 0, pnl: 0 };
  v.n++;
  v.pnl += t.pnl;
  byReason.set(k, v);
}
const sum = (chain: string) => closes.filter((t) => t.chain === chain).reduce((s, t) => s + t.pnl, 0);
console.log(`# Son 7 gün: ${closes.length} kapanış · ${CHAINS.map((c) => `${nativeSymbol(c)} ${sum(c).toFixed(4)}`).join(' · ')}`);
console.log(`win rate: ${closes.length ? ((closes.filter((t) => t.pnl > 0).length / closes.length) * 100).toFixed(0) : 0}%`);
console.log('\n## çıkış nedenleri');
for (const [k, v] of byReason) console.log(`- ${k}: ${v.n} işlem, ${v.pnl.toFixed(4)}`);

// Cüzdan kalitesi: cüzdanın aday listesinde göründüğü token'ların 6 saatlik max/min hareketi.
const outcomes = new Map(readJsonl<any>('outcomes.jsonl').map((o) => [`${o.chain}:${o.token}`, o]));
const stats = new Map<string, { n: number; max: number; min: number; rug: number }>();
for (const c of readJsonl<any>('candidates.jsonl')) {
  const o = outcomes.get(`${c.chain}:${c.token}`);
  if (!o) continue;
  for (const w of [...(c.metrics?.smartWallets ?? []), ...(c.metrics?.kolWallets ?? [])]) {
    const s = stats.get(w) ?? { n: 0, max: 0, min: 0, rug: 0 };
    s.n++;
    s.max += o.maxPct;
    s.min += o.minPct;
    if (o.minPct <= -80) s.rug++;
    stats.set(w, s);
  }
}
console.log('\n## cüzdanlar (n≥3) — avg max / avg min / rug oranı');
[...stats.entries()]
  .filter(([, s]) => s.n >= 3)
  .sort((a, b) => b[1].max / b[1].n - a[1].max / a[1].n)
  .forEach(([w, s]) =>
    console.log(`- ${w}: n=${s.n} max ${(s.max / s.n).toFixed(0)}% min ${(s.min / s.n).toFixed(0)}% rug ${((s.rug / s.n) * 100).toFixed(0)}%`),
  );
