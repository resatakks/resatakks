# sniper-bot — Solana (Jupiter) + BSC (Pancake V2) + Base (Uniswap V2 / Aerodrome), smart money/KOL hibrit sinyal

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

**Risk ölçeği** (`risk.auto_scale: true`): Sabah Raporu her ağ için 0.25–1 arası bir ölçek hesaplar ve günlük cap'i bununla **küçültür** (asla büyütmez). Bu bir mekanik limittir, yatırım tavsiyesi değildir.

Gün sınırı `timezone: Europe/Istanbul` — gece seansı (00:00–08:00) tek güne düşer.

## Telegram

`/status` · `/rapor` (Sabah Raporu'nu şimdi üret) · `/pause` (yeni giriş yok, açıklar yönetilir) · `/resume` · `/panic` (hepsini sat + dur). Yalnız `TELEGRAM_CHAT_ID`'den gelen komutlar işlenir.

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

07:45'te Telegram'a **☀️ Sabah Raporu** (kopyası `data/sabah-raporu-YYYY-MM-DD.txt`):
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
- 07:45'te Sabah Raporu → Telegram
- 08:00'de durumu kaydedip çıkar (rapor kaçtıysa çıkarken atar)
- gündüz başlatırsan bir sonraki 08:00'e kadar çalışır
- `caffeinate -i` Mac'in uyumasını engeller; kapak kapanırsa süreç durur

Sabah kontrol:
```bash
tail -n 20 data/nightly-summary.log
cat data/sabah-raporu-$(date +%F).txt
```

## Nightly modda çalıştır, sabah rapor at

**Railway:**
```bash
railway up
railway logs | grep -E "nightly başladı|started"
```
`nightly başladı {"window":"00:00-08:00","report":"07:45"}` görünmeli. Telegram'da `/rapor` ile raporu hemen dene. 07:45'te ☀️ Sabah Raporu kendiliğinden gelir (risk / fırsat / rekabet / tuzak / çıkış / config bölümleri yukarıda).

**Yerelde (Mac açık kalacak):**
```bash
cd sniper-bot
cp .env.example .env    # TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID, HELIUS_API_KEY, BSC_RPC_URL, BASE_RPC_URL doldur
caffeinate -i node --env-file=.env node_modules/.bin/tsx src/nightly-run.ts
```
08:00'de kendisi çıkar. Sabah: `cat data/sabah-raporu-$(date +%F).txt`.

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
| `early_buyers.jsonl` | erken alıcılar: alım sayısı, tutma süresi, sattı mı (rug korelasyonu) |
| `devs.jsonl` | token başına dev cüzdanı + satış % |
| `wash_groups.jsonl` | wash grubu cüzdanları (wash halkası tespiti) |
| `sniper-bots.json` | discover-wallets'ın işaretlediği sniper botlar |
| `suspect-wallets.json` | tuzak şüphelileri: skor, tür, gerekçe |
| `bot.log.jsonl` | tüm log |
| `nightly-summary.log` | 30 dk'lık gece özetleri |
| `sabah-raporu-*.txt`, `optimize-*.md`, `wallet-candidates-*.md` | raporlar |

## Bilinen sınırlar

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
