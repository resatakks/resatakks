// Kendi verinden smart-money aday cüzdan çıkarır: kazanan token'larda erken top-holder olup
// rug'larda görünmeyen adresler. Yalnız botun KENDİ kayıtları (early_buyers/candidates/outcomes.jsonl) kullanılır;
// hazır/dış cüzdan listesi yok. Çıktı ÖNERİDİR; wallets.yaml'a eklemeden önce Solscan/BscScan/Basescan'de elle doğrula.
// Otomatik eleme: rug oranı > %35, win rate < %42, sniper bot (aynı token'da > 3 erken alım), halka üyesi (senkron/fonlama/wash/rug kümesi/dev-sniper, skordan bağımsız),
// tuzak şüphe skoru ≥ filters.suspect_wallet_score (trap.ts: rug ortağı, smart-money tuzağı, dev+sniper hibrit, seri dev, wash halkası, rug kümesi).
// Sniper botlar data/sniper-bots.json'a, tüm şüpheliler data/suspect-wallets.json'a yazılır.
// Kullanım: npm run discover-wallets            (en az ~1 hafta candidates + outcomes verisi gerekir)
import fs from 'node:fs';
import path from 'node:path';
import { CHAINS, DATA_DIR, cfg, isEvm, normAddr, wallets, type Chain, type EvmChain } from '../src/config.js';
import { EVM } from '../src/chains.js';
import { suspectOf, suspects, type SuspectKind } from '../src/trap.js';
import { readJsonl, utcDay } from '../src/util.js';

const WIN_MAX_PCT = 100; // 6 saatte en az 2x
const RUG_MIN_PCT = -80;
const MIN_WINS = 3;
const MAX_RUG_RATE = 0.35;
const MIN_WIN_RATE = 0.42;
const SNIPER_EARLY_BUYS = 3; // aynı token'da bundan FAZLA erken alım = bot
const MAX_SUSPICION = cfg.filters.suspect_wallet_score; // bu skor ve üstü aday listesine giremez

const outcomes = new Map(readJsonl<any>('outcomes.jsonl').map((o) => [`${o.chain}:${o.token}`, o]));
const known = new Set(CHAINS.flatMap((c) => wallets[c].map((w) => w.address.toLowerCase())));

interface Stat {
  chain: string;
  address: string;
  wins: number;
  rugs: number;
  seen: number;
  sumMax: number;
  tokens: string[];
}
const stats = new Map<string, Stat>();

// early_buyers.jsonl (sniper.ts): ilk 4 slot/blokta aynı token'a çok kez giren = sniper bot
const norm = (chain: string, a: string) => normAddr(chain as Chain, a);
const bots = new Map<string, { chain: string; address: string; tokens: number; maxBuys: number; quickFlips: number }>();
for (const e of readJsonl<any>('early_buyers.jsonl')) {
  const k = `${e.chain}:${norm(e.chain, e.wallet)}`;
  const b = bots.get(k) ?? { chain: e.chain, address: e.wallet, tokens: 0, maxBuys: 0, quickFlips: 0 };
  b.tokens++;
  b.maxBuys = Math.max(b.maxBuys, e.buys ?? 1);
  if (e.sold && (e.holdMin ?? Infinity) <= cfg.filters.quick_flip_min) b.quickFlips++;
  bots.set(k, b);
}
for (const [k, b] of bots) if (b.maxBuys <= SNIPER_EARLY_BUYS) bots.delete(k);
const isBot = (chain: string, a: string) => bots.has(`${chain}:${norm(chain, a)}`);
const done = new Set<string>();

