# Umaykut

Facebook'taki eski **Umaykut Online** oyunundan esinlenen, React ile yazılmış tek kişilik bir tarayıcı strateji oyunu.
Dünyada seninle birlikte **1000 sahte oyuncu** yaşar: büyürler, birbirlerini yağmalarlar, sohbet ederler, boylar kurup Umaykut yarışına girerler ve sana da saldırırlar.

## Çalıştırma

```bash
cd umaykut
npm install
npm run dev      # http://localhost:5173
npm run build    # dist/ klasörüne statik site üretir
```

## Oynanış

- **Halk seç:** Hunlar (atlılar +%15 saldırı), Göktürkler (+%10 üretim), Selçuklular (+%15 savunma).
- **Köy:** Ana Otağ, Oduncu, Taş Ocağı, Demir Madeni, Tarla, Ambar, Kışla, Ahır ve Sur. Aynı anda 2 inşaat sıraya alınabilir.
- **Ordu:** Her halkın 4 kendine özgü birimi var. Yağma, saldırı ve keşif seferleri düzenleyebilirsin. Ordu yiyecek tüketir.
- **Harita:** 100×100 dünya, mini harita, halka ya da boya göre renklendirme. Gri köyler inaktiftir, kolay yağma hedefidir.
- **Boy:** 40 hazır boydan birine başvur ya da kendi boyunu kur. Boy sohbetinde üyeler seninle konuşur.
- **Umaykut:** Boyunla kaynak bağışlayarak Umaykut'u 10. seviyeye ilk çıkaran boy dünyayı kazanır (boyda üç halktan da üye olmalı).
- **Yaşayan dünya:** Botlar sohbette yazdıklarına cevap verir, yağmaladığın oyuncular mesaj atar ve intikam almaya gelir. Acemi koruması bittikten sonra sana saldırılar başlar.

Oyun `localStorage`'a kaydedilir; sekmeyi kapatsan bile döndüğünde geçen süre (en fazla 48 saat) işlenir. Dünya hızı ×1, ×3 ya da ×10 seçilebilir.
