# Sniper bot — değişen dosyalar (tam metin, 02.11.2026 02:04)

## `.dockerignore`

````text
node_modules
data
pulled
.env
*.tgz
````

## `.env.example`

````text
# --- zorunlu ---
TELEGRAM_BOT_TOKEN=
TELEGRAM_CHAT_ID=
HELIUS_API_KEY=                 # helius.dev free tier: RPC + DAS + webhook
ETHERSCAN_API_KEY=              # opsiyonel: etherscan.io v2 (BSC/Base/Monad fonlama kümesi; yoksa bu kontrol 'bilinmiyor')
HELIUS_WEBHOOK_AUTH=            # webhook'ta "Authorization" header olarak gireceğin rastgele string
BSC_RPC_URL=                    # NodeReal / Ankr free endpoint (eth_getLogs destekli)
BASE_RPC_URL=                   # Base mainnet (8453): Alchemy / QuickNode / mainnet.base.org — eth_getLogs destekli olmalı
BLAST_RPC_URL=                  # yalnız chains.blast.enabled ise: https://rpc.blast.io veya Alchemy/QuickNode
MONAD_RPC_URL=https://rpc.monad.xyz   # public RPC: eth_getLogs en fazla 100 blok (bot parçalar); Alchemy/QuickNode daha hızlı

# --- yalnız live ---
LIVE_CONFIRM=                   # live mod için tam olarak YES
SOLANA_PRIVATE_KEY=             # base58, SADECE bot için açılmış ayrı cüzdan
BSC_PRIVATE_KEY=                # 0x..., SADECE bot için açılmış ayrı cüzdan
BASE_PRIVATE_KEY=               # 0x..., SADECE bot için açılmış ayrı cüzdan (yalnız Base live ise gerekli)
BLAST_PRIVATE_KEY=              # yalnız Blast live ise
MONAD_PRIVATE_KEY=              # yalnız Monad live ise

# --- opsiyonel ---
GMGN_API_BASE=                  # erişimin varsa: src/sources/gmgn.ts adaptörünü doldur
DATA_DIR=/data                  # Railway volume mount yolu
PORT=8080
````

## `.gitignore`

````text
node_modules
data
.env
pulled
*.tgz
````

## `Dockerfile`

````text
FROM node:22-slim
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY . .
ENV NODE_ENV=production DATA_DIR=/data
CMD ["npm", "start"]
````

## `README.md`

````markdown
# sniper-bot — Solana (Jupiter + pump.fun benzeri launchpad'ler) + BSC (Pancake V2) + Base (Uniswap V2 / Aerodrome) + Blast (Uniswap V2) + Monad (Uniswap V2), smart money/KOL hibrit sinyal

Varsayılan **paper** mod: gerçek quote'larla simülasyon, sanal bakiye. Live için `config.yaml → mode: live` **ve** env `LIVE_CONFIRM=YES`.

## Akış

```
GeckoTerminal new_pools + DexScreener profiles  (20 sn)
  → DexScreener çift verisi: yaş 3–90 dk, liq ≥ $8k
  → güvenlik
      SOL: RugCheck (top10 havuz hariç, LP kilit, mint/freeze authority, Token-2022 fee)
      BSC: GoPlus + honeypot.is simülasyonu, yalnız Pancake V2 çifti
      top10 < %28 · LP kilit/burn ≥ %90 · renounce · satış vergisi < %4 · honeypot yok
      dev'in önceki token'ı rug olduysa → ele  (dev_serial)
  → wash trading (SOL: Helius son 100 SWAP, BSC: son ~400 blok Transfer)
      ≥ 4 cüzdan 30 sn içinde al-sat yapıyor ve en büyük 5'li grup trade'lerin ≥ %20'si → ele
  → senkron cüzdan (aynı swap verisi): aynı slot/blokta aynı yönde ≥3 cüzdan; aynı çift ≥3 blokta birlikte = koordineli
      senkron trade ≥ %55 VE koordineli ≥3 cüzdan → ele (sync_swarm) · grubun ≥%25'i önceki rug'larda da senkron → ele
  → fonlama kümesi: erken alıcıların ilk fonlayıcısı (SOL RPC / EVM Etherscan v2); ortak fonlayıcı ≥%30, dev-fonlu ≥%10,
      taze cüzdan ≥%60 + ortak ≥%20 ya da fonlayıcının önceki rug'u → ele (funding_cluster) · kombo coordinated_group
  → izlenen cüzdanlar ≤3 sn içinde aynı token'a girdiyse tek giriş sayılır (smart_sync) · launchpad'in 14g erken dump/rug oranı trap skoruna
      koordineli ≥3 + erken dump/dev satışı/wash → coordinated_dump (kombo, tek başına eler)
  → holder sayımı t0, 120 sn bekle, t1 → büyüme > %0.1  (SOL: Helius DAS, BSC: GoPlus)
  → smart money/KOL
      SOL: Helius Enhanced webhook (SWAP) + RPC bakiye doğrulama
      BSC: eth_getLogs Transfer taraması (15 sn)
      ≥ 2 giriş, en az 1'i "smart"
  → erken alıcı analizi (ilk 4 slot / 4 blok, en fazla 25 cüzdan)
      bugün tuttukları arz < %30
      10 dk içinde satan erken alıcı < %60  (sniper_flip)
      daha önce rug olmuş token'larda da erken alıcı olan < %25  (sniper_rug_link)
      aynı ≥3 erken alıcı ≥2 önceki rug'da birlikte erken girdiyse → ele  (rug_cluster)
      dev'in ödediği / launch slot'undaki alımlar ≥ %30 → ele  (bundle)
      dev elindekinin ≥ %20'sini pair'e sattıysa → ele, LP kilitli olsa bile  (dev_sell)
  → ilk 8 dk dump: GeckoTerminal 1 dk mum, zirveden ≥ %45 düşüş → ele  (early_dump)
  → sinyal tuzak skoru 0–100 (src/trap.ts) > 65 → ele  (trap_score)
  → risk kapısı (src/risk.ts) → Jupiter / Pancake alım
pozisyon döngüsü (6 sn): TP +55 · SL −22 · trailing (+25'te devreye, zirveden −12) · 240 dk timeout
  · tetikleyen cüzdan satarsa → anında sat
```

Her aday (geçen ve kalan) `candidates.jsonl`'e yazılır ve 6 saat fiyatı izlenir (`outcomes.jsonl`). Optimizasyon ve gece raporu reddedilenlerin de ne yaptığını görür.

GMGN yerine: SOL'da Helius + RugCheck, BSC'de GoPlus + honeypot.is. solana.fm eklenmedi: Helius aynı veriyi (tx geçmişi, holder, webhook) tek anahtarla veriyor, ikinci bir kaynak yalnız rate-limit yükü getirir.

## Sert limitler ($50 profil — src/risk.ts tek giriş kapısı)

$50 ≈ 0.31 SOL ≈ 0.083 BNB ≈ 0.0167 ETH (SOL≈$160, BNB≈$600, ETH≈$3000). **Yalnız bir ağı live yap**; diğerleri `paper_only: true` (live modda bile paper kalır). Sabah Raporu'ndaki fırsat/rekabet tabloları hangi ağın daha iyi gittiğini gösterir.

| Limit | SOL | BNB | ETH (Base) |
|---|---|---|---|
| Probe | clamp(bakiye × %12, 0.03, 0.0375) | 0.008–0.01 | 0.0016–0.002 |
| Ücret rezervi | 0.02 | 0.003 | 0.0006 |
| Günlük kayıp cap (× risk ölçeği) | 0.03 (≈$4.8) | 0.008 | 0.0016 |
| Günlük kâr hedefi | +0.06 → o gün yeni giriş yok | +0.016 | +0.0033 |
| Eşzamanlı pozisyon | 2 (tüm ağlar) | | |
| Ön-işlem bütçesi | realize kayıp + açıklar × %40 + yeni × %40 ≤ cap × ölçek | | |
| Kayıp sonrası cooldown | 45 dk | | |
| Aynı token | 72 saat tekrar yok | | |
| Ardışık kayıp | 2 → gün sonuna kadar dur | | |
| Günlük işlem | 6 | | |

**Risk ölçeği** (`risk.auto_scale: true`): `/rapor` (ve sabah raporu) her ağ için 0.25–1 arası bir ölçek hesaplar ve günlük cap'i bununla **küçültür** (asla büyütmez). Bu bir mekanik limittir, yatırım tavsiyesi değildir.

Gün sınırı `timezone: Europe/Istanbul` — gece seansı (00:00–08:00) tek güne düşer.

## Telegram

`/status` · `/rapor` (detaylı rapor, aşağıda) · `/pause` (yeni giriş yok, açıklar yönetilir) · `/resume` · `/panic` (hepsini sat + dur). Yalnız `TELEGRAM_CHAT_ID`'den gelen komutlar işlenir.

### /rapor — istediğin an detaylı rapor