for (const c of readJsonl<any>('candidates.jsonl')) {
  const key = `${c.chain}:${c.token}`;
  if (done.has(key)) continue;
  done.add(key);
  const o = outcomes.get(key);
  const addrs: string[] = c.metrics?.holderAddrs ?? [];
  if (!o || !addrs.length) continue;
  const win = o.maxPct >= WIN_MAX_PCT && o.minPct > RUG_MIN_PCT;
  const rug = o.minPct <= RUG_MIN_PCT;
  for (const a of addrs) {
    const k = `${c.chain}:${a}`;
    const s = stats.get(k) ?? { chain: c.chain, address: a, wins: 0, rugs: 0, seen: 0, sumMax: 0, tokens: [] as string[] };
    s.seen++;
    if (win) {
      s.wins++;
      s.sumMax += o.maxPct;
      s.tokens.push(c.symbol);
    }
    if (rug) s.rugs++;
    stats.set(k, s);
  }
}

// Çok sık görünen adresler genelde bot/aggregator/CEX'tir → seen tavanı ve rug cezası.
const RING: SuspectKind[] = ['sync_ring', 'funder_ring', 'wash_ring', 'rug_cluster', 'dev_sniper'];
const eliminated = { rug: 0, winRate: 0, bot: 0, trap: 0, ring: 0 };
const ranked = [...stats.values()]
  .filter((s) => s.wins >= MIN_WINS && !known.has(s.address.toLowerCase()) && s.seen <= 200)
  .filter((s) => {
    if (s.rugs / s.seen > MAX_RUG_RATE) return void eliminated.rug++, false;
    if (s.wins / s.seen < MIN_WIN_RATE) return void eliminated.winRate++, false;
    if (isBot(s.chain, s.address)) return void eliminated.bot++, false;
    const sp = suspectOf(s.chain, s.address);
    if (sp && sp.kinds.some((k) => RING.includes(k))) return void eliminated.ring++, false; // halka üyesi = skor düşük olsa da takip edilmez
    if ((sp?.score ?? 0) >= MAX_SUSPICION) return void eliminated.trap++, false;
    return true;
  })
  .map((s) => ({ ...s, score: (s.wins - 2 * s.rugs) * Math.log1p(s.sumMax / s.wins) * (s.wins / s.seen) }))
  .sort((a, b) => b.score - a.score)
  .slice(0, 40);

const sus = suspects(MAX_SUSPICION);
const trackedBad = sus.filter((x) => x.label);
const KINDS: [SuspectKind, string][] = [
  ['smart_trap', "Smart-money tuzağı (erken alıp rug'dan önce satan)"],
  ['rug_accomplice', "Rug ortağı (≥2 rug'da erken alıcı)"],
  ['dev_sniper', 'Dev + sniper hibrit'],
  ['serial_dev', "Seri rug'cu dev"],
  ['wash_ring', 'Wash trading halkası'],
  ['rug_cluster', "Rug kümesi (aynı grup birden fazla rug'da)"],
  ['sync_ring', 'Senkron halka (aynı blokta birlikte işlem, ≥2 token)'],
  ['funder_ring', 'Fonlayıcı halkası (≥2 token\'da erken alıcıları fonlayan cüzdan)'],
  ['sniper_bot', 'Sniper bot'],
];
function syncPairs(): string[] {
  const pairs = new Map<string, Set<string>>();
  for (const g of readJsonl<any>('smart_sync.jsonl')) {
    const ls = [...new Set<string>(g.labels ?? [])].sort();
    for (let i = 0; i < ls.length; i++) for (let j = i + 1; j < ls.length; j++) (pairs.get(`${ls[i]} + ${ls[j]}`) ?? pairs.set(`${ls[i]} + ${ls[j]}`, new Set()).get(`${ls[i]} + ${ls[j]}`)!).add(`${g.chain}:${g.token}`);
  }
  const xs = [...pairs].filter(([, t]) => t.size >= 2).sort((a, b) => b[1].size - a[1].size).slice(0, 20);
  return xs.length ? xs.map(([p, t]) => `- ${p} · ${t.size} token'da aynı anda`) : ['- yok (≥2 token gerekir)'];
}
const explorer = (chain: string, a: string) =>
  isEvm(chain as Chain) ? `${EVM[chain as EvmChain].explorer}/address/${a}` : `https://solscan.io/account/${a}`;
