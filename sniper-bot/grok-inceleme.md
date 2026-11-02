# sniper-bot — tam kaynak (inceleme için)

## README.md

```markdown
# sniper-bot — Solana (Jupiter) + BSC (Pancake V2), smart money/KOL hibrit sinyal

Varsayılan **paper** mod: gerçek quote'larla simülasyon, sanal bakiye. Live için `config.yaml → mode: live` **ve** env `LIVE_CONFIRM=YES`.

## Akış

```
GeckoTerminal new_pools + DexScreener profiles  (20 sn)
  → DexScreener çift verisi: yaş 3–90 dk, liq ≥ $8k
  → güvenlik
      SOL: RugCheck (top10 havuz hariç, LP kilit, mint/freeze authority, Token-2022 fee)
      BSC: GoPlus + honeypot.is simülasyonu, yalnız Pancake V2 çifti
      top10 < %28 · LP kilit/burn ≥ %90 · renounce · satış vergisi < %4 · honeypot yok
  → holder sayımı t0, 120 sn bekle, t1 → büyüme > %0.1  (SOL: Helius DAS, BSC: GoPlus)
  → smart money/KOL
      SOL: Helius Enhanced webhook (SWAP) + RPC bakiye doğrulama
      BSC: eth_getLogs Transfer taraması (15 sn)
      ≥ 2 giriş, en az 1'i "smart"
  → sniper oranı (on-chain: ilk 2 slot / 3 blokta alanların bugünkü payı) < %30
  → risk kapısı (src/risk.ts) → Jupiter / Pancake alım