| Komut | İçerik |
|---|---|
| `/rapor` | son 24 sa, tüm bölümler |
| `/rapor 6` | son 6 sa (1–336 sa) |
| `/rapor tuzak` | tuzak oranı, kombo sayıları, 14 gün tuzak isabeti (rug %, kaçan +%50, geçen-rug %), şüpheli cüzdanlar + senkron analizi |
| `/rapor kacan` | elenip ≥+%50 yapan adaylar (sembol, ağ/launchpad, max %, sebepler) + 14g filtre karnesi: sebep başına kaçan pump vs önlenen rug |
| `/rapor isabet` | rug isabet oranı (14g, ağ başına): rug %, yakalama % (tuzak filtreleriyle ayrı), kesinlik %, filtreyi geçip rug olan (sızan) |
| `/rapor senkron` | aynı slot/blokta ≥3 cüzdanın aynı yönde işlemi: ağ başına ort. senkron trade %, koordineli grup, sync_swarm/coordinated_dump elemeleri, 14g rug farkı, tekrarlayan senkron cüzdanlar + fonlama kümesi (ortak fonlayıcı %, taze cüzdan %, tekrarlayan fonlayıcılar) |
| `/rapor risk` | önerilen günlük max risk (ölçek × cap, ≈$) ve hangi kuralın küçülttüğü |
| `/rapor firsat rekabet` | hangi ağda fırsat daha çok / rekabet daha az (son 24 sa, tahmin) |
| `/rapor launchpad` | köken launchpad/dex kırılımı (pump-fun, meteora-dbc, four-meme …) |
| `/rapor cikis` | 14 günlük yollardan en güvenli TP/SL/trailing/max hold (p25'i en iyi olan) + gerçek çıkış nedenleri |
| `/rapor config` | ağ başına önerilen config (UYGULA/UYGULAMA) |

Bölümler birleştirilebilir: `/rapor risk cikis 12`. Türkçe karakterli yazım da olur (`/rapor çıkış`). Rakamlar botun kendi kayıtlarından; "önerilen max risk" mekanik bir limit, yatırım tavsiyesi değil. `auto_scale: true` iken `/rapor` risk ölçeğini günceller (yalnız küçültür).

Otomatik 07:45 raporu `nightly.auto_report: false` ile kapalı (yine `data/sabah-raporu-<gün>.txt`'ye yazılır); `true` yaparsan Telegram'a da gelir.

Bot: @BotFather → `/newbot` → token. Chat ID: bota bir mesaj at, `https://api.telegram.org/bot<TOKEN>/getUpdates` → `chat.id`.

## Kurulum (yerel, paper)

```bash
npm ci
cp .env.example .env   # TELEGRAM_*, HELIUS_*, BSC_RPC_URL, BASE_RPC_URL doldur (private key yalnız live ağ için)
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

**9. Nightly'nin Railway'de sorunsuz çalışması için**
- **Settings → Serverless (App Sleeping): KAPALI.** Açıksa trafik yokken servis uyur, 00:00–08:00 arası tarama ve 07:45 raporu olmaz.
- **Replicas: 1** (`railway.json`). İki kopya = çift alım + çift rapor.
- **Volume `/data` bağlı olmalı.** `nightly-last-report.txt` orada tutulur; volume yoksa her restart'ta rapor tekrar gider.
- Saat dilimi `config.yaml → timezone: Europe/Istanbul` ile hesaplanır (Node'un tam ICU'su); container'ın UTC olması sorun değil, `TZ` değişkeni gerekmez.
- Restart/redeploy 07:45'i kaçırırsa: pencere içindeyse hemen, 08:00–11:00 arasındaysa ilk tick'te (30 sn) rapor gönderilir. Günde bir kez.
- Tarama sayaçları (`scanStats`) process ömrü boyunca tutulur; gece içinde restart olursa rapordaki keşif/derin kontrol sayıları restart'tan itibarendir. Gölge paper ve PnL dosyadan okunduğu için etkilenmez.
- Redeploy'u 00:00–08:00 dışında yap. Kontrol: `railway logs | grep -E "nightly|sabah raporu"`.

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

07:45'te **☀️ Sabah Raporu** (`auto_report: true` ise Telegram'a; her an `/rapor` aynı içeriği verir) (kopyası `data/sabah-raporu-YYYY-MM-DD.txt`):
- tarama: keşif / ön-filtre / derin kontrol / filtre geçen / risk kapısına takılan / açılan
- zincir başına: aday, geçen, en sık eleme nedenleri, gölge paper (n, win, avg, pf, PnL), gerçek paper/live kapanan işlemler ve PnL, günlük cap/hedef durumu
- açık pozisyonlar, günlük durdurma/duraklatma
- **tuzağa düşme risk skoru** (0–100): smart/KOL girişi olan son 3 rug'da izlenen cüzdanların kaçı rug anından **önce** sattı. Yüksek skor = takip ettiğin cüzdanlar seni exit liquidity olarak kullanıyor olabilir. ≥ 2 rug'da önce satan etiketler ayrıca listelenir → `wallets.yaml`'dan çıkarmayı değerlendir. 🟢 < 30 · 🟠 30–59 · 🔴 ≥ 60
- 🧯 **Önerilen günlük max risk** (ağ başına): `daily_loss_cap × ölçek`, native + ≈$ + kaç probe'luk kötü senaryo kaybı. Ölçek 1'den başlar: 7g gölge < 5 işlem ×0.75 · 7g gölge ort < 0 ×0.5 · gece tuzak oranı ≥ %50 ×0.75 · dün kayıp limiti doldu ×0.5 · son 3 gerçek işlem zarar ×0.5; [min_scale, 1] aralığına kırpılır. Mekanik limit, tavsiye değil.
- 🎯 **Bugün hangi ağda daha fazla fırsat var** (son 24 sa): aday, güvenlik geçen, filtre geçen, biten adaylarda +%50 ve rug oranı, gölge ortalama; skor = pump × (1 − rug) × log(1 + güvenli aday). Geçmiş-veri tahmini.
- 🏁 **Bugün hangi ağda daha az rekabet var** (son 24 sa `early_buyers.jsonl`): token başına erken alıcı, sniper-bot payı (≥ 3 token'da erken ya da tek token'da > 3 alım), hızlı satış %, bundle % → 0–100 rekabet endeksi; düşük = az rekabet. Tahmin.
- 🔬 **Detaylı tuzak analizi**: ağ başına gece tuzak eleme oranı, kombo/oto-eleme sayıları, 14 günlük isabet (tuzakla elenenlerin yüzde kaçı gerçekten rug oldu, kaçı +%50 yaptı = kaçırılan).
- 🚪 **En güvenli çıkış stratejisi**: 14 günde geçen adayların gerçek fiyat yollarında TP/SL/trailing/max_hold ızgarası; ort > 0 şartıyla kötü çeyreği (p25) en iyi olan ayar + gerçek çıkış nedeni dağılımı. Veri yoksa "paper kal".
- **önerilen config değişikliği** (ağ başına, yalnız o ağın kendi geçmişiyle walk-forward → `chain_filters.<ağ>.*`; config otomatik değişmez)

## Sabah 8'e kadar çalıştır, 07:45'te rapor ver

**Railway'de (önerilen):** `nightly.enabled: true` ile bot zaten sürekli açık; her gece 00:00–08:00 özet yazar ve 07:45'te raporu atar. Ek bir şey yapma.

**Yerelde tek gece:**
```bash
caffeinate -i node --env-file=.env node_modules/.bin/tsx src/nightly-run.ts
```
veya `.env` shell'e yüklüyse `caffeinate -i npm run nightly`. Davranış:
- gece yarısından önce başlatırsan 00:00'ı bekler, pencereye girer
- 07:45: sabah raporu dosyaya (Telegram için `auto_report: true`); istediğin an `/rapor`
- 08:00'de durumu kaydedip çıkar (rapor kaçtıysa çıkarken atar)
- gündüz başlatırsan bir sonraki 08:00'e kadar çalışır
- `caffeinate -i` Mac'in uyumasını engeller; kapak kapanırsa süreç durur

Sabah kontrol:
```bash
tail -n 20 data/nightly-summary.log
cat data/sabah-raporu-$(date +%F).txt
```

## Şimdi nightly modda veya /rapor ile test et

**Railway:**
```bash
railway up
railway logs | grep -E "nightly başladı|started"
```
`nightly başladı {"window":"00:00-08:00","report":"07:45"}` görünmeli. Telegram'da `/status`, sonra `/rapor` yaz — ilk saatlerde bölümler "veri az" der; birkaç saat tarama sonrası `/rapor 6`, sabah `/rapor` tam dolu gelir. Otomatik 07:45 gönderimi için `nightly.auto_report: true`.

**Yerelde (Mac açık kalacak):**
```bash
cd sniper-bot
cp .env.example .env    # TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID, HELIUS_API_KEY, BSC_RPC_URL, BASE_RPC_URL doldur
caffeinate -i node --env-file=.env node_modules/.bin/tsx src/nightly-run.ts
```
08:00'de kendisi çıkar. Sabah: `cat data/sabah-raporu-$(date +%F).txt`.

**Yerelde sürekli (gündüz test, /rapor ile):**
```bash
cd sniper-bot
node --env-file=.env node_modules/.bin/tsx src/index.ts
```
Telegram'dan `/rapor 1` (son 1 sa), `/rapor launchpad`, `/rapor tuzak`.

## Tuzak tespiti (src/trap.ts)

Hepsi botun kendi geçmişinden öğrenir: `early_buyers.jsonl`, `devs.jsonl`, `wash_groups.jsonl`, `outcomes.jsonl` (rug = 6 saatte −%80). Dışarıdan hazır kara liste yok.

**Cüzdan şüphe skoru** (0–100; `filters.suspect_wallet_score` = 50 üstü şüpheli: sinyal, rapor ve discover-wallets aynı eşiği kullanır):

| İşaret | Tür | Puan |
|---|---|---|
| ≥ 2 rug'da erken alıcı | rug ortağı | 20 + 30 × rug oranı |
| bu rug'ların ≥ yarısında rug'dan önce satmış | smart-money tuzağı | +25 |
| tek token'da ilk slot/bloklarda > 3 alım | sniper bot | +15 |
| bir token'ın dev'i + başka token'larda erken alıcı | dev+sniper hibrit | +25 |
| dev'i olduğu token rug | seri rug'cu dev | 20 + 15 × rug (en fazla 3) |
| ≥ 2 token'da wash grubunda (1 token: +10) | wash halkası | +25 |
| ≥ 2 cüzdanla ≥ 2 rug'da birlikte erken | rug kümesi | +25 |
| ≥ 3 hızlı satış | — | +10 |

**Sinyal tuzak skoru** (0–100; `max_trap_score: 50` üstü otomatik ele):

| Bileşen | Tam puan | Tam puan eşiği |
|---|---|---|
| dev_prev_rug | 40 | ≥ 1 rug |
| trap_wallet (tetikleyen smart/KOL şüpheli ya da rug'dan önce satmış) | 40 | var |
| rug_cluster | 35 (1 rug: 12) | ≥ 2 rug |
| rug_link | 30 | %15 |
| dev_sold | 30 | %20 |
| suspect_early | 25 | %15 |
| dev_sniper (dev'e bağlı erken alıcı) | 25 | %10 |
| quick_flip | 20 | %40 |
| early_dump | 20 | %35 |
| bundled | 20 | %20 |
| short_hold (medyan tutma) | 15 | ≤ 3 dk (30 dk'da 0) |
| wash | 15 | %15 |
| unknown (eksik veri, alan başına 4) | 16 | 4 alan |

**Kombo kuralları** (`combo_rules: true`, her biri tek başına eler):

| Neden | Koşul |
|---|---|
| `dev_sniper_hybrid` | dev satışı ≥ %10 **ve** bundle ≥ %15, ya da dev'e bağlı erken alıcı **ve** bundle ≥ %15 |
| `smart_trap` | tetikleyen izlenen cüzdanların ≥ yarısı tuzak cüzdanı, ya da tuzak cüzdanı + (hızlı satış ≥ %30 veya erken dump ≥ %25) |
| `wash_ring` | wash ≥ %10 **ve** şüpheli erken alıcı ≥ %10 |
| `insider_exit` | erken dump ≥ %30 **ve** hızlı satış ≥ %40 |
| `rug_ring` | ≥ 1 ortak rug kümesi **ve** rug_link ≥ %10 |
| `trap_wallet` | tetikleyen cüzdanlardan biri tuzak listesinde |

Ayrıca tek başına eleyenler: `dev_sell` (≥ %15), `dev_serial` (önceki rug), `early_dump` (≥ %35), `rug_cluster`, `bundle` (≥ %20), `sniper_flip`, `sniper_rug_link`, `wash_trading`.

Skor ve bileşenleri her adayın `metrics.trapScore` / `trapParts` alanında; optimizer eski kayıtları da güncel ağırlıklarla yeniden puanlar ve `max_trap_score` 40/50/60/70, `max_early_dump_pct`, `max_dev_sold_pct`, `max_bundled_pct` dener.

**Ağa özel filtre** (`chain_filters.<solana|bsc|base>`): verilmeyen alan genel `filters`'tan gelir. Base: ilk 3 blok sniper, top10 < %25, LP kilit ≥ %95, vergi ≤ %3. BSC: ilk 6 blok.

## Cüzdan listesi

`wallets.yaml` boş gelir — doğrulanmamış hazır liste eklenmedi. Doldurma: paper modda 3–7 gün çalıştır → `npm run discover-wallets` → `data/wallet-candidates-*.md` → her adresi Solscan/BscScan/Basescan/GMGN'de elle doğrula (wallets.yaml içindeki kriterler) → ekle → Helius webhook adres listesini güncelle → `railway up`.

`discover-wallets` otomatik eler: rug oranı (rug/görülme) > %35, win rate (kazanç/görülme) < %42, aynı token'da ilk 4 slot/blokta > 3 alım yapan (sniper bot). Sniper botlar raporun sonunda ayrı listelenir ve `data/sniper-bots.json`'a yazılır. Yalnız botun kendi kayıtları kullanılır (hazır cüzdan listesi yok). Tuzak şüphe skoru ≥ `suspect_wallet_score` olanlar da elenir, türüne göre (smart tuzak, rug ortağı, dev+sniper, seri dev, wash halkası, rug kümesi) listelenir ve `data/suspect-wallets.json`'a yazılır; wallets.yaml'daki şüpheliler ayrıca uyarılır.

## Paper → live kontrol listesi

- [ ] En az 2 hafta paper, ≥ 40 kapanmış işlem, `npm run report` net pozitif, `/rapor`da gölge avg > 0
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
| `early_buyers.jsonl` | erken alıcılar: alım sayısı, tutma süresi, sattı mı (rug korelasyonu) |
| `devs.jsonl` | token başına dev cüzdanı + satış % |
| `wash_groups.jsonl` | wash grubu cüzdanları (wash halkası tespiti) |
| `sniper-bots.json` | discover-wallets'ın işaretlediği sniper botlar |
| `suspect-wallets.json` | tuzak şüphelileri: skor, tür, gerekçe |
| `bot.log.jsonl` | tüm log |
| `nightly-summary.log` | 30 dk'lık gece özetleri |
| `sabah-raporu-*.txt`, `optimize-*.md`, `wallet-candidates-*.md` | raporlar |

## Bilinen sınırlar

- **Ağ aktivitesi (1 Kas 2026, GeckoTerminal new_pools ilk sayfa):** Solana ~20 havuz/dk (çoğu pump-fun bonding curve; likiditesi ≥$10k olan 2–4), BSC 20 havuz/14 dk (pancake_v2 16, four-meme 4), Base 20 havuz/21 dk (16'sı Uniswap V4 → atlanır), Blast 0 (kapalı), Monad 20/15 dk ama likidite ≥$10k yok (eklendi, paper), Ethereum gas $50 probe için fazla (eklenmedi).
- **Solana launchpad'leri:** pump.fun, letsbonk, meteora DBC, raydium launchlab, boop, moonit, bags vb. token'ları keşfedilir ama bonding curve'deyken LP/likidite olmadığından `min_liquidity_usd`'de kalır; mezun olunca (pumpswap / meteora-damm-v2 / raydium) normal filtrelerden geçer. Bonding curve'e doğrudan alım (pre-migration) yok.
- **Blast:** Uniswap V2 (router `0xBB66…3035`, factory `0x5C34…1070`, WETH `0x4300…0004` on-chain doğrulandı). honeypot.is Blast'ı desteklemiyor → vergi/honeypot yalnız GoPlus. Varsayılan kapalı.
- **Monad (143):** Uniswap V2 (router `0x4b2a…6804`, factory `0x182a…0f59`, WMON `0x3bd3…433a` on-chain doğrulandı). honeypot.is desteklemiyor → yalnız GoPlus. Public RPC eth_getLogs'u 100 blokla sınırlar → bot parçalar (90 dk'lık havuzda satış taraması ~180 çağrı; yavaşsa ücretli RPC). Blok ~0.3 sn (ölçüm), `sniper_blocks: 15`. Explorer monadscan.com (adres doğrulanmadı). Varsayılan açık ama paper_only.
- **Base:** yalnız Uniswap **V2** ve Aerodrome **volatile** havuzları. Uniswap V3/V4, Clanker/Flaunch (V4 hook) ve bonding-curve token'ları atlanır (pair 20-byte adres değilse aday alınmaz). Ücret EIP-1559, tavan `exec.base_max_fee_gwei`. GoPlus/honeypot.is chain id 8453.

- **BSC:** yalnız Pancake **V2**. four.meme bonding curve veya yalnız V3 havuzlu token'lar atlanır. GoPlus `holder_count` önbellekli → BSC holder büyümesi kaba.
- **RugCheck** alan adları sürüme göre değişebiliyor; ilk gün `candidates.jsonl`'de birkaç token'ı RugCheck sitesiyle karşılaştır.
- Fiyat yolu 5 dk örneklenir; gölge paper ve optimizasyonda SL gap'leri gerçekten farklı görünebilir.
- `stage: security`'de elenen adayların smart/sniper/holder metrikleri ölçülmez; `stage: wash`'ta elenenlerin smart/sniper metrikleri ölçülmez.
- Rug korelasyonu kendi geçmişinden öğrenir: ilk günlerde `outcomes.jsonl` boşken `sniper_rug_link`, `rug_cluster`, `dev_serial` ve şüpheli cüzdan skoru hiçbir adayı elemez; tuzak skoru ilk günlerde yalnız dev satışı, dump, bundle, hızlı satış ve wash'tan oluşur.
- Dev = RugCheck/GoPlus `creator`; yoksa (SOL) oluşturma tx'inin ödeyicisi. BSC'de dev'in launch bloğundan sonraki her dev→pair transferi satış sayılır (sonradan likidite ekleme de satış gibi görünür → dev_sell yanlış pozitif olabilir). Dev token'ı başka cüzdana aktarıp oradan satarsa yakalanmaz.
- early_dump GeckoTerminal mumlarına bağlı; havuz Gecko'da yoksa null (elemez).
- BSC tutma süresi blok sayısı × ortalama blok süresiyle yaklaşık hesaplanır; SOL'da satış zamanı token hesabının alımdan sonraki ilk işlemidir.
- Smart money satışları yalnız webhook/BSC taramasının gördüğü kadardır; görülmeyen satış tuzak skorunda "yakalandı" sayılır (skor düşük tarafta yanılır).
````

## `config.yaml`

````yaml
# $30–50 gerçek bankroll profili. Varsayılan paper; live için ayrıca env LIVE_CONFIRM=YES.
# Tüm tutarlar o ağın native birimi. Dolar karşılıkları yaklaşık fiyatla (SOL≈$160, BNB≈$600, ETH≈$3000, MON≈$0.0192) —
# fiyat değişince probe/cap'leri aynı dolar seviyesine göre güncelle.
# $50 ile öneri: YALNIZ BİR ağı live yap (bankroll bölünürse probe'lar ücrete göre çok küçülür);
# diğerleri paper_only: true kalsın, /rapor'daki fırsat/rekabet tablosu hangisinin daha iyi gittiğini gösterir.
mode: paper
timezone: Europe/Istanbul   # gün sınırı (günlük limitler 00:00'da sıfırlanır) + nightly saatleri

chains:
  solana: { enabled: true }                    # Jupiter
  bsc: { enabled: true, paper_only: true }     # Pancake V2
  base: { enabled: true, paper_only: true }    # Uniswap V2 → Aerodrome (volatile); V3/V4/Clanker havuzları atlanır
                                               # 1 Kas 2026 ölçüm: Base yeni havuzlarının ~%80'i Uniswap V4 → çoğu atlanır
  blast: { enabled: false, paper_only: true }  # Uniswap V2 (router on-chain doğrulandı); 1 Kas 2026: yeni havuz 0 → kapalı
  monad: { enabled: true, paper_only: true }   # 5. ağ: Uniswap V2 (router on-chain doğrulandı). Yeni havuzların çoğu spam →
                                               # filtrede kalır; paper'da /rapor fırsat/rekabet tablosuyla ölç, sonra karar ver

scan:
  interval_sec: 20
  min_pair_age_min: 3
  max_pair_age_min: 90
  deep_check_concurrency: 2
  seen_ttl_min: 180
  # GeckoTerminal new_pools sayfası (20 havuz/sayfa, 2.1 sn). Solana ~20 havuz/dk → 3 sayfa ≈ son 3 dk.
  gecko_pages: { solana: 3, bsc: 1, base: 1, blast: 1, monad: 1 }
  # pump.fun benzeri launchpad'ler (pump-fun, letsbonk-fun, meteora-dbc, raydium-launchlab, boop-fun, moonit,
  # bags-fm, heaven …) zaten taranır: bonding curve'deyken LP/likidite yok → filtrede kalır, mezun olunca
  # (pumpswap / meteora-damm-v2 / raydium) normal filtrelerden geçer. Kökeni rapordaki launchpad kırılımında.
  # Tamamen dışarıda bırakmak istediğin köken dex'leri:
  skip_launchpads: []

filters:
  min_liquidity_usd: 10000
  max_top10_pct: 28
  require_lp_locked: true
  min_lp_locked_pct: 90
  require_renounced: true
  max_sell_tax_pct: 4
  max_buy_tax_pct: 4
  # sniper = ilk N slot (SOL) / blok (EVM) alıcıları
  max_sniper_pct: 25            # erken alıcıların bugün tuttuğu arz payı
  sniper_slots: 4
  sniper_blocks: 4
  sniper_sig_pages: 3
  sniper_max_buyers: 25         # analiz edilen erken alıcı sayısı (RPC kredisi)
  sniper_unknown_pass: false
  quick_flip_min: 10            # bu sürede satan erken alıcı = flipper
  max_sniper_quick_flip_pct: 50
  max_sniper_rug_link_pct: 15   # erken alıcıların %15+'ı daha önce rug olmuş token'larda da erken alıcıysa ele
  # wash trading: son trade'lerde aynı küçük cüzdan grubu 30 sn içinde al-sat yapıyorsa ele
  wash_window_sec: 30
  wash_min_wallets: 3
  wash_group_max: 5
  max_wash_trade_pct: 15
  wash_unknown_pass: true       # veri çekilemezse elemez (ama trap skoruna "unknown" cezası yazılır)
  # senkron cüzdan: aynı slot/blokta aynı yönde ≥3 farklı cüzdan. 1 Kas ölçümü: trend pumpswap havuzunda trade'lerin
  # %40'ı zaten senkron (doğal kalabalık), tekrarlayan çift 0 → asıl işaret aynı çiftlerin defalarca birlikte görünmesi.
  sync_min_wallets: 3
  sync_repeat_min: 3            # bir çift ≥3 senkron blokta birlikte → koordineli
  max_sync_trade_pct: 55        # sync_swarm: trade% ≥55 VE koordineli cüzdan ≥3 → ele
  max_sync_repeat_wallets: 3
  max_sync_rug_link_pct: 25     # senkron grubun ≥%25'i önceki rug'larda da senkron → ele
  # "aynı anda tüm cüzdanlar alıyor" = bağımsız sinyal değil. İzlenen cüzdanlar ≤3 sn içinde girerse tek giriş sayılır;
  # bağımsız giriş min_smart_entries'in altında kalırsa → ele (smart_sync). discover-wallets bu grupları listeler.
  sync_entry_sec: 3
  # launchpad erken satış oranı: son 14g bu ağ+launchpad adaylarının ≥%60'ı ilk 8 dk dump/rug → trap skoru +25 (≥10 örnek)
  max_launchpad_dump_pct: 60
  # koordineli cüzdan grubu (fonlama kümesi): erken alıcıların ilk fonlayıcısı. Bilinen kalıp: dev/operatör tek
  # cüzdandan çok sayıda taze cüzdana native gönderir, bunlar launch'ta arzı toplar (Rugproof vakası: 162 cüzdan, arzın yarısı).
  # Borsa sıcak cüzdanları (≥1000 tx) gruplanmaz. EVM için ETHERSCAN_API_KEY gerekir (yoksa bilinmiyor → elemez).
  funding_max_wallets: 12       # aday başına fonlayıcısı aranan erken alıcı (SOL: 2 RPC/cüzdan, EVM: 1 Etherscan)
  fresh_wallet_hours: 48        # ilk işlemi son 48 sa içinde = taze cüzdan
  max_common_funder_pct: 30     # erken alıcıların ≥%30'u aynı cüzdandan fonlanmış → ele
  max_fund_dev_pct: 10          # erken alıcıların ≥%10'unu doğrudan dev fonlamış → ele
  max_fresh_wallet_pct: 60      # taze cüzdan ≥%60 VE ortak fonlayıcı ≥%20 → ele
  # --- tuzak filtreleri (sert) ---
  early_dump_window_min: 8      # launch sonrası ilk N dk
  max_early_dump_pct: 35        # ilk 8 dk zirveden ≥%35 düşüş → ele
  max_dev_sold_pct: 15          # LP kilitli olsa bile dev elindekinin ≥%15'ini sattıysa → ele
  max_dev_prev_rugs: 0          # dev'in önceki rug'u varsa → ele
  cluster_min_shared: 3         # aynı ≥3 erken alıcı …
  cluster_min_rugs: 2           # … ≥2 önceki rug'da birlikte erken girdiyse → ele
  max_bundled_pct: 15           # dev'in ödediği / launch slot/bloğundaki erken alım ≥%15 → ele (Bubblemaps: >%15 ciddi)
  max_trap_score: 50            # sinyal tuzak skoru > 50 → otomatik ele
  suspect_wallet_score: 50      # bu skorun üstündeki cüzdan = şüpheli (sinyal + rapor + discover)
  combo_rules: true             # dev_sniper_hybrid / smart_trap / wash_ring / insider_exit / rug_ring / coordinated_dump / coordinated_group → tek başına eler
  unknown_trap_penalty: 0       # eksik veri başına ek ceza (taban 4/alan, tavan 16 zaten uygulanır)
  min_smart_entries: 2
  min_smart_only: 1
  smart_lookback_min: 120
  require_holder_growth: true
  holder_growth_window_sec: 120
  min_holder_growth_pct: 0.1

# Ağa özel filtre üstüne yazımları (verilmeyen alan yukarıdakini kullanır).
chain_filters:
  base:
    sniper_blocks: 3            # 2 sn blok → ilk ~6 sn
    max_top10_pct: 25
    min_lp_locked_pct: 95
    max_sell_tax_pct: 3
    max_buy_tax_pct: 3
  bsc:
    sniper_blocks: 6            # 0.75 sn blok → ilk ~4.5 sn
  monad:
    sniper_blocks: 15           # 0.3 sn blok → ilk ~4.5 sn
    max_top10_pct: 25

risk:
  sol:                          # $50 ≈ 0.31 SOL
    paper_start_balance: 0.31
    probe_min: 0.02             # ≈ $3.2
    probe_max: 0.04             # ≈ $6.4
    probe_balance_pct: 12
    fee_reserve: 0.02           # tx ücreti + ATA rent
    daily_loss_cap: 0.08        # ≈ $12.8 (~%26 bankroll) — operatör tercihi; pratik tavan aşağıda
    daily_profit_target: 0.06   # ≈ $9.6 → o gün yeni giriş yok
  bnb:                          # $50 ≈ 0.083 BNB
    paper_start_balance: 0.083
    probe_min: 0.008
    probe_max: 0.01
    probe_balance_pct: 12
    fee_reserve: 0.003
    daily_loss_cap: 0.008
    daily_profit_target: 0.016
  eth:                          # Base · $50 ≈ 0.0167 ETH
    paper_start_balance: 0.0167
    probe_min: 0.0016
    probe_max: 0.002
    probe_balance_pct: 12
    fee_reserve: 0.0006         # approve + swap + sell, Base L2 + L1 data ücreti
    daily_loss_cap: 0.0016
    daily_profit_target: 0.0033
  mon:                          # Monad · $50 ≈ 2600 MON (1 Kas 2026: MON ≈ $0.0192)
    paper_start_balance: 2600
    probe_min: 250              # ≈ $4.8
    probe_max: 310              # ≈ $6
    probe_balance_pct: 12
    fee_reserve: 5              # swap ~200k gas × 102 gwei ≈ 0.02 MON; Monad gas limit'i ücretlendirir → bol pay
    daily_loss_cap: 250
    daily_profit_target: 500
  max_concurrent: 2
  max_trades_per_day: 6
  cooldown_after_loss_min: 45
  max_consecutive_losses: 2
  reentry_block_hours: 72       # aynı token'a 72 saat tekrar giriş yok (kapanıştan itibaren)
  # realize kayıp + açık pozisyonlar × % + yeni × % <= daily_loss_cap × risk ölçeği
  # SOL (cap 0.08): 2 × 0.04 × 0.4 = 0.032 ≤ 0.08 → iki açık pozisyon. Günlük gerçek tavanı çoğunlukla
  # max_consecutive_losses (2 kayıp → dur) ve max_trades_per_day (6 × 0.04 = 0.24 SOL toplam giriş) belirler;
  # stop -%20 ile tipik kayıp/işlem ≈ 0.004–0.008 SOL. auto_scale bu cap'i rapora göre küçültebilir (asla büyütmez).
  assumed_worst_loss_pct: 40
  auto_scale: true              # /rapor (ve sabah raporu) "önerilen günlük max risk" ölçeği cap'i küçültür (asla büyütmez)
  min_scale: 0.25

exit:
  take_profit_pct: 50
  stop_loss_pct: 20
  trailing_activate_pct: 20
  trailing_distance_pct: 10
  max_hold_min: 120
  smart_exit_count: 1
  poll_sec: 6
  quote_fail_exit_after: 5

exec:
  slippage_bps: 800
  sell_slippage_bps: 1500
  sol_priority_max_lamports: 50000
  bsc_gas_price_gwei: 1
  base_max_fee_gwei: 0.5        # EIP-1559 tavanı; Base'de tipik ücret bunun çok altında (Blast da bunu kullanır)
  monad_max_fee_gwei: 200       # Monad base fee ~100 gwei (1 Kas 2026)
  paper_extra_slippage_pct: 2

tracking:
  sample_every_min: 5
  track_for_min: 360

nightly:
  enabled: true          # gece özet logu + risk ölçeği; rapor her an /rapor ile
  start: "00:00"
  end: "08:00"
  summary_every_min: 30  # /data/nightly-summary.log
  summary_to_telegram: false
  report_at: "07:45"     # sabah raporu data/sabah-raporu-<gün>.txt
  auto_report: false     # true → 07:45'te Telegram'a da at. false → yalnız /rapor ile iste
  usd_ref: { sol: 160, bnb: 600, eth: 3000, mon: 0.0192 }   # rapordaki ≈$ karşılıkları (fiyat değişince güncelle)
````

## `grok-icin-toplu-cevap.md`

````markdown
# Sniper bot — toplu durum (2 Kas 2026)

Dal: `feat/sniper-bot` (son commit df2e80a). Bu turdaki değişiklikler henüz commit edilmedi. Tam metin: `degisen-dosyalar-tam-metin.md`.

## İstenen → yapılan

| İstek | Durum |
|---|---|
| Base, Solana (pump.fun, meteora, pumpswap, bags), BSC, Blast, Monad tarama | Var. Blast 1 Kas ölçümünde 0 yeni havuz → `enabled: false` (tek satırla açılır). Solana launchpad'leri bonding curve'deyken likidite filtresinde kalır; mezun olunca (pumpswap / meteora-damm / raydium) normal filtreden geçer. |
| Agresif trap score | 26 parça + 9 kombo, eşik `max_trap_score: 50`. İki orta işaret tek başına eler. Tablo aşağıda. |
| discover-wallets / optimizer yalnız kendi geçmişi | Evet. Kaynak yalnız `candidates/outcomes/early_buyers/wash_groups/sync_groups/funders/smart_sync.jsonl`; hazır cüzdan listesi yok. |
| $50 config | probe 0.02–0.04 SOL · daily loss cap 0.08 SOL · max_concurrent 2 · cooldown 45 dk · reentry 72 sa · 2 ardışık kayıp → dur · günde en çok 6 işlem. |
| /rapor | Bölümler: ozet, risk, firsat, rekabet, launchpad, tuzak, senkron, kacan, isabet, cikis, config + saat. |
| Gri / hile taktik | **Uygulanmadı.** Wash, bundle ve sahte hacim gibi taktikler başkalarını dolandırmak demek; bot bunları yalnız tespit edip kaçınmak için kullanıyor. |

## Trap skoru parçaları

| Kalıp | Ölçüm | Sert filtre / kombo |
|---|---|---|
| Smart money tuzağı | izlenen cüzdan son rug'larda rug'dan önce satmış | `trap_wallet`, `smart_trap` |
| Aynı anda giren izlenen cüzdanlar (yeni) | ≤3 sn içinde giren izlenen cüzdanlar tek giriş sayılır | `smart_sync` (bağımsız giriş < min_smart_entries) |
| Wash halkası | 30 sn içinde al-sat yapan küçük grup %15'ten fazla | `wash_trading`, `wash_ring` |
| Senkron cüzdan | aynı slot/blokta ≥3 cüzdan; aynı çift ≥3 kez birlikte | `sync_swarm`, `coordinated_dump` |
| Koordineli cüzdan grubu / fonlama kümesi (yeni) | erken alıcıların ilk fonlayıcısı: ortak %30, dev %10, taze %60 + ortak %20, ya da fonlayıcının önceki rug'u | `funding_cluster`, `coordinated_group` |
| Dev + sniper hibrit | dev'le bağlantılı erken alıcı | `dev_sniper_hybrid` |
| Rug cluster | aynı ≥3 cüzdan ≥2 rug'da birlikte | `rug_cluster`, `rug_ring` |
| Bundle | launch slotu / dev ödemeli alım ≥%15 (Bubblemaps: %15 üstü ciddi) | `bundle` |
| Insider exit | erken alıcı hızlı satış / kısa tutma | `sniper_flip`, `insider_exit` |
| Erken dump | ilk 8 dk zirveden ≥%35 düşüş | `early_dump` |
| Launchpad erken satış oranı (yeni) | bu ağ+launchpad'in 14 günlük erken dump/rug oranı ≥%60 → +25 puan | trap skoru |
| Dev sell / seri dev | dev elindekinin ≥%15'ini satmış / dev'in önceki rug'u | `dev_sell`, `dev_serial` |
| Eksik veri | "bilinmiyor" güvenli sayılmaz: alan başına 4, en çok 16 puan | — |

discover-wallets, senkron, fonlama, wash, rug kümesi ve dev-sniper halkasındaki cüzdanları şüphe skorundan bağımsız olarak aday listesine almaz. Ayrıca takip edilen cüzdanlardan aynı anda giren çiftleri listeler.

## Araştırmadan alınan kalıplar

- Bubblemaps bundle eşikleri: %5'in altı düşük, %5–15 orta, %15'in üstü ciddi. https://blog.bubblemaps.io/how-to-analyze-meme-coin-holders-with-bubblemaps/
- Fonlama kümesi (Rugproof, Tem 2025): creator 162 cüzdanı fonladı, bu cüzdanlar arzın yarısını aldı. https://cointelegraph.com/news/bubblemaps-rugproof-launchpad-alleged-rug-pull
- pump.fun token'larının %98,6'sı pump-and-dump ya da rug. https://www.soliduslabs.com/reports/solana-rug-pulls-pump-dumps-crypto-compliance
- Rug güvenlik kontrol listesi: https://blofin.com/academy/education/solana/solana-memecoin-rug-pull-safety
- Etherscan v2'nin desteklediği ağlar (BSC 56, Base 8453, Monad 143; Blast yok): https://docs.etherscan.io/etherscan-v2/supported-chains

## Test talimatı

### Paper mod
1. Kurulum:
   ```bash
   cd sniper-bot && npm ci && cp .env.example .env
   ```
2. `.env`'i doldur:
   - `HELIUS_API_KEY` ve `HELIUS_WEBHOOK_AUTH`
   - Telegram bot token ve chat id
   - opsiyonel `ETHERSCAN_API_KEY` (BSC/Base/Monad fonlama kontrolü için)
   - Paper modda özel anahtar **gerekmez**.
3. `config.yaml` içinde `mode: paper` olsun. Varsayılan budur. Live için ayrıca `LIVE_CONFIRM=YES` gerekir.
4. Başlat:
   ```bash
   caffeinate -i node --env-file=.env node_modules/.bin/tsx src/index.ts
   ```
5. Veri `data/*.jsonl` dosyalarına yazılır. Gece özeti `data/nightly-summary.log`'a, sabah raporu `data/sabah-raporu-<gün>.txt`'ye gider.

### /rapor (Telegram)

| Komut | İçerik |
|---|---|
| `/rapor` | tüm bölümler, son 24 saat |
| `/rapor 6` | son 6 saat |
| `/rapor tuzak` | tuzak oranı, kombolar, 14 günlük isabet, şüpheli cüzdanlar, senkron + fonlama, rug isabeti |
| `/rapor senkron` | aynı blokta işlem yapan cüzdanlar + fonlama kümesi |
| `/rapor kacan` | elenip +%50 yapanlar ve filtre karnesi (kaçan pump / önlenen rug) |
| `/rapor isabet` | rug yakalama %, kesinlik %, sızan rug'lar |
| `/rapor risk` | önerilen günlük max risk (mekanik limit, yalnız küçültür) |
| `/rapor firsat` / `/rapor rekabet` | ağ bazında fırsat ve rekabet tahmini |
| `/rapor launchpad` | launchpad kırılımı |
| `/rapor cikis` | en güvenli exit stratejisi (gölge simülasyon) |
| `/rapor config` | ağ başına önerilen config; otomatik uygulanmaz |

Bölümler birleştirilebilir, örneğin `/rapor risk cikis 12`. Türkçe karakter de olur: `/rapor kaçan`.

### wallets.yaml
Biçim:
```yaml
solana:
  - { address: "<adres>", label: "s1", type: smart }
bsc: []
base: []
blast: []
monad: []
```
- **Hazır liste veya uydurma adres koyma.** İlk 1–2 hafta boş kalabilir; bu sürede bot yine aday toplar ve rapor üretir.
- Doldurmak için `npm run discover-wallets` çalıştır. Çıktı `data/wallet-candidates-<gün>.md` dosyasına yazılır.
- Her adayı Solscan / BscScan / Basescan'de elle kontrol et, sonra dosyanın sonundaki hazır satırı kopyala.
- "Aynı anda giren gruplar" ve "şüpheli izlenenler" bölümündekileri çıkar ya da gruptan yalnız birini tut.

### İlk 4 hafta
1. **1. hafta, yalnız paper.** Tüm ağlar açık, wallets.yaml boş ya da çok kısa. Her gün `/rapor ozet tuzak`. Amaç veri toplamak; karar verme.
2. **2. hafta:**
   - `npm run discover-wallets` çalıştır, 3–5 doğrulanmış cüzdan ekle, paper'a devam et.
   - `/rapor kacan isabet` ile hangi filtrenin çok pump kaçırdığına, hangisinin rug yakaladığına bak.
   - Eşikleri gevşetme; yalnız `/rapor config` "UYGULA" diyorsa ve test seti yeterliyse değiştir.
3. **3. hafta:**
   - `/rapor firsat rekabet risk` ile en iyi giden tek ağı seç (büyük olasılıkla Solana).
   - Gölge paper ortalaması 7 gün boyunca pozitif ve rug isabeti ≥%70 değilse bir hafta daha paper kal.
4. **4. hafta, live'a geçiş koşulları sağlandıysa:**
   - Yalnız o ağı live yap, diğerlerinde `paper_only: true` kalsın.
   - Probe 0.02 SOL'den başlasın.
   - Günlük cap 0.08 SOL, 2 ardışık kayıpta dur.
   - Büyütme kuralı: 2 hafta net pozitif olursa probe_max'ı en çok %25 artır. Kayıplı haftada geri al.

Kaybetmeyi göze alabileceğin para kadar koy: geçmiş veri ileriye garanti vermez ve bu yatırım tavsiyesi değildir.

## Doğrulanmayan / açık kalanlar
- `fundingCheck` gerçek RPC/Etherscan çağrısıyla canlı denenmedi; sahte verilerle mantık testi geçti.
- Blast'ta fonlama kontrolü yok (Etherscan v2 desteklemiyor).
- Commit / push / deploy yapılmadı. Onay bekliyor.
````

## `package.json`

````json
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
````

## `railway.json`

````json
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
````

## `scripts/discover-wallets.ts`

````ts
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
````

## `scripts/optimize.ts`

````ts
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
````

## `scripts/report.ts`

````ts
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
````

## `src/chains.ts`

````ts
import { Connection, Keypair, PublicKey } from '@solana/web3.js';
import { JsonRpcProvider, Wallet, type Filter, type Log } from 'ethers';
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

// ---------- EVM ağları (BSC + Base + Blast) ----------
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
  logRange?: number; // RPC'nin eth_getLogs blok aralığı sınırı (Monad public RPC: 100)
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
  // Blast (81457): router/factory/WETH 1 Kas 2026'da rpc.blast.io üzerinde eth_call ile doğrulandı.
  // GoPlus destekliyor, honeypot.is desteklemiyor (vergi yalnız GoPlus'tan). 1 Kas 2026: GeckoTerminal'de yeni havuz yok.
  blast: {
    id: 81457,
    rpcEnv: 'BLAST_RPC_URL',
    keyEnv: 'BLAST_PRIVATE_KEY',
    wrapped: '0x4300000000000000000000000000000000000004',
    quotes: new Set(
      [
        '0x4300000000000000000000000000000000000004', // WETH
        '0x4300000000000000000000000000000000000003', // USDB
      ].map((a) => a.toLowerCase()),
    ),
    routes: [{ name: 'uniswap_v2', kind: 'v2', router: '0xBB66Eb1c5e875933D44DAe661dbD80e5D9B03035', factory: '0x5C346464d33F90bABaf70dB6388507CC889C1070' }],
    secPerBlock: 2,
    explorer: 'https://blastscan.io',
  },
  // Monad (143): Uniswap V2 router/factory/WMON 1 Kas 2026'da rpc.monad.xyz üzerinde eth_call ile doğrulandı
  // (router.factory() = factory, router.WETH() = WMON, WMON/USDC pair token0/1). Ölçülen blok ~0.3 sn, gas ~102 gwei.
  // GoPlus 143'ü destekliyor, honeypot.is desteklemiyor. Yeni havuzların çoğu spam (likidite ≪ $10k).
  monad: {
    id: 143,
    rpcEnv: 'MONAD_RPC_URL',
    keyEnv: 'MONAD_PRIVATE_KEY',
    wrapped: '0x3bd359c1119da7da1d913d1c4d2b7c461115433a',
    quotes: new Set(
      [
        '0x3bd359c1119da7da1d913d1c4d2b7c461115433a', // WMON
        '0x754704bc059f8c67012fed69bc8a327a5aafb603', // USDC
      ].map((a) => a.toLowerCase()),
    ),
    routes: [{ name: 'uniswap_v2', kind: 'v2', router: '0x4b2ab38dbf28d31d467aa8993f6c2585981d6804', factory: '0x182a927119d56008d921126764bf884221b10f59' }],
    secPerBlock: 0.3,
    logRange: 100,
    explorer: 'https://monadscan.com',
  },
};

// eth_getLogs'u ağın blok aralığı sınırına göre parçalayıp sırayla çağırır.
export async function getLogsChunked(chain: EvmChain, filter: Filter & { fromBlock: number; toBlock: number }): Promise<Log[]> {
  const step = EVM[chain].logRange ?? Infinity;
  const p = evmProvider(chain);
  if (filter.toBlock - filter.fromBlock + 1 <= step) return p.getLogs(filter);
  const out: Log[] = [];
  for (let from = filter.fromBlock; from <= filter.toBlock; from += step) {
    out.push(...(await p.getLogs({ ...filter, fromBlock: from, toBlock: Math.min(filter.toBlock, from + step - 1) })));
  }
  return out;
}

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
````

## `src/config.ts`

````ts
import fs from 'node:fs';
import path from 'node:path';
import YAML from 'yaml';

export type Chain = 'solana' | 'bsc' | 'base' | 'blast' | 'monad';
export const CHAINS: Chain[] = ['solana', 'bsc', 'base', 'blast', 'monad'];
export type EvmChain = Exclude<Chain, 'solana'>;
export const isEvm = (c: string): c is EvmChain => c === 'bsc' || c === 'base' || c === 'blast' || c === 'monad';
// EVM adresleri küçük harfe normalize edilir (Solana base58 büyük/küçük harf duyarlı).
export const normAddr = (chain: string, a: string) => (isEvm(chain) ? a.toLowerCase() : a);

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
  // paper_only: mode=live olsa bile bu ağ sanal bakiyeyle işlem görür (küçük sermayede tek ağı canlıya al)
  chains: Record<Chain, { enabled: boolean; paper_only?: boolean }>;
  scan: {
    interval_sec: number;
    min_pair_age_min: number;
    max_pair_age_min: number;
    deep_check_concurrency: number;
    seen_ttl_min: number;
    // GeckoTerminal new_pools sayfa sayısı (sayfa = 20 havuz, 2.1 sn). Solana'da 20 havuz ~1 dk'da dolar.
    gecko_pages?: Partial<Record<Chain, number>>;
    // Bu launchpad/dex kaynaklı token'lar taranmaz (GeckoTerminal dex id, ör. pump-fun, meteora-dbc).
    skip_launchpads?: string[];
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
    sniper_max_buyers: number;
    sniper_unknown_pass: boolean;
    quick_flip_min: number;
    max_sniper_quick_flip_pct: number;
    max_sniper_rug_link_pct: number;
    wash_window_sec: number;
    wash_min_wallets: number;
    wash_group_max: number;
    max_wash_trade_pct: number;
    sync_min_wallets?: number; // aynı slot/blokta aynı yönde bu kadar farklı cüzdan = senkron blok
    sync_repeat_min?: number; // bir cüzdan çifti bu kadar senkron blokta birlikte → koordineli
    max_sync_trade_pct?: number;
    max_sync_repeat_wallets?: number; // sync_swarm: trade% ≥ max_sync_trade_pct VE repeat ≥ bu
    max_sync_rug_link_pct?: number; // senkron grubun ≥ bu %'si başka rug'larda da senkron → ele
    sync_entry_sec?: number; // izlenen cüzdanlar bu kadar sn içinde aynı token'a girerse tek giriş sayılır (smart_sync)
    max_launchpad_dump_pct?: number; // launchpad'in geçmiş erken dump/rug oranı ≥ bu → trap skoru ağır ceza
    funding_max_wallets?: number; // fonlayıcısı aranan erken alıcı (RPC/Etherscan maliyeti)
    fresh_wallet_hours?: number;
    max_common_funder_pct?: number; // funding_cluster: erken alıcıların ≥ bu %'si aynı cüzdandan fonlanmış → ele
    max_fund_dev_pct?: number; // dev'in fonladığı erken alıcı ≥ bu % → ele
    max_fresh_wallet_pct?: number; // taze cüzdan ≥ bu % VE ortak fonlayıcı ≥ %20 → ele
    wash_unknown_pass: boolean;
    early_dump_window_min: number;
    max_early_dump_pct: number;
    max_dev_sold_pct: number;
    max_dev_prev_rugs: number;
    cluster_min_shared: number;
    cluster_min_rugs: number;
    max_bundled_pct: number;
    max_trap_score: number;
    suspect_wallet_score: number;
    combo_rules: boolean;
    unknown_trap_penalty: number;
    min_smart_entries: number;
    min_smart_only: number;
    smart_lookback_min: number;
    require_holder_growth: boolean;
    holder_growth_window_sec: number;
    min_holder_growth_pct: number;
  };
  // Ağ bazlı filtre üstüne yazımı (BSC/Base blok süresi, vergi, likidite farkları)
  chain_filters?: Partial<Record<Chain, Partial<Config['filters']>>>;
  risk: {
    sol: ChainRisk;
    bnb: ChainRisk;
    eth: ChainRisk;
    mon?: ChainRisk; // Monad; yoksa chains.monad kapalı olmalı
    auto_scale: boolean; // Sabah Raporu'nun risk çarpanı daily_loss_cap'e uygulanır
    min_scale: number;
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
    base_max_fee_gwei: number;
    monad_max_fee_gwei?: number; // Monad EIP-1559 tavanı (base fee ~100 gwei)
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
    auto_report?: boolean; // false → report_at'te Telegram'a atmaz (yalnız data/ dosyası), rapor /rapor ile istenir
    usd_ref?: Partial<Record<'sol' | 'bnb' | 'eth' | 'mon', number>>; // rapordaki ≈$ karşılıkları
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
const evmList = (xs: TrackedWallet[] | undefined) => (xs ?? []).map((w) => ({ ...w, address: w.address.toLowerCase() }));
export const wallets: Record<Chain, TrackedWallet[]> = {
  solana: rawWallets.solana ?? [],
  bsc: evmList(rawWallets.bsc),
  base: evmList(rawWallets.base),
  blast: evmList(rawWallets.blast),
  monad: evmList(rawWallets.monad),
};

// Eski config.yaml'larla uyum: eksik ağ = kapalı
for (const c of CHAINS) cfg.chains[c] ??= { enabled: false };
cfg.filters.combo_rules ??= true;
cfg.filters.unknown_trap_penalty ??= 0;
cfg.filters.sync_min_wallets ??= 3;
cfg.filters.sync_repeat_min ??= 3;
cfg.filters.max_sync_trade_pct ??= 55;
cfg.filters.max_sync_repeat_wallets ??= 3;
cfg.filters.max_sync_rug_link_pct ??= 25;
cfg.filters.sync_entry_sec ??= 3;
cfg.filters.max_launchpad_dump_pct ??= 60;
cfg.filters.funding_max_wallets ??= 12;
cfg.filters.fresh_wallet_hours ??= 48;
cfg.filters.max_common_funder_pct ??= 30;
cfg.filters.max_fund_dev_pct ??= 10;
cfg.filters.max_fresh_wallet_pct ??= 60;
cfg.risk.auto_scale ??= false;
cfg.risk.min_scale ??= 0.25;

const RISK_KEY = { solana: 'sol', bsc: 'bnb', base: 'eth', blast: 'eth', monad: 'mon' } as const; // Blast = ETH profili, günlük cap ağ başına ayrı sayılır
export const riskFor = (chain: Chain): ChainRisk => {
  const r = cfg.risk[RISK_KEY[chain]];
  if (!r) throw new Error(`config.yaml: risk.${RISK_KEY[chain]} yok (${chain} açık)`);
  return r;
};
for (const c of CHAINS) if (cfg.chains[c].enabled) riskFor(c); // eksik risk profili açılışta patlasın
export const nativeSymbol = (chain: Chain) => ({ solana: 'SOL', bsc: 'BNB', base: 'ETH', blast: 'ETH', monad: 'MON' })[chain];
export const filtersFor = (chain: Chain): Config['filters'] => ({ ...cfg.filters, ...(cfg.chain_filters?.[chain] ?? {}) });
export const paperOnly = (chain: Chain) => !isLiveMode() || Boolean(cfg.chains[chain].paper_only);
function isLiveMode() {
  return cfg.mode === 'live';
}

export function env(key: string, required = true): string {
  const v = process.env[key];
  if (!v && required) throw new Error(`missing env ${key}`);
  return v ?? '';
}

export const isLive = () => cfg.mode === 'live';

if (isLive() && process.env.LIVE_CONFIRM !== 'YES') {
  throw new Error('mode=live ama LIVE_CONFIRM=YES değil — paper moda dön veya env ekle');
}
````

## `src/exec/evm.ts`

````ts
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
````

## `src/exec/index.ts`

````ts
import { LAMPORTS_PER_SOL } from '@solana/web3.js';
import { cfg, paperOnly, type Chain } from '../config.js';
import { SOL_MINT } from '../chains.js';
import { state, save } from '../state.js';
import { evmExecutor, evmQuoteBuy } from './evm.js';
import { jupQuote, mintDecimals, solanaExecutor } from './solana.js';
import type { Executor, Fill } from './types.js';

const live: Record<Chain, Executor> = { solana: solanaExecutor, bsc: evmExecutor('bsc'), base: evmExecutor('base'), blast: evmExecutor('blast'), monad: evmExecutor('monad') };
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
````

## `src/exec/solana.ts`

````ts
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
````

## `src/exec/types.ts`

````ts
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
````

## `src/filters.ts`

````ts
import type { Config } from './config.js';
import { comboFlags } from './trap.js';
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
  if (m.sniperQuickFlipPct != null && m.sniperQuickFlipPct >= f.max_sniper_quick_flip_pct) fail.push('sniper_flip');
  if (m.sniperRugLinkPct != null && m.sniperRugLinkPct >= f.max_sniper_rug_link_pct) fail.push('sniper_rug_link');
  if (m.washWallets === null || m.washTradePct === null) {
    if (!f.wash_unknown_pass) fail.push('wash_trading');
  } else if (m.washWallets !== undefined && m.washTradePct !== undefined &&
    m.washWallets >= f.wash_min_wallets && m.washTradePct >= f.max_wash_trade_pct) fail.push('wash_trading');
  if (m.smartWallets.length + m.kolWallets.length < f.min_smart_entries || m.smartWallets.length < f.min_smart_only)
    fail.push('smart_money');
  if (f.require_holder_growth && (m.holderGrowthPct == null || m.holderGrowthPct <= f.min_holder_growth_pct))
    fail.push('holder_growth');
  // tuzak filtreleri (veri yoksa elemez)
  if (m.earlyDumpPct != null && m.earlyDumpPct >= f.max_early_dump_pct) fail.push('early_dump');
  if (m.devSoldPct != null && m.devSoldPct >= f.max_dev_sold_pct) fail.push('dev_sell');
  if (m.devPrevRugs != null && m.devPrevRugs > f.max_dev_prev_rugs) fail.push('dev_serial');
  if (m.clusterRugs != null && m.clusterRugs >= f.cluster_min_rugs) fail.push('rug_cluster');
  if (m.sniperBundledPct != null && m.sniperBundledPct >= f.max_bundled_pct) fail.push('bundle');
  if (
    (m.syncTradePct != null && m.syncRepeatWallets != null && m.syncTradePct >= (f.max_sync_trade_pct ?? 55) && m.syncRepeatWallets >= (f.max_sync_repeat_wallets ?? 3)) ||
    (m.syncRugLinkPct != null && m.syncRugLinkPct >= (f.max_sync_rug_link_pct ?? 25))
  )
    fail.push('sync_swarm');
  if (
    (m.fundCommonPct != null && m.fundCommonPct >= (f.max_common_funder_pct ?? 30)) ||
    (m.fundDevPct != null && m.fundDevPct >= (f.max_fund_dev_pct ?? 10)) ||
    (m.fundFreshPct != null && m.fundCommonPct != null && m.fundFreshPct >= (f.max_fresh_wallet_pct ?? 60) && m.fundCommonPct >= 20) ||
    (m.fundPrevRugs ?? 0) >= 1
  )
    fail.push('funding_cluster');
  // izlenen cüzdanlar aynı anda girdiyse bağımsız giriş sayısı min_smart_entries'in altında kalır
  if (m.smartEffective != null && m.smartWallets.length + m.kolWallets.length >= f.min_smart_entries && m.smartEffective < f.min_smart_entries)
    fail.push('smart_sync');
  if (m.trapScore != null && m.trapScore > f.max_trap_score) fail.push('trap_score');
  if (m.trapWallets?.length) fail.push('trap_wallet');
  if (f.combo_rules) fail.push(...comboFlags(m));
  return fail;
}
````

## `src/index.ts`

````ts
import http from 'node:http';
import { CHAINS, cfg, env, isEvm, nativeSymbol } from './config.js';
import { closeAll, startMonitor, statusText } from './positions.js';
import { startScanner } from './scanner.js';
import { handleHeliusWebhook, pollEvm, walletCounts } from './smartmoney.js';
import { save, state } from './state.js';
import { startCommands, tg } from './telegram.js';
import { morningReport, parseReportArgs, startNightly } from './nightly.js';
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
  '/rapor': async (args) => {
    // İstek üzerine detaylı rapor (varsayılan son 24 sa). /rapor tuzak | senkron | kacan | isabet | risk | firsat | rekabet | launchpad | cikis | config | <saat>
    // riskSection auto_scale açıksa risk ölçeğini günceller (yalnız küçültür). Telegram 4096 sınırı için parçala.
    const text = morningReport(parseReportArgs(args));
    for (let i = 0; i < text.length - 3900; i += 3900) await tg(text.slice(i, i + 3900));
    return text.slice(Math.floor((text.length - 1) / 3900) * 3900);
  },
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
for (const c of CHAINS) {
  if (isEvm(c) && cfg.chains[c].enabled) setInterval(() => pollEvm(c).catch((e) => log.warn(`${c} wallets`, { err: errMsg(e) })), 15_000);
}

if (cfg.nightly.enabled || process.env.NIGHTLY_EXIT === '1') startNightly({ exitAtEnd: process.env.NIGHTLY_EXIT === '1' });

const wc = walletCounts();
log.info('started', { mode: cfg.mode, wallets: wc });
void tg(`🤖 bot başladı · <b>${cfg.mode.toUpperCase()}</b> · izlenen cüzdan ${CHAINS.map((c) => `${nativeSymbol(c)} ${wc[c]}`).join(' / ')}`);

for (const sig of ['SIGINT', 'SIGTERM'] as const) {
  process.on(sig, () => {
    save();
    log.info('shutdown', { sig });
    process.exit(0);
  });
}
process.on('unhandledRejection', (e) => log.error('unhandled', { err: errMsg(e) }));
````

## `src/insights.ts`

````ts
// Sabah Raporu analiz bölümleri. Hepsi botun KENDİ kayıtlarından (candidates/outcomes/early_buyers/trades.jsonl)
// türetilen geçmiş-veri TAHMİNLERİDİR; yatırım tavsiyesi değildir.
// "Önerilen günlük max risk" = config daily_loss_cap × veri-temelli ölçek (yalnız küçültür) → mekanik limit.
import { CHAINS, cfg, filtersFor, nativeSymbol, riskFor, type Chain } from './config.js';
import { evaluate } from './filters.js';
import { grid, rowChain, scoreResults, shadowSince, simulate, type Row } from './optimizer.js';
import { save, state } from './state.js';
import { readJsonl } from './util.js';

const DAY = 86_400_000;
const enabledChains = () => CHAINS.filter((c) => cfg.chains[c].enabled);
const isRug = (r: Row) => r.path.some(([, p]) => p <= -80);
const isPump = (r: Row) => r.path.some(([, p]) => p >= 50);
const pct = (a: number, b: number) => (b ? (a / b) * 100 : 0);
const sign = (x: number, d = 4) => `${x >= 0 ? '+' : ''}${x.toFixed(d)}`;
const reasonsOf = (r: Row) => evaluate(r.metrics, filtersFor(rowChain(r)));
const ofChain = (rows: Row[], c: Chain) => rows.filter((r) => rowChain(r) === c);

export const TRAP_REASONS = new Set([
  'trap_score', 'trap_wallet', 'dev_sell', 'dev_serial', 'early_dump', 'rug_cluster', 'bundle', 'sniper_flip', 'sniper_rug_link', 'wash_trading',
  'dev_sniper_hybrid', 'smart_trap', 'wash_ring', 'insider_exit', 'rug_ring', 'sync_swarm', 'coordinated_dump', 'funding_cluster', 'coordinated_group', 'smart_sync',
]);
const COMBO = ['dev_sniper_hybrid', 'smart_trap', 'wash_ring', 'insider_exit', 'rug_ring', 'coordinated_dump', 'coordinated_group', 'trap_wallet'];
const SECURITY = new Set(['honeypot', 'top10', 'lp_lock', 'renounce', 'sell_tax', 'buy_tax']);

const DEFAULT_USD = { sol: 160, bnb: 600, eth: 3000, mon: 0.019 } as const;
const riskKey = (c: Chain) => nativeSymbol(c).toLowerCase() as keyof typeof DEFAULT_USD;
export const toUsd = (c: Chain, native: number) => native * (cfg.nightly.usd_ref?.[riskKey(c)] ?? DEFAULT_USD[riskKey(c)]);

function realCloses(c: Chain, fromMs: number, toMs = Infinity) {
  return readJsonl<any>('trades.jsonl').filter((t) => t.ev === 'close' && t.chain === c && Date.parse(t.ts) >= fromMs && Date.parse(t.ts) < toMs);
}

// ---------- Detaylı tuzak analizi (ağ bazında + tuzak filtresinin isabeti) ----------
export function trapDetail(rows: Row[], since: number): string[] {
  const L = ['🔬 <b>Detaylı tuzak analizi</b> (ağ bazında)'];
  for (const c of enabledChains()) {
    const win = ofChain(rows, c).filter((r) => Date.parse(r.ts) >= since);
    const trapped = win.filter((r) => reasonsOf(r).some((x) => TRAP_REASONS.has(x)));
    const combo = new Map<string, number>();
    for (const r of win) for (const x of reasonsOf(r)) if (COMBO.includes(x)) combo.set(x, (combo.get(x) ?? 0) + 1);
    L.push(`${c}: gece ${win.length} aday · tuzakla elenen ${trapped.length} (%${pct(trapped.length, win.length).toFixed(0)})`);
    if (combo.size) L.push(`  kombo/oto-eleme: ${[...combo].map(([k, v]) => `${k} ${v}`).join(', ')}`);

    // İsabet: geçmişte tuzakla elenen ve izlemesi biten adaylar gerçekten ne oldu?
    const hist = ofChain(rows, c).filter((r) => r.done && r.path.length && Date.parse(r.ts) >= Date.now() - 14 * DAY);
    const elim = hist.filter((r) => reasonsOf(r).some((x) => TRAP_REASONS.has(x)));
    const pass = hist.filter((r) => reasonsOf(r).length === 0);
    if (elim.length >= 5) {
      L.push(
        `  isabet (14g, ${elim.length} elenen): rug oldu %${pct(elim.filter(isRug).length, elim.length).toFixed(0)} · ` +
          `+%50 yaptı (kaçırılan) %${pct(elim.filter(isPump).length, elim.length).toFixed(0)}` +
          (pass.length ? ` · geçenlerde rug %${pct(pass.filter(isRug).length, pass.length).toFixed(0)}` : ''),
      );
    } else L.push(`  isabet: veri az (${elim.length} biten elenen aday; ≥5 gerekir)`);
  }
  return L;
}

// ---------- Aynı anda birden fazla cüzdan (senkron blok) ----------
// Aday başına son ~100 swap'ta aynı slot/blokta aynı yönde ≥3 cüzdan; yüksek = koordineli cüzdan ≥ max_sync_repeat_wallets.
export function syncSection(rows: Row[], since: number): string[] {
  const L = ['👥 <b>Senkron cüzdan analizi</b> (aynı slot/blokta ≥3 cüzdan aynı yönde)'];
  for (const c of enabledChains()) {
    const f = filtersFor(c);
    const hi = (r: Row) => (r.metrics.syncRepeatWallets ?? 0) >= (f.max_sync_repeat_wallets ?? 3);
    const win = ofChain(rows, c).filter((r) => Date.parse(r.ts) >= since && r.metrics.syncTradePct != null);
    if (!win.length) {
      L.push(`${c}: senkron verisi yok (wash kontrolüne giren aday 0)`);
      continue;
    }
    const avg = win.reduce((s, r) => s + (r.metrics.syncTradePct ?? 0), 0) / win.length;
    const swarm = win.filter((r) => reasonsOf(r).includes('sync_swarm')).length;
    const coord = win.filter((r) => reasonsOf(r).includes('coordinated_dump')).length;
    L.push(`${c}: ${win.length} aday · ort. senkron trade %${avg.toFixed(0)} · koordineli grup ${win.filter(hi).length} · sync_swarm ${swarm} · coordinated_dump ${coord}`);
    const done = ofChain(rows, c).filter((r) => r.done && r.path.length && r.metrics.syncTradePct != null && Date.parse(r.ts) >= Date.now() - 14 * DAY);
    const a = done.filter(hi), b = done.filter((r) => !hi(r));
    if (a.length >= 3 && b.length >= 3)
      L.push(`  14g: koordineli grupta rug %${pct(a.filter(isRug).length, a.length).toFixed(0)} (${a.length}) vs diğerleri %${pct(b.filter(isRug).length, b.length).toFixed(0)} (${b.length})`);
    else L.push(`  14g isabet: veri az (koordineli ${a.length} / diğer ${b.length} biten; ikisi de ≥3 gerekir)`);
  }
  // En çok token'da senkron görülen cüzdanlar (sync_groups.jsonl) + kaçı rug
  const rugged = new Set(rows.filter((r) => r.done && isRug(r)).map((r) => r.key));
  const byW = new Map<string, Set<string>>();
  for (const g of readJsonl<any>('sync_groups.jsonl')) for (const w of g.wallets ?? []) (byW.get(`${g.chain}:${w}`) ?? byW.set(`${g.chain}:${w}`, new Set()).get(`${g.chain}:${w}`)!).add(`${g.chain}:${g.token}`);
  const top = [...byW].filter(([, t]) => t.size >= 2).sort((x, y) => y[1].size - x[1].size).slice(0, 8);
  if (top.length) {
    L.push('tekrarlayan senkron cüzdanlar (token / rug):');
    for (const [w, t] of top) L.push(`  · <code>${w}</code> ${t.size} / ${[...t].filter((k) => rugged.has(k)).length}`);
  } else L.push('tekrarlayan senkron cüzdan yok (≥2 token gerekir)');
  return L;
}

// ---------- Koordineli cüzdan grubu (fonlama kümesi) ----------
export function fundingSection(rows: Row[], since: number): string[] {
  const L = ['🧬 <b>Fonlama kümesi</b> (erken alıcıları aynı cüzdan / dev mi fonladı?)'];
  for (const c of enabledChains()) {
    const win = ofChain(rows, c).filter((r) => Date.parse(r.ts) >= since && r.metrics.fundCommonPct != null);
    if (!win.length) {
      L.push(`${c}: fonlama verisi yok (sniper kontrolüne giren aday 0${c === 'blast' ? '; Blast Etherscan v2\'de yok' : c !== 'solana' ? ' ya da ETHERSCAN_API_KEY yok' : ''})`);
      continue;
    }
    const avg = (k: 'fundCommonPct' | 'fundFreshPct') => win.reduce((s, r) => s + (r.metrics[k] ?? 0), 0) / win.length;
    const cl = win.filter((r) => reasonsOf(r).includes('funding_cluster')).length;
    const cg = win.filter((r) => reasonsOf(r).includes('coordinated_group')).length;
    L.push(`${c}: ${win.length} aday · ort. ortak fonlayıcı %${avg('fundCommonPct').toFixed(0)} · taze cüzdan %${avg('fundFreshPct').toFixed(0)} · dev-fonlu ${win.filter((r) => (r.metrics.fundDevPct ?? 0) > 0).length} · funding_cluster ${cl} · coordinated_group ${cg}`);
    const done = ofChain(rows, c).filter((r) => r.done && r.path.length && r.metrics.fundCommonPct != null && Date.parse(r.ts) >= Date.now() - 14 * DAY);
    const a = done.filter((r) => (r.metrics.fundCommonPct ?? 0) >= 20), b = done.filter((r) => (r.metrics.fundCommonPct ?? 0) < 20);
    if (a.length >= 3 && b.length >= 3)
      L.push(`  14g: ortak fonlayıcı ≥%20 olanlarda rug %${pct(a.filter(isRug).length, a.length).toFixed(0)} (${a.length}) vs diğerleri %${pct(b.filter(isRug).length, b.length).toFixed(0)} (${b.length})`);
    else L.push(`  14g isabet: veri az (kümeli ${a.length} / diğer ${b.length} biten; ikisi de ≥3 gerekir)`);
  }
  const rugged = new Set(rows.filter((r) => r.done && isRug(r)).map((r) => r.key));
  const byF = new Map<string, Set<string>>();
  for (const g of readJsonl<any>('funders.jsonl')) (byF.get(`${g.chain}:${g.funder}`) ?? byF.set(`${g.chain}:${g.funder}`, new Set()).get(`${g.chain}:${g.funder}`)!).add(`${g.chain}:${g.token}`);
  const top = [...byF].filter(([, t]) => t.size >= 2).sort((x, y) => y[1].size - x[1].size).slice(0, 8);
  if (top.length) {
    L.push('tekrarlayan fonlayıcılar (token / rug):');
    for (const [w, t] of top) L.push(`  · <code>${w}</code> ${t.size} / ${[...t].filter((k) => rugged.has(k)).length}`);
  } else L.push('tekrarlayan fonlayıcı yok (≥2 token gerekir)');
  return L;
}

// ---------- Rug isabet oranı (14g, ağ bazında) ----------
// yakalama = rug olan adayların kaçı elendi · kesinlik = elenenlerin kaçı gerçekten rug · sızan = filtreyi geçip rug olan
export function rugHitSection(rows: Row[]): string[] {
  const L = ['🎯 <b>Rug isabet oranı</b> (14g, izlemesi biten adaylar)'];
  for (const c of enabledChains()) {
    const hist = ofChain(rows, c).filter((r) => r.done && r.path.length && Date.parse(r.ts) >= Date.now() - 14 * DAY);
    if (hist.length < 10) {
      L.push(`${c}: veri az (${hist.length} biten aday; ≥10 gerekir)`);
      continue;
    }
    const rugs = hist.filter(isRug);
    const elim = hist.filter((r) => reasonsOf(r).length);
    const pass = hist.filter((r) => !reasonsOf(r).length);
    const caught = rugs.filter((r) => reasonsOf(r).length).length;
    const trapCaught = rugs.filter((r) => reasonsOf(r).some((x) => TRAP_REASONS.has(x))).length;
    const leaked = pass.filter(isRug);
    L.push(
      `${c}: ${hist.length} aday · rug ${rugs.length} (%${pct(rugs.length, hist.length).toFixed(0)}) · yakalama %${pct(caught, rugs.length).toFixed(0)} (tuzak filtreleriyle %${pct(trapCaught, rugs.length).toFixed(0)}) · ` +
        `kesinlik %${pct(elim.filter(isRug).length, elim.length).toFixed(0)} · geçen ${pass.length}, sızan rug ${leaked.length}`,
    );
    for (const r of leaked.slice(0, 3)) L.push(`  sızan: ${r.symbol} (${r.launchpad ?? '?'}) trap ${Math.round(r.metrics.trapScore ?? 0)}`);
  }
  return L;
}

// ---------- Kaçırılan yükselişler: elenip +%50 yapanlar ve filtre başına maliyet/fayda ----------
export function missedSection(rows: Row[], since: number): string[] {
  const L = ['🚀 <b>Kaçırılan yükselişler</b> (elenip ≥+%50 yapan adaylar)'];
  const maxPct = (r: Row) => Math.max(...r.path.map(([, p]) => p));
  const win = rows.filter((r) => Date.parse(r.ts) >= since && r.path.length && isPump(r) && reasonsOf(r).length);
  if (!win.length) L.push('pencerede elenip pump yapan aday yok');
  for (const r of win.sort((a, b) => maxPct(b) - maxPct(a)).slice(0, 10)) {
    const rug = isRug(r) ? ' → sonra rug' : '';
    L.push(`  · ${r.symbol} (${rowChain(r)}/${r.launchpad ?? '?'}) max +%${maxPct(r).toFixed(0)}${rug} · ${reasonsOf(r).slice(0, 4).join(', ')}`);
  }
  if (win.length > 10) L.push(`  … +${win.length - 10} daha`);
  // 14g filtre karnesi: tek başına elediği (tek sebep) adaylarda kaçırılan pump vs önlenen rug
  const hist = rows.filter((r) => r.done && r.path.length && Date.parse(r.ts) >= Date.now() - 14 * DAY);
  const by = new Map<string, { n: number; solo: number; pump: number; rug: number; soloPump: number; soloRug: number }>();
  for (const r of hist) {
    const rs = reasonsOf(r);
    for (const k of rs) {
      const e = by.get(k) ?? by.set(k, { n: 0, solo: 0, pump: 0, rug: 0, soloPump: 0, soloRug: 0 }).get(k)!;
      e.n++;
      if (isPump(r) && !isRug(r)) e.pump++;
      if (isRug(r)) e.rug++;
      if (rs.length === 1) {
        e.solo++;
        if (isPump(r) && !isRug(r)) e.soloPump++;
        if (isRug(r)) e.soloRug++;
      }
    }
  }
  const tab = [...by].filter(([, e]) => e.n >= 5).sort((a, b) => b[1].soloPump - a[1].soloPump || b[1].n - a[1].n).slice(0, 12);
  if (!tab.length) return [...L, 'filtre karnesi (14g): veri az (sebep başına ≥5 biten aday gerekir)'];
  L.push('filtre karnesi (14g · sebep: elenen → pump/rug · tek sebep olduğunda → pump/rug):');
  for (const [k, e] of tab) {
    const warn = e.solo >= 5 && e.soloPump > e.soloRug ? ' ⚠️ tek başına daha çok pump kaçırıyor' : '';
    L.push(`  · ${k}: ${e.n} → %${pct(e.pump, e.n).toFixed(0)}/%${pct(e.rug, e.n).toFixed(0)} · tek ${e.solo} → ${e.soloPump}/${e.soloRug}${warn}`);
  }
  L.push('pump = zirve ≥+%50 ve sonra −%80 görmedi; ileri dönük garanti değil, gevşetme kararı /rapor config önerisine bırakılır.');
  return L;
}

// ---------- Önerilen günlük max risk (mekanik limit) ----------
export function riskBudget(c: Chain, rows: Row[], since: number): { scale: number; capNative: number; notes: string[] } {
  const r = riskFor(c);
  const mine = ofChain(rows, c);
  const notes: string[] = [];
  let scale = 1;
  const cut = (f: number, why: string) => {
    scale *= f;
    notes.push(`${why} ×${f}`);
  };
  const sh7 = shadowSince(Date.now() - 7 * DAY, mine, r.probe_max);
  if (sh7.score.n < 5) cut(0.75, `az veri (7g gölge ${sh7.score.n} işlem)`);
  else if (sh7.score.avg < 0) cut(0.5, `7g gölge ort ${sh7.score.avg.toFixed(1)}%`);

  const night = mine.filter((x) => Date.parse(x.ts) >= since);
  const trapRate = pct(night.filter((x) => reasonsOf(x).some((y) => TRAP_REASONS.has(y))).length, night.length);
  if (night.length >= 5 && trapRate >= 50) cut(0.75, `gece tuzak oranı %${trapRate.toFixed(0)}`);

  const prev = realCloses(c, since - DAY, since).reduce((s, t) => s + Number(t.pnl ?? 0), 0);
  if (prev <= -r.daily_loss_cap * 0.999) cut(0.5, `dün kayıp limiti doldu`);

  const last3 = realCloses(c, 0).slice(-3);
  if (last3.length === 3 && last3.every((t) => Number(t.pnl ?? 0) < 0)) cut(0.5, `son 3 gerçek işlem zarar`);

  scale = Math.min(1, Math.max(cfg.risk.min_scale ?? 0.25, scale));
  if (cfg.risk.auto_scale) {
    state.riskScale = { ...(state.riskScale ?? {}), [c]: scale };
    save();
  }
  return { scale, capNative: r.daily_loss_cap * scale, notes };
}

export function riskSection(rows: Row[], since: number): string[] {
  const L = ['🧯 <b>Önerilen günlük max risk</b> (mekanik limit: config tavanı × veri ölçeği; tavsiye değil)'];
  for (const c of enabledChains()) {
    const r = riskFor(c);
    const b = riskBudget(c, rows, since);
    const worst = r.probe_max * (cfg.risk.assumed_worst_loss_pct / 100);
    const probes = worst > 0 ? Math.floor(b.capNative / worst) : 0;
    L.push(
      `${c}${cfg.chains[c].paper_only ? ' (paper)' : ''}: ${b.capNative.toFixed(4)} ${nativeSymbol(c)} ≈ $${toUsd(c, b.capNative).toFixed(1)} ` +
        `(ölçek ${b.scale.toFixed(2)}) · ≈${probes} probe'luk kötü senaryo kaybı`,
    );
    if (b.notes.length) L.push(`  neden: ${b.notes.join(' · ')}`);
  }
  L.push(cfg.risk.auto_scale ? 'auto_scale açık → bugünkü daily_loss_cap bu ölçekle küçültüldü (asla büyütülmez).' : 'auto_scale kapalı → yalnız bilgi.');
  return L;
}

// ---------- Bugün hangi ağda daha fazla fırsat var (son 24 saat) ----------
export function opportunitySection(rows: Row[]): string[] {
  const since = Date.now() - DAY;
  const out = enabledChains().map((c) => {
    const win = ofChain(rows, c).filter((r) => Date.parse(r.ts) >= since);
    const secPass = win.filter((r) => !reasonsOf(r).some((x) => SECURITY.has(x))).length;
    const passed = win.filter((r) => reasonsOf(r).length === 0);
    const done = win.filter((r) => r.done && r.path.length);
    const rug = pct(done.filter(isRug).length, done.length) / 100;
    const pump = pct(done.filter(isPump).length, done.length) / 100;
    const sh = scoreResults(passed.filter((r) => r.path.length).map((r) => simulate(r.path, cfg.exit)));
    return { c, n: win.length, secPass, passed: passed.length, done: done.length, rug, pump, sh, score: pump * (1 - rug) * Math.log(1 + secPass) };
  });
  const L = ['🎯 <b>Bugün hangi ağda daha fazla fırsat var</b> (son 24 sa, tahmin)'];
  for (const o of [...out].sort((a, b) => b.score - a.score))
    L.push(
      `${o.c}: aday ${o.n} · güvenlik geçen ${o.secPass} · tüm filtre geçen ${o.passed} · ` +
        `biten ${o.done}: +%50 %${(o.pump * 100).toFixed(0)} / rug %${(o.rug * 100).toFixed(0)} · gölge ort ${o.sh.n ? o.sh.avg.toFixed(1) + '%' : '-'} · skor ${o.score.toFixed(2)}`,
    );
  const best = [...out].sort((a, b) => b.score - a.score)[0];
  if (best && best.done >= 5 && best.score > 0) L.push(`→ en yüksek fırsat skoru: <b>${best.c}</b> (pump × (1−rug) × log(1+güvenli aday))`);
  else L.push('→ karşılaştırma için yeterli biten aday yok (ağ başına ≥5).');
  return L;
}

// ---------- Launchpad / dex kırılımı (pump.fun benzeri platformlar dahil, son 24 sa) ----------
export function launchpadSection(rows: Row[]): string[] {
  const since = Date.now() - DAY;
  const by = new Map<string, Row[]>();
  for (const r of rows) {
    if (Date.parse(r.ts) < since) continue;
    const k = `${rowChain(r)}/${r.launchpad ?? '?'}`;
    (by.get(k) ?? by.set(k, []).get(k)!).push(r);
  }
  const L = ['🚀 <b>Launchpad kırılımı</b> (son 24 sa · köken dex → aday / geçen / biten +%50 / rug)'];
  if (!by.size) return [...L, 'veri yok'];
  const list = [...by].map(([k, rs]) => {
    const done = rs.filter((r) => r.done && r.path.length);
    return { k, n: rs.length, passed: rs.filter((r) => reasonsOf(r).length === 0).length, done: done.length, pump: pct(done.filter(isPump).length, done.length), rug: pct(done.filter(isRug).length, done.length) };
  });
  for (const o of list.sort((a, b) => b.n - a.n).slice(0, 10))
    L.push(`${o.k}: ${o.n} / ${o.passed} / ${o.done ? `%${o.pump.toFixed(0)}` : '-'} / ${o.done ? `%${o.rug.toFixed(0)}` : '-'}`);
  L.push('bonding curve havuzları (pump-fun, meteora-dbc…) LP olmadığı için mezun olana kadar likidite filtresinde kalır.');
  return L;
}

// ---------- Bugün hangi ağda daha az rekabet var (son 24 saat erken alıcı verisi) ----------
export function competitionSection(): string[] {
  const since = Date.now() - DAY;
  const all = readJsonl<any>('early_buyers.jsonl').filter((e) => Date.parse(e.ts) >= since);
  const out = enabledChains().map((c) => {
    const ev = all.filter((e) => e.chain === c);
    const tokens = new Map<string, number>();
    const walletTokens = new Map<string, Set<string>>();
    const heavy = new Set<string>();
    for (const e of ev) {
      tokens.set(e.token, (tokens.get(e.token) ?? 0) + 1);
      const w = String(e.wallet).toLowerCase();
      (walletTokens.get(w) ?? walletTokens.set(w, new Set()).get(w)!).add(e.token);
      if ((e.buys ?? 1) > 3) heavy.add(w);
    }
    const bots = [...walletTokens].filter(([w, t]) => t.size >= 3 || heavy.has(w)).length;
    const avgBuyers = tokens.size ? ev.length / tokens.size : 0;
    const bundled = pct(ev.filter((e) => e.bundled).length, ev.length);
    const flip = pct(ev.filter((e) => e.sold && (e.holdMin ?? Infinity) <= cfg.filters.quick_flip_min).length, ev.length);
    const botShare = pct(bots, walletTokens.size);
    const sniperCap = Math.max(1, filtersFor(c).sniper_max_buyers);
    const idx = 40 * Math.min(1, avgBuyers / sniperCap) + 0.3 * botShare + 0.2 * flip + 0.1 * bundled;
    return { c, tokens: tokens.size, avgBuyers, bundled, flip, botShare, idx };
  });
  const L = ['🏁 <b>Bugün hangi ağda daha az rekabet var</b> (son 24 sa erken alıcılardan tahmin; düşük = az rekabet)'];
  for (const o of [...out].sort((a, b) => a.idx - b.idx))
    if (o.tokens < 3) L.push(`${o.c}: veri az (${o.tokens} token)`);
    else L.push(
      `${o.c}: ${o.tokens} token · token başına erken alıcı ${o.avgBuyers.toFixed(1)} · sniper-bot payı %${o.botShare.toFixed(0)} · ` +
        `hızlı satış %${o.flip.toFixed(0)} · bundle %${o.bundled.toFixed(0)} → rekabet ${o.idx.toFixed(0)}/100`,
    );
  const ok = out.filter((o) => o.tokens >= 3).sort((a, b) => a.idx - b.idx);
  L.push(ok.length >= 2 ? `→ en az rekabet: <b>${ok[0].c}</b>` : '→ karşılaştırma için yeterli veri yok (ağ başına ≥3 token).');
  return L;
}

// ---------- En güvenli çıkış stratejisi (son 14 gün, geçen adayların gerçek fiyat yolları) ----------
const p25 = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(0.25 * (s.length - 1))] ?? 0;
};

export function safeExitSection(rows: Row[]): string[] {
  const L = ['🚪 <b>En güvenli çıkış stratejisi</b> (14g geçen adaylar; kötü çeyrek (p25) en iyi, ort > 0 şartı)'];
  for (const c of enabledChains()) {
    const set = ofChain(rows, c).filter((r) => r.done && r.path.length && Date.parse(r.ts) >= Date.now() - 14 * DAY && reasonsOf(r).length === 0);
    const cur = set.map((r) => simulate(r.path, cfg.exit));
    if (set.length < 8) {
      L.push(`${c}: veri az (${set.length} biten geçen aday; ≥8 gerekir) → mevcut exit kalır`);
    } else {
      let best: { e: typeof cfg.exit; p: number; avg: number } | null = null;
      for (const e of grid(cfg.exit, {
        take_profit_pct: [30, 50, 80, 120],
        stop_loss_pct: [10, 15, 20, 30],
        trailing_activate_pct: [15, 20, 30],
        trailing_distance_pct: [8, 12, 18],
        max_hold_min: [60, 120, 240],
      })) {
        const res = set.map((r) => simulate(r.path, e));
        const avg = res.reduce((s, x) => s + x, 0) / res.length;
        const p = p25(res);
        if (avg > 0 && (!best || p > best.p)) best = { e, p, avg };
      }
      const curAvg = cur.reduce((s, x) => s + x, 0) / cur.length;
      L.push(`${c} (n=${set.length}): mevcut p25 ${p25(cur).toFixed(1)}% ort ${curAvg.toFixed(1)}%`);
      L.push(
        best
          ? `  → TP ${best.e.take_profit_pct} · SL ${best.e.stop_loss_pct} · trailing ${best.e.trailing_activate_pct}/${best.e.trailing_distance_pct} · max ${best.e.max_hold_min} dk → p25 ${best.p.toFixed(1)}% ort ${best.avg.toFixed(1)}%`
          : '  → pozitif ortalamalı ayar yok → bu ağda gerçek giriş için veri desteği yok (paper kal)',
      );
    }
    const closes = realCloses(c, Date.now() - 14 * DAY);
    if (closes.length) {
      const m = new Map<string, { n: number; pnl: number }>();
      for (const t of closes) {
        const k = String(t.exitReason ?? '?');
        const v = m.get(k) ?? { n: 0, pnl: 0 };
        m.set(k, { n: v.n + 1, pnl: v.pnl + Number(t.pnl ?? 0) });
      }
      L.push(`  gerçek çıkışlar (14g): ${[...m].map(([k, v]) => `${k} ${v.n} (${sign(v.pnl)} ${nativeSymbol(c)})`).join(', ')}`);
    }
  }
  return L;
}
````

## `src/nightly-run.ts`

````ts
// npm run nightly → botu gece penceresi bitene kadar çalıştırır, 07:45'te sabah raporu, 08:00'de çıkış.
process.env.NIGHTLY_EXIT = '1';
await import('./index.js');
````

## `src/nightly.ts`

````ts
// Gece modu: start–end penceresinde her summary_every_min dakikada özet yazar,
// report_at'te Telegram'a "Sabah Raporu" atar, exitAtEnd ise end'de süreci kapatır.
import fs from 'node:fs';
import path from 'node:path';
import { CHAINS, DATA_DIR, cfg, nativeSymbol, riskFor, type Chain } from './config.js';
import { competitionSection, launchpadSection, opportunitySection, riskSection, safeExitSection, syncSection, fundingSection, missedSection, rugHitSection, trapDetail, TRAP_REASONS } from './insights.js';
import { loadRows, rejectCounts, runOptimization, shadowSince, fmtScore, type Row } from './optimizer.js';
import { scanStats } from './scanner.js';
import { trapRisk } from './smartmoney.js';
import { suspects, type SuspectKind } from './trap.js';
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

const KIND_TR: Record<SuspectKind, string> = {
  smart_trap: 'smart tuzak',
  rug_accomplice: 'rug ortağı',
  sniper_bot: 'sniper bot',
  dev_sniper: 'dev+sniper',
  serial_dev: "seri rug'cu dev",
  wash_ring: 'wash halkası',
  rug_cluster: 'rug kümesi',
  sync_ring: 'senkron halka',
  funder_ring: 'fonlayıcı halkası',
};

// "Tuzağa Düşme Risk Analizi": izlenen smart/KOL tuzak skoru + gece elenen tuzaklar + şüpheli cüzdan listesi.
export function trapAnalysis(rows: Row[], since: number): string[] {
  const L: string[] = ['🪤 <b>Tuzağa Düşme Risk Analizi</b>'];
  const trap = trapRisk(rows);
  if (trap.score == null) L.push('smart/KOL tuzak skoru: veri yok (smart/KOL girişli rug kaydı yok)');
  else {
    const lvl = trap.score >= 60 ? '🔴 yüksek' : trap.score >= 30 ? '🟠 orta' : '🟢 düşük';
    L.push(`smart/KOL tuzak skoru: ${trap.score}/100 ${lvl} (son ${trap.rugs.length} rug)`);
    for (const r of trap.rugs)
      L.push(`  · ${r.symbol} rug ${new Date(r.rugAt).toLocaleTimeString('tr-TR', { timeZone: cfg.timezone, hour: '2-digit', minute: '2-digit' })} — önce satan: ${r.front.join(', ') || '-'} · yakalanan: ${r.caught.join(', ') || '-'}`);
  }

  const win = rows.filter((r) => Date.parse(r.ts) >= since);
  const reasons = rejectCounts(win).filter(([k]) => TRAP_REASONS.has(k));
  L.push(`gece tuzak elemesi: ${reasons.length ? reasons.map(([k, v]) => `${k} ${v}`).join(', ') : 'yok'}`);
  const scored = win.filter((r) => r.metrics?.trapScore != null);
  if (scored.length) {
    const avg = scored.reduce((s, r) => s + (r.metrics.trapScore ?? 0), 0) / scored.length;
    const over = scored.filter((r) => (r.metrics.trapScore ?? 0) > cfg.filters.max_trap_score);
    L.push(`sinyal tuzak skoru: ort ${avg.toFixed(0)} · >${cfg.filters.max_trap_score} elenen ${over.length}/${scored.length}`);
    for (const r of over.sort((a, b) => (b.metrics.trapScore ?? 0) - (a.metrics.trapScore ?? 0)).slice(0, 5)) {
      const parts = Object.entries(r.metrics.trapParts ?? {}).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([k, v]) => `${k} ${v}`).join(', ');
      const rugged = r.path.some(([, p]) => p <= -80) ? ' → rug oldu ✅' : '';
      L.push(`  · ${r.symbol} ${r.metrics.trapScore} (${parts})${rugged}`);
    }
  }

  const sus = suspects(cfg.filters.suspect_wallet_score);
  const tracked = sus.filter((x) => x.label);
  const frontBad = trap.wallets.filter((w) => w.front >= 2).map((w) => w.label);
  const flagged = [...new Set([...tracked.map((x) => x.label!), ...frontBad])];
  if (flagged.length) L.push(`⚠️ izlenen cüzdanlarda şüpheli (wallets.yaml'dan çıkarmayı değerlendir): ${flagged.join(', ')}`);
  L.push(`şüpheli cüzdanlar (skor ≥ ${cfg.filters.suspect_wallet_score}): ${sus.length}`);
  for (const x of sus.slice(0, 10)) L.push(`  · ${x.chain} <code>${x.address}</code> ${x.score} — ${x.kinds.map((k) => KIND_TR[k]).join(', ')}${x.label ? ` [${x.label}]` : ''}`);
  if (sus.length > 10) L.push(`  … tam liste: npm run discover-wallets → data/suspect-wallets.json`);
  return L;
}

// /rapor alt bölümleri: /rapor tuzak | senkron | kacan | isabet | risk | firsat | rekabet | launchpad | cikis | config | <saat>
export const REPORT_PARTS = ['ozet', 'risk', 'firsat', 'rekabet', 'launchpad', 'tuzak', 'senkron', 'kacan', 'isabet', 'cikis', 'config'] as const;
export type ReportPart = (typeof REPORT_PARTS)[number];
export interface ReportOpts {
  sinceMs?: number; // varsayılan: nightly penceresi başlangıcı
  parts?: ReportPart[]; // varsayılan: hepsi
  title?: string;
}

// /rapor [bölüm…] [saat] → ör. "/rapor", "/rapor tuzak", "/rapor risk cikis 6"
export function parseReportArgs(args: string[]): ReportOpts {
  const ascii = (a: string) => a.toLocaleLowerCase('tr').replace(/[çışğöü]/g, (ch) => ({ ç: 'c', ı: 'i', ş: 's', ğ: 'g', ö: 'o', ü: 'u' })[ch]!);
  const parts = args.map(ascii).filter((a): a is ReportPart => (REPORT_PARTS as readonly string[]).includes(a));
  const h = Number(args.find((a) => /^\d+(\.\d+)?$/.test(a)) ?? 24);
  return { sinceMs: Date.now() - Math.min(Math.max(h, 1), 24 * 14) * 3_600_000, parts: parts.length ? parts : undefined, title: `📊 <b>Rapor</b> · son ${h} sa` };
}

export function morningReport(opts: ReportOpts = {}): string {
  const since = opts.sinceMs ?? windowStartMs();
  const want = (p: ReportPart) => !opts.parts || opts.parts.includes(p);
  const rows = rowsNow();
  const L: string[] = [];
  L.push(`${opts.title ?? '☀️ <b>Sabah Raporu</b>'} · ${utcDay()} · ${cfg.mode.toUpperCase()}`);
  L.push(`pencere ${new Date(since).toLocaleString('tr-TR', { timeZone: cfg.timezone, hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' })}–${localHHMM()} (${cfg.timezone}) · fırsat/rekabet/launchpad her zaman son 24 sa`);
  if (want('ozet')) {
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
      const day = state.daily.realized[c] ?? 0;
      L.push(`gün toplamı ${day >= 0 ? '+' : ''}${day.toFixed(4)} / limit −${riskFor(c).daily_loss_cap} / hedef +${riskFor(c).daily_profit_target}`);
    }

    const open = openPositions();
    L.push('');
    L.push(`<b>Açık pozisyon</b>: ${open.length ? open.map((p) => `${p.symbol}(${p.chain}) ${((p.lastValueNative / p.sizeNative - 1) * 100).toFixed(1)}%`).join(', ') : 'yok'}`);
    if (state.haltedDay === utcDay()) L.push(`⛔ günlük durdurma: ${state.haltReason}`);
    if (state.paused) L.push(`⏸ duraklatılmış: ${state.pauseReason}`);
  }

  if (want('risk')) L.push('', ...riskSection(rows, since));
  if (want('firsat')) L.push('', ...opportunitySection(rows));
  if (want('rekabet')) L.push('', ...competitionSection());
  if (want('launchpad')) L.push('', ...launchpadSection(rows));
  if (want('tuzak')) L.push('', ...trapAnalysis(rows, since), '', ...trapDetail(rows, since));
  if (want('tuzak') || want('senkron')) L.push('', ...syncSection(rows, since), '', ...fundingSection(rows, since));
  if (want('tuzak') || want('isabet') || want('kacan')) L.push('', ...rugHitSection(rows));
  if (want('kacan')) L.push('', ...missedSection(rows, since));
  if (want('cikis')) L.push('', ...safeExitSection(rows));
  if (!want('config')) return L.join('\n');

  // Optimizasyon ağ başına: yalnız o ağın kendi kayıtları + filtersFor(chain)
  L.push('');
  L.push('<b>Önerilen config</b> (botun kendi geçmişi, ağ başına):');
  for (const c of CHAINS.filter((x) => cfg.chains[x].enabled)) {
    const opt = runOptimization(rows, c);
    L.push(`${c} (${opt.rows} biten aday): karar ${opt.accept ? 'UYGULA' : 'UYGULAMA'} · test ${fmtScore(opt.newTest)}`);
    if (opt.diff.length) L.push(opt.diff.map((d) => `  · ${d}`).join('\n'));
  }
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
  if (cfg.nightly.auto_report === false) return log.info('sabah raporu dosyaya yazıldı (auto_report: false → /rapor ile iste)');
  // Telegram 4096 karakter sınırı
  for (let i = 0; i < text.length; i += 3900) await tg(text.slice(i, i + 3900));
  log.info('sabah raporu gönderildi');
}

const reportCatchUp = () => {
  const n = nowMin();
  const end = toMin(cfg.nightly.end);
  return n >= toMin(cfg.nightly.report_at) && n >= end && n < end + 180;
};

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
    } else if (!exitAtEnd && reportCatchUp() && lastReportDay() !== utcDay()) {
      await sendMorning(); // Railway restart/redeploy 07:45'i kaçırdıysa pencere bitiminden sonraki 3 saat içinde at
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
````

## `src/optimizer.ts`

````ts
// Filtre + çıkış optimizasyonu (walk-forward) ve gölge-paper simülasyonu.
// Config'i ASLA otomatik değiştirmez; yalnız öneri üretir. Yalnız botun KENDİ kayıtlarından öğrenir
// (candidates/outcomes/trades.jsonl) — dışarıdan hazır cüzdan/sinyal listesi kullanılmaz.
import { cfg, filtersFor, type Chain, type Config } from './config.js';
import { evaluate } from './filters.js';
import { signalTrapScore } from './trap.js';
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
  launchpad?: string;
}

const MIN_N_TRAIN = 20;
const MIN_N_TEST = 8;
export const rowChain = (r: Row) => r.key.slice(0, r.key.indexOf(':')) as Chain;
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
    // trap skoru güncel ağırlıklarla yeniden hesaplanır → eski kayıtlar da yeni kurallarla değerlendirilir
    const metrics = c.metrics?.trapScore != null ? { ...c.metrics, trapScore: signalTrapScore(c.metrics).score } : c.metrics;
    rows.push({ ts: c.ts, key, symbol: c.symbol, stage: c.stage, fails: c.fails ?? [], metrics, path: p?.path ?? [], done: p?.done ?? false, launchpad: c.launchpad ?? c.dex });
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

export function scoreResults(r: number[]): Score {
  const wins = r.filter((x) => x > 0);
  const loss = r.filter((x) => x <= 0).reduce((s, x) => s - x, 0);
  const total = r.reduce((s, x) => s + x, 0);
  return { n: r.length, win: r.length ? wins.length / r.length : 0, avg: r.length ? total / r.length : 0, pf: loss ? wins.reduce((s, x) => s + x, 0) / loss : Infinity, total };
}

// f verilmezse her satır kendi ağının filtresiyle (filtersFor) değerlendirilir.
export const passes = (r: Row, f?: Filters) => evaluate(r.metrics, f ?? filtersFor(rowChain(r))).length === 0;

export function score(set: Row[], f: Filters | undefined, e: Exit): Score {
  return scoreResults(set.filter((x) => x.path.length && passes(x, f)).map((x) => simulate(x.path, e)));
}

// Az örnekle şişmiş ortalamayı cezalandır.
const objective = (s: Score) => (s.n < MIN_N_TRAIN ? -Infinity : s.avg * Math.sqrt(s.n));

export function* grid<T extends object>(base: T, axes: Partial<Record<keyof T, number[]>>): Generator<T> {
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

// chain verilirse yalnız o ağın satırları + filtersFor(chain) → öneriler chain_filters.<chain>.* olarak yazılır.
export function runOptimization(all: Row[] = loadRows(), chain?: Chain): OptResult {
  const rows = all.filter((r) => r.done && r.path.length && (!chain || rowChain(r) === chain));
  const cut = Date.now() - 7 * 86_400_000;
  const train = rows.filter((r) => Date.parse(r.ts) < cut);
  const test = rows.filter((r) => Date.parse(r.ts) >= cut);
  const curF = chain ? filtersFor(chain) : cfg.filters;
  const curE: Exit = cfg.exit;
  const fKey = chain ? `chain_filters.${chain}` : 'filters';

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
  // 1b) Tuzak eşikleri (en iyi temel filtrenin üstüne; ayrı ızgara → kombinasyon patlaması yok)
  for (const f of grid(bestF, {
    max_trap_score: [40, 50, 60, 70],
    max_early_dump_pct: [30, 45, 60],
    max_dev_sold_pct: [10, 20, 35],
    max_bundled_pct: [20, 30, 45],
  })) {
    const s = objective(score(train, f, curE));
    if (s > bestFs) [bestF, bestFs] = [f, s];
  }
  // 1c) Senkron cüzdan eşikleri
  for (const f of grid(bestF, {
    max_sync_trade_pct: [45, 55, 70],
    max_sync_repeat_wallets: [2, 3, 5],
    max_sync_rug_link_pct: [15, 25, 40],
  })) {
    const s = objective(score(train, f, curE));
    if (s > bestFs) [bestF, bestFs] = [f, s];
  }
  // 1d) Fonlama kümesi eşikleri
  for (const f of grid(bestF, {
    max_common_funder_pct: [20, 30, 45],
    max_fund_dev_pct: [5, 10, 20],
    max_fresh_wallet_pct: [40, 60, 80],
    max_launchpad_dump_pct: [45, 60, 75],
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
    max_hold_min: [60, 120, 240],
  })) {
    const s = objective(score(train, bestF, e));
    if (s > bestEs) [bestE, bestEs] = [e, s];
  }

  const curTrain = score(train, curF, curE);
  const curTest = score(test, curF, curE);
  const newTrain = score(train, bestF, bestE);
  const newTest = score(test, bestF, bestE);

  const diff: string[] = [];
  for (const k of Object.keys(bestF) as (keyof Filters)[]) if (bestF[k] !== curF[k]) diff.push(`${fKey}.${k}: ${curF[k]} → ${bestF[k]}`);
  for (const k of Object.keys(bestE) as (keyof Exit)[]) if (bestE[k] !== curE[k]) diff.push(`exit.${k}: ${curE[k]} → ${bestE[k]}`);

  const accept = diff.length > 0 && newTest.n >= MIN_N_TEST && newTest.avg > curTest.avg && newTest.avg > 0;
  const enough = train.length >= MIN_N_TRAIN;
  const report = [
    `# Optimizasyon ${utcDay()}${chain ? ` · ${chain}` : ''}`,
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

export function rejectCounts(rows: Row[], f?: Filters): [string, number][] {
  const m = new Map<string, number>();
  for (const r of rows) for (const reason of evaluate(r.metrics, f ?? filtersFor(rowChain(r)))) m.set(reason, (m.get(reason) ?? 0) + 1);
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
  const passed = win.filter((r) => passes(r));
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
````

## `src/positions.ts`

````ts
import { randomUUID } from 'node:crypto';
import { CHAINS, cfg, nativeSymbol, paperOnly, type Chain } from './config.js';
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
    mode: paperOnly(pi.chain) ? 'paper' : 'live',
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
    `bugün: ${CHAINS.map((c) => `${nativeSymbol(c)} ${fmt(d.realized[c] ?? 0)}`).join(' · ')} · ${d.trades} işlem`,
    `paper bakiye: ${CHAINS.map((c) => `${fmt(state.paperBalance[c] ?? 0)} ${nativeSymbol(c)}`).join(' · ')}`,
    `risk ölçeği: ${CHAINS.map((c) => `${c} ×${(state.riskScale?.[c] ?? 1).toFixed(2)}`).join(' · ')}`,
    `açık (${open.length}/${cfg.risk.max_concurrent}):`,
    ...lines,
  ].join('\n');
}
````

## `src/risk.ts`

````ts
import { cfg, riskFor, type Chain } from './config.js';
import { openPositions, rollDay, state } from './state.js';
import { utcDay } from './util.js';

export function probeSize(chain: Chain, balance: number): number | null {
  const r = riskFor(chain);
  const free = balance - r.fee_reserve;
  const size = Math.min(r.probe_max, Math.max(r.probe_min, balance * (r.probe_balance_pct / 100)));
  return size <= free ? Number(size.toFixed(4)) : null;
}

// auto_scale açıksa Sabah Raporu'nun önerdiği ölçek (state.riskScale) günlük kayıp tavanını küçültür; asla büyütmez.
export function dailyCap(chain: Chain): number {
  const r = riskFor(chain);
  const s = cfg.risk.auto_scale ? Math.min(1, Math.max(cfg.risk.min_scale, state.riskScale?.[chain] ?? 1)) : 1;
  return r.daily_loss_cap * s;
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
  if ((d.realized[chain] ?? 0) >= r.daily_profit_target) return { ok: false, reason: 'günlük kâr hedefi doldu' };

  const worst = cfg.risk.assumed_worst_loss_pct / 100;
  const realizedLoss = Math.max(0, -(d.realized[chain] ?? 0));
  const openRisk = open.filter((p) => p.chain === chain).reduce((s, p) => s + p.sizeNative * worst, 0);
  const cap = dailyCap(chain);
  if (realizedLoss + openRisk + size * worst > cap + 1e-9)
    return {
      ok: false,
      reason: `risk bütçesi: ${(realizedLoss + openRisk).toFixed(4)} + ${(size * worst).toFixed(4)} > ${cap.toFixed(4)}`,
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
  d.realized[chain] = (d.realized[chain] ?? 0) + pnl;
  if (pnl < 0) {
    d.consecutiveLosses++;
    d.lastLossAt = Date.now();
  } else d.consecutiveLosses = 0;

  if (-(d.realized[chain] ?? 0) >= dailyCap(chain)) return halt(`${chain} günlük kayıp limiti (${d.realized[chain].toFixed(4)})`);
  if ((d.realized[chain] ?? 0) >= r.daily_profit_target) return halt(`${chain} günlük kâr hedefi (+${d.realized[chain].toFixed(4)})`);
  if (d.consecutiveLosses >= cfg.risk.max_consecutive_losses) return halt(`${d.consecutiveLosses} ardışık kayıp`);
  return null;
}
````

## `src/scanner.ts`

````ts
import { cfg, filtersFor, isEvm, wallets, type Chain } from './config.js';
import { isEvmAddress } from './chains.js';
import { executor } from './exec/index.js';
import { evaluate } from './filters.js';
import { openPosition } from './positions.js';
import { canOpen, probeSize } from './risk.js';
import { activeEntries, confirmSolanaOnChain, entrySync } from './smartmoney.js';
import { bestPairs, discover } from './sources/discovery.js';
import { holderCount, security } from './sources/security.js';
import { earlyDumpPct } from './sources/ohlcv.js';
import { sniperPct } from './sources/sniper.js';
import { fundingCheck } from './sources/funding.js';
import { washCheck } from './sources/wash.js';
import { state } from './state.js';
import { tg } from './telegram.js';
import { clusterCheck, comboFlags, syncRugLinkPct, funderPrevRugs, devLinkedEarlyPct, devPrevRugs, launchpadDumpPct, signalTrapScore, suspectEarlyPct, suspects, trapLabels } from './trap.js';
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
  const f = filtersFor(pi.chain);
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
  // 1a) Seri rug'cu dev (kendi geçmişimiz, ücretsiz).
  base.devPrevRugs = devPrevRugs(pi.chain, pi.token, sec.creator);
  const early = evaluate(base, { ...f, max_sniper_pct: Infinity, sniper_unknown_pass: true, wash_unknown_pass: true, min_smart_entries: 0, min_smart_only: 0, require_holder_growth: false });
  if (early.length) return finish(pi, base, early, 'security');

  // 1b) Wash trading + senkron cüzdan (son ~100 swap / ~5 dk blok).
  const wash = await washCheck(pi.chain, pi.token, pi.pair).catch((e) => {
    log.warn('wash calc', { token: pi.token, err: errMsg(e) });
    return null;
  });
  base.washWallets = wash?.washWallets ?? null;
  base.washTradePct = wash?.washTradePct ?? null;
  base.syncTradePct = wash?.sync.syncTradePct ?? null;
  base.syncMaxWallets = wash?.sync.syncMaxWallets ?? null;
  base.syncRepeatWallets = wash?.sync.syncRepeatWallets ?? null;
  base.syncRugLinkPct = wash ? syncRugLinkPct(pi.chain, pi.token, wash.sync.group) : null;
  const washFail = evaluate(base, { ...f, max_sniper_pct: Infinity, sniper_unknown_pass: true, min_smart_entries: 0, min_smart_only: 0, require_holder_growth: false });
  if (washFail.length) return finish(pi, base, washFail, 'wash');

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
  const es = entrySync(pi.chain, pi.token, [...sm.smart, ...sm.kol]);
  base.smartEffective = sm.smart.length + sm.kol.length ? es.effective : null;
  base.smartSynced = es.synced;
  if (es.synced.length >= 2) jsonl('smart_sync.jsonl', { chain: pi.chain, token: pi.token, labels: es.synced });
  base.launchpadDumpPct = launchpadDumpPct(pi.chain, pi.launchpad);

  // 4) Sniper oranı (en pahalı) yalnız smart money geçtiyse.
  if (sm.smart.length + sm.kol.length >= f.min_smart_entries) {
    const sn = await sniperPct(pi.chain, pi.token, pi.pair, pi.pairCreatedAt, sec.creator).catch((e) => {
      log.warn('sniper calc', { token: pi.token, err: errMsg(e) });
      return null;
    });
    base.sniperPct = sn?.pct ?? null;
    base.sniperBuyers = sn?.buyers;
    base.sniperHoldMin = sn?.holdMin ?? null;
    base.sniperQuickFlipPct = sn?.quickFlipPct ?? null;
    base.sniperRugLinkPct = sn?.rugLinkPct ?? null;
    base.sniperBundledPct = sn?.bundledPct ?? null;
    base.devSoldPct = sn?.devSoldPct ?? null;
    if (sn?.dev && !sec.creator) base.devPrevRugs = devPrevRugs(pi.chain, pi.token, sn.dev);
    const ws = sn?.wallets ?? [];
    const cl = clusterCheck(pi.chain, pi.token, ws);
    base.clusterRugs = cl?.rugs ?? null;
    base.clusterShared = cl?.maxShared ?? null;
    base.suspectEarlyPct = suspectEarlyPct(pi.chain, ws);
    base.devLinkedEarlyPct = devLinkedEarlyPct(pi.chain, pi.token, ws);
    // 4b) Koordineli cüzdan grubu: erken alıcıların fonlayıcısı (ortak kaynak / dev / taze cüzdan)
    const fund = await fundingCheck(pi.chain, pi.token, ws, sn?.dev ?? sec.creator ?? null).catch((e) => {
      log.warn('funding', { token: pi.token, err: errMsg(e) });
      return null;
    });
    base.fundChecked = fund?.checked ?? null;
    base.fundFreshPct = fund?.freshPct ?? null;
    base.fundCommonPct = fund?.commonPct ?? null;
    base.fundDevPct = fund?.devPct ?? null;
    base.fundPrevRugs = fund?.topFunder ? funderPrevRugs(pi.chain, pi.token, fund.topFunder) : null;

    // 5) İlk 8 dk dump (GeckoTerminal 1 dk mum).
    base.earlyDumpPct = await earlyDumpPct(pi.chain, pi.pair, pi.pairCreatedAt).catch((e) => {
      log.warn('ohlcv', { token: pi.token, err: errMsg(e) });
      return null;
    });

    // 6) Tetikleyen smart/KOL arasında tuzak cüzdanı: son rug'larda ≥2 kez önce satan ya da şüphe skoru yüksek.
    const traps = trapLabels();
    const bad = new Set(suspects(f.suspect_wallet_score).map((x) => x.address.toLowerCase()));
    const addrOf = new Map(wallets[pi.chain].map((w) => [w.label, w.address.toLowerCase()]));
    base.trapWallets = [...sm.smart, ...sm.kol].filter((l) => traps.has(l) || bad.has(addrOf.get(l) ?? ''));
  }

  // 7) Sinyal tuzak skoru: > max_trap_score → trap_score ile elenir.
  const ts = signalTrapScore(base);
  base.trapScore = ts.score;
  base.trapParts = ts.parts;
  base.comboFlags = comboFlags(base);

  const fails = evaluate(base, f);
  return finish(pi, base, fails, 'full');
}

// Gece raporu için sayaçlar (process ömrü boyunca).
export const scanStats = { discovered: 0, prefiltered: 0, deepChecked: 0, passed: 0, opened: 0, gated: 0 };

async function finish(pi: PairInfo, m: Metrics, fails: string[], stage: string) {
  scanStats.deepChecked++;
  jsonl('candidates.jsonl', { chain: pi.chain, token: pi.token, symbol: pi.symbol, pair: pi.pair, dex: pi.dex, launchpad: pi.launchpad, priceUsd: pi.priceUsd, stage, fails, metrics: m });
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
    if (age > cfg.scan.max_pair_age_min || pi.liquidityUsd < filtersFor(chain).min_liquidity_usd) continue;
    if (isEvm(chain) && !isEvmAddress(pi.pair)) continue; // Uniswap V4 / Clanker pool id → V2 rotası yok
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
````

## `src/smartmoney.ts`

````ts
import { EventEmitter } from 'node:events';
import { PublicKey } from '@solana/web3.js';
import { id as keccakId, zeroPadValue, getAddress } from 'ethers';
import { CHAINS, cfg, normAddr, wallets, type Chain, type EvmChain, type TrackedWallet } from './config.js';
import { EVM, QUOTE_MINTS, evmProvider, solConn } from './chains.js';
import type { Row } from './optimizer.js';
import { errMsg, jsonl, log, readJsonl, throttle } from './util.js';

interface WalletEvent {
  wallet: string;
  label: string;
  type: 'smart' | 'kol';
  side: 'buy' | 'sell';
  ts: number;
  source: string;
}

const events = new Map<string, WalletEvent[]>();
const key = (chain: Chain, token: string) => `${chain}:${normAddr(chain, token)}`;
const byAddr = Object.fromEntries(CHAINS.map((c) => [c, new Map(wallets[c].map((w) => [normAddr(c, w.address), w]))])) as Record<
  Chain,
  Map<string, TrackedWallet>
>;

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

// "Aynı anda tüm cüzdanlar alıyor" kalıbı: izlenen cüzdanlar ≤ sync_entry_sec içinde aynı token'a giriyorsa
// bağımsız sinyal değil (tek operatörün çoklu cüzdanı, copy-trade zinciri ya da yem grubu) → tek giriş sayılır.
export function entrySync(chain: Chain, token: string, labels: string[]): { effective: number; synced: string[] } {
  const win = (cfg.filters.sync_entry_sec ?? 3) * 1000;
  const first = new Map<string, number>();
  for (const e of events.get(key(chain, token)) ?? []) if (e.side === 'buy' && labels.includes(e.label) && !first.has(e.label)) first.set(e.label, e.ts);
  const xs = [...first].sort((a, b) => a[1] - b[1]);
  let effective = 0;
  const synced = new Set<string>();
  for (let i = 0; i < xs.length; i++) {
    if (i && xs[i][1] - xs[i - 1][1] <= win) synced.add(xs[i][0]).add(xs[i - 1][0]);
    else effective++;
  }
  return { effective, synced: [...synced] };
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

// ---------- EVM: Transfer log taraması (iki getLogs çağrısı / tur, ağ başına) ----------
const TRANSFER = keccakId('Transfer(address,address,uint256)');
const fromBlock: Partial<Record<EvmChain, number>> = {};
export async function pollEvm(chain: EvmChain) {
  if (!wallets[chain].length) return;
  const p = evmProvider(chain);
  const head = await p.getBlockNumber();
  const last = (fromBlock[chain] ??= head - 40);
  if (head <= last) return;
  const toBlock = Math.min(head, last + Math.min(400, EVM[chain].logRange ?? 400));
  const topics = wallets[chain].map((w) => zeroPadValue(w.address, 32));
  const [ins, outs] = await Promise.all([
    p.getLogs({ topics: [TRANSFER, null, topics], fromBlock: last + 1, toBlock }),
    p.getLogs({ topics: [TRANSFER, topics], fromBlock: last + 1, toBlock }),
  ]);
  for (const [logs, side, idx] of [
    [ins, 'buy', 2],
    [outs, 'sell', 1],
  ] as const) {
    for (const l of logs) {
      if (EVM[chain].quotes.has(l.address.toLowerCase())) continue;
      const addr = getAddress('0x' + l.topics[idx].slice(26)).toLowerCase();
      const w = byAddr[chain].get(addr);
      if (w) record(chain, l.address.toLowerCase(), w, side, 'logs');
    }
  }
  fromBlock[chain] = toBlock;
}

export function walletCounts() {
  return Object.fromEntries(CHAINS.map((c) => [c, wallets[c].length])) as Record<Chain, number>;
}

// ---------- Tuzağa düşme risk skoru ----------
// Son N rug'da (path min ≤ −80%) girişte görülen smart/KOL cüzdanlar rug ANINDAN önce sattı mı?
// Önce satan = takipçiyi exit liquidity yapıyor olabilir → onları kopyalamak tuzak.
// Skor 0–100 = rug başına "önce satan / giren" ortalaması. Satış görülmemesi = birlikte yakalandı ya da izlenmedi.
export interface TrapRisk {
  score: number | null;
  rugs: { symbol: string; key: string; rugAt: number; front: string[]; caught: string[] }[];
  wallets: { label: string; front: number; caught: number }[];
}

export function trapRisk(rows: Row[], lastN = 3): TrapRisk {
  const rugs = rows
    .filter((r) => r.metrics && (r.metrics.smartWallets?.length ?? 0) + (r.metrics.kolWallets?.length ?? 0) > 0 && r.path.some(([, pct]) => pct <= -80))
    .sort((a, b) => Date.parse(b.ts) - Date.parse(a.ts))
    .slice(0, lastN);
  if (!rugs.length) return { score: null, rugs: [], wallets: [] };

  const sells = new Map<string, { label: string; ts: number }[]>();
  for (const e of readJsonl<any>('wallet_events.jsonl')) {
    if (e.side !== 'sell') continue;
    const k = key(e.chain, e.token);
    (sells.get(k) ?? sells.set(k, []).get(k)!).push({ label: e.label, ts: e.ts });
  }

  const per = new Map<string, { label: string; front: number; caught: number }>();
  const out: TrapRisk['rugs'] = [];
  let sum = 0;
  for (const r of rugs) {
    const [chain, token] = [r.key.slice(0, r.key.indexOf(':')), r.key.slice(r.key.indexOf(':') + 1)] as [Chain, string];
    const rugMin = r.path.find(([, pct]) => pct <= -80)![0];
    const rugAt = Date.parse(r.ts) + rugMin * 60_000;
    const labels = [...new Set([...r.metrics.smartWallets, ...r.metrics.kolWallets])];
    const ss = sells.get(key(chain, token)) ?? [];
    const front = labels.filter((l) => ss.some((x) => x.label === l && x.ts < rugAt));
    const caught = labels.filter((l) => !front.includes(l));
    for (const l of labels) {
      const w = per.get(l) ?? { label: l, front: 0, caught: 0 };
      front.includes(l) ? w.front++ : w.caught++;
      per.set(l, w);
    }
    sum += front.length / labels.length;
    out.push({ symbol: r.symbol, key: r.key, rugAt, front, caught });
  }
  return {
    score: Math.round((sum / rugs.length) * 100),
    rugs: out,
    wallets: [...per.values()].sort((a, b) => b.front - a.front || b.caught - a.caught),
  };
}
````

## `src/sources/discovery.ts`

````ts
import { cfg, normAddr, type Chain } from '../config.js';
import type { PairInfo } from '../types.js';
import { getJson, throttle } from '../util.js';

const DEXS = 'https://api.dexscreener.com';
const GECKO = 'https://api.geckoterminal.com/api/v2';

// token → ilk görüldüğü launchpad/dex (GeckoTerminal dex id). Bonding curve'den mezun olup
// pumpswap/meteora'ya geçen token DexScreener'da yeni dex'iyle görünür; köken burada kalır.
const origin = new Map<string, string>();

// GeckoTerminal: yeni havuzlar (free ~30 rpm → 2.1 sn aralık). Sayfa sayısı scan.gecko_pages.
export async function geckoNewPools(chain: Chain): Promise<string[]> {
  const pages = Math.max(1, cfg.scan.gecko_pages?.[chain] ?? 1);
  const skip = new Set(cfg.scan.skip_launchpads ?? []);
  const out: string[] = [];
  for (let page = 1; page <= pages; page++) {
    await throttle('gecko', 2100);
    const j = await getJson<any>(`${GECKO}/networks/${chain}/new_pools?page=${page}`);
    for (const p of j.data ?? []) {
      const id = String(p.relationships?.base_token?.data?.id ?? '');
      const token = id.slice(id.indexOf('_') + 1);
      const dex = String(p.relationships?.dex?.data?.id ?? '');
      if (!token) continue;
      const k = `${chain}:${normAddr(chain, token)}`;
      if (dex && !origin.has(k)) origin.set(k, dex);
      if (skip.has(origin.get(k) ?? dex)) continue;
      out.push(token);
    }
    if ((j.data ?? []).length < 20) break;
  }
  if (origin.size > 50_000) origin.clear();
  return out;
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
      const key = normAddr(chain, token);
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
        launchpad: origin.get(`${chain}:${key}`) ?? p.dexId,
      });
    }
  }
  return out;
}

export async function discover(chain: Chain): Promise<string[]> {
  const [a, b] = await Promise.allSettled([geckoNewPools(chain), dexsLatestProfiles(chain)]);
  const set = new Set<string>();
  for (const r of [a, b]) if (r.status === 'fulfilled') r.value.forEach((t) => set.add(normAddr(chain, t)));
  return [...set];
}
````

## `src/sources/funding.ts`

````ts
import { PublicKey } from '@solana/web3.js';
import { env, filtersFor, isEvm, type Chain } from '../config.js';
import { evmProvider, solConn } from '../chains.js';
import { norm } from '../trap.js';
import { getJson, jsonl, throttle } from '../util.js';

// Koordineli cüzdan grubu (fonlama kümesi): erken alıcıları kim fonladı?
// Bilinen kalıp (Bubblemaps kümeleri, Rugproof vakası): dev/operatör tek cüzdandan çok sayıda TAZE cüzdana native
// gönderir, bu cüzdanlar launch'ta arzı toplar ve birlikte satar. Ayrı adresler bağımsız alıcı gibi görünür.
// - freshPct: ilk işlemi fresh_wallet_hours içinde olan erken alıcı %
// - commonPct: en büyük ortak-fonlayıcı grubunun kontrol edilen erken alıcılara oranı
// - devPct: doğrudan dev tarafından fonlanan erken alıcı %
// Borsa/köprü sıcak cüzdanları herkesi fonlar → "hub" sayılıp gruplanmaz (SOL: ≥1000 imza, EVM: nonce ≥ 1000).
export interface FundInfo {
  checked: number;
  freshPct: number | null;
  commonPct: number | null;
  devPct: number | null;
  topFunder: string | null;
  group: string[];
}

interface Origin {
  funder: string | null;
  firstTs: number | null; // ms
}

const ETHERSCAN_ID: Partial<Record<Chain, number>> = { bsc: 56, base: 8453, monad: 143 }; // Blast Etherscan v2'de yok
const hubCache = new Map<string, boolean>();

export async function fundingCheck(chain: Chain, token: string, wallets: string[], dev: string | null): Promise<FundInfo | null> {
  const f = filtersFor(chain);
  const ws = wallets.filter((w) => !dev || norm(chain, w) !== norm(chain, dev)).slice(0, f.funding_max_wallets ?? 12);
  if (ws.length < 3) return null;
  const origins: { wallet: string; o: Origin }[] = [];
  for (const w of ws) {
    const o = await (chain === 'solana' ? solOrigin(w) : isEvm(chain) ? evmOrigin(chain, w) : Promise.resolve(null)).catch(() => null);
    if (o) origins.push({ wallet: w, o });
  }
  if (origins.length < 3) return null; // veri yok (anahtar yok / API hatası) → bilinmiyor
  const now = Date.now();
  const fresh = origins.filter((x) => x.o.firstTs != null && now - x.o.firstTs <= (f.fresh_wallet_hours ?? 48) * 3_600_000).length;
  const by = new Map<string, string[]>();
  for (const { wallet, o } of origins) {
    if (!o.funder || (await isHub(chain, o.funder))) continue;
    const k = norm(chain, o.funder);
    (by.get(k) ?? by.set(k, []).get(k)!).push(wallet);
  }
  const top = [...by].sort((a, b) => b[1].length - a[1].length)[0];
  const devN = dev ? (by.get(norm(chain, dev))?.length ?? 0) : 0;
  const info: FundInfo = {
    checked: origins.length,
    freshPct: (fresh / origins.length) * 100,
    commonPct: top && top[1].length >= 2 ? (top[1].length / origins.length) * 100 : 0,
    devPct: (devN / origins.length) * 100,
    topFunder: top && top[1].length >= 2 ? top[0] : null,
    group: top && top[1].length >= 2 ? top[1] : [],
  };
  for (const [funder, g] of by) if (g.length >= 2) jsonl('funders.jsonl', { chain, token, funder, wallets: g, dev: dev ? norm(chain, dev) === funder : false });
  return info;
}

// ---- Solana: cüzdanın en eski imzası → o tx'te cüzdana SOL gönderen (yoksa fee payer) ----
async function solOrigin(wallet: string): Promise<Origin | null> {
  const conn = solConn();
  await throttle('sol-rpc', 120);
  const sigs = await conn.getSignaturesForAddress(new PublicKey(wallet), { limit: 1000 });
  if (!sigs.length) return null;
  if (sigs.length >= 1000) return { funder: null, firstTs: null }; // eski/yoğun cüzdan → taze değil, köken bilinmiyor
  const oldest = sigs[sigs.length - 1];
  await throttle('sol-rpc', 120);
  const tx = await conn.getParsedTransaction(oldest.signature, { maxSupportedTransactionVersion: 0 });
  const firstTs = (oldest.blockTime ?? tx?.blockTime ?? 0) * 1000 || null;
  if (!tx) return { funder: null, firstTs };
  const ixs = [...tx.transaction.message.instructions, ...(tx.meta?.innerInstructions ?? []).flatMap((i) => i.instructions)];
  for (const ix of ixs as any[]) {
    const p = ix.parsed;
    if (ix.program === 'system' && (p?.type === 'transfer' || p?.type === 'transferWithSeed') && p.info?.destination === wallet) return { funder: p.info.source, firstTs };
  }
  const payer = tx.transaction.message.accountKeys[0]?.pubkey.toBase58() ?? null;
  return { funder: payer && payer !== wallet ? payer : null, firstTs };
}

// ---- EVM: Etherscan v2 ilk tx (asc) → gelen tx ise from = fonlayıcı ----
async function evmOrigin(chain: Chain, wallet: string): Promise<Origin | null> {
  const key = env('ETHERSCAN_API_KEY', false);
  const id = ETHERSCAN_ID[chain];
  if (!key || !id) return null;
  await throttle('etherscan', 220); // ücretsiz katman 5 istek/sn
  const r = await getJson<any>(
    `https://api.etherscan.io/v2/api?chainid=${id}&module=account&action=txlist&address=${wallet}&startblock=0&endblock=99999999&page=1&offset=1&sort=asc&apikey=${key}`,
  );
  const tx = Array.isArray(r?.result) ? r.result[0] : null;
  if (!tx) return null; // hata ya da hiç dış tx yok (ör. yalnız internal tx ile fonlanmış)
  const incoming = String(tx.to).toLowerCase() === wallet.toLowerCase();
  return { funder: incoming ? String(tx.from).toLowerCase() : null, firstTs: Number(tx.timeStamp) * 1000 };
}

async function isHub(chain: Chain, funder: string): Promise<boolean> {
  const k = `${chain}:${norm(chain, funder)}`;
  if (hubCache.has(k)) return hubCache.get(k)!;
  let hub = false;
  try {
    if (chain === 'solana') {
      await throttle('sol-rpc', 120);
      hub = (await solConn().getSignaturesForAddress(new PublicKey(funder), { limit: 1000 })).length >= 1000;
    } else if (isEvm(chain)) hub = (await evmProvider(chain).getTransactionCount(funder)) >= 1000;
  } catch {
    hub = false;
  }
  if (hubCache.size > 5000) hubCache.clear();
  hubCache.set(k, hub);
  return hub;
}
````

## `src/sources/gmgn.ts`

````ts
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
  const j = await getJson<any>(`${base.replace(/\/$/, '')}/token/${({ solana: 'sol', bsc: 'bsc', base: 'base', blast: 'blast', monad: 'monad' } as const)[chain]}/${token}`);
  const d = j.data ?? j;
  return {
    sniperPct: d.sniper_hold_rate != null ? Number(d.sniper_hold_rate) * 100 : undefined,
    smartBuyers: d.smart_buy_count != null ? Number(d.smart_buy_count) : undefined,
    kolBuyers: d.kol_buy_count != null ? Number(d.kol_buy_count) : undefined,
  };
}
````

## `src/sources/ohlcv.ts`

````ts
import { filtersFor, type Chain } from '../config.js';
import { getJson, throttle } from '../util.js';

const GECKO = 'https://api.geckoterminal.com/api/v2';

// İlk early_dump_window_min dakikadaki dump: launch'tan itibaren görülen zirveden (high) sonraki en düşük low'a düşüş %.
// Sniper/insider'ların ilk dakikalarda satıp grafiği "temizlenmiş" gibi göstermesini yakalar.
// Pencere henüz dolmadıysa eldeki dakikalarla hesaplanır; mum yoksa null (filtre elemez).
export async function earlyDumpPct(chain: Chain, pair: string, pairCreatedAt: number): Promise<number | null> {
  await throttle('gecko', 2100);
  const j = await getJson<any>(`${GECKO}/networks/${chain}/pools/${pair}/ohlcv/minute?aggregate=1&limit=100&currency=usd`);
  const list: number[][] = j?.data?.attributes?.ohlcv_list ?? [];
  const t0 = Math.floor(pairCreatedAt / 1000);
  const t1 = t0 + filtersFor(chain).early_dump_window_min * 60;
  const c = list.filter((x) => x[0] >= t0 - 60 && x[0] <= t1).sort((a, b) => a[0] - b[0]); // [ts, o, h, l, c, v]
  if (!c.length) return null;
  let peak = 0;
  let worst = 0;
  for (const [, , h, l] of c) {
    peak = Math.max(peak, h);
    if (peak > 0) worst = Math.max(worst, ((peak - l) / peak) * 100);
  }
  return worst;
}
````

## `src/sources/security.ts`

````ts
import { env, filtersFor, isEvm, type Chain, type EvmChain } from '../config.js';
import { BURN_ADDRS, EVM, HELIUS_RPC } from '../chains.js';
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
    creator: typeof r.creator === 'string' ? r.creator : null,
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

// ---------- EVM (BSC 56 / Base 8453 / Blast 81457 / Monad 143): GoPlus + honeypot.is ----------
export async function evmSecurity(chain: EvmChain, token: string, pair: string): Promise<Security> {
  const id = EVM[chain].id;
  const addr = token.toLowerCase();
  await throttle('goplus', 1100);
  const [g, hp] = await Promise.all([
    getJson<any>(`https://api.gopluslabs.io/api/v1/token_security/${id}?contract_addresses=${addr}`, {}, 15_000),
    chain === 'blast' || chain === 'monad'
      ? null // honeypot.is Blast/Monad'ı desteklemiyor
      : getJson<any>(`https://api.honeypot.is/v2/IsHoneypot?address=${addr}&chainID=${id}&pair=${pair}`, {}, 15_000).catch(
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
    t.is_anti_whale === '1' && t.anti_whale_modifiable === '1' && 'anti_whale_mod',
    t.trading_cooldown === '1' && 'trading_cooldown',
    t.personal_slippage_modifiable === '1' && 'personal_tax',
    t.external_call === '1' && 'external_call',
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
    creator: typeof t.creator_address === 'string' && t.creator_address ? t.creator_address : null,
  };
}

export async function security(chain: Chain, token: string, pair: string): Promise<Security> {
  if (chain === 'solana') return solanaSecurity(token);
  if (isEvm(chain)) return evmSecurity(chain, token, pair);
  throw new Error(`desteklenmeyen ağ: ${chain}`);
}

// GoPlus holder_count önbellekli olabilir; EVM'de büyüme sinyali bu yüzden daha kaba.
export async function holderCount(chain: Chain, token: string, pair: string): Promise<number | null> {
  if (chain === 'solana') return env('HELIUS_API_KEY', false) ? solanaHolderCount(token) : null;
  return isEvm(chain) ? (await evmSecurity(chain, token, pair)).holders : null;
}

export const lpOk = (s: Security, chain: Chain) => {
  const f = filtersFor(chain);
  return !f.require_lp_locked || s.lpLockedPct >= f.min_lp_locked_pct;
};
````

## `src/sources/sniper.ts`

````ts
import { PublicKey } from '@solana/web3.js';
import { Contract, id as keccakId, zeroPadValue, getAddress } from 'ethers';
import { filtersFor, isEvm, type Chain, type EvmChain } from '../config.js';
import { EVM, evmProvider, getLogsChunked, solConn } from '../chains.js';
import { norm, rugLinkPct } from '../trap.js';
import { jsonl, throttle } from '../util.js';
import { gmgnTokenStats } from './gmgn.js';

// Erken alıcı analizi (ilk sniper_slots slot / sniper_blocks blok):
// - pct: erken alıcıların BUGÜN tuttuğu arz %
// - holdMin: erken alıcıların medyan tutma süresi (satmayan = şu ana kadarki süre)
// - quickFlipPct: quick_flip_min içinde %50+ satan erken alıcı %
// - rugLinkPct: daha önce rug olmuş token'larda da erken alıcı olan cüzdan % (trap.ts)
// - bundledPct: dev'in ödediği (fee payer = dev) ya da launch slot/bloğunda alan erken alıcı %
// - devSoldPct: dev'in elindekinin satılan %'si — LP kilitli olsa bile dev token'ı pair'e boşaltabilir
// Her erken alıcı early_buyers.jsonl'e, dev devs.jsonl'e yazılır → rug korelasyonu, küme, dev geçmişi.
export interface SniperInfo {
  pct: number | null;
  buyers: number;
  wallets: string[];
  holdMin: number | null;
  quickFlipPct: number | null;
  rugLinkPct: number | null;
  bundledPct: number | null;
  dev: string | null;
  devSoldPct: number | null;
}

interface Buyer {
  wallet: string;
  buys: number;
  bought: number; // token birimi (SOL: ui, BSC: wei → Number yaklaşık)
  buyTs: number; // ms
  held: number;
  sold: boolean;
  holdMin: number;
  bundled: boolean;
  account?: string; // SOL token hesabı
}

interface Early {
  buyers: Buyer[];
  supply: number;
  dev: string | null;
  devSoldPct: number | null;
}

export async function sniperPct(chain: Chain, token: string, pair: string, pairCreatedAt: number, creator?: string | null): Promise<SniperInfo | null> {
  const g = await gmgnTokenStats(chain, token).catch(() => null);
  const r = await (chain === 'solana' ? solanaEarly(token, creator) : isEvm(chain) ? evmEarly(chain, token, pair, pairCreatedAt, creator) : null);
  if (!r) return g?.sniperPct != null ? { pct: g.sniperPct, buyers: 0, wallets: [], holdMin: null, quickFlipPct: null, rugLinkPct: null, bundledPct: null, dev: creator ?? null, devSoldPct: null } : null;
  const { buyers, supply, dev, devSoldPct } = r;
  for (const b of buyers) jsonl('early_buyers.jsonl', { chain, token, wallet: b.wallet, buys: b.buys, holdMin: Math.round(b.holdMin), sold: b.sold, bundled: b.bundled });
  if (dev) jsonl('devs.jsonl', { chain, token, dev, devSoldPct: devSoldPct == null ? null : Math.round(devSoldPct) });
  const others = buyers.filter((b) => !dev || norm(chain, b.wallet) !== norm(chain, dev));
  const n = buyers.length;
  const held = buyers.reduce((s, b) => s + b.held, 0);
  const holds = buyers.map((b) => b.holdMin).sort((a, b) => a - b);
  const wallets = buyers.map((b) => b.wallet);
  return {
    pct: g?.sniperPct ?? (n === 0 ? 0 : supply ? (held / supply) * 100 : null),
    buyers: n,
    wallets,
    holdMin: n ? holds[Math.floor(n / 2)] : null,
    quickFlipPct: n ? (buyers.filter((b) => b.sold && b.holdMin <= filtersFor(chain).quick_flip_min).length / n) * 100 : null,
    rugLinkPct: n ? rugLinkPct(chain, token, wallets) : null,
    bundledPct: others.length ? (others.filter((b) => b.bundled).length / others.length) * 100 : null,
    dev,
    devSoldPct,
  };
}

// ---- Solana ----
async function solanaEarly(mint: string, creator?: string | null): Promise<Early | null> {
  const conn = solConn();
  const mintPk = new PublicKey(mint);
  let before: string | undefined;
  const sigs: { signature: string; slot: number; err: unknown; blockTime?: number | null }[] = [];
  let exhausted = false;
  for (let i = 0; i < filtersFor('solana').sniper_sig_pages; i++) {
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
  const early = oldest.filter((s) => !s.err && s.slot <= firstSlot + filtersFor('solana').sniper_slots).slice(0, 60);

  const by = new Map<string, Buyer>();
  let dev = creator ?? null;
  let devInitial = 0;
  for (const s of early) {
    await throttle('sol-rpc', 120);
    const tx = await conn.getParsedTransaction(s.signature, { maxSupportedTransactionVersion: 0 });
    if (!tx?.meta) continue;
    const keys = tx.transaction.message.accountKeys;
    const feePayer = keys[0]?.pubkey.toBase58();
    if (!dev && s.signature === oldest[0].signature) dev = feePayer ?? null; // creator yoksa: oluşturma tx'inin ödeyicisi
    const pre = new Map<number, number>();
    for (const b of tx.meta.preTokenBalances ?? []) if (b.mint === mint) pre.set(b.accountIndex, b.uiTokenAmount.uiAmount ?? 0);
    for (const b of tx.meta.postTokenBalances ?? []) {
      if (b.mint !== mint || !b.owner) continue;
      const delta = (b.uiTokenAmount.uiAmount ?? 0) - (pre.get(b.accountIndex) ?? 0);
      if (b.owner === dev) devInitial = Math.max(devInitial, b.uiTokenAmount.uiAmount ?? 0);
      if (delta <= 0) continue;
      // bundle: dev başka cüzdana alım yaptırıyor (fee payer = dev) ya da oluşturma slot'unda alım
      const bundled = b.owner !== dev && (feePayer === dev || s.slot === firstSlot);
      const cur = by.get(b.owner);
      if (cur) {
        cur.buys++;
        cur.bought += delta;
        cur.bundled ||= bundled;
      } else if (by.size < filtersFor('solana').sniper_max_buyers) {
        by.set(b.owner, {
          bundled,
          wallet: b.owner,
          buys: 1,
          bought: delta,
          buyTs: (tx.blockTime ?? s.blockTime ?? 0) * 1000,
          held: 0,
          sold: false,
          holdMin: 0,
          account: keys[b.accountIndex]?.pubkey.toBase58(),
        });
      }
    }
  }
  const buyers = [...by.values()];

  // dev satışı: launch'taki en yüksek bakiye → bugün
  let devSoldPct: number | null = null;
  if (dev && devInitial > 0) {
    await throttle('sol-rpc', 120);
    const accts = await conn.getParsedTokenAccountsByOwner(new PublicKey(dev), { mint: mintPk }).catch(() => null);
    if (accts) {
      const now = accts.value.reduce((s, a) => s + Number(a.account.data.parsed.info.tokenAmount.uiAmount ?? 0), 0);
      devSoldPct = Math.max(0, ((devInitial - now) / devInitial) * 100);
    }
  }
  if (!buyers.length) return { buyers, supply: 0, dev, devSoldPct };

  await throttle('sol-rpc', 120);
  const supply = (await conn.getTokenSupply(mintPk)).value.uiAmount ?? 0;
  const now = Date.now();
  for (const b of buyers) {
    await throttle('sol-rpc', 120);
    const accts = await conn.getParsedTokenAccountsByOwner(new PublicKey(b.wallet), { mint: mintPk });
    b.held = accts.value.reduce((s, a) => s + Number(a.account.data.parsed.info.tokenAmount.uiAmount ?? 0), 0);
    b.sold = b.held < b.bought * 0.5;
    let endTs = now;
    if (b.sold && b.account) {
      // token hesabının alımdan sonraki ilk işlemi ≈ satış zamanı
      await throttle('sol-rpc', 120);
      const hist = await conn.getSignaturesForAddress(new PublicKey(b.account), { limit: 1000 }).catch(() => []);
      const after = hist.map((h) => (h.blockTime ?? 0) * 1000).filter((t) => t > b.buyTs);
      if (after.length) endTs = Math.min(...after);
    }
    b.holdMin = b.buyTs ? Math.max(0, (endTs - b.buyTs) / 60_000) : 0;
  }
  return { buyers, supply, dev, devSoldPct };
}

const ERC20 = ['function balanceOf(address) view returns (uint256)', 'function totalSupply() view returns (uint256)'];
const TRANSFER = keccakId('Transfer(address,address,uint256)');
const LOG_CHUNK = 2000;

async function blockAt(chain: EvmChain, tsSec: number): Promise<number> {
  const p = evmProvider(chain);
  let hi = await p.getBlockNumber();
  let lo = Math.max(0, hi - Math.ceil((8 * 3600) / EVM[chain].secPerBlock)); // ~8 saat; max_pair_age bunun altında
  while (lo < hi) {
    const mid = Math.floor((lo + hi) / 2);
    const b = await p.getBlock(mid);
    if (!b || b.timestamp < tsSec) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

// ---- EVM (BSC/Base/Blast/Monad): Transfer(pair → alıcı) logları ----
async function evmEarly(chain: EvmChain, token: string, pair: string, pairCreatedAt: number, creator?: string | null): Promise<Early | null> {
  if (!pairCreatedAt) return null;
  const f = filtersFor(chain);
  const p = evmProvider(chain);
  const pairTopic = zeroPadValue(pair, 32);
  const start = (await blockAt(chain, Math.floor(pairCreatedAt / 1000))) - 20;
  const logs = await getLogsChunked(chain, { address: token, topics: [TRANSFER, pairTopic], fromBlock: start, toBlock: start + 20 + f.sniper_blocks + 40 });
  if (!logs.length) return null;
  const first = logs[0].blockNumber;

  const by = new Map<string, Buyer & { buyBlock: number }>();
  for (const l of logs) {
    if (l.blockNumber > first + f.sniper_blocks) break;
    const w = getAddress('0x' + l.topics[2].slice(26));
    const amt = Number(BigInt(l.data));
    const cur = by.get(w);
    if (cur) {
      cur.buys++;
      cur.bought += amt;
    } else if (by.size < f.sniper_max_buyers) {
      by.set(w, { wallet: w, buys: 1, bought: amt, buyTs: 0, buyBlock: l.blockNumber, held: 0, sold: false, holdMin: 0, bundled: l.blockNumber === first }); // launch bloğunda = bundle
    }
  }
  const buyers = [...by.values()];
  const dev = creator ? getAddress(creator) : null;
  if (!buyers.length && !dev) return { buyers: [], supply: 0, dev, devSoldPct: null };

  const head = await p.getBlockNumber();
  const [b0, b1] = await Promise.all([p.getBlock(first), p.getBlock(head)]);
  const secPerBlock = b0 && b1 && head > first ? (b1.timestamp - b0.timestamp) / (head - first) : EVM[chain].secPerBlock;
  const firstTs = (b0?.timestamp ?? Math.floor(pairCreatedAt / 1000)) * 1000;

  const c = new Contract(token, ERC20, p);
  const supply = Number((await c.totalSupply()) as bigint);
  for (const b of buyers) {
    b.buyTs = firstTs + (b.buyBlock - first) * secPerBlock * 1000;
    b.held = Number((await c.balanceOf(b.wallet)) as bigint);
    b.sold = b.held < b.bought * 0.5;
  }

  // satış = erken alıcıdan pair'e ilk Transfer (yalnız satanlar için tarama).
  // Dev → pair transferleri de toplanır (launch bloğundan sonra; ilk likidite ekleme hariç) → devSoldPct.
  const sellers = buyers.filter((b) => b.sold);
  const firstSell = new Map<string, number>();
  let devSold = 0n;
  const devBal = dev ? ((await c.balanceOf(dev)) as bigint) : 0n;
  const from0 = [...sellers.map((b) => b.wallet), ...(dev ? [dev] : [])];
  if (from0.length) {
    const fromTopics = [...new Set(from0)].map((w) => zeroPadValue(w, 32));
    const chunk = Math.min(LOG_CHUNK, EVM[chain].logRange ?? LOG_CHUNK);
    for (let from = first + 1; from <= head; from += chunk) {
      const sells = await p.getLogs({ address: token, topics: [TRANSFER, fromTopics, pairTopic], fromBlock: from, toBlock: Math.min(head, from + chunk - 1) });
      for (const l of sells) {
        const w = getAddress('0x' + l.topics[1].slice(26));
        if (w === dev) devSold += BigInt(l.data);
        if (!firstSell.has(w)) firstSell.set(w, l.blockNumber);
      }
      if (!dev && firstSell.size >= sellers.length) break;
    }
  }
  const devSoldPct = dev && devSold + devBal > 0n ? Number((devSold * 10_000n) / (devSold + devBal)) / 100 : null;
  for (const b of buyers) {
    const endBlock = b.sold ? (firstSell.get(b.wallet) ?? head) : head;
    b.holdMin = Math.max(0, ((endBlock - b.buyBlock) * secPerBlock) / 60);
  }
  return { buyers, supply, dev, devSoldPct };
}
````

## `src/sources/wash.ts`

````ts
import { id as keccakId, zeroPadValue, getAddress } from 'ethers';
import { cfg, env, isEvm, type Chain, type EvmChain } from '../config.js';
import { EVM, evmProvider, getLogsChunked } from '../chains.js';
import { getJson, jsonl, throttle } from '../util.js';

// Wash trading: küçük bir cüzdan grubu (wash_group_max) wash_window_sec içinde hem alıp hem satıyor
// ve bu grup son trade'lerin max_wash_trade_pct'sinden fazlasını oluşturuyorsa hacim sahte sayılır.
export interface Trade {
  wallet: string;
  side: 'buy' | 'sell';
  ts: number; // ms
  block?: number; // Solana slot / EVM blok — aynı-blok senkron işlem tespiti
}

export interface WashInfo {
  washWallets: number; // gruptaki round-trip cüzdan sayısı
  washTradePct: number; // grubun trade'lerinin toplam trade'e oranı
  trades: number;
  group: string[]; // round-trip grubundaki cüzdanlar (wash_groups.jsonl → wash halkası tespiti)
  sync: SyncInfo;
}

// Senkron cüzdanlar: aynı slot/blokta aynı yönde ≥ sync_min_wallets farklı cüzdan = koordineli grup
// (bundle bot, bubble-map farm, tek operatörün çoklu cüzdanı). Tek seferlik çakışma popüler token'da doğaldır;
// asıl işaret aynı cüzdan çiftlerinin defalarca birlikte görünmesi (repeat) ve bu grubun başka token'larda da olması.
export interface SyncInfo {
  syncBlocks: number; // senkron blok sayısı
  syncTradePct: number; // senkron bloklardaki trade'lerin toplam trade'e oranı
  syncMaxWallets: number; // tek blokta en fazla farklı cüzdan (aynı yön)
  syncRepeatWallets: number; // ≥ sync_repeat_min kez birlikte senkron işlem yapan çiftlerdeki farklı cüzdan
  group: string[]; // en çok senkron görülen cüzdanlar (sync_groups.jsonl → senkron halka geçmişi)
}

export function detectSync(trades: Trade[], minWallets = cfg.filters.sync_min_wallets ?? 3, repeatMin = cfg.filters.sync_repeat_min ?? 3): SyncInfo {
  const buckets = new Map<string, Set<string>>();
  const counts = new Map<string, number>();
  for (const t of trades) {
    const k = `${t.block ?? Math.floor(t.ts / 1000)}:${t.side}`;
    (buckets.get(k) ?? buckets.set(k, new Set()).get(k)!).add(t.wallet);
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  const sync = [...buckets].filter(([, s]) => s.size >= minWallets);
  const pairs = new Map<string, number>();
  const seen = new Map<string, number>();
  for (const [, s] of sync) {
    const ws = [...s].sort().slice(0, 30); // çok kalabalık blokta çift patlaması yok
    for (const w of ws) seen.set(w, (seen.get(w) ?? 0) + 1);
    for (let i = 0; i < ws.length; i++) for (let j = i + 1; j < ws.length; j++) pairs.set(`${ws[i]}|${ws[j]}`, (pairs.get(`${ws[i]}|${ws[j]}`) ?? 0) + 1);
  }
  const repeat = new Set<string>();
  for (const [k, n] of pairs) if (n >= repeatMin) for (const w of k.split('|')) repeat.add(w);
  const syncTrades = sync.reduce((s, [k]) => s + (counts.get(k) ?? 0), 0);
  return {
    syncBlocks: sync.length,
    syncTradePct: trades.length ? (syncTrades / trades.length) * 100 : 0,
    syncMaxWallets: Math.max(0, ...[...buckets.values()].map((s) => s.size)),
    syncRepeatWallets: repeat.size,
    group: (repeat.size ? [...repeat] : [...seen.keys()]).sort((a, b) => (seen.get(b) ?? 0) - (seen.get(a) ?? 0)).slice(0, 12),
  };
}

export function detectWash(trades: Trade[], windowSec = cfg.filters.wash_window_sec, groupMax = cfg.filters.wash_group_max): WashInfo {
  const by = new Map<string, Trade[]>();
  for (const t of trades) (by.get(t.wallet) ?? by.set(t.wallet, []).get(t.wallet)!).push(t);
  const roundTrip: { wallet: string; n: number }[] = [];
  for (const [wallet, ts] of by) {
    const buys = ts.filter((t) => t.side === 'buy').map((t) => t.ts);
    const sells = ts.filter((t) => t.side === 'sell').map((t) => t.ts);
    if (buys.some((b) => sells.some((s) => Math.abs(s - b) <= windowSec * 1000))) roundTrip.push({ wallet, n: ts.length });
  }
  const group = roundTrip.sort((a, b) => b.n - a.n).slice(0, groupMax);
  const groupTrades = group.reduce((s, g) => s + g.n, 0);
  return { washWallets: group.length, washTradePct: trades.length ? (groupTrades / trades.length) * 100 : 0, trades: trades.length, group: group.map((g) => g.wallet), sync: detectSync(trades) };
}

export async function washCheck(chain: Chain, token: string, pair: string): Promise<WashInfo | null> {
  const trades = chain === 'solana' ? await solanaTrades(token, pair) : isEvm(chain) ? await evmTrades(chain, token, pair) : null;
  if (!trades || trades.length < 10) return null; // az trade → karar verilemez
  const w = detectWash(trades);
  if (w.group.length >= 2) jsonl('wash_groups.jsonl', { chain, token, wallets: w.group, pct: Math.round(w.washTradePct) });
  if (w.sync.syncRepeatWallets >= 2)
    jsonl('sync_groups.jsonl', { chain, token, wallets: w.sync.group, pct: Math.round(w.sync.syncTradePct), repeat: w.sync.syncRepeatWallets, max: w.sync.syncMaxWallets });
  return w;
}

// Helius Enhanced Transactions: pool adresindeki son SWAP'lar; trader = feePayer.
async function solanaTrades(mint: string, pair: string): Promise<Trade[] | null> {
  const key = env('HELIUS_API_KEY', false);
  if (!key) return null;
  await throttle('helius-api', 250);
  const txs = await getJson<any[]>(`https://api.helius.xyz/v0/addresses/${pair}/transactions?api-key=${key}&type=SWAP&limit=100`);
  const out: Trade[] = [];
  for (const tx of txs ?? []) {
    const fp: string = tx.feePayer;
    for (const t of tx.tokenTransfers ?? []) {
      if (t.mint !== mint) continue;
      if (t.toUserAccount === fp) out.push({ wallet: fp, side: 'buy', ts: tx.timestamp * 1000, block: tx.slot });
      else if (t.fromUserAccount === fp) out.push({ wallet: fp, side: 'sell', ts: tx.timestamp * 1000, block: tx.slot });
      else continue;
      break;
    }
  }
  return out;
}

const TRANSFER = keccakId('Transfer(address,address,uint256)');
const LOOKBACK_SEC = 300; // ~5 dk

// pair → cüzdan = alım, cüzdan → pair = satış
async function evmTrades(chain: EvmChain, token: string, pair: string): Promise<Trade[] | null> {
  const p = evmProvider(chain);
  const head = await p.getBlockNumber();
  const span = Math.ceil(LOOKBACK_SEC / EVM[chain].secPerBlock);
  const from = head - span;
  const pt = zeroPadValue(pair, 32);
  const [buys, sells, bHead, bFrom] = await Promise.all([
    getLogsChunked(chain, { address: token, topics: [TRANSFER, pt], fromBlock: from, toBlock: head }),
    getLogsChunked(chain, { address: token, topics: [TRANSFER, null, pt], fromBlock: from, toBlock: head }),
    p.getBlock(head),
    p.getBlock(from),
  ]);
  if (!bHead || !bFrom) return null;
  const spb = (bHead.timestamp - bFrom.timestamp) / span;
  const ts = (n: number) => (bFrom.timestamp + (n - from) * spb) * 1000;
  const lp = pair.toLowerCase();
  const out: Trade[] = [];
  for (const l of buys) out.push({ wallet: getAddress('0x' + l.topics[2].slice(26)), side: 'buy', ts: ts(l.blockNumber), block: l.blockNumber });
  for (const l of sells) {
    const w = getAddress('0x' + l.topics[1].slice(26));
    if (w.toLowerCase() !== lp) out.push({ wallet: w, side: 'sell', ts: ts(l.blockNumber), block: l.blockNumber });
  }
  return out;
}
````

## `src/state.ts`

````ts
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
  riskScale?: Partial<Record<Chain, number>>; // Sabah Raporu önerisi (auto_scale) — 1 = config tavanı
}

const FILE = path.join(DATA_DIR, 'state.json');

const freshDaily = (): Daily => ({ day: utcDay(), realized: Object.fromEntries(CHAINS.map((c) => [c, 0])) as Record<Chain, number>, trades: 0, consecutiveLosses: 0, lastLossAt: 0 });

function load(): State {
  if (fs.existsSync(FILE)) {
    // yeni eklenen ağlar (ör. base) eski state.json'da yok → varsayılanla tamamla
    const s: State = JSON.parse(fs.readFileSync(FILE, 'utf8'));
    for (const c of CHAINS) {
      s.paperBalance[c] ??= riskFor(c).paper_start_balance;
      s.daily.realized[c] ??= 0;
    }
    return s;
  }
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
````

## `src/telegram.ts`

````ts
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
````

## `src/tracker.ts`

````ts
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
````

## `src/trap.ts`

````ts
// Tuzak tespiti: kendi geçmişinden (early_buyers / devs / wash_groups / outcomes / wallet_events)
// rug ortağı cüzdanları, wash halkalarını, dev+sniper hibritlerini ve tekrar eden rug kümelerini skorlar.
// Hem sinyal anında (scanner) hem raporda (nightly, discover-wallets) aynı skorlar kullanılır.
import { CHAINS, cfg, normAddr, wallets, type Chain } from './config.js';
import { loadRows } from './optimizer.js';
import { trapRisk } from './smartmoney.js';
import type { Metrics } from './types.js';
import { readJsonl } from './util.js';

export const RUG_MIN_PCT = -80;
const CACHE_MS = 10 * 60_000;

export const norm = normAddr;
const tk = (chain: string, token: string) => `${chain}:${norm(chain, token)}`;

interface WalletHist {
  chain: string;
  address: string;
  tokens: Set<string>; // erken alıcı olduğu token'lar
  rugTokens: Set<string>; // bunlardan rug olanlar
  soldInRug: number; // rug token'ında analiz anında zaten satmıştı
  maxBuys: number; // tek token'da ilk slot/bloklarda en fazla alım
  quickFlips: number;
  devOf: Set<string>; // dev olduğu token'lar
  devRugs: number;
  washTokens: Set<string>; // wash grubunda göründüğü token'lar
  syncTokens: Set<string>; // senkron (aynı blok, tekrarlayan) grupta göründüğü token'lar
  fundedTokens: Set<string>; // bu cüzdanın ≥2 erken alıcıyı fonladığı token'lar (funders.jsonl)
  rugPartners: Map<string, number>; // aynı rug'da birlikte erken alan cüzdan → kaç rug
}

interface Hist {
  at: number;
  finished: number;
  rugged: Set<string>;
  earlyByToken: Map<string, Set<string>>; // chain:token → erken alıcı (norm)
  wallets: Map<string, WalletHist>; // chain:wallet
}

let cache: Hist | null = null;

export function history(force = false): Hist {
  if (!force && cache && Date.now() - cache.at < CACHE_MS) return cache;
  const rugged = new Set<string>();
  let finished = 0;
  for (const o of readJsonl<any>('outcomes.jsonl')) {
    finished++;
    if (o.minPct <= RUG_MIN_PCT) rugged.add(tk(o.chain, o.token));
  }
  const ws = new Map<string, WalletHist>();
  const get = (chain: string, a: string) => {
    const k = `${chain}:${norm(chain, a)}`;
    let w = ws.get(k);
    if (!w)
      ws.set(
        k,
        (w = { chain, address: a, tokens: new Set(), rugTokens: new Set(), soldInRug: 0, maxBuys: 0, quickFlips: 0, devOf: new Set(), devRugs: 0, washTokens: new Set(), syncTokens: new Set(), fundedTokens: new Set(), rugPartners: new Map() }),
      );
    return w;
  };

  const earlyByToken = new Map<string, Set<string>>();
  for (const e of readJsonl<any>('early_buyers.jsonl')) {
    const t = tk(e.chain, e.token);
    const w = get(e.chain, e.wallet);
    if (w.tokens.has(t)) continue;
    w.tokens.add(t);
    w.maxBuys = Math.max(w.maxBuys, e.buys ?? 1);
    if (e.sold && (e.holdMin ?? Infinity) <= cfg.filters.quick_flip_min) w.quickFlips++;
    if (rugged.has(t)) {
      w.rugTokens.add(t);
      if (e.sold) w.soldInRug++;
    }
    (earlyByToken.get(t) ?? earlyByToken.set(t, new Set()).get(t)!).add(norm(e.chain, e.wallet));
  }
  for (const d of readJsonl<any>('devs.jsonl')) {
    if (!d.dev) continue;
    const w = get(d.chain, d.dev);
    const t = tk(d.chain, d.token);
    if (w.devOf.has(t)) continue;
    w.devOf.add(t);
    if (rugged.has(t)) w.devRugs++;
  }
  for (const g of readJsonl<any>('wash_groups.jsonl')) for (const a of g.wallets ?? []) get(g.chain, a).washTokens.add(tk(g.chain, g.token));
  for (const g of readJsonl<any>('funders.jsonl')) if (g.funder) get(g.chain, g.funder).fundedTokens.add(tk(g.chain, g.token));
  for (const g of readJsonl<any>('sync_groups.jsonl')) for (const a of g.wallets ?? []) get(g.chain, a).syncTokens.add(tk(g.chain, g.token));

  // rug kümeleri: aynı rug'da birlikte erken alan çiftler
  for (const t of rugged) {
    const set = [...(earlyByToken.get(t) ?? [])];
    const chain = t.slice(0, t.indexOf(':'));
    for (const a of set) {
      const w = ws.get(`${chain}:${a}`)!;
      for (const b of set) if (a !== b) w.rugPartners.set(b, (w.rugPartners.get(b) ?? 0) + 1);
    }
  }
  return (cache = { at: Date.now(), finished, rugged, earlyByToken, wallets: ws });
}

// ---------- cüzdan şüphe skoru (0–100) ----------
export type SuspectKind = 'rug_accomplice' | 'smart_trap' | 'sniper_bot' | 'dev_sniper' | 'serial_dev' | 'wash_ring' | 'rug_cluster' | 'sync_ring' | 'funder_ring';

export interface Suspect {
  chain: string;
  address: string;
  label?: string; // wallets.yaml'daysa
  score: number;
  kinds: SuspectKind[];
  reasons: string[];
}

export function walletSuspicion(w: WalletHist): Suspect {
  const kinds: SuspectKind[] = [];
  const reasons: string[] = [];
  let s = 0;
  const rugs = w.rugTokens.size;
  if (rugs >= 2) {
    const rate = rugs / w.tokens.size;
    s += 20 + 30 * rate;
    kinds.push('rug_accomplice');
    reasons.push(`${rugs}/${w.tokens.size} erken girişi rug`);
    if (w.soldInRug / rugs >= 0.5) {
      s += 25;
      kinds.push('smart_trap');
      reasons.push(`rug'ların ${w.soldInRug}'inde rug'dan önce sattı`);
    }
  }
  if (w.maxBuys > 3) {
    s += 15;
    kinds.push('sniper_bot');
    reasons.push(`tek token'da ${w.maxBuys} erken alım`);
  }
  const otherTokens = [...w.tokens].filter((t) => !w.devOf.has(t)).length;
  if (w.devOf.size && otherTokens) {
    s += 25;
    kinds.push('dev_sniper');
    reasons.push(`${w.devOf.size} token'ın dev'i + ${otherTokens} başka token'da erken alıcı`);
  }
  if (w.devRugs >= 1) {
    s += 20 + 15 * Math.min(w.devRugs, 3);
    kinds.push('serial_dev');
    reasons.push(`dev'i olduğu ${w.devRugs} token rug`);
  }
  if (w.washTokens.size >= 2) {
    s += 25;
    kinds.push('wash_ring');
    reasons.push(`${w.washTokens.size} token'da wash grubunda`);
  } else if (w.washTokens.size === 1) {
    s += 10;
    reasons.push('1 token\'da wash grubunda');
  }
  if (w.syncTokens.size >= 2) {
    const syncRugs = [...w.syncTokens].filter((t) => history().rugged.has(t)).length;
    s += 20 + (syncRugs ? 15 : 0);
    kinds.push('sync_ring');
    reasons.push(`${w.syncTokens.size} token'da senkron grupta${syncRugs ? ` (${syncRugs} rug)` : ''}`);
  }
  if (w.fundedTokens.size >= 2) {
    const fr = [...w.fundedTokens].filter((t) => history().rugged.has(t)).length;
    s += 25 + 15 * Math.min(fr, 2);
    kinds.push('funder_ring');
    reasons.push(`${w.fundedTokens.size} token'da erken alıcıları fonladı${fr ? ` (${fr} rug)` : ''}`);
  }
  const partners = [...w.rugPartners.values()].filter((n) => n >= cfg.filters.cluster_min_rugs).length;
  if (partners >= cfg.filters.cluster_min_shared - 1) {
    s += 25;
    kinds.push('rug_cluster');
    reasons.push(`${partners} cüzdanla ≥${cfg.filters.cluster_min_rugs} rug'da birlikte erken`);
  }
  if (w.quickFlips >= 3) {
    s += 10;
    reasons.push(`${w.quickFlips} hızlı satış`);
  }
  return { chain: w.chain, address: w.address, score: Math.min(100, Math.round(s)), kinds, reasons };
}

const trackedLabel = new Map(CHAINS.flatMap((c) => wallets[c]).map((w) => [w.address.toLowerCase(), w.label]));

export function suspects(minScore = 40): Suspect[] {
  return [...history().wallets.values()]
    .map(walletSuspicion)
    .filter((x) => x.score >= minScore)
    .map((x) => ({ ...x, label: trackedLabel.get(x.address.toLowerCase()) }))
    .sort((a, b) => b.score - a.score);
}

export const suspicionOf = (chain: string, a: string) => {
  const w = history().wallets.get(`${chain}:${norm(chain, a)}`);
  return w ? walletSuspicion(w).score : 0;
};

// ---------- sinyal anı kontrolleri ----------
export function rugLinkPct(chain: Chain, token: string, ws: string[]): number | null {
  const h = history();
  if (!h.finished || !ws.length) return null; // geçmiş yok → bilinmiyor (filtre elemez)
  const self = tk(chain, token);
  const linked = ws.filter((a) => [...(h.wallets.get(`${chain}:${norm(chain, a)}`)?.rugTokens ?? [])].some((t) => t !== self)).length;
  return (linked / ws.length) * 100;
}

// Aynı ≥ cluster_min_shared erken alıcı kaç önceki rug'da birlikte erken girdi?
// Senkron grubun, kendi dışında rug olmuş bir token'da da senkron görülen kısmı (%)
export function syncRugLinkPct(chain: Chain, token: string, ws: string[]): number | null {
  const h = history();
  if (!h.finished || !ws.length) return null;
  const self = tk(chain, token);
  const linked = ws.filter((a) => [...(h.wallets.get(`${chain}:${norm(chain, a)}`)?.syncTokens ?? [])].some((t) => t !== self && h.rugged.has(t))).length;
  return (linked / ws.length) * 100;
}

// Launchpad erken satış oranı: bu ağ+launchpad'den son 14 günde erken dump (≥ max_early_dump_pct) ya da rug olan
// aday %. Botun kendi candidates/outcomes kayıtlarından; <10 örnekte null (bilinmiyor, ceza yok).
let lpCache: { at: number; m: Map<string, number | null> } | null = null;
export function launchpadDumpPct(chain: Chain, launchpad?: string): number | null {
  if (!launchpad) return null;
  if (!lpCache || Date.now() - lpCache.at > CACHE_MS) {
    const h = history();
    const since = Date.now() - 14 * 86_400_000;
    const agg = new Map<string, { n: number; bad: number }>();
    const seen = new Set<string>();
    for (const c of readJsonl<any>('candidates.jsonl')) {
      const t = tk(c.chain, c.token);
      if (!c.launchpad || seen.has(t) || Date.parse(c.ts) < since || c.metrics?.earlyDumpPct == null) continue;
      seen.add(t);
      const k = `${c.chain}:${c.launchpad}`;
      const e = agg.get(k) ?? agg.set(k, { n: 0, bad: 0 }).get(k)!;
      e.n++;
      if (c.metrics.earlyDumpPct >= cfg.filters.max_early_dump_pct || h.rugged.has(t)) e.bad++;
    }
    lpCache = { at: Date.now(), m: new Map([...agg].map(([k, e]) => [k, e.n >= 10 ? (e.bad / e.n) * 100 : null])) };
  }
  return lpCache.m.get(`${chain}:${launchpad}`) ?? null;
}

export function suspectOf(chain: string, a: string): Suspect | null {
  const w = history().wallets.get(`${chain}:${norm(chain, a)}`);
  return w ? walletSuspicion(w) : null;
}

// Ortak fonlayıcının, kendi dışında rug olmuş kaç token'da erken alıcı fonladığı
export function funderPrevRugs(chain: Chain, token: string, funder: string): number | null {
  const h = history();
  if (!h.finished) return null;
  const w = h.wallets.get(`${chain}:${norm(chain, funder)}`);
  const self = tk(chain, token);
  return w ? [...w.fundedTokens].filter((t) => t !== self && h.rugged.has(t)).length : 0;
}

export function clusterCheck(chain: Chain, token: string, ws: string[]): { rugs: number; maxShared: number } | null {
  const h = history();
  if (!h.finished || !ws.length) return null;
  const self = tk(chain, token);
  const mine = new Set(ws.map((a) => norm(chain, a)));
  let rugs = 0;
  let maxShared = 0;
  for (const t of h.rugged) {
    if (t === self || !t.startsWith(chain + ':')) continue;
    const shared = [...(h.earlyByToken.get(t) ?? [])].filter((a) => mine.has(a)).length;
    maxShared = Math.max(maxShared, shared);
    if (shared >= cfg.filters.cluster_min_shared) rugs++;
  }
  return { rugs, maxShared };
}

export function devPrevRugs(chain: Chain, token: string, dev: string | null | undefined): number | null {
  if (!dev) return null;
  const w = history().wallets.get(`${chain}:${norm(chain, dev)}`);
  if (!w) return 0;
  const self = tk(chain, token);
  return [...w.devOf].filter((t) => t !== self && history().rugged.has(t)).length;
}

export function suspectEarlyPct(chain: Chain, ws: string[]): number | null {
  if (!history().finished || !ws.length) return null;
  return (ws.filter((a) => suspicionOf(chain, a) >= cfg.filters.suspect_wallet_score).length / ws.length) * 100;
}

// Dev+sniper hibrit: erken alıcılardan kaçı başka token'ların dev'i (kendi geçmişimizden)?
export function devLinkedEarlyPct(chain: Chain, token: string, ws: string[]): number | null {
  const h = history();
  if (!h.finished || !ws.length) return null;
  const self = tk(chain, token);
  const n = ws.filter((a) => [...(h.wallets.get(`${chain}:${norm(chain, a)}`)?.devOf ?? [])].some((t) => t !== self)).length;
  return (n / ws.length) * 100;
}

// İzlenen smart/KOL cüzdanlardan son rug'larda ≥2 kez rug'dan önce satanlar (10 dk önbellek).
let trapCache: { at: number; labels: Set<string> } | null = null;
export function trapLabels(): Set<string> {
  if (trapCache && Date.now() - trapCache.at < CACHE_MS) return trapCache.labels;
  const t = trapRisk(loadRows(), 10);
  return (trapCache = { at: Date.now(), labels: new Set(t.wallets.filter((w) => w.front >= 2).map((w) => w.label)) }).labels;
}

// ---------- sinyal tuzak skoru (0–100, sert) ----------
// Ağırlık toplamı 100'ü çok aşar: tek güçlü işaret (dev'in eski rug'u, tuzak cüzdan) ~40,
// iki orta işaret max_trap_score'u (varsayılan 50) geçirir. Kilit veri eksikse (null) küçük ceza:
// "bilinmiyor" güvenli sayılmaz.
const lin = (v: number | null | undefined, full: number) => (v == null ? 0 : Math.min(1, Math.max(0, v / full)));

export function signalTrapScore(m: Metrics): { score: number; parts: Record<string, number> } {
  const cr = m.clusterRugs ?? 0;
  const p: Record<string, number> = {
    rug_link: 30 * lin(m.sniperRugLinkPct, 15),
    quick_flip: 20 * lin(m.sniperQuickFlipPct, 40),
    short_hold: m.sniperHoldMin == null ? 0 : 15 * (1 - lin(m.sniperHoldMin - 3, 27)),
    dev_sold: 30 * lin(m.devSoldPct, 20),
    dev_prev_rug: m.devPrevRugs ? 40 : 0,
    early_dump: 20 * lin(m.earlyDumpPct, 35),
    rug_cluster: cr >= cfg.filters.cluster_min_rugs ? 35 : cr === 1 ? 12 : 0,
    bundled: 20 * lin(m.sniperBundledPct, 15),
    suspect_early: 25 * lin(m.suspectEarlyPct, 15),
    dev_sniper: 25 * lin(m.devLinkedEarlyPct, 10),
    trap_wallet: m.trapWallets?.length ? 40 : 0,
    wash: 15 * lin(m.washTradePct, 15),
    // senkron trade% popüler token'da doğal olarak ~%40 (1 Kas ölçümü) → yalnız %40 üstü sayılır
    sync: 10 * lin((m.syncTradePct ?? 0) - 40, 30) + 20 * lin(m.syncRepeatWallets, 6),
    sync_rug: 30 * lin(m.syncRugLinkPct, 20),
    // fonlama kümesi: Bubblemaps ölçeği — bundle/küme arzı %5–15 orta, >%15 ciddi
    common_funder: 30 * lin(m.fundCommonPct, 30),
    fund_dev: 35 * lin(m.fundDevPct, 10),
    fresh: 15 * lin((m.fundFreshPct ?? 0) - 30, 50),
    funder_rug: m.fundPrevRugs ? 45 : 0,
    smart_sync: (m.smartSynced?.length ?? 0) >= 2 ? 20 : 0,
    // launchpad erken satış oranı: geçmişte bu launchpad'in adaylarının çoğu ilk dakikalarda dump/rug olduysa
    launchpad_dump: 25 * lin((m.launchpadDumpPct ?? 0) - 30, (cfg.filters.max_launchpad_dump_pct ?? 60) - 30),
  };
  // yalnız tam kontrole (sniper analizi) giren sinyalde eksik veri cezası
  if (m.sniperBuyers != null || m.sniperPct != null) {
    const unknown = [m.sniperQuickFlipPct, m.sniperBundledPct, m.devSoldPct, m.earlyDumpPct, m.washTradePct].filter((x) => x == null).length;
    p.unknown = Math.min(16, 4 * unknown) + (cfg.filters.unknown_trap_penalty ?? 0) * unknown;
  }
  for (const k of Object.keys(p)) if (!p[k]) delete p[k];
  for (const k of Object.keys(p)) p[k] = Math.round(p[k]);
  return { score: Math.min(100, Object.values(p).reduce((s, x) => s + x, 0)), parts: p };
}

// ---------- birleşik kurallar (skordan bağımsız, tek başına eler) ----------
// Tek işaret eşiğin altında kalsa bile birlikte görülünce bilinen tuzak kalıbı:
export function comboFlags(m: Metrics): string[] {
  const out: string[] = [];
  const v = (x: number | null | undefined) => x ?? 0;
  const tracked = m.smartWallets.length + m.kolWallets.length;
  if ((v(m.devSoldPct) >= 10 && v(m.sniperBundledPct) >= 15) || (v(m.devLinkedEarlyPct) >= 1 && v(m.sniperBundledPct) >= 15)) out.push('dev_sniper_hybrid');
  if ((tracked && (m.trapWallets?.length ?? 0) / tracked >= 0.5) || (m.trapWallets?.length && (v(m.sniperQuickFlipPct) >= 30 || v(m.earlyDumpPct) >= 25))) out.push('smart_trap');
  if (v(m.washTradePct) >= 10 && v(m.suspectEarlyPct) >= 10) out.push('wash_ring');
  if (v(m.earlyDumpPct) >= 30 && v(m.sniperQuickFlipPct) >= 40) out.push('insider_exit');
  if (v(m.clusterRugs) >= 1 && v(m.sniperRugLinkPct) >= 10) out.push('rug_ring');
  if (v(m.fundCommonPct) >= 20 && (v(m.syncRepeatWallets) >= 2 || v(m.sniperBundledPct) >= 10 || v(m.fundFreshPct) >= 50)) out.push('coordinated_group');
  if (v(m.syncRepeatWallets) >= 3 && (v(m.earlyDumpPct) >= 20 || v(m.devSoldPct) >= 5 || v(m.washTradePct) >= 10)) out.push('coordinated_dump');
  return out;
}
````

## `src/types.ts`

````ts
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
  launchpad?: string; // ilk görüldüğü GeckoTerminal dex'i (pump-fun, meteora-dbc, four-meme …) — rapor kırılımı
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
  creator?: string | null; // token/pool yaratıcısı (dev)
  flags: string[];
}

export interface Metrics extends Security {
  liquidityUsd: number;
  ageMin: number;
  sniperPct: number | null;
  sniperBuyers?: number;
  sniperHoldMin?: number | null; // erken alıcıların medyan tutma süresi (hâlâ tutan = token yaşı)
  sniperQuickFlipPct?: number | null; // quick_flip_min içinde satan erken alıcı %
  sniperRugLinkPct?: number | null; // daha önce rug olmuş token'larda da erken alıcı olanların %
  sniperBundledPct?: number | null; // dev'in ödediği ya da launch slot/bloğundaki erken alımlar %
  devSoldPct?: number | null; // dev'in elindekinin satılan/çıkan %'si (LP kilidinden bağımsız)
  devPrevRugs?: number | null; // bu dev'in daha önce rug olmuş token sayısı
  earlyDumpPct?: number | null; // launch sonrası ilk 8 dk zirveden en derin düşüş %
  clusterRugs?: number | null; // aynı ≥3 erken alıcının birlikte erken girdiği önceki rug sayısı
  clusterShared?: number | null; // o rug'larla en fazla ortak erken alıcı sayısı
  suspectEarlyPct?: number | null; // şüpheli skoru ≥ suspect_wallet_score olan erken alıcı %
  devLinkedEarlyPct?: number | null; // başka token'ların dev'i olan erken alıcı % (dev+sniper hibrit)
  comboFlags?: string[]; // birleşik tuzak kuralları (trap.ts comboFlags)
  trapWallets?: string[]; // sinyaldeki ≥2 rug'da önce satmış izlenen cüzdanlar
  trapScore?: number | null; // 0–100 sinyal tuzak skoru
  trapParts?: Record<string, number>;
  washWallets?: number | null;
  washTradePct?: number | null;
  syncTradePct?: number | null; // aynı slot/blokta ≥3 cüzdanın aynı yönde işlem yaptığı trade %
  syncMaxWallets?: number | null; // tek blokta en fazla farklı cüzdan
  syncRepeatWallets?: number | null; // defalarca birlikte senkron işlem yapan cüzdan sayısı
  syncRugLinkPct?: number | null; // senkron gruptan, başka rug token'larında da senkron görülenlerin %
  smartEffective?: number | null; // aynı anda (≤ sync_entry_sec) giren izlenen cüzdanlar tek sayılınca bağımsız giriş
  smartSynced?: string[]; // aynı anda giren izlenen cüzdan etiketleri
  launchpadDumpPct?: number | null; // bu ağ+launchpad'den son 14g adayların erken dump/rug oranı
  fundChecked?: number | null; // fonlayıcısı çıkarılan erken alıcı sayısı
  fundFreshPct?: number | null; // ilk işlemi fresh_wallet_hours içinde olan erken alıcı %
  fundCommonPct?: number | null; // en büyük ortak-fonlayıcı grubu / kontrol edilen erken alıcı %
  fundDevPct?: number | null; // doğrudan dev'in fonladığı erken alıcı %
  fundPrevRugs?: number | null; // ortak fonlayıcının erken alıcı fonladığı, rug olmuş başka token sayısı
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
````

## `src/util.ts`

````ts
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
````

## `tsconfig.json`

````json
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
````

## `wallets.yaml`

````yaml
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
#      (kazanan token'larda erken top-holder olup rug'larda görünmeyen adresler;
#       rug oranı > %35, win rate < %42 ve sniper botlar otomatik elenir)
#   3) Her adayı elle doğrula (Solscan / BscScan / GMGN cüzdan sayfası):
#      - son 30 günde ≥ 20 işlem, realize PnL pozitif, win rate ≥ %40
#      - tek token'a bağlı değil, CEX/aggregator/bot (dakikada onlarca tx) değil
#      - aynı token'da hep ilk blokta alıp dakikalar içinde satan → sniper bot, ekleme
#   4) KOL cüzdanı: yalnız KOL'un kendisinin kamuya açıkça ilan ettiği adres.
#   5) Ekle, Helius webhook'unun account listesini güncelle, redeploy.
#   6) Her Pazar npm run report → n ≥ 3 ve rug oranı > %35 olanları çıkar.
#   7) Sabah Raporu'ndaki "tuzağa düşme risk skoru" ≥ 2 rug'da önce satan etiketi gösterirse çıkar.
solana:
  # - { address: "WalletPubkeyBase58", label: "sm_01", type: smart }
  # - { address: "WalletPubkeyBase58", label: "kol_01", type: kol }
bsc:
  # - { address: "0xWallet", label: "sm_bsc_01", type: smart }

base: []   # Base (8453) — discover-wallets önerisiyle, basescan'de doğrulayıp ekle
blast: []  # Blast (81457) — blastscan'de doğrulayıp ekle
monad: []  # Monad (143) — monadscan'de doğrulayıp ekle
````

