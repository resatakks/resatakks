// Sahte oyuncuların sohbet ve mesaj şablonları.
// {x} {y} {name} {ally} {ally2} {me} {tribe} {n} yer tutucuları doldurulur.

export const WORLD_LINES = [
  'selam millet', 'sa', 'as', 'kimse yok mu', 'Umaykut kimin olacak sizce?', '{ally} çok güçlendi dikkat edin',
  'inaktif köy bilen var mı {x}|{y} civarında', '{tribe} en iyi halk, tartışmam', 'Börü süvarileri yine yağmaya çıktı 🐺',
  'gece saldıranlar adam değildir :D', 'demir lazım takas yapan?', 'boyumuza aktif oyuncu arıyoruz, {ally} pm',
  'acemi korumam bitti dua edin', 'ambar yine doldu, kaynak taşıyor', 'kışlada 200 okçu bekliyor, hedef arıyorum',
  'Tengri bizi korusun', 'oyun kasıyor mu bende mi', 'yarın sınav var hala oynuyorum 😅', 'hunlar mı göktürkler mi?',
  'sunucunun en büyüğü kim şu an', 'iyi akşamlar', 'kurultay kaçta?', '{name} beni yağmaladı ya :(',
  '{name} helal olsun, iyi saldırıydı', 'Atilla gibi olacağım', 'Selçuklu surları yıkılmaz', 'yağma sırası bende',
  'kanka {x}|{y} benim, dokunmayın', 'barış isteyen boylar pm atsın', '{ally} ile {ally2} savaşa girmiş duydunuz mu',
  'yeni başladım ne yapmam lazım', 'tarla kasın arkadaşlar yoksa asker açlıktan ölüyor', 'oduncu 10 oldu sonunda',
  'ahır açtım atlı basıyorum 🐎', '{name} online mı', 'gece 3te saldırı yedim uyuyamadım', 'çay demledim, devam',
  '{ally} Umaykut seviyesi kaç oldu', 'ilk 100e girdim 🎉', 'surum 10 olunca kimse dokunamaz', 'kim bu {name} ya her yeri yağmalıyor',
  'bu sunucu eski Altay sunucusuna benziyor', 'özledim bu oyunu', 'eski facebook günleri ❤️', 'boyumdan ayrıldım yeni boy arıyorum',
  'mızrakçı mı okçu mu savunmada daha iyi', '{x}|{y} inaktif, yağmalayın', 'akıncılar yola çıktı 🐎🐎🐎',
]

export const ALLIANCE_LINES = [
  'günaydın boy', 'Umaykut’a {n} kaynak bıraktım', 'saldırı altındayım! {x}|{y} destek lazım', 'tamam geliyorum',
  '{name} bize saldırdı, karşılık verelim mi?', 'bugün herkes Umaykut’a en az 5000 kaynak', 'kurultay akşam 9da',
  'savunma askeri basın arkadaşlar', '{ally2} ile barış yapalım mı?', 'okçu mu basayım atlı mı', '{ally2} ile savaştayız, dikkat',
  'yağmaya gidiyorum, katılan?', 'gece nöbeti kimde', 'Umaykut {n}. seviyeye ne zaman çıkar sizce', 'helal olsun boy, iyi gidiyoruz',
  'ben biraz afk', 'döndüm', 'demirim taşıyor, Umaykut’a atıyorum', 'yeni gelenler önce tarla kassın', '{name} inaktif olmuş, yağmalayın',
]

export const REPLIES: { re: RegExp; lines: string[] }[] = [
  { re: /\b(selam|merhaba|slm|sa|selamün|hey|naber)\b/i, lines: ['as', 'aleyküm selam', 'selam hoş geldin', 'merhaba {me}', 'as kardeş', 'selam {me}, yeni misin?', 'iyiyiz sen?'] },
  { re: /(yardım|nasıl|ne yap|tavsiye|öneri|yeni)/i, lines: ['önce kaynak binalarını yükselt', 'ambarı unutma yoksa kaynak taşar', 'acemi koruman bitmeden kışla kur', 'inaktiflere yağma at, en hızlı büyüme o', 'bir boya katıl, yalnız kalma', 'tarlayı ihmal etme, ordu yiyecek ister', 'haritada nüfusu hiç artmayan köyleri bul, onlar inaktif'] },
  { re: /(boy|ittifak|klan|lonca)/i, lines: ['bizim boya gel, {ally}', '{ally} üye alıyor', 'boysuz kalma kardeş', '{ally}’e başvur kabul ederler'] },
  { re: /(saldır|yağma|vur|savaş)/i, lines: ['kime saldırıyorsun?', 'bana dokunma ama :D', 'önce inaktif bul', 'hadi bakalım 😄', 'raporu at görelim'] },
  { re: /umaykut/i, lines: ['Umaykut’u {ally} dikecek bence', 'herkes Umaykut peşinde', 'üç halktan da üye lazım unutmayın', '10. seviye çok uzak daha'] },
  { re: /(hun|göktürk|gokturk|selçuklu|selcuklu)/i, lines: ['{tribe} en iyisi', 'atlı okçular rakipsiz', 'Selçuklu sur bonusu çok iyi', 'Göktürk üretim bonusu uzun vadede kazandırır'] },
  { re: /(haha|hah|ksksk|😂|lol)/i, lines: ['😂', 'haha', 'kopdum', 'xd'] },
]

export const GENERIC_REPLIES = ['haha', 'aynen', '+1', 'katılıyorum', 'yok artık', '😂', 'sen kimsin ya :D', 'hoş geldin yeni misin?', 'hmm', 'doğru', 'bilmiyorum valla', '👍']

export const DM_STRONG = [
  'Köyüme saldıran sen miydin {me}? Hesabını soracağım!',
  'Bunu yanına bırakmam.',
  'Boyuma yazdım, yakında misafirin olacak 🐺',
  'Cesaretine hayranım ama bu sana pahalıya patlayacak.',
]
export const DM_WEAK = [
  'Lütfen bana saldırma, yeni başladım :(',
  'Kardeş ne istiyorsun, kaynak kalmadı',
  'Tamam pes ediyorum, barış?',
  'Neden ben ya 😭',
]
export const DM_PROTECT_END = 'Acemi korumanız sona erdi. Artık diğer oyuncular size saldırabilir. Tengri yar ve yardımcınız olsun!'

export function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}