pozisyon döngüsü (6 sn): TP +55 · SL −22 · trailing (+25'te devreye, zirveden −12) · 240 dk timeout
  · tetikleyen cüzdan satarsa → anında sat
```

Her aday (geçen ve kalan) `candidates.jsonl`'e yazılır ve 6 saat fiyatı izlenir (`outcomes.jsonl`). Optimizasyon ve gece raporu reddedilenlerin de ne yaptığını görür.

GMGN yerine: SOL'da Helius + RugCheck, BSC'de GoPlus + honeypot.is. solana.fm eklenmedi: Helius aynı veriyi (tx geçmişi, holder, webhook) tek anahtarla veriyor, ikinci bir kaynak yalnız rate-limit yükü getirir.

## Sert limitler ($30 profil — src/risk.ts tek giriş kapısı)

| Limit | SOL | BNB |
|---|---|---|
| Probe | clamp(bakiye × %20, 0.03, 0.05) | clamp(…, 0.005, 0.008) |
| Ücret rezervi | 0.02 | 0.002 |
| Günlük kayıp cap | 0.06 → o gün yeni giriş yok | 0.01 |
| Günlük kâr hedefi | +0.25 → o gün yeni giriş yok | +0.04 |
| Eşzamanlı pozisyon | 3 (iki zincir toplam) | |
| Ön-işlem bütçesi | realize kayıp + açıklar × %40 + yeni × %40 ≤ cap | |
| Kayıp sonrası cooldown | 20 dk | |
| Aynı token | 36 saat tekrar yok (kapanıştan itibaren) | |
| Ardışık kayıp | 3 → gün sonuna kadar dur | |
| Günlük işlem | 10 | |

Gün sınırı `timezone: Europe/Istanbul` — gece seansı (00:00–08:00) tek güne düşer, 03:00'te (UTC gece yarısı) sayaçlar sıfırlanmaz.

## Telegram

`/status` · `/pause` (yeni giriş yok, açıklar yönetilir) · `/resume` · `/panic` (hepsini sat + dur). Yalnız `TELEGRAM_CHAT_ID`'den gelen komutlar işlenir.

Bot: @BotFather → `/newbot` → token. Chat ID: bota bir mesaj at, `https://api.telegram.org/bot<TOKEN>/getUpdates` → `chat.id`.

## Kurulum (yerel, paper)

```bash
npm ci
cp .env.example .env   # TELEGRAM_*, HELIUS_*, BSC_RPC_URL doldur
node --env-file=.env node_modules/.bin/tsx src/index.ts
```

Yerelde Helius webhook'u gelmez (public URL yok); SOL smart money yalnız RPC doğrulamayla çalışır. Tam test için Railway.

## Railway deploy (adım adım, < $5/ay)

**Dosyalar** (repoda hazır):
- `Dockerfile` — `node:22-slim`, `npm ci --omit=dev`, `DATA_DIR=/data`, `CMD npm start`
- `railway.json` — Dockerfile builder, **1 replica** (iki kopya = çift alım), `/health` healthcheck, hata olursa 10 kez yeniden başlat
- `.dockerignore` — `node_modules`, `data`, `.env` imaja girmez

**1. Hesap + CLI**
```bash
npm i -g @railway/cli
railway login
```
Railway → **Hobby** plan ($5/ay, $5 kullanım dahil).

**2. Proje**
```bash
cd sniper-bot
railway init          # "sniper-bot" adında yeni proje
railway up            # Dockerfile ile build + deploy (ilk deploy env eksik diye crash eder, normal)
```

**3. Volume** — Dashboard → servis → sağ tık **Attach Volume** → mount path `/data`. state.json, tüm `.jsonl` loglar ve raporlar burada; restart/redeploy'da kaybolmaz.

**4. Variables** — servis → **Variables → Raw Editor**:

| Değişken | Değer | Not |
|---|---|---|
| `TELEGRAM_BOT_TOKEN` | BotFather token | zorunlu |
| `TELEGRAM_CHAT_ID` | kendi chat id | zorunlu, komutlar yalnız buradan |
| `HELIUS_API_KEY` | dashboard.helius.dev | zorunlu (RPC + DAS + webhook) |
| `HELIUS_WEBHOOK_AUTH` | rastgele 32+ karakter (`openssl rand -hex 24`) | zorunlu |
| `BSC_RPC_URL` | NodeReal/Ankr free endpoint | zorunlu, `eth_getLogs` destekli olmalı |
| `DATA_DIR` | `/data` | volume yolu |
| `PORT` | `8080` | Railway domain bu porta yönlenir |
| `LIVE_CONFIRM` | boş / `YES` | yalnız live |
| `SOLANA_PRIVATE_KEY` | base58 | yalnız live, bota özel ayrı cüzdan |
| `BSC_PRIVATE_KEY` | 0x… | yalnız live, bota özel ayrı cüzdan |
| `GMGN_API_BASE` | boş | opsiyonel adaptör |

Kaydet → otomatik redeploy.

**5. Domain** — **Settings → Networking → Generate Domain** (port 8080). Kontrol:
```bash
curl https://<x>.up.railway.app/health
```
`{"ok":true,"mode":"paper",...}` dönmeli.

**6. Helius webhook** — dashboard.helius.dev → **Webhooks → New Webhook**:
- type: **Enhanced**, transaction types: `SWAP`
- account addresses: `wallets.yaml → solana` adresleri
- webhook URL: `https://<x>.up.railway.app/webhook/helius`
- Authentication header: `HELIUS_WEBHOOK_AUTH` değerinin aynısı

**7. Doğrula** — Telegram'da `🤖 bot başladı · PAPER` gelir. `railway logs` → `started`, `nightly başladı` satırları.

**8. Güncelleme** — kod/config değişince `railway up`. Loglar: `railway logs`. Volume'a erişim: `railway ssh`.

**Maliyet**

| Kalem | $/ay |
|---|---|
| Railway Hobby (bu bot ~0.1 vCPU / ~200 MB → $5 dahil kullanımın içinde) | 5 |
| Helius free (1M kredi, webhook dahil) | 0 |
| NodeReal/Ankr BSC RPC free | 0 |
| DexScreener / GeckoTerminal / RugCheck / GoPlus / honeypot.is / Jupiter lite | 0 |
| **Toplam** | **~5** (on-chain ücretler hariç) |

Volume ~1 GB'ın altında kalır (jsonl, haftada ~20–50 MB). Helius kredisi yükselirse önce `sniper_sig_pages`'i düşür.

**Cloudflare Workers neden değil:** sürekli süreç, 6 sn pozisyon döngüsü, Telegram long-poll ve dosya state'i gerekiyor; Workers cron en sık 1 dk.

## Gece modu (00:00–08:00)

`config.yaml → nightly`:

```yaml
nightly:
  enabled: true          # Railway'de sürekli açık bot her gece raporlar
  start: "00:00"
  end: "08:00"
  summary_every_min: 30  # data/nightly-summary.log'a satır
  summary_to_telegram: false
  report_at: "07:45"     # ☀️ Sabah Raporu
```

Pencere içinde bot normal çalışır (`mode`'a göre paper veya live) ve ayrıca **gölge paper** tutar: filtreyi geçen *her* aday — risk kapısı (cap, cooldown, max_concurrent) engellese bile — `outcomes`/izleme fiyat yolu üzerinde mevcut çıkış kurallarıyla simüle edilir. Böylece gerçek işlem sayısı az olsa da filtre kalitesi ölçülür; çift alım yapılmaz.

Her 30 dk `data/nightly-summary.log`:
```
[03:30] tarandı 412 ön-filtre 37 derin 37 · açık 1 · solana: aday 29 geçen 2 gölge 2tr avg 8.4% · gerçek 1tr +0.0041 SOL | bsc: …
```

07:45'te Telegram'a **☀️ Sabah Raporu** (kopyası `data/sabah-raporu-YYYY-MM-DD.txt`):
- tarama: keşif / ön-filtre / derin kontrol / filtre geçen / risk kapısına takılan / açılan
- zincir başına: aday, geçen, en sık eleme nedenleri, gölge paper (n, win, avg, pf, PnL), gerçek paper/live kapanan işlemler ve PnL, günlük cap/hedef durumu
- açık pozisyonlar, günlük durdurma/duraklatma
- **önerilen config değişikliği** (tüm geçmiş veriyle walk-forward; config otomatik değişmez)

## Sabah 8'e kadar çalıştır, 07:45'te rapor ver

**Railway'de (önerilen):** `nightly.enabled: true` ile bot zaten sürekli açık; her gece 00:00–08:00 özet yazar ve 07:45'te raporu atar. Ek bir şey yapma.

**Yerelde tek gece:**
```bash
caffeinate -i node --env-file=.env node_modules/.bin/tsx src/nightly-run.ts
```
veya `.env` shell'e yüklüyse `caffeinate -i npm run nightly`. Davranış:
- gece yarısından önce başlatırsan 00:00'ı bekler, pencereye girer
- 07:45'te Sabah Raporu → Telegram
- 08:00'de durumu kaydedip çıkar (rapor kaçtıysa çıkarken atar)
- gündüz başlatırsan bir sonraki 08:00'e kadar çalışır
- `caffeinate -i` Mac'in uyumasını engeller; kapak kapanırsa süreç durur

Sabah kontrol:
```bash
tail -n 20 data/nightly-summary.log
cat data/sabah-raporu-$(date +%F).txt
```

## Cüzdan listesi

`wallets.yaml` boş gelir — doğrulanmamış hazır liste eklenmedi. Doldurma: paper modda 3–7 gün çalıştır → `npm run discover-wallets` → `data/wallet-candidates-*.md` → her adresi Solscan/BscScan/GMGN'de elle doğrula (wallets.yaml içindeki kriterler) → ekle → Helius webhook adres listesini güncelle → `railway up`.

## Paper → live kontrol listesi

- [ ] En az 2 hafta paper, ≥ 40 kapanmış işlem, `npm run report` net pozitif, Sabah Raporu'nda gölge avg > 0
- [ ] Bot için **ayrı** cüzdan; içinde yalnız bankroll (~0.2 SOL + ~0.03 BNB)
- [ ] `mode: live` + `LIVE_CONFIRM=YES` + private key env'leri → redeploy
- [ ] İlk gün `/status` ile takip; sorun olursa `/panic`

## Haftalık optimizasyon (her Pazar, ~15 dk)

1. **Veriyi çek:**
   ```bash
   railway ssh -- tar czf - -C /data . > data-$(date +%F).tgz
   mkdir -p pulled && tar xzf data-$(date +%F).tgz -C pulled
   ```
2. **İşlem + cüzdan raporu:** `DATA_DIR=./pulled npm run report` → n ≥ 3 ve rug oranı > %40 veya avg max < %20 olan cüzdanları çıkar.
3. **Yeni cüzdan adayları:** `DATA_DIR=./pulled npm run discover-wallets` → doğrula, haftada en fazla %20 değiştir.
4. **Grid + walk-forward:** `DATA_DIR=./pulled npm run optimize` (mantık `src/optimizer.ts`; gece raporu da aynısını kullanır)
   - train = son 7 günden önceki, test = son 7 gün; önce filtreler, sonra çıkışlar
   - rapor `pulled/optimize-YYYY-MM-DD.md`
5. **Uygulama kuralları** (karar **UYGULA** ise):
   - haftada en fazla 2 parametre, her biri bir grid basamağı
   - test n < 8 → değiştirme
   - tek filtre adayların > %70'ini kesiyor ve gevşetmek test avg'yi düşürmüyorsa gevşet
   - `config.yaml`'a yaz, commit mesajına mevcut/öneri satırlarını koy, `railway up`
6. **Geri alma:** yeni ayar ilk 3 günde eski test avg'sinin altında kalırsa önceki commit'e dön.

## Dosyalar (data/)

| Dosya | İçerik |
|---|---|
| `state.json` | pozisyonlar, paper bakiye, günlük sayaçlar |
| `candidates.jsonl` | her aday + metrikler + eleme nedenleri |
| `outcomes.jsonl` | adayların 6 saatlik fiyat yolu |
| `trades.jsonl` | açılış/kapanış, PnL |
| `wallet_events.jsonl` | izlenen cüzdan alım/satımları |
| `bot.log.jsonl` | tüm log |
| `nightly-summary.log` | 30 dk'lık gece özetleri |
| `sabah-raporu-*.txt`, `optimize-*.md`, `wallet-candidates-*.md` | raporlar |

## Bilinen sınırlar

- **BSC:** yalnız Pancake **V2**. four.meme bonding curve veya yalnız V3 havuzlu token'lar atlanır. GoPlus `holder_count` önbellekli → BSC holder büyümesi kaba.
- **RugCheck** alan adları sürüme göre değişebiliyor; ilk gün `candidates.jsonl`'de birkaç token'ı RugCheck sitesiyle karşılaştır.
- Fiyat yolu 5 dk örneklenir; gölge paper ve optimizasyonda SL gap'leri gerçekten farklı görünebilir.
- `stage: security`'de elenen adayların smart/sniper/holder metrikleri ölçülmez.
```

## config.yaml

```yaml
# $30 gerçek bankroll profili (~0.2 SOL). Varsayılan paper; live için ayrıca env LIVE_CONFIRM=YES.
mode: paper
timezone: Europe/Istanbul   # gün sınırı (günlük limitler 00:00'da sıfırlanır) + nightly saatleri

chains:
  solana: { enabled: true }
  bsc: { enabled: true }      # BSC yalnız Pancake V2 rotası

scan:
  interval_sec: 20
  min_pair_age_min: 3
  max_pair_age_min: 90
  deep_check_concurrency: 2
  seen_ttl_min: 180

filters:
  min_liquidity_usd: 8000
  max_top10_pct: 28
  require_lp_locked: true
  min_lp_locked_pct: 90
  require_renounced: true
  max_sell_tax_pct: 4
  max_buy_tax_pct: 4
  max_sniper_pct: 30
  sniper_slots: 2
  sniper_blocks: 3
  sniper_sig_pages: 3
  sniper_unknown_pass: false
  min_smart_entries: 2
  min_smart_only: 1
  smart_lookback_min: 120
  require_holder_growth: true
  holder_growth_window_sec: 120
  min_holder_growth_pct: 0.1

risk:
  sol:
    paper_start_balance: 0.2    # ≈ $30
    probe_min: 0.03
    probe_max: 0.05
    probe_balance_pct: 20       # boyut = clamp(bakiye × %20, 0.03, 0.05)
    fee_reserve: 0.02           # tx ücreti + ATA rent (~0.002/yeni token)
    daily_loss_cap: 0.06
    daily_profit_target: 0.25   # realize kâr buna ulaşınca o gün yeni giriş yok
  bnb:
    paper_start_balance: 0.03
    probe_min: 0.005
    probe_max: 0.008
    probe_balance_pct: 20
    fee_reserve: 0.002
    daily_loss_cap: 0.01
    daily_profit_target: 0.04
  max_concurrent: 3
  max_trades_per_day: 10
  cooldown_after_loss_min: 20
  max_consecutive_losses: 3
  reentry_block_hours: 36       # aynı token'a 36 saat tekrar giriş yok
  # realize kayıp + açık pozisyonlar × % + yeni × % <= daily_loss_cap
  # 0.06 cap ile %100'de tek 0.05'lik pozisyondan sonra ikinci giriş bloklanır.
  # %40 = SL(-22) + gap payı; 0.06 cap içinde 3 × 0.05 açık pozisyona izin verir.
  assumed_worst_loss_pct: 40

exit:
  take_profit_pct: 55
  stop_loss_pct: 22
  trailing_activate_pct: 25
  trailing_distance_pct: 12
  max_hold_min: 240
  smart_exit_count: 1
  poll_sec: 6
  quote_fail_exit_after: 5

exec:
  slippage_bps: 800
  sell_slippage_bps: 1500
  sol_priority_max_lamports: 50000   # 0.05 SOL'luk işlemde ücret payını küçük tut
  bsc_gas_price_gwei: 1
  paper_extra_slippage_pct: 2

tracking:
  sample_every_min: 5
  track_for_min: 360

nightly:
  enabled: true          # always-on (Railway) süreçte her gece çalışır
  start: "00:00"
  end: "08:00"
  summary_every_min: 30  # /data/nightly-summary.log
  summary_to_telegram: false
  report_at: "07:45"     # "Sabah Raporu" Telegram
```

## wallets.yaml

```yaml
# İzlenen cüzdanlar. type: smart (kârlı on-chain cüzdan) | kol (influencer cüzdanı)
#
# Bilerek BOŞ: doğrulanmamış "en iyi 2026 cüzdanları" listesi eklenmedi. Hazır listeler
# (Telegram/X paylaşımları) çoğu zaman eskimiş, exit-liquidity olarak kullanılan veya
# copy-trade botlarını tuzağa çeken adreslerdir. Liste boşken smart money filtresi hiçbir
# adayı geçirmez; paper mod yine tüm adayları kaydeder ve gölge-paper raporu üretir.
#
# Doldurma (25 adres hedefi, ~%70 smart / %30 kol):
#   1) Botu paper modda 3–7 gün çalıştır (candidates.jsonl + outcomes.jsonl birikir).
#   2) npm run discover-wallets  → data/wallet-candidates-YYYY-MM-DD.md
#      (kazanan token'larda erken top-holder olup rug'larda görünmeyen adresler)
#   3) Her adayı elle doğrula (Solscan / BscScan / GMGN cüzdan sayfası):
#      - son 30 günde ≥ 20 işlem, realize PnL pozitif, win rate ≥ %40
#      - tek token'a bağlı değil, CEX/aggregator/bot (dakikada onlarca tx) değil
#      - aynı token'da hep ilk blokta alıp dakikalar içinde satan → sniper bot, ekleme
#   4) KOL cüzdanı: yalnız KOL'un kendisinin kamuya açıkça ilan ettiği adres.
#   5) Ekle, Helius webhook'unun account listesini güncelle, redeploy.
#   6) Her Pazar npm run report → n ≥ 3 ve rug oranı > %40 olanları çıkar.
solana:
  # - { address: "WalletPubkeyBase58", label: "sm_01", type: smart }
  # - { address: "WalletPubkeyBase58", label: "kol_01", type: kol }
bsc:
  # - { address: "0xWallet", label: "sm_bsc_01", type: smart }
```

## package.json

```json
{
  "name": "sniper-bot",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "engines": { "node": ">=22" },
  "scripts": {
    "start": "tsx src/index.ts",
    "dev": "tsx watch src/index.ts",
    "typecheck": "tsc --noEmit",
    "optimize": "tsx scripts/optimize.ts",
    "report": "tsx scripts/report.ts",
    "nightly": "tsx src/nightly-run.ts",
    "discover-wallets": "tsx scripts/discover-wallets.ts"
  },
  "dependencies": {
    "@solana/web3.js": "^1.98.0",
    "bs58": "^6.0.0",
    "ethers": "^6.13.4",
    "tsx": "^4.19.2",
    "yaml": "^2.6.1"
  },
  "devDependencies": {
    "@types/node": "^22.10.0",
    "typescript": "^5.7.2"
  }
}
```

## tsconfig.json

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "noEmit": true
  },
  "include": ["src", "scripts"]
}
```

## Dockerfile

```Dockerfile
FROM node:22-slim
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY . .
ENV NODE_ENV=production DATA_DIR=/data
CMD ["npm", "start"]
```

## railway.json

```json
{
  "$schema": "https://railway.com/railway.schema.json",
  "build": { "builder": "DOCKERFILE", "dockerfilePath": "Dockerfile" },
  "deploy": {
    "numReplicas": 1,
    "healthcheckPath": "/health",
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 10
  }
}
```

## .env.example

```example
# --- zorunlu ---
TELEGRAM_BOT_TOKEN=
TELEGRAM_CHAT_ID=
HELIUS_API_KEY=                 # helius.dev free tier: RPC + DAS + webhook
HELIUS_WEBHOOK_AUTH=            # webhook'ta "Authorization" header olarak gireceğin rastgele string
BSC_RPC_URL=                    # NodeReal / Ankr free endpoint (eth_getLogs destekli)

# --- yalnız live ---
LIVE_CONFIRM=                   # live mod için tam olarak YES
SOLANA_PRIVATE_KEY=             # base58, SADECE bot için açılmış ayrı cüzdan
BSC_PRIVATE_KEY=                # 0x..., SADECE bot için açılmış ayrı cüzdan

# --- opsiyonel ---
GMGN_API_BASE=                  # erişimin varsa: src/sources/gmgn.ts adaptörünü doldur
DATA_DIR=/data                  # Railway volume mount yolu
PORT=8080
```

## scripts/discover-wallets.ts

```ts
// Kendi verinden smart-money aday cüzdan çıkarır: kazanan token'larda erken top-holder olup
// rug'larda görünmeyen adresler. Çıktı ÖNERİDİR; wallets.yaml'a eklemeden önce Solscan/BscScan'de elle doğrula.
// Kullanım: npm run discover-wallets            (en az ~1 hafta candidates + outcomes verisi gerekir)
import fs from 'node:fs';
import path from 'node:path';
import { DATA_DIR, wallets } from '../src/config.js';
import { readJsonl, utcDay } from '../src/util.js';

const WIN_MAX_PCT = 100; // 6 saatte en az 2x
const RUG_MIN_PCT = -80;
const MIN_WINS = 3;

const outcomes = new Map(readJsonl<any>('outcomes.jsonl').map((o) => [`${o.chain}:${o.token}`, o]));
const known = new Set([...wallets.solana, ...wallets.bsc].map((w) => w.address.toLowerCase()));

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
const ranked = [...stats.values()]
  .filter((s) => s.wins >= MIN_WINS && s.rugs <= s.wins / 3 && !known.has(s.address.toLowerCase()) && s.seen <= 200)
  .map((s) => ({ ...s, score: (s.wins - 2 * s.rugs) * Math.log1p(s.sumMax / s.wins) * (s.wins / s.seen) }))
  .sort((a, b) => b.score - a.score)
  .slice(0, 40);

const explorer = (chain: string, a: string) => (chain === 'solana' ? `https://solscan.io/account/${a}` : `https://bscscan.com/address/${a}`);
const lines = [
  `# Aday cüzdanlar ${utcDay()} — ${done.size} token, ${outcomes.size} sonuç`,
  `kriter: ≥${MIN_WINS} kazanan (max ≥ +${WIN_MAX_PCT}%), rug ≤ kazanç/3, zaten izlenenler hariç`,
  '',
  ...ranked.map(
    (s) =>
      `- ${s.chain} ${s.address} · kazanç ${s.wins} / rug ${s.rugs} / görülme ${s.seen} · ort max +${(s.sumMax / s.wins).toFixed(0)}% · ${s.tokens.slice(0, 5).join(', ')}\n  ${explorer(s.chain, s.address)}`,
  ),
  '',
  '# wallets.yaml formatı (doğruladıktan sonra kopyala)',
  ...ranked.map((s) => `#  - { address: "${s.address}", label: "auto-${s.address.slice(0, 6)}", type: smart }   # ${s.chain}`),
];
if (!ranked.length) lines.push('', 'yeterli veri yok — botu paper modda birkaç gün daha çalıştır.');

const out = path.join(DATA_DIR, `wallet-candidates-${utcDay()}.md`);
fs.writeFileSync(out, lines.join('\n'));
console.log(lines.join('\n'));
console.log(`\n→ ${out}`);
```

## scripts/optimize.ts

```ts
// Haftalık filtre + çıkış optimizasyonu (walk-forward). Config'i ASLA otomatik değiştirmez.
// Kullanım: npm run optimize            (data/ altındaki jsonl'ler)
//           DATA_DIR=./pulled npm run optimize
import fs from 'node:fs';
import path from 'node:path';
import { DATA_DIR } from '../src/config.js';
import { runOptimization } from '../src/optimizer.js';
import { utcDay } from '../src/util.js';

const { report } = runOptimization();
const out = path.join(DATA_DIR, `optimize-${utcDay()}.md`);
fs.writeFileSync(out, report);
console.log(report);
console.log(`\n→ ${out}`);
```

## scripts/report.ts

```ts
// Haftalık işlem + cüzdan isabet raporu. Kullanım: npm run report
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
console.log(`# Son 7 gün: ${closes.length} kapanış · SOL ${sum('solana').toFixed(4)} · BNB ${sum('bsc').toFixed(4)}`);
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
```

## src/chains.ts

```ts
import { Connection, Keypair, PublicKey } from '@solana/web3.js';
import { JsonRpcProvider, Wallet } from 'ethers';
import bs58 from 'bs58';
import { env, isLive } from './config.js';

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

let _bsc: JsonRpcProvider | null = null;
export const bscProvider = () => (_bsc ??= new JsonRpcProvider(env('BSC_RPC_URL'), 56, { staticNetwork: true }));

let _bw: Wallet | null = null;
export const bscWallet = () => (_bw ??= new Wallet(env('BSC_PRIVATE_KEY'), bscProvider()));

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
```

## src/config.ts

```ts
import fs from 'node:fs';
import path from 'node:path';
import YAML from 'yaml';

export type Chain = 'solana' | 'bsc';
export const CHAINS: Chain[] = ['solana', 'bsc'];

export interface ChainRisk {
  paper_start_balance: number;
  probe_min: number;
  probe_max: number;
  probe_balance_pct: number;
  fee_reserve: number;
  daily_loss_cap: number;
  daily_profit_target: number;
}

export interface Config {
  mode: 'paper' | 'live';
  timezone: string;
  chains: Record<Chain, { enabled: boolean }>;
  scan: {
    interval_sec: number;
    min_pair_age_min: number;
    max_pair_age_min: number;
    deep_check_concurrency: number;
    seen_ttl_min: number;
  };
  filters: {
    min_liquidity_usd: number;
    max_top10_pct: number;
    require_lp_locked: boolean;
    min_lp_locked_pct: number;
    require_renounced: boolean;
    max_sell_tax_pct: number;
    max_buy_tax_pct: number;
    max_sniper_pct: number;
    sniper_slots: number;
    sniper_blocks: number;
    sniper_sig_pages: number;
    sniper_unknown_pass: boolean;
    min_smart_entries: number;
    min_smart_only: number;
    smart_lookback_min: number;
    require_holder_growth: boolean;
    holder_growth_window_sec: number;
    min_holder_growth_pct: number;
  };
  risk: {
    sol: ChainRisk;
    bnb: ChainRisk;
    max_concurrent: number;
    max_trades_per_day: number;
    cooldown_after_loss_min: number;
    max_consecutive_losses: number;
    reentry_block_hours: number;
    assumed_worst_loss_pct: number;
  };
  exit: {
    take_profit_pct: number;
    stop_loss_pct: number;
    trailing_activate_pct: number;
    trailing_distance_pct: number;
    max_hold_min: number;
    smart_exit_count: number;
    poll_sec: number;
    quote_fail_exit_after: number;
  };
  exec: {
    slippage_bps: number;
    sell_slippage_bps: number;
    sol_priority_max_lamports: number;
    bsc_gas_price_gwei: number;
    paper_extra_slippage_pct: number;
  };
  tracking: { sample_every_min: number; track_for_min: number };
  nightly: {
    enabled: boolean;
    start: string;
    end: string;
    summary_every_min: number;
    summary_to_telegram: boolean;
    report_at: string;
  };
}

export interface TrackedWallet {
  address: string;
  label: string;
  type: 'smart' | 'kol';
}

const ROOT = process.cwd();
export const DATA_DIR = process.env.DATA_DIR || path.join(ROOT, 'data');
fs.mkdirSync(DATA_DIR, { recursive: true });

export const cfg: Config = YAML.parse(
  fs.readFileSync(process.env.CONFIG_PATH || path.join(ROOT, 'config.yaml'), 'utf8'),
);

const rawWallets = YAML.parse(fs.readFileSync(path.join(ROOT, 'wallets.yaml'), 'utf8')) ?? {};
export const wallets: Record<Chain, TrackedWallet[]> = {
  solana: rawWallets.solana ?? [],
  bsc: (rawWallets.bsc ?? []).map((w: TrackedWallet) => ({ ...w, address: w.address.toLowerCase() })),
};

export const riskFor = (chain: Chain): ChainRisk => (chain === 'solana' ? cfg.risk.sol : cfg.risk.bnb);
export const nativeSymbol = (chain: Chain) => (chain === 'solana' ? 'SOL' : 'BNB');

export function env(key: string, required = true): string {
  const v = process.env[key];
  if (!v && required) throw new Error(`missing env ${key}`);
  return v ?? '';
}

export const isLive = () => cfg.mode === 'live';

if (isLive() && process.env.LIVE_CONFIRM !== 'YES') {
  throw new Error('mode=live ama LIVE_CONFIRM=YES değil — paper moda dön veya env ekle');
}
```

## src/exec/bsc.ts

```ts
import { Contract, MaxUint256, formatEther, parseEther, parseUnits } from 'ethers';
import { cfg } from '../config.js';
import { PANCAKE_V2_ROUTER, WBNB, bscProvider, bscWallet } from '../chains.js';
import type { Executor, Fill } from './types.js';

const ROUTER_ABI = [
  'function getAmountsOut(uint amountIn, address[] path) view returns (uint[] amounts)',
  'function swapExactETHForTokensSupportingFeeOnTransferTokens(uint amountOutMin, address[] path, address to, uint deadline) payable',
  'function swapExactTokensForETHSupportingFeeOnTransferTokens(uint amountIn, uint amountOutMin, address[] path, address to, uint deadline)',
];
const ERC20_ABI = [
  'function balanceOf(address) view returns (uint256)',
  'function decimals() view returns (uint8)',
  'function allowance(address,address) view returns (uint256)',
  'function approve(address,uint256) returns (bool)',
];

const router = () => new Contract(PANCAKE_V2_ROUTER, ROUTER_ABI, bscProvider());
const gas = () => ({ gasPrice: parseUnits(String(cfg.exec.bsc_gas_price_gwei), 'gwei') });
const deadline = () => Math.floor(Date.now() / 1000) + 60;
const minOut = (amt: bigint, bps: number) => (amt * BigInt(10_000 - bps)) / 10_000n;

async function amountsOut(amountIn: bigint, path: string[]): Promise<bigint> {
  const a: bigint[] = await router().getAmountsOut(amountIn, path);
  return a[a.length - 1];
}

// Not: four.meme bonding curve'deki veya yalnız Pancake V3'te olan token'lar V2 router'dan geçmez → canRoute false.
export const bscExecutor: Executor = {
  chain: 'bsc',

  async canRoute(token, sizeNative) {
    try {
      return (await amountsOut(parseEther(sizeNative.toFixed(6)), [WBNB, token])) > 0n;
    } catch {
      return false;
    }
  },

  async buy(token, sizeNative): Promise<Fill> {
    const w = bscWallet();
    const value = parseEther(sizeNative.toFixed(6));
    const erc = new Contract(token, ERC20_ABI, w);
    const before: bigint = await erc.balanceOf(w.address);
    const out = await amountsOut(value, [WBNB, token]);
    const r = new Contract(PANCAKE_V2_ROUTER, ROUTER_ABI, w);
    const tx = await r.swapExactETHForTokensSupportingFeeOnTransferTokens(
      minOut(out, cfg.exec.slippage_bps),
      [WBNB, token],
      w.address,
      deadline(),
      { value, ...gas() },
    );
    const rc = await tx.wait();
    const after: bigint = await erc.balanceOf(w.address);
    return { tokenRaw: after - before, decimals: Number(await erc.decimals()), spentNative: sizeNative, sig: rc?.hash };
  },

  async quoteSell(token, raw) {
    return Number(formatEther(await amountsOut(raw, [token, WBNB])));
  },

  async sell(token, raw) {
    const w = bscWallet();
    const erc = new Contract(token, ERC20_ABI, w);
    const have: bigint = await erc.balanceOf(w.address);
    const amt = raw > have ? have : raw;
    if ((await erc.allowance(w.address, PANCAKE_V2_ROUTER)) < amt) {
      await (await erc.approve(PANCAKE_V2_ROUTER, MaxUint256, gas())).wait();
    }
    const before = await bscProvider().getBalance(w.address);
    const out = await amountsOut(amt, [token, WBNB]);
    const r = new Contract(PANCAKE_V2_ROUTER, ROUTER_ABI, w);
    const tx = await r.swapExactTokensForETHSupportingFeeOnTransferTokens(
      amt,
      minOut(out, cfg.exec.sell_slippage_bps),
      [token, WBNB],
      w.address,
      deadline(),
      gas(),
    );
    const rc = await tx.wait();
    const after = await bscProvider().getBalance(w.address);
    return { outNative: Number(formatEther(after - before)), sig: rc?.hash }; // gas dahil net
  },

  async balance() {
    return Number(formatEther(await bscProvider().getBalance(bscWallet().address)));
  },
};
```

## src/exec/index.ts

```ts
import { LAMPORTS_PER_SOL } from '@solana/web3.js';
import { parseEther } from 'ethers';
import { cfg, isLive, type Chain } from '../config.js';
import { SOL_MINT, WBNB } from '../chains.js';
import { state, save } from '../state.js';
import { bscExecutor } from './bsc.js';
import { jupQuote, mintDecimals, solanaExecutor } from './solana.js';
import { Contract } from 'ethers';
import { bscProvider, PANCAKE_V2_ROUTER } from '../chains.js';
import type { Executor, Fill } from './types.js';

const live: Record<Chain, Executor> = { solana: solanaExecutor, bsc: bscExecutor };
const haircut = (x: number) => x * (1 - cfg.exec.paper_extra_slippage_pct / 100);

async function paperBuyQuote(chain: Chain, token: string, size: number): Promise<Fill> {
  if (chain === 'solana') {
    const q = await jupQuote(SOL_MINT, token, BigInt(Math.floor(size * LAMPORTS_PER_SOL)), cfg.exec.slippage_bps);
    const raw = (BigInt(q.outAmount) * BigInt(Math.round(haircut(1) * 10_000))) / 10_000n;
    return { tokenRaw: raw, decimals: await mintDecimals(token), spentNative: size, sig: 'paper' };
  }
  const r = new Contract(PANCAKE_V2_ROUTER, ['function getAmountsOut(uint,address[]) view returns (uint[])'], bscProvider());
  const a: bigint[] = await r.getAmountsOut(parseEther(size.toFixed(6)), [WBNB, token]);
  const erc = new Contract(token, ['function decimals() view returns (uint8)'], bscProvider());
  const raw = (a[1] * BigInt(Math.round(haircut(1) * 10_000))) / 10_000n;
  return { tokenRaw: raw, decimals: Number(await erc.decimals()), spentNative: size, sig: 'paper' };
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

export const executor = (chain: Chain): Executor => (isLive() ? live[chain] : paperExecutor(chain));
```

## src/exec/solana.ts

```ts
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
```

## src/exec/types.ts

```ts
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
```

## src/filters.ts

```ts
import type { Config } from './config.js';
import type { Metrics } from './types.js';

// Saf fonksiyon: canlı bot ve haftalık optimizasyon aynı mantığı kullanır.
export function evaluate(m: Metrics, f: Config['filters']): string[] {
  const fail: string[] = [];
  if (m.liquidityUsd < f.min_liquidity_usd) fail.push('liquidity');
  if (m.honeypot) fail.push('honeypot');
  if (m.top10Pct >= f.max_top10_pct) fail.push('top10');
  if (f.require_lp_locked && m.lpLockedPct < f.min_lp_locked_pct) fail.push('lp_lock');
  if (f.require_renounced && !m.renounced) fail.push('renounce');
  if (m.sellTaxPct >= f.max_sell_tax_pct) fail.push('sell_tax');
  if (m.buyTaxPct >= f.max_buy_tax_pct) fail.push('buy_tax');
  if (m.sniperPct == null ? !f.sniper_unknown_pass : m.sniperPct >= f.max_sniper_pct) fail.push('sniper');
  if (m.smartWallets.length + m.kolWallets.length < f.min_smart_entries || m.smartWallets.length < f.min_smart_only)
    fail.push('smart_money');
  if (f.require_holder_growth && (m.holderGrowthPct == null || m.holderGrowthPct <= f.min_holder_growth_pct))
    fail.push('holder_growth');
  return fail;
}
```

## src/index.ts

```ts
import http from 'node:http';
import { CHAINS, cfg, env } from './config.js';
import { closeAll, startMonitor, statusText } from './positions.js';
import { startScanner } from './scanner.js';
import { handleHeliusWebhook, pollBsc, walletCounts } from './smartmoney.js';
import { save, state } from './state.js';
import { startCommands, tg } from './telegram.js';
import { startNightly } from './nightly.js';
import { startTracker } from './tracker.js';
import { errMsg, log } from './util.js';

// ---- HTTP: health + Helius webhook ----
const server = http.createServer((req, res) => {
  if (req.method === 'GET' && req.url === '/health') {
    res.writeHead(200, { 'content-type': 'application/json' });
    return res.end(JSON.stringify({ ok: true, mode: cfg.mode, paused: state.paused, open: state.positions.filter((p) => p.status !== 'closed').length }));
  }
  if (req.method === 'POST' && req.url === '/webhook/helius') {
    if (req.headers.authorization !== env('HELIUS_WEBHOOK_AUTH')) {
      res.writeHead(401);
      return res.end();
    }
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      try {
        handleHeliusWebhook(JSON.parse(body));
      } catch (e) {
        log.warn('webhook parse', { err: errMsg(e) });
      }
      res.writeHead(200);
      res.end('ok');
    });
    return;
  }
  res.writeHead(404);
  res.end();
});
server.listen(Number(process.env.PORT || 8080));

// ---- Telegram komutları ----
void startCommands({
  '/status': async () => statusText(),
  '/pause': async () => {
    state.paused = true;
    state.pauseReason = 'telegram';
    save();
    return '⏸ yeni girişler durdu (açık pozisyonlar yönetilmeye devam ediyor)';
  },
  '/resume': async () => {
    state.paused = false;
    save();
    return '▶️ devam';
  },
  '/panic': async () => {
    state.paused = true;
    state.pauseReason = 'panic';
    save();
    await closeAll('panic');
    return '🛑 tüm pozisyonlar satıldı, bot durdu';
  },
});

// ---- Döngüler ----
for (const c of CHAINS) if (cfg.chains[c].enabled) startScanner(c);
startMonitor();
startTracker();
if (cfg.chains.bsc.enabled) {
  setInterval(() => pollBsc().catch((e) => log.warn('bsc wallets', { err: errMsg(e) })), 15_000);
}

if (cfg.nightly.enabled || process.env.NIGHTLY_EXIT === '1') startNightly({ exitAtEnd: process.env.NIGHTLY_EXIT === '1' });

const wc = walletCounts();
log.info('started', { mode: cfg.mode, wallets: wc });
void tg(`🤖 bot başladı · <b>${cfg.mode.toUpperCase()}</b> · izlenen cüzdan SOL ${wc.solana} / BSC ${wc.bsc}`);

for (const sig of ['SIGINT', 'SIGTERM'] as const) {
  process.on(sig, () => {
    save();
    log.info('shutdown', { sig });
    process.exit(0);
  });
}
process.on('unhandledRejection', (e) => log.error('unhandled', { err: errMsg(e) }));
```

## src/nightly-run.ts

```ts
// npm run nightly → botu gece penceresi bitene kadar çalıştırır, 07:45'te sabah raporu, 08:00'de çıkış.
process.env.NIGHTLY_EXIT = '1';
await import('./index.js');
```

## src/nightly.ts

```ts
// Gece modu: start–end penceresinde her summary_every_min dakikada özet yazar,
// report_at'te Telegram'a "Sabah Raporu" atar, exitAtEnd ise end'de süreci kapatır.
import fs from 'node:fs';
import path from 'node:path';
import { CHAINS, DATA_DIR, cfg, nativeSymbol, riskFor, type Chain } from './config.js';
import { loadRows, runOptimization, shadowSince, fmtScore, type Row } from './optimizer.js';
import { scanStats } from './scanner.js';
import { openPositions, save, state } from './state.js';
import { tg } from './telegram.js';
import { trackingSnapshot } from './tracker.js';
import { errMsg, localHHMM, log, readJsonl, utcDay } from './util.js';

const SUMMARY_FILE = path.join(DATA_DIR, 'nightly-summary.log');
const LAST_REPORT_FILE = path.join(DATA_DIR, 'nightly-last-report.txt');

const toMin = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};
const nowMin = () => toMin(localHHMM());

