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

### $30–50 ile Phantom'ta başlangıç (yalnız 4. hafta, live kararı verildiyse)
1. **Ayrı bot cüzdanı aç.** Phantom → sol üstteki hesap menüsü → **Add / Connect Wallet → Create New Wallet**.
   - Ana cüzdanını ve içinde başka varlık olan hesabı **asla** kullanma.
   - Mümkünse ayrı bir seed (yeni Phantom kurulumu) kullan. Böylece anahtar sızarsa yalnız bot bakiyesi gider.
2. **Bakiye:** config `paper_start_balance: 0.31` SOL'e göre ayarlı ($50 ≈ 0.31 SOL, 160 $/SOL varsayımıyla).
   - $30 ile başlarsan ≈ 0.19 SOL olur. Bu durumda `probe_max` 0.03'e ve `daily_loss_cap` 0.05'e iner; `/rapor risk` önerisine bak.
   - 0.02 SOL `fee_reserve` her zaman cüzdanda kalır (tx ücreti + token hesabı rent'i).
   - SOL'ü borsadan doğrudan bu yeni adrese gönder. Önce küçük bir test transferi yap.
3. **Anahtarı bota ver.** Phantom → Settings → Manage Accounts → bot hesabı → **Show Private Key** (base58 string).
   - Bunu yalnız kendi makinendeki `sniper-bot/.env` dosyasına `SOLANA_PRIVATE_KEY=` olarak yapıştır.
   - Sohbete, Telegram'a, Grok'a, git'e **asla** yapıştırma. `.env` zaten `.gitignore`'da.
   - Ben veya başka bir ajan bu anahtarı girmeyiz; bu adımı sen yaparsın.
4. **Live'ı aç.** `config.yaml` içinde `mode: live` yap. `.env`'e `LIVE_CONFIRM=YES` ekle.
   - Solana dışındaki ağlarda `paper_only: true` kalsın; BSC, Base ve Monad için anahtar girme.
5. **İlk gün izle:**
   - `/rapor ozet risk` komutunu ve Phantom'daki işlem geçmişini karşılaştır.
   - Bakiye beklenmedik düşerse botu durdur (Ctrl+C) ve `mode: paper`'a dön.
6. **Kâr çekme:** Bakiye başlangıcın 2 katına çıkarsa fazlasını ana cüzdana çek. Bot cüzdanında yalnız çalışma sermayesi kalsın.

## Doğrulanmayan / açık kalanlar
- `fundingCheck` gerçek RPC/Etherscan çağrısıyla canlı denenmedi; sahte verilerle mantık testi geçti.
- Blast'ta fonlama kontrolü yok (Etherscan v2 desteklemiyor).
- Commit / push / deploy yapılmadı. Onay bekliyor.