const lines = [
  `# Aday cüzdanlar ${utcDay()} — ${done.size} token, ${outcomes.size} sonuç`,
  `kriter: ≥${MIN_WINS} kazanan (max ≥ +${WIN_MAX_PCT}%), rug oranı ≤ %${MAX_RUG_RATE * 100}, win rate ≥ %${MIN_WIN_RATE * 100}, sniper bot değil, şüphe skoru < ${MAX_SUSPICION}, zaten izlenenler hariç`,
  `elenen: rug oranı ${eliminated.rug} · düşük win rate ${eliminated.winRate} · sniper bot ${eliminated.bot} · tuzak şüphesi ${eliminated.trap} · halka üyesi (senkron/fonlama/wash/rug kümesi/dev-sniper) ${eliminated.ring}`,
  '',
  ...ranked.map(
    (s) =>
      `- ${s.chain} ${s.address} · kazanç ${s.wins} / rug ${s.rugs} / görülme ${s.seen} · win %${((s.wins / s.seen) * 100).toFixed(0)} · ort max +${(s.sumMax / s.wins).toFixed(0)}% · ${s.tokens.slice(0, 5).join(', ')}\n  ${explorer(s.chain, s.address)}`,
  ),
  '',
  `# Sniper bot olarak işaretlenen (aynı token'da > ${SNIPER_EARLY_BUYS} erken alım) — EKLEME`,
  ...[...bots.values()]
    .sort((a, b) => b.tokens - a.tokens)
    .slice(0, 50)
    .map((b) => `- ${b.chain} ${b.address} · ${b.tokens} token · max ${b.maxBuys} erken alım · ${b.quickFlips} hızlı satış`),
  '',
  `# İzlenen cüzdanlardan AYNI ANDA (≤${cfg.filters.sync_entry_sec ?? 3} sn) giren gruplar — bağımsız değil, birini tut ya da hepsini çıkar`,
  ...syncPairs(),
  '',
  `# İzlenen cüzdanlardan şüpheli olanlar (wallets.yaml'dan ÇIKARMAYI düşün)`,
  ...(trackedBad.length ? trackedBad.map((x) => `- ${x.label} ${x.chain} ${x.address} · skor ${x.score} · ${x.kinds.join(', ')} · ${x.reasons.join('; ')}`) : ['- yok']),
  '',
  `# Tuzak şüphelileri (skor ≥ ${MAX_SUSPICION}) — EKLEME`,
  ...KINDS.flatMap(([k, title]) => {
    const xs = sus.filter((x) => x.kinds.includes(k)).slice(0, 15);
    return xs.length ? [`## ${title} (${sus.filter((x) => x.kinds.includes(k)).length})`, ...xs.map((x) => `- ${x.chain} ${x.address} · skor ${x.score} · ${x.reasons.join('; ')}`)] : [];
  }),
  ...(sus.length ? [] : ['- yok (early_buyers/outcomes geçmişi biriktikçe dolar)']),
  '',
  '# wallets.yaml formatı (doğruladıktan sonra kopyala)',
  ...ranked.map((s) => `#  - { address: "${s.address}", label: "auto-${s.address.slice(0, 6)}", type: smart }   # ${s.chain}`),
];
if (!ranked.length) lines.push('', 'yeterli veri yok — botu paper modda birkaç gün daha çalıştır.');

fs.writeFileSync(path.join(DATA_DIR, 'sniper-bots.json'), JSON.stringify([...bots.values()], null, 2));
fs.writeFileSync(path.join(DATA_DIR, 'suspect-wallets.json'), JSON.stringify(sus, null, 2));
const out = path.join(DATA_DIR, `wallet-candidates-${utcDay()}.md`);
fs.writeFileSync(out, lines.join('\n'));
console.log(lines.join('\n'));
console.log(`\n→ ${out}`);