function inWindow(): boolean {
  const s = toMin(cfg.nightly.start);
  const e = toMin(cfg.nightly.end);
  const n = nowMin();
  return s <= e ? n >= s && n < e : n >= s || n < e; // 22:00–06:00 gibi gece yarısını aşan pencere de olur
}

// Bu gecenin başlangıç anı (ms).
function windowStartMs(): number {
  const back = (nowMin() - toMin(cfg.nightly.start) + 1440) % 1440;
  return Date.now() - back * 60_000;
}

function rowsNow(): Row[] {
  return loadRows(trackingSnapshot());
}

function realTrades(sinceMs: number) {
  return readJsonl<any>('trades.jsonl').filter((t) => t.ev === 'close' && Date.parse(t.ts) >= sinceMs);
}

function chainBlock(chain: Chain, rows: Row[], sinceMs: number) {
  const sym = nativeSymbol(chain);
  const sh = shadowSince(sinceMs, rows.filter((r) => r.key.startsWith(`${chain}:`)), riskFor(chain).probe_max);
  const real = realTrades(sinceMs).filter((t) => t.chain === chain);
  const realPnl = real.reduce((s, t) => s + Number(t.pnl ?? 0), 0);
  return { chain, sym, sh, real, realPnl };
}

function summaryLine(): string {
  const since = windowStartMs();
  const rows = rowsNow();
  const parts = CHAINS.filter((c) => cfg.chains[c].enabled).map((c) => {
    const b = chainBlock(c, rows, since);
    return `${c}: aday ${b.sh.candidates} geçen ${b.sh.passed} gölge ${b.sh.score.n}tr avg ${b.sh.score.avg.toFixed(1)}% · gerçek ${b.real.length}tr ${b.realPnl >= 0 ? '+' : ''}${b.realPnl.toFixed(4)} ${b.sym}`;
  });
  return `[${localHHMM()}] tarandı ${scanStats.discovered} ön-filtre ${scanStats.prefiltered} derin ${scanStats.deepChecked} · açık ${openPositions().length} · ${parts.join(' | ')}`;
}

export function morningReport(): string {
  const since = windowStartMs();
  const rows = rowsNow();
  const L: string[] = [];
  L.push(`☀️ <b>Sabah Raporu</b> · ${utcDay()} · ${cfg.mode.toUpperCase()}`);
  L.push(`pencere ${cfg.nightly.start}–${localHHMM()} (${cfg.timezone})`);
  L.push('');
  L.push(`<b>Tarama</b>: keşif ${scanStats.discovered} · ön-filtre geçen ${scanStats.prefiltered} · derin kontrol ${scanStats.deepChecked}`);
  L.push(`filtre geçen ${scanStats.passed} · risk kapısına takılan ${scanStats.gated} · açılan ${scanStats.opened}`);

  for (const c of CHAINS.filter((x) => cfg.chains[x].enabled)) {
    const b = chainBlock(c, rows, since);
    L.push('');
    L.push(`<b>${c.toUpperCase()}</b> — aday ${b.sh.candidates}, filtre geçen ${b.sh.passed}`);
    if (b.sh.rejects.length) L.push(`eleme: ${b.sh.rejects.slice(0, 6).map(([k, v]) => `${k} ${v}`).join(', ')}`);
    L.push(`gölge paper (geçen her aday, ${riskFor(c).probe_max} ${b.sym} probe): ${fmtScore(b.sh.score)}`);
    L.push(`gölge PnL ≈ ${b.sh.probePnlNative >= 0 ? '+' : ''}${b.sh.probePnlNative.toFixed(4)} ${b.sym}`);
    for (const t of b.sh.trades.slice(0, 8)) L.push(`  · ${t.symbol} ${t.pct >= 0 ? '+' : ''}${t.pct.toFixed(1)}%${t.done ? '' : ' (sürüyor)'}`);
    L.push(`gerçek ${cfg.mode}: ${b.real.length} kapanan işlem, PnL ${b.realPnl >= 0 ? '+' : ''}${b.realPnl.toFixed(4)} ${b.sym}`);
    for (const t of b.real.slice(0, 8))
      L.push(`  · ${t.symbol} ${t.exitReason} ${Number(t.pnlPct ?? 0) >= 0 ? '+' : ''}${Number(t.pnlPct ?? 0).toFixed(1)}%`);
    L.push(`gün toplamı ${state.daily.realized[c] >= 0 ? '+' : ''}${state.daily.realized[c].toFixed(4)} / limit −${riskFor(c).daily_loss_cap} / hedef +${riskFor(c).daily_profit_target}`);
  }

  const open = openPositions();
  L.push('');
  L.push(`<b>Açık pozisyon</b>: ${open.length ? open.map((p) => `${p.symbol}(${p.chain}) ${((p.lastValueNative / p.sizeNative - 1) * 100).toFixed(1)}%`).join(', ') : 'yok'}`);
  if (state.haltedDay === utcDay()) L.push(`⛔ günlük durdurma: ${state.haltReason}`);
  if (state.paused) L.push(`⏸ duraklatılmış: ${state.pauseReason}`);

  const opt = runOptimization(rows);
  L.push('');
  L.push(`<b>Önerilen config</b> (tüm geçmiş, ${opt.rows} biten aday):`);
  L.push(opt.diff.length ? opt.diff.map((d) => `  · ${d}`).join('\n') : '  · değişiklik yok');
  L.push(`karar: ${opt.accept ? 'UYGULA' : 'UYGULAMA'} · test ${fmtScore(opt.newTest)}`);
  L.push('config otomatik değişmez; uygulamak için config.yaml düzenle + redeploy.');

  return L.join('\n');
}

function lastReportDay(): string {
  try {
    return fs.readFileSync(LAST_REPORT_FILE, 'utf8').trim();
  } catch {
    return '';
  }
}

async function sendMorning() {
  const text = morningReport();
  fs.writeFileSync(LAST_REPORT_FILE, utcDay());
  fs.writeFileSync(path.join(DATA_DIR, `sabah-raporu-${utcDay()}.txt`), text.replace(/<\/?b>/g, ''));
  // Telegram 4096 karakter sınırı
  for (let i = 0; i < text.length; i += 3900) await tg(text.slice(i, i + 3900));
  log.info('sabah raporu gönderildi');
}

export function startNightly({ exitAtEnd = false } = {}) {
  let lastSummaryAt = 0;
  let sawWindow = inWindow();
  log.info('nightly başladı', { window: `${cfg.nightly.start}-${cfg.nightly.end}`, report: cfg.nightly.report_at, exitAtEnd });

  const tick = async () => {
    const inside = inWindow();
    if (inside) {
      sawWindow = true;
      if (Date.now() - lastSummaryAt >= cfg.nightly.summary_every_min * 60_000) {
        lastSummaryAt = Date.now();
        const line = summaryLine();
        fs.appendFileSync(SUMMARY_FILE, line + '\n');
        if (cfg.nightly.summary_to_telegram) await tg(`🌙 ${line}`);
      }
      if (nowMin() >= toMin(cfg.nightly.report_at) && lastReportDay() !== utcDay()) await sendMorning();
    } else if (sawWindow && exitAtEnd) {
      if (lastReportDay() !== utcDay()) await sendMorning(); // report_at kaçtıysa (geç başlatma) kapanışta at
      save();
      log.info('nightly bitti, çıkılıyor');
      setTimeout(() => process.exit(0), 2000); // son Telegram/log yazımı için
    }
  };

  setInterval(() => tick().catch((e) => log.warn('nightly', { err: errMsg(e) })), 30_000);
  void tick().catch((e) => log.warn('nightly', { err: errMsg(e) }));
}
```

## src/optimizer.ts

```ts
// Filtre + çıkış optimizasyonu (walk-forward) ve gölge-paper simülasyonu.
// Config'i ASLA otomatik değiştirmez; yalnız öneri üretir.
import { cfg, type Config } from './config.js';
import { evaluate } from './filters.js';
import type { Metrics } from './types.js';
import { readJsonl, utcDay } from './util.js';

type Filters = Config['filters'];
type Exit = Pick<Config['exit'], 'take_profit_pct' | 'stop_loss_pct' | 'trailing_activate_pct' | 'trailing_distance_pct' | 'max_hold_min'>;
type Path = [number, number][];

export interface Row {
  ts: string;
  key: string;
  symbol: string;
  stage: string;
  fails: string[];
  metrics: Metrics;
  path: Path;
  done: boolean; // izleme süresi doldu mu
}

const MIN_N_TRAIN = 20;
const MIN_N_TEST = 8;
export const COST_PCT = cfg.exec.paper_extra_slippage_pct * 2 + 1.5; // gidiş-dönüş slippage + ücret varsayımı

// candidates.jsonl + outcomes.jsonl (+ istenirse devam eden izleme yolları) → satırlar
export function loadRows(inProgress: { chain: string; token: string; path: Path }[] = []): Row[] {
  const paths = new Map<string, { path: Path; done: boolean }>();
  for (const t of inProgress) paths.set(`${t.chain}:${t.token}`, { path: t.path, done: false });
  for (const o of readJsonl<any>('outcomes.jsonl')) paths.set(`${o.chain}:${o.token}`, { path: o.path, done: true });
  const seen = new Set<string>();
  const rows: Row[] = [];
  for (const c of readJsonl<any>('candidates.jsonl')) {
    const key = `${c.chain}:${c.token}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const p = paths.get(key);
    rows.push({ ts: c.ts, key, symbol: c.symbol, stage: c.stage, fails: c.fails ?? [], metrics: c.metrics, path: p?.path ?? [], done: p?.done ?? false });
  }
  return rows;
}

export function simulate(p: Path, e: Exit): number {
  let peak = 0;
  for (const [min, pct] of p) {
    if (min > e.max_hold_min) return pct - COST_PCT;
    peak = Math.max(peak, pct);
    if (pct >= e.take_profit_pct) return e.take_profit_pct - COST_PCT;
    if (pct <= -e.stop_loss_pct) return Math.max(pct, -100) - COST_PCT; // 5 dk örneklemede gap'i olduğu gibi yaz
    const peakVal = 1 + peak / 100;
    if (peak >= e.trailing_activate_pct && 1 + pct / 100 <= peakVal * (1 - e.trailing_distance_pct / 100)) return pct - COST_PCT;
  }
  return p[p.length - 1][1] - COST_PCT;
}

export interface Score {
  n: number;
  win: number;
  avg: number;
  pf: number;
  total: number;
}

function scoreResults(r: number[]): Score {
  const wins = r.filter((x) => x > 0);
  const loss = r.filter((x) => x <= 0).reduce((s, x) => s - x, 0);
  const total = r.reduce((s, x) => s + x, 0);
  return { n: r.length, win: r.length ? wins.length / r.length : 0, avg: r.length ? total / r.length : 0, pf: loss ? wins.reduce((s, x) => s + x, 0) / loss : Infinity, total };
}

export function score(set: Row[], f: Filters, e: Exit): Score {
  return scoreResults(set.filter((x) => x.path.length && evaluate(x.metrics, f).length === 0).map((x) => simulate(x.path, e)));
}

// Az örnekle şişmiş ortalamayı cezalandır.
const objective = (s: Score) => (s.n < MIN_N_TRAIN ? -Infinity : s.avg * Math.sqrt(s.n));

function* grid<T extends object>(base: T, axes: Partial<Record<keyof T, number[]>>): Generator<T> {
  const keys = Object.keys(axes) as (keyof T)[];
  const idx = keys.map(() => 0);
  for (;;) {
    const o = { ...base };
    keys.forEach((k, i) => ((o as any)[k] = axes[k]![idx[i]]));
    yield o;
    let i = 0;
    while (i < keys.length && ++idx[i] >= axes[keys[i]]!.length) idx[i++] = 0;
    if (i === keys.length) return;
  }
}

export const fmtScore = (s: Score) =>
  `n=${s.n} win=${(s.win * 100).toFixed(0)}% avg=${s.avg.toFixed(1)}% pf=${s.pf === Infinity ? '∞' : s.pf.toFixed(2)} toplam=${s.total.toFixed(0)}%`;

export interface OptResult {
  report: string;
  diff: string[];
  accept: boolean;
  rows: number;
  curTest: Score;
  newTest: Score;
}

export function runOptimization(all: Row[] = loadRows()): OptResult {
  const rows = all.filter((r) => r.done && r.path.length);
  const cut = Date.now() - 7 * 86_400_000;
  const train = rows.filter((r) => Date.parse(r.ts) < cut);
  const test = rows.filter((r) => Date.parse(r.ts) >= cut);
  const curF = cfg.filters;
  const curE: Exit = cfg.exit;

  // 1) Filtreler (mevcut çıkışla)
  let bestF = curF;
  let bestFs = -Infinity;
  for (const f of grid(curF, {
    min_liquidity_usd: [5000, 8000, 12000, 20000],
    max_top10_pct: [20, 24, 28, 32],
    max_sniper_pct: [20, 25, 30, 40],
    min_smart_entries: [1, 2, 3],
    min_holder_growth_pct: [0, 0.1, 1, 3],
  })) {
    const s = objective(score(train, f, curE));
    if (s > bestFs) [bestF, bestFs] = [f, s];
  }

  // 2) Çıkışlar (en iyi filtreyle)
  let bestE = curE;
  let bestEs = -Infinity;
  for (const e of grid(curE, {
    take_profit_pct: [35, 55, 80, 120],
    stop_loss_pct: [15, 22, 30],
    trailing_activate_pct: [15, 25, 40],
    trailing_distance_pct: [8, 12, 18],
  })) {
    const s = objective(score(train, bestF, e));
    if (s > bestEs) [bestE, bestEs] = [e, s];
  }

  const curTrain = score(train, curF, curE);
  const curTest = score(test, curF, curE);
  const newTrain = score(train, bestF, bestE);
  const newTest = score(test, bestF, bestE);

  const diff: string[] = [];
  for (const k of Object.keys(bestF) as (keyof Filters)[]) if (bestF[k] !== curF[k]) diff.push(`filters.${k}: ${curF[k]} → ${bestF[k]}`);
  for (const k of Object.keys(bestE) as (keyof Exit)[]) if (bestE[k] !== curE[k]) diff.push(`exit.${k}: ${curE[k]} → ${bestE[k]}`);

  const accept = diff.length > 0 && newTest.n >= MIN_N_TEST && newTest.avg > curTest.avg && newTest.avg > 0;
  const enough = train.length >= MIN_N_TRAIN;
  const report = [
    `# Optimizasyon ${utcDay()}`,
    `veri: ${rows.length} aday (train ${train.length} / test son 7 gün ${test.length}), maliyet varsayımı ${COST_PCT}%`,
    '',
    `mevcut  train: ${fmtScore(curTrain)}`,
    `mevcut  test : ${fmtScore(curTest)}`,
    `öneri   train: ${fmtScore(newTrain)}`,
    `öneri   test : ${fmtScore(newTest)}`,
    '',
    `## önerilen değişiklik`,
    diff.length ? diff.map((d) => `- ${d}`).join('\n') : enough ? '- yok' : `- yok (train örneği < ${MIN_N_TRAIN})`,
    '',
    `## karar: ${accept ? 'UYGULA (test dönemi de iyileşiyor)' : 'UYGULAMA (test iyileşmiyor veya örnek az)'}`,
    '',
    `## mevcut filtrelerde eleme nedenleri`,
    ...rejectCounts(all).map(([k, v]) => `- ${k}: ${v}`),
  ].join('\n');

  return { report, diff, accept, rows: rows.length, curTest, newTest };
}

export function rejectCounts(rows: Row[], f: Filters = cfg.filters): [string, number][] {
  const m = new Map<string, number>();
  for (const r of rows) for (const reason of evaluate(r.metrics, f)) m.set(reason, (m.get(reason) ?? 0) + 1);
  return [...m.entries()].sort((a, b) => b[1] - a[1]);
}

// Gölge paper: filtreyi geçen HER aday (risk kapısı engellese bile) mevcut çıkış kurallarıyla simüle edilir.
// Bitmemiş yolda sonuç "şu ana kadar" değeridir.
export interface Shadow {
  candidates: number;
  passed: number;
  rejects: [string, number][];
  trades: { symbol: string; key: string; pct: number; done: boolean }[];
  score: Score;
  probePnlNative: number; // her girişin probe_max ile yapıldığı varsayımı
}

export function shadowSince(sinceMs: number, rows: Row[], probe = cfg.risk.sol.probe_max): Shadow {
  const win = rows.filter((r) => Date.parse(r.ts) >= sinceMs);
  const passed = win.filter((r) => evaluate(r.metrics, cfg.filters).length === 0);
  const trades = passed
    .filter((r) => r.path.length)
    .map((r) => ({ symbol: r.symbol, key: r.key, pct: simulate(r.path, cfg.exit), done: r.done }));
  const s = scoreResults(trades.map((t) => t.pct));
  return {
    candidates: win.length,
    passed: passed.length,
    rejects: rejectCounts(win),
    trades,
    score: s,
    probePnlNative: trades.reduce((sum, t) => sum + (probe * t.pct) / 100, 0),
  };
}
```

## src/positions.ts

```ts
import { randomUUID } from 'node:crypto';
import { cfg, nativeSymbol, type Chain } from './config.js';
import { executor } from './exec/index.js';
import { onClosed } from './risk.js';
import { exitsSince, pollSolanaHolders, smartBus } from './smartmoney.js';
import { openPositions, save, state } from './state.js';
import { tg } from './telegram.js';
import type { Metrics, PairInfo, Position } from './types.js';
import { errMsg, jsonl, log } from './util.js';

const fmt = (n: number) => n.toFixed(4);
const pctOf = (p: Position, v: number) => (v / p.sizeNative - 1) * 100;

export async function openPosition(pi: PairInfo, size: number, m: Metrics) {
  const ex = executor(pi.chain);
  const fill = await ex.buy(pi.token, size);
  if (fill.tokenRaw <= 0n) throw new Error('alım sonrası token bakiyesi 0');
  const pos: Position = {
    id: randomUUID().slice(0, 8),
    chain: pi.chain,
    token: pi.token,
    symbol: pi.symbol,
    pair: pi.pair,
    mode: cfg.mode,
    openedAt: Date.now(),
    sizeNative: size,
    tokenRaw: fill.tokenRaw.toString(),
    decimals: fill.decimals,
    peakValueNative: size,
    lastValueNative: size,
    quoteFails: 0,
    triggerWallets: [...m.smartWallets, ...m.kolWallets],
    entrySig: fill.sig,
    status: 'open',
  };
  state.positions.push(pos);
  state.daily.trades++;
  save();
  jsonl('trades.jsonl', { ev: 'open', ...pos, metrics: m });
  await tg(
    `🟢 <b>${cfg.mode.toUpperCase()} BUY</b> ${pi.symbol} (${pi.chain})\n` +
      `${size} ${nativeSymbol(pi.chain)} · liq $${Math.round(pi.liquidityUsd)} · top10 ${m.top10Pct.toFixed(1)}%\n` +
      `smart: ${m.smartWallets.join(', ') || '-'} · kol: ${m.kolWallets.join(', ') || '-'}\n` +
      `<code>${pi.token}</code>`,
  );
}

async function closePosition(p: Position, reason: string) {
  if (p.status !== 'open') return;
  p.status = 'closing';
  save();
  const ex = executor(p.chain);
  try {
    const { outNative, sig } = await ex.sell(p.token, BigInt(p.tokenRaw));
    p.status = 'closed';
    p.exitReason = reason;
    p.exitValueNative = outNative;
    p.exitSig = sig;
    p.closedAt = Date.now();
    const pnl = outNative - p.sizeNative;
    const halt = onClosed(p.chain, pnl);
    save();
    jsonl('trades.jsonl', { ev: 'close', ...p, pnl, pnlPct: pctOf(p, outNative) });
    await tg(
      `${pnl >= 0 ? '✅' : '🔻'} <b>SELL</b> ${p.symbol} · ${reason}\n` +
        `${fmt(p.sizeNative)} → ${fmt(outNative)} ${nativeSymbol(p.chain)} (${pctOf(p, outNative).toFixed(1)}%)\n` +
        `bugün ${p.chain}: ${fmt(state.daily.realized[p.chain])}`,
    );
    if (halt) await tg(`⛔ Yeni giriş bugün kapalı: ${halt}`);
  } catch (e) {
    p.status = 'open'; // bir sonraki turda tekrar dener
    save();
    log.error('sell failed', { id: p.id, reason, err: errMsg(e) });
    await tg(`⚠️ SATIŞ BAŞARISIZ ${p.symbol} (${reason}): ${errMsg(e)}`);
  }
}

async function check(p: Position) {
  if (p.status !== 'open') return;
  const e = cfg.exit;

  const smartExits = exitsSince(p.chain, p.token, p.triggerWallets, p.openedAt);
  if (p.triggerWallets.length && smartExits.length >= e.smart_exit_count)
    return closePosition(p, `smart_exit(${smartExits.join(',')})`);

  let value: number;
  try {
    value = await executor(p.chain).quoteSell(p.token, BigInt(p.tokenRaw));
    p.quoteFails = 0;
  } catch (err) {
    p.quoteFails++;
    log.warn('quote fail', { id: p.id, n: p.quoteFails, err: errMsg(err) });
    if (p.quoteFails >= e.quote_fail_exit_after) return closePosition(p, 'no_quote');
    return;
  }
  p.lastValueNative = value;
  p.peakValueNative = Math.max(p.peakValueNative, value);
  const pct = pctOf(p, value);
  const peakPct = pctOf(p, p.peakValueNative);

  if (pct >= e.take_profit_pct) return closePosition(p, `tp(${pct.toFixed(1)}%)`);
  if (pct <= -e.stop_loss_pct) return closePosition(p, `sl(${pct.toFixed(1)}%)`);
  if (peakPct >= e.trailing_activate_pct && value <= p.peakValueNative * (1 - e.trailing_distance_pct / 100))
    return closePosition(p, `trail(peak ${peakPct.toFixed(1)}% → ${pct.toFixed(1)}%)`);
  if (Date.now() - p.openedAt > e.max_hold_min * 60_000) return closePosition(p, `timeout(${pct.toFixed(1)}%)`);
}

export async function closeAll(reason: string) {
  for (const p of openPositions()) await closePosition(p, reason);
}

export function startMonitor() {
  // Smart money satışı → beklemeden kontrol.
  smartBus.on('sell', (chain: Chain, token: string) => {
    for (const p of openPositions()) if (p.chain === chain && p.token === token) void check(p);
  });

  let tick = 0;
  const loop = async () => {
    tick++;
    for (const p of openPositions()) {
      try {
        // Webhook yedeği: ~30 sn'de bir tetikleyen cüzdanların bakiyesine bak.
        if (p.chain === 'solana' && p.triggerWallets.length && tick % 5 === 0) await pollSolanaHolders(p.token, p.triggerWallets);
        await check(p);
      } catch (err) {
        log.error('monitor', { id: p.id, err: errMsg(err) });
      }
    }
    save();
    setTimeout(loop, cfg.exit.poll_sec * 1000);
  };
  void loop();
}

export function statusText(): string {
  const open = openPositions();
  const lines = open.map(
    (p) => `• ${p.symbol} ${p.chain} ${pctOf(p, p.lastValueNative).toFixed(1)}% (peak ${pctOf(p, p.peakValueNative).toFixed(1)}%)`,
  );
  const d = state.daily;
  return [
    `<b>${cfg.mode.toUpperCase()}</b> ${state.paused ? '⏸ paused' : '▶️ running'}${state.haltedDay ? ` · halt ${state.haltedDay}` : ''}`,
    `bugün: SOL ${fmt(d.realized.solana)} · BNB ${fmt(d.realized.bsc)} · ${d.trades} işlem`,
    `paper bakiye: ${fmt(state.paperBalance.solana)} SOL · ${fmt(state.paperBalance.bsc)} BNB`,
    `açık (${open.length}/${cfg.risk.max_concurrent}):`,
    ...lines,
  ].join('\n');
}
```

## src/risk.ts

```ts
import { cfg, riskFor, type Chain } from './config.js';
import { openPositions, rollDay, state } from './state.js';
import { utcDay } from './util.js';

export function probeSize(chain: Chain, balance: number): number | null {
  const r = riskFor(chain);
  const free = balance - r.fee_reserve;
  const size = Math.min(r.probe_max, Math.max(r.probe_min, balance * (r.probe_balance_pct / 100)));
  return size <= free ? Number(size.toFixed(4)) : null;
}

export type Gate = { ok: true } | { ok: false; reason: string };

// Tüm sert sınırlar burada; tek yerden geçmeyen giriş yok.
export function canOpen(chain: Chain, token: string, size: number): Gate {
  rollDay();
  const r = riskFor(chain);
  const open = openPositions();
  const d = state.daily;
  const now = Date.now();

  if (state.paused) return { ok: false, reason: `paused: ${state.pauseReason ?? 'manual'}` };
  if (state.haltedDay === utcDay()) return { ok: false, reason: `günlük durdurma: ${state.haltReason ?? ''}` };
  if (open.length >= cfg.risk.max_concurrent) return { ok: false, reason: `max_concurrent (${cfg.risk.max_concurrent})` };
  if (open.some((p) => p.chain === chain && p.token === token)) return { ok: false, reason: 'zaten pozisyon var' };

  const reentryMs = cfg.risk.reentry_block_hours * 3_600_000;
  if (state.positions.some((p) => p.chain === chain && p.token === token && (p.closedAt ?? p.openedAt) > now - reentryMs))
    return { ok: false, reason: `son ${cfg.risk.reentry_block_hours} saatte işlem yapıldı` };

  if (d.trades >= cfg.risk.max_trades_per_day) return { ok: false, reason: 'max_trades_per_day' };
  if (d.lastLossAt && now - d.lastLossAt < cfg.risk.cooldown_after_loss_min * 60_000) {
    const left = Math.ceil((cfg.risk.cooldown_after_loss_min * 60_000 - (now - d.lastLossAt)) / 60_000);
    return { ok: false, reason: `kayıp sonrası cooldown (${left} dk)` };
  }
  if (d.realized[chain] >= r.daily_profit_target) return { ok: false, reason: 'günlük kâr hedefi doldu' };

  const worst = cfg.risk.assumed_worst_loss_pct / 100;
  const realizedLoss = Math.max(0, -d.realized[chain]);
  const openRisk = open.filter((p) => p.chain === chain).reduce((s, p) => s + p.sizeNative * worst, 0);
  if (realizedLoss + openRisk + size * worst > r.daily_loss_cap + 1e-9)
    return {
      ok: false,
      reason: `risk bütçesi: ${(realizedLoss + openRisk).toFixed(3)} + ${(size * worst).toFixed(3)} > ${r.daily_loss_cap}`,
    };

  return { ok: true };
}

function halt(reason: string) {
  state.haltedDay = utcDay();
  state.haltReason = reason;
  return reason;
}

// Pozisyon kapanınca çağrılır; günlük durdurmaları burada tetikler.
export function onClosed(chain: Chain, pnl: number): string | null {
  rollDay();
  const r = riskFor(chain);
  const d = state.daily;
  d.realized[chain] += pnl;
  if (pnl < 0) {
    d.consecutiveLosses++;
    d.lastLossAt = Date.now();
  } else d.consecutiveLosses = 0;

  if (-d.realized[chain] >= r.daily_loss_cap) return halt(`${chain} günlük kayıp limiti (${d.realized[chain].toFixed(4)})`);
  if (d.realized[chain] >= r.daily_profit_target) return halt(`${chain} günlük kâr hedefi (+${d.realized[chain].toFixed(4)})`);
  if (d.consecutiveLosses >= cfg.risk.max_consecutive_losses) return halt(`${d.consecutiveLosses} ardışık kayıp`);
  return null;
}
```

## src/scanner.ts

```ts
import { cfg, wallets, type Chain } from './config.js';
import { executor } from './exec/index.js';
import { evaluate } from './filters.js';
import { openPosition } from './positions.js';
import { canOpen, probeSize } from './risk.js';
import { activeEntries, confirmSolanaOnChain } from './smartmoney.js';
import { bestPairs, discover } from './sources/discovery.js';
import { holderCount, security } from './sources/security.js';
import { sniperPct } from './sources/sniper.js';
import { state } from './state.js';
import { tg } from './telegram.js';
import { track } from './tracker.js';
import type { Metrics, PairInfo } from './types.js';
import { errMsg, jsonl, log, queue, sleep } from './util.js';

const seen = new Map<string, number>();
const deep = queue(cfg.scan.deep_check_concurrency);

function fresh(chain: Chain, token: string) {
  const k = `${chain}:${token}`;
  const ttl = cfg.scan.seen_ttl_min * 60_000;
  const t = seen.get(k);
  if (t && Date.now() - t < ttl) return false;
  seen.set(k, Date.now());
  if (seen.size > 20_000) for (const [kk, v] of seen) if (Date.now() - v > ttl) seen.delete(kk);
  return true;
}

async function deepCheck(pi: PairInfo) {
  const f = cfg.filters;
  const ageMin = (Date.now() - pi.pairCreatedAt) / 60_000;

  // 1) Güvenlik (ucuz ve en çok eleyen) — erken çık.
  const sec = await security(pi.chain, pi.token, pi.pair);
  const base: Metrics = {
    ...sec,
    liquidityUsd: pi.liquidityUsd,
    ageMin,
    sniperPct: null,
    smartWallets: [],
    kolWallets: [],
    holders0: null,
    holders1: null,
    holderGrowthPct: null,
  };
  const early = evaluate(base, { ...f, max_sniper_pct: Infinity, sniper_unknown_pass: true, min_smart_entries: 0, min_smart_only: 0, require_holder_growth: false });
  if (early.length) return finish(pi, base, early, 'security');

  // 2) Holder büyümesi: iki ölçüm arası pencere.
  base.holders0 = await holderCount(pi.chain, pi.token, pi.pair).catch(() => sec.holders);
  await sleep(f.holder_growth_window_sec * 1000);
  base.holders1 = await holderCount(pi.chain, pi.token, pi.pair).catch(() => null);
  if (base.holders0 && base.holders1 != null) base.holderGrowthPct = ((base.holders1 - base.holders0) / base.holders0) * 100;

  // 3) Smart money / KOL (webhook olayları + gerekirse RPC doğrulaması).
  if (pi.chain === 'solana' && wallets.solana.length) await confirmSolanaOnChain(pi.token);
  const sm = activeEntries(pi.chain, pi.token);
  base.smartWallets = sm.smart;
  base.kolWallets = sm.kol;

  // 4) Sniper oranı (en pahalı) yalnız smart money geçtiyse.
  if (sm.smart.length + sm.kol.length >= f.min_smart_entries) {
    base.sniperPct = await sniperPct(pi.chain, pi.token, pi.pair, pi.pairCreatedAt).catch((e) => {
      log.warn('sniper calc', { token: pi.token, err: errMsg(e) });
      return null;
    });
  }

  const fails = evaluate(base, f);
  return finish(pi, base, fails, 'full');
}

// Gece raporu için sayaçlar (process ömrü boyunca).
export const scanStats = { discovered: 0, prefiltered: 0, deepChecked: 0, passed: 0, opened: 0, gated: 0 };

async function finish(pi: PairInfo, m: Metrics, fails: string[], stage: string) {
  scanStats.deepChecked++;
  jsonl('candidates.jsonl', { chain: pi.chain, token: pi.token, symbol: pi.symbol, pair: pi.pair, priceUsd: pi.priceUsd, stage, fails, metrics: m });
  track(pi); // geçen/kalan herkesin sonrası izlenir → haftalık optimizasyon
  if (fails.length) return;
  scanStats.passed++;

  const ex = executor(pi.chain);
  const size = probeSize(pi.chain, await ex.balance());
  if (size == null) return log.warn('bakiye yetersiz', { chain: pi.chain });
  const gate = canOpen(pi.chain, pi.token, size);
  if (!gate.ok) {
    scanStats.gated++;
    log.info('sinyal ama risk kapısı kapalı', { token: pi.token, reason: gate.reason });
    return tg(`🟡 Sinyal ${pi.symbol} (${pi.chain}) — girilmedi: ${gate.reason}`);
  }
  if (!(await ex.canRoute(pi.token, size))) return log.info('rota yok', { token: pi.token });
  try {
    await openPosition(pi, size, m);
    scanStats.opened++;
  } catch (e) {
    log.error('buy failed', { token: pi.token, err: errMsg(e) });
    await tg(`⚠️ ALIM BAŞARISIZ ${pi.symbol}: ${errMsg(e)}`);
  }
}

async function scanOnce(chain: Chain) {
  const tokens = (await discover(chain)).filter((t) => fresh(chain, t));
  scanStats.discovered += tokens.length;
  if (!tokens.length) return;
  const pairs = await bestPairs(chain, tokens);
  for (const pi of pairs.values()) {
    const age = (Date.now() - pi.pairCreatedAt) / 60_000;
    if (age < cfg.scan.min_pair_age_min) {
      seen.delete(`${chain}:${pi.token}`); // erken geldi, sonraki turda yeniden değerlendir
      continue;
    }
    if (age > cfg.scan.max_pair_age_min || pi.liquidityUsd < cfg.filters.min_liquidity_usd) continue;
    scanStats.prefiltered++;
    deep.push(() =>
      deepCheck(pi).catch((e) => log.warn('deep check', { token: pi.token, err: errMsg(e) })),
    );
  }
}

export function startScanner(chain: Chain) {
  const loop = async () => {
    if (!state.paused && deep.size < 20) {
      try {
        await scanOnce(chain);
      } catch (e) {
        log.warn('scan', { chain, err: errMsg(e) });
      }
    }
    setTimeout(loop, cfg.scan.interval_sec * 1000);
  };
  void loop();
}
```

## src/smartmoney.ts

```ts
import { EventEmitter } from 'node:events';
import { PublicKey } from '@solana/web3.js';
import { id as keccakId, zeroPadValue, getAddress } from 'ethers';
import { cfg, wallets, type Chain, type TrackedWallet } from './config.js';
import { BSC_QUOTE_TOKENS, QUOTE_MINTS, bscProvider, solConn } from './chains.js';
import { errMsg, jsonl, log, throttle } from './util.js';

interface WalletEvent {
  wallet: string;
  label: string;
  type: 'smart' | 'kol';
  side: 'buy' | 'sell';
  ts: number;
  source: string;
}

const events = new Map<string, WalletEvent[]>();
const key = (chain: Chain, token: string) => `${chain}:${chain === 'bsc' ? token.toLowerCase() : token}`;
const byAddr: Record<Chain, Map<string, TrackedWallet>> = {
  solana: new Map(wallets.solana.map((w) => [w.address, w])),
  bsc: new Map(wallets.bsc.map((w) => [w.address, w])),
};

// "sell" olayı → pozisyon yöneticisi anında kontrol eder.
export const smartBus = new EventEmitter();

function record(chain: Chain, token: string, w: TrackedWallet, side: 'buy' | 'sell', source: string, ts = Date.now()) {
  const k = key(chain, token);
  const list = events.get(k) ?? [];
  if (side === 'buy' && list.some((e) => e.wallet === w.address && e.side === 'buy')) return;
  const ev: WalletEvent = { wallet: w.address, label: w.label, type: w.type, side, ts, source };
  list.push(ev);
  events.set(k, list);
  jsonl('wallet_events.jsonl', { chain, token, ...ev });
  if (side === 'sell') smartBus.emit('sell', chain, k.slice(chain.length + 1), w.address);
}

// Pencere içinde alıp henüz satmamış izlenen cüzdanlar.
export function activeEntries(chain: Chain, token: string): { smart: string[]; kol: string[] } {
  const since = Date.now() - cfg.filters.smart_lookback_min * 60_000;
  const list = events.get(key(chain, token)) ?? [];
  const smart: string[] = [];
  const kol: string[] = [];
  for (const e of list) {
    if (e.side !== 'buy' || e.ts < since) continue;
    const sold = list.some((x) => x.wallet === e.wallet && x.side === 'sell' && x.ts > e.ts);
    if (!sold) (e.type === 'smart' ? smart : kol).push(e.label);
  }
  return { smart, kol };
}

export function exitsSince(chain: Chain, token: string, labels: string[], sinceMs: number): string[] {
  return (events.get(key(chain, token)) ?? [])
    .filter((e) => e.side === 'sell' && e.ts >= sinceMs && labels.includes(e.label))
    .map((e) => e.label);
}

// ---------- Solana: Helius Enhanced Webhook (tip: SWAP, adresler: wallets.yaml) ----------
export function handleHeliusWebhook(body: unknown) {
  if (!Array.isArray(body)) return;
  for (const tx of body as any[]) {
    for (const tt of tx.tokenTransfers ?? []) {
      if (!tt.mint || QUOTE_MINTS.has(tt.mint)) continue;
      const ts = tx.timestamp ? tx.timestamp * 1000 : Date.now();
      const to = byAddr.solana.get(tt.toUserAccount);
      const from = byAddr.solana.get(tt.fromUserAccount);
      if (to) record('solana', tt.mint, to, 'buy', 'helius', ts);
      if (from) record('solana', tt.mint, from, 'sell', 'helius', ts);
    }
  }
}

// Webhook kaçırdıysa: aday token için cüzdan bakiyelerini doğrudan sorgula.
export async function confirmSolanaOnChain(mint: string) {
  const mintPk = new PublicKey(mint);
  for (const w of wallets.solana) {
    try {
      await throttle('sol-rpc', 120);
      const r = await solConn().getParsedTokenAccountsByOwner(new PublicKey(w.address), { mint: mintPk });
      const bal = r.value.reduce((s, a) => s + Number(a.account.data.parsed.info.tokenAmount.uiAmount ?? 0), 0);
      if (bal > 0) record('solana', mint, w, 'buy', 'rpc');
    } catch (e) {
      log.warn('sol wallet check', { w: w.label, err: errMsg(e) });
    }
  }
}

// Açık pozisyon için: tetikleyen cüzdanlar bakiyeyi sıfırladı/yarıladı mı (webhook yedeği).
const lastBal = new Map<string, number>();
export async function pollSolanaHolders(mint: string, labels: string[]) {
  const mintPk = new PublicKey(mint);
  for (const w of wallets.solana.filter((x) => labels.includes(x.label))) {
    await throttle('sol-rpc', 120);
    const r = await solConn().getParsedTokenAccountsByOwner(new PublicKey(w.address), { mint: mintPk });
    const bal = r.value.reduce((s, a) => s + Number(a.account.data.parsed.info.tokenAmount.uiAmount ?? 0), 0);
    const k = `${w.address}:${mint}`;
    const prev = lastBal.get(k);
    lastBal.set(k, bal);
    if (prev != null && prev > 0 && bal < prev * 0.5) record('solana', mint, w, 'sell', 'rpc');
  }
}

// ---------- BSC: Transfer log taraması (iki getLogs çağrısı / tur) ----------
const TRANSFER = keccakId('Transfer(address,address,uint256)');
let bscFrom = 0;
export async function pollBsc() {
  if (!wallets.bsc.length) return;
  const p = bscProvider();
  const head = await p.getBlockNumber();
  if (!bscFrom) bscFrom = head - 40;
  if (head <= bscFrom) return;
  const toBlock = Math.min(head, bscFrom + 400);
  const topics = wallets.bsc.map((w) => zeroPadValue(w.address, 32));
  const [ins, outs] = await Promise.all([
    p.getLogs({ topics: [TRANSFER, null, topics], fromBlock: bscFrom + 1, toBlock }),
    p.getLogs({ topics: [TRANSFER, topics], fromBlock: bscFrom + 1, toBlock }),
  ]);
  for (const [logs, side, idx] of [
    [ins, 'buy', 2],
    [outs, 'sell', 1],
  ] as const) {
    for (const l of logs) {
      if (BSC_QUOTE_TOKENS.has(l.address.toLowerCase())) continue;
      const addr = getAddress('0x' + l.topics[idx].slice(26)).toLowerCase();
      const w = byAddr.bsc.get(addr);
      if (w) record('bsc', l.address.toLowerCase(), w, side, 'logs');
    }
  }
  bscFrom = toBlock;
}

export function walletCounts() {
  return { solana: wallets.solana.length, bsc: wallets.bsc.length };
}
```

## src/sources/discovery.ts

```ts
import type { Chain } from '../config.js';
import type { PairInfo } from '../types.js';
import { getJson, throttle } from '../util.js';

const DEXS = 'https://api.dexscreener.com';
const GECKO = 'https://api.geckoterminal.com/api/v2';

// GeckoTerminal: yeni havuzlar (free ~30 rpm → 2.1 sn aralık).
export async function geckoNewPools(chain: Chain): Promise<string[]> {
  await throttle('gecko', 2100);
  const j = await getJson<any>(`${GECKO}/networks/${chain}/new_pools?page=1`);
  return (j.data ?? [])
    .map((p: any) => String(p.relationships?.base_token?.data?.id ?? ''))
    .map((id: string) => id.slice(id.indexOf('_') + 1))
    .filter(Boolean);
}

// DexScreener: profil açan yeni token'lar (genelde dev/ekip aktif olanlar).
export async function dexsLatestProfiles(chain: Chain): Promise<string[]> {
  await throttle('dexs', 1100);
  const rows = await getJson<any[]>(`${DEXS}/token-profiles/latest/v1`);
  return rows.filter((r) => r.chainId === chain).map((r) => r.tokenAddress);
}

// Token başına en likit çift. /tokens/v1 tek çağrıda 30 adres alır (300 rpm).
export async function bestPairs(chain: Chain, tokens: string[]): Promise<Map<string, PairInfo>> {
  const out = new Map<string, PairInfo>();
  for (let i = 0; i < tokens.length; i += 30) {
    const chunk = tokens.slice(i, i + 30);
    await throttle('dexs', 250);
    const pairs = await getJson<any[]>(`${DEXS}/tokens/v1/${chain}/${chunk.join(',')}`);
    for (const p of pairs ?? []) {
      const token: string = p.baseToken?.address;
      if (!token) continue;
      const key = chain === 'bsc' ? token.toLowerCase() : token;
      const liq = Number(p.liquidity?.usd ?? 0);
      const prev = out.get(key);
      if (prev && prev.liquidityUsd >= liq) continue;
      out.set(key, {
        chain,
        token: key,
        symbol: p.baseToken?.symbol ?? '?',
        pair: p.pairAddress,
        dex: p.dexId,
        priceUsd: Number(p.priceUsd ?? 0),
        liquidityUsd: liq,
        fdvUsd: Number(p.fdv ?? 0),
        pairCreatedAt: Number(p.pairCreatedAt ?? 0),
      });
    }
  }
  return out;
}

export async function discover(chain: Chain): Promise<string[]> {
  const [a, b] = await Promise.allSettled([geckoNewPools(chain), dexsLatestProfiles(chain)]);
  const set = new Set<string>();
  for (const r of [a, b]) if (r.status === 'fulfilled') r.value.forEach((t) => set.add(chain === 'bsc' ? t.toLowerCase() : t));
  return [...set];
}
```

## src/sources/gmgn.ts

```ts
import { env, type Chain } from '../config.js';
import { getJson, throttle } from '../util.js';

export interface GmgnStats {
  sniperPct?: number;
  smartBuyers?: number;
  kolBuyers?: number;
}

// GMGN'in herkese açık, stabil bir veri API'si yok; web uç noktaları Cloudflare arkasında ve sık değişiyor.
// GMGN_API_BASE ile erişimin olan bir uç nokta (ör. kendi proxy'n / ücretli erişim) verirsen burası kullanılır,
// yoksa null döner ve bot on-chain hesaplara (sniper.ts) + kendi cüzdan listene (smartmoney.ts) düşer.
// Alan eşlemesini aldığın yanıtın şemasına göre düzenle.
export async function gmgnTokenStats(chain: Chain, token: string): Promise<GmgnStats | null> {
  const base = env('GMGN_API_BASE', false);
  if (!base) return null;
  await throttle('gmgn', 1500);
  const j = await getJson<any>(`${base.replace(/\/$/, '')}/token/${chain === 'solana' ? 'sol' : 'bsc'}/${token}`);
  const d = j.data ?? j;
  return {
    sniperPct: d.sniper_hold_rate != null ? Number(d.sniper_hold_rate) * 100 : undefined,
    smartBuyers: d.smart_buy_count != null ? Number(d.smart_buy_count) : undefined,
    kolBuyers: d.kol_buy_count != null ? Number(d.kol_buy_count) : undefined,
  };
}
```

## src/sources/security.ts

```ts
import { cfg, env, type Chain } from '../config.js';
import { BURN_ADDRS, HELIUS_RPC } from '../chains.js';
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

// ---------- BSC: GoPlus + honeypot.is ----------
export async function bscSecurity(token: string, pair: string): Promise<Security> {
  const addr = token.toLowerCase();
  await throttle('goplus', 1100);
  const [g, hp] = await Promise.all([
    getJson<any>(`https://api.gopluslabs.io/api/v1/token_security/56?contract_addresses=${addr}`, {}, 15_000),
    getJson<any>(`https://api.honeypot.is/v2/IsHoneypot?address=${addr}&chainID=56&pair=${pair}`, {}, 15_000).catch(
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
  };
}

export async function security(chain: Chain, token: string, pair: string): Promise<Security> {
  return chain === 'solana' ? solanaSecurity(token) : bscSecurity(token, pair);
}

// GoPlus holder_count önbellekli olabilir; BSC'de büyüme sinyali bu yüzden daha kaba.
export async function holderCount(chain: Chain, token: string, pair: string): Promise<number | null> {
  if (chain === 'solana') return env('HELIUS_API_KEY', false) ? solanaHolderCount(token) : null;
  return (await bscSecurity(token, pair)).holders;
}

export const lpOk = (s: Security) => !cfg.filters.require_lp_locked || s.lpLockedPct >= cfg.filters.min_lp_locked_pct;
```

## src/sources/sniper.ts

```ts
import { PublicKey } from '@solana/web3.js';
import { Contract, id as keccakId, zeroPadValue, getAddress } from 'ethers';
import { cfg, type Chain } from '../config.js';
import { bscProvider, solConn } from '../chains.js';
import { throttle } from '../util.js';
import { gmgnTokenStats } from './gmgn.js';

// Sniper oranı = ilk N slot/blokta alan cüzdanların BUGÜN tuttuğu arzın yüzdesi.
// Önce GMGN adaptörü (varsa), yoksa on-chain yaklaşık hesap.
export async function sniperPct(chain: Chain, token: string, pair: string, pairCreatedAt: number): Promise<number | null> {
  const g = await gmgnTokenStats(chain, token).catch(() => null);
  if (g?.sniperPct != null) return g.sniperPct;
  return chain === 'solana' ? solanaSniperPct(token) : bscSniperPct(token, pair, pairCreatedAt);
}

async function solanaSniperPct(mint: string): Promise<number | null> {
  const conn = solConn();
  const mintPk = new PublicKey(mint);
  let before: string | undefined;
  const sigs: { signature: string; slot: number; err: unknown }[] = [];
  let exhausted = false;
  for (let i = 0; i < cfg.filters.sniper_sig_pages; i++) {
    await throttle('sol-rpc', 120);
    const page = await conn.getSignaturesForAddress(mintPk, { before, limit: 1000 });
    sigs.push(...page);
    if (page.length < 1000) {
      exhausted = true;
      break;
    }
    before = page[page.length - 1].signature;
  }
  if (!exhausted || sigs.length === 0) return null; // en eskiye inemedik → bilinmiyor

  const oldest = sigs.reverse();
  const firstSlot = oldest[0].slot;
  const early = oldest.filter((s) => !s.err && s.slot <= firstSlot + cfg.filters.sniper_slots).slice(0, 40);

  const buyers = new Set<string>();
  for (const s of early) {
    await throttle('sol-rpc', 120);
    const tx = await conn.getParsedTransaction(s.signature, { maxSupportedTransactionVersion: 0 });
    const pre = new Map<string, number>();
    for (const b of tx?.meta?.preTokenBalances ?? []) if (b.mint === mint && b.owner) pre.set(b.owner, b.uiTokenAmount.uiAmount ?? 0);
    for (const b of tx?.meta?.postTokenBalances ?? []) {
      if (b.mint !== mint || !b.owner) continue;
      if ((b.uiTokenAmount.uiAmount ?? 0) > (pre.get(b.owner) ?? 0)) buyers.add(b.owner);
    }
  }
  if (buyers.size === 0) return 0;

  await throttle('sol-rpc', 120);
  const supply = (await conn.getTokenSupply(mintPk)).value.uiAmount ?? 0;
  if (!supply) return null;
  let held = 0;
  for (const owner of buyers) {
    await throttle('sol-rpc', 120);
    const accts = await conn.getParsedTokenAccountsByOwner(new PublicKey(owner), { mint: mintPk });
    for (const a of accts.value) held += Number(a.account.data.parsed.info.tokenAmount.uiAmount ?? 0);
  }
  return (held / supply) * 100;
}

const ERC20 = ['function balanceOf(address) view returns (uint256)', 'function totalSupply() view returns (uint256)'];
const TRANSFER = keccakId('Transfer(address,address,uint256)');

async function blockAt(tsSec: number): Promise<number> {
  const p = bscProvider();
  let hi = await p.getBlockNumber();
  let lo = Math.max(0, hi - 40_000); // ~8 saat (0.75 sn blok); max_pair_age bunun altında
  while (lo < hi) {
    const mid = Math.floor((lo + hi) / 2);
    const b = await p.getBlock(mid);
    if (!b || b.timestamp < tsSec) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

async function bscSniperPct(token: string, pair: string, pairCreatedAt: number): Promise<number | null> {
  if (!pairCreatedAt) return null;
  const p = bscProvider();
  const start = (await blockAt(Math.floor(pairCreatedAt / 1000))) - 20;
  const logs = await p.getLogs({
    address: token,
    topics: [TRANSFER, zeroPadValue(pair, 32)],
    fromBlock: start,
    toBlock: start + 20 + cfg.filters.sniper_blocks + 40,
  });
  if (!logs.length) return null;
  const first = logs[0].blockNumber;
  const buyers = new Set(
    logs
      .filter((l) => l.blockNumber <= first + cfg.filters.sniper_blocks)
      .map((l) => getAddress('0x' + l.topics[2].slice(26))),
  );
  const c = new Contract(token, ERC20, p);
  const supply: bigint = await c.totalSupply();
  if (supply === 0n) return null;
  let held = 0n;
  for (const b of buyers) held += (await c.balanceOf(b)) as bigint;
  return Number((held * 10_000n) / supply) / 100;
}
```

## src/state.ts

```ts
import fs from 'node:fs';
import path from 'node:path';
import { CHAINS, DATA_DIR, riskFor, type Chain } from './config.js';
import type { Position } from './types.js';
import { utcDay } from './util.js';

interface Daily {
  day: string;
  realized: Record<Chain, number>;
  trades: number;
  consecutiveLosses: number;
  lastLossAt: number;
}

export interface State {
  positions: Position[];
  paperBalance: Record<Chain, number>;
  daily: Daily;
  paused: boolean;
  pauseReason?: string;
  haltedDay?: string; // günlük cap/kâr hedefi/seri kayıp → bu gün yeni giriş yok
  haltReason?: string;
}

const FILE = path.join(DATA_DIR, 'state.json');

const freshDaily = (): Daily => ({ day: utcDay(), realized: { solana: 0, bsc: 0 }, trades: 0, consecutiveLosses: 0, lastLossAt: 0 });

function load(): State {
  if (fs.existsSync(FILE)) return JSON.parse(fs.readFileSync(FILE, 'utf8'));
  return {
    positions: [],
    paperBalance: Object.fromEntries(CHAINS.map((c) => [c, riskFor(c).paper_start_balance])) as Record<Chain, number>,
    daily: freshDaily(),
    paused: false,
  };
}

export const state: State = load();

export function rollDay() {
  if (state.daily.day !== utcDay()) {
    state.daily = freshDaily();
    save();
  }
}

export function save() {
  const tmp = FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(state, null, 2));
  fs.renameSync(tmp, FILE);
}

export const openPositions = () => state.positions.filter((p) => p.status !== 'closed');
```

## src/telegram.ts

```ts
import { env } from './config.js';
import { errMsg, getJson, log, sleep } from './util.js';

const api = (m: string) => `https://api.telegram.org/bot${env('TELEGRAM_BOT_TOKEN')}/${m}`;

export async function tg(text: string) {
  try {
    await getJson(api('sendMessage'), {
      method: 'POST',
      body: JSON.stringify({ chat_id: env('TELEGRAM_CHAT_ID'), text, parse_mode: 'HTML', disable_web_page_preview: true }),
    });
  } catch (e) {
    log.warn('telegram send', { err: errMsg(e) });
  }
}

export type Commands = Record<string, (args: string[]) => Promise<string>>;

// Long-polling; yalnız TELEGRAM_CHAT_ID'den gelen komutlar işlenir.
export async function startCommands(cmds: Commands) {
  const chatId = env('TELEGRAM_CHAT_ID');
  let offset = 0;
  for (;;) {
    try {
      const r = await getJson<any>(api(`getUpdates?timeout=30&offset=${offset}`), {}, 40_000);
      for (const u of r.result ?? []) {
        offset = u.update_id + 1;
        const msg = u.message;
        if (!msg?.text || String(msg.chat.id) !== chatId) continue;
        const [cmd, ...args] = msg.text.trim().split(/\s+/);
        const h = cmds[cmd.replace(/@.*/, '').toLowerCase()];
        await tg(h ? await h(args).catch((e) => `hata: ${errMsg(e)}`) : `komutlar: ${Object.keys(cmds).join(' ')}`);
      }
    } catch (e) {
      log.warn('telegram poll', { err: errMsg(e) });
      await sleep(5000);
    }
  }
}
```

## src/tracker.ts

```ts
import fs from 'node:fs';
import path from 'node:path';
import { DATA_DIR, cfg, type Chain } from './config.js';
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
  for (const chain of ['solana', 'bsc'] as Chain[]) {
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
```

## src/types.ts

```ts
import type { Chain } from './config.js';

export interface PairInfo {
  chain: Chain;
  token: string;
  symbol: string;
  pair: string;
  dex: string;
  priceUsd: number;
  liquidityUsd: number;
  fdvUsd: number;
  pairCreatedAt: number; // ms
}

export interface Security {
  top10Pct: number;
  lpLockedPct: number;
  renounced: boolean;
  buyTaxPct: number;
  sellTaxPct: number;
  honeypot: boolean;
  holders: number | null;
  holderAddrs: string[]; // havuz hariç ilk 20 holder (cüzdan keşfi için)
  flags: string[];
}

export interface Metrics extends Security {
  liquidityUsd: number;
  ageMin: number;
  sniperPct: number | null;
  smartWallets: string[];
  kolWallets: string[];
  holders0: number | null;
  holders1: number | null;
  holderGrowthPct: number | null;
}

export interface Position {
  id: string;
  chain: Chain;
  token: string;
  symbol: string;
  pair: string;
  mode: 'paper' | 'live';
  openedAt: number;
  sizeNative: number;
  tokenRaw: string; // bigint string
  decimals: number;
  peakValueNative: number;
  lastValueNative: number;
  quoteFails: number;
  triggerWallets: string[];
  entrySig?: string;
  status: 'open' | 'closing' | 'closed';
  exitReason?: string;
  exitValueNative?: number;
  closedAt?: number;
  exitSig?: string;
}
```

## src/util.ts

```ts
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
```

