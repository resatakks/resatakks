// Umaykut Online'ın oyun verisi: kaynaklar, devletler, binalar, birimler, madenler.

export type ResKey = 'tas' | 'odun' | 'tahil' | 'demir' | 'altin' | 'at'
export type Res = Record<ResKey, number>
export const RES_KEYS: ResKey[] = ['tas', 'odun', 'tahil', 'demir', 'altin', 'at']
/** ambar kapasitesine tabi olanlar */
export const STORED: ResKey[] = ['tas', 'odun', 'tahil', 'demir']
export const RES_INFO: Record<ResKey, { name: string; icon: string }> = {
  tas: { name: 'Taş', icon: '🪨' },
  odun: { name: 'Odun', icon: '🪵' },
  tahil: { name: 'Tahıl', icon: '🌾' },
  demir: { name: 'Demir', icon: '⛓️' },
  altin: { name: 'Altın', icon: '🪙' },
  at: { name: 'At', icon: '🐴' },
}

export const res = (tas = 0, odun = 0, tahil = 0, demir = 0, altin = 0, at = 0): Res => ({ tas, odun, tahil, demir, altin, at })
export const zeroRes = (): Res => res()
export const sumRes = (r: Res) => RES_KEYS.reduce((s, k) => s + r[k], 0)

// ---------------- devletler ----------------
export type TribeId = 'hun' | 'gokturk' | 'selcuklu'
export const TRIBE_IDS: TribeId[] = ['hun', 'gokturk', 'selcuklu']
export const TRIBES: Record<TribeId, { name: string; short: string; color: string; emblem: string; desc: string; bonus: string[] }> = {
  hun: {
    name: 'Hun',
    short: 'Hun',
    color: '#e0533a',
    emblem: '🏹',
    desc: 'Mete Han’ın torunları. Saldırı ve yağmada rakipsiz, savunmada zayıf.',
    bonus: ['Atlı birlikler %15 güçlü saldırır', 'Yağmada %20 fazla ganimet taşır', 'Savunma %10 zayıf'],
  },
  gokturk: {
    name: 'Göktürk',
    short: 'Göktürk',
    color: '#4d9be6',
    emblem: '🐺',
    desc: 'Bumin ve İstemi’nin kağanlığı. En iyi savunma ve en hızlı maden toplama.',
    bonus: ['Savunma %15 güçlü', 'Maden üretimi %15 fazla', 'Saldırı %5 zayıf'],
  },
  selcuklu: {
    name: 'Selçuklu',
    short: 'Selçuk',
    color: '#5bbf6d',
    emblem: '🛡️',
    desc: 'Tuğrul ve Çağrı beylerin devleti. Nüfus artışında lider, dengeli ordu.',
    bonus: ['Nüfus ve altın geliri %20 fazla', 'Birimler %10 ucuz', 'Dengeli saldırı ve savunma'],
  },
}

// ---------------- madenler ----------------
export type MineType = 'tas' | 'odun' | 'tahil' | 'demir'
export const MINE_TYPES: MineType[] = ['tas', 'odun', 'tahil', 'demir']
export const MINE_NAME: Record<MineType, string> = { tas: 'Taş Ocağı', odun: 'Orman', tahil: 'Tahıl Tarlası', demir: 'Demir Madeni' }
// ---------------- köy çemberi ----------------
// Son dönem kuralı: yeni köyün çemberi 0,5 birimle başlar, her gün kendiliğinden
// genişler ve en fazla 2,5 birime ulaşır. Okul bu büyümeyi hızlandırır; Göktürk
// çemberi diğer devletlerden hızlı genişler. İşçiler yalnız çember içindeki
// kaynaklara gönderilebilir.
export const RING_MIN = 0.5
export const RING_MAX = 2.5
/** okulsuz köyde 1x sunucuda günlük genişleme (birim) */
export const RING_DAY = 0.25
/** her Okul seviyesinin büyüme hızına katkısı */
export const RING_OKUL = 0.3
/** yeni köy en yakın köyden en fazla bu kadar uzakta kurulabilir */
export const MAX_CITY_GAP = 40

// ---------------- binalar ----------------
export type BuildingId =
  | 'merkez' | 'tasci' | 'oduncu' | 'tarla' | 'demirci' | 'ambar' | 'kisla' | 'okcu' | 'ahir' | 'atolye' | 'sur' | 'pazar' | 'tapinak' | 'okul' | 'degirmen' | 'siginak'

export interface BuildingDef {
  id: BuildingId
  name: string
  icon: string
  desc: string
  base: Partial<Res>
  time: number // saniye, 1. seviye
  max: number
  req?: Partial<Record<BuildingId, number>>
  produces?: MineType
}

export const BUILDINGS: BuildingDef[] = [
  { id: 'merkez', name: 'Merkez', icon: '⛺', desc: 'Şehrin kalbi. Her seviye inşaat süresini kısaltır ve yeni binaların kilidini açar.', base: res(90, 120, 60, 40), time: 60, max: 20 },
  { id: 'tasci', name: 'Taşçı', icon: '⛏️', desc: 'Şehrin sahip olduğu taş kaynaklarındaki taş üretimini arttırır, şehrin taş kaynağı yoksa yararsızdır.', base: res(40, 70, 40, 20), time: 35, max: 20, produces: 'tas', req: { merkez: 3 } },
  { id: 'oduncu', name: 'Keresteci', icon: '🪓', desc: 'Şehrin sahip olduğu odun kaynaklarındaki odun üretimini arttırır, şehrin odun kaynağı yoksa yararsızdır.', base: res(70, 40, 40, 20), time: 35, max: 20, produces: 'odun', req: { merkez: 3 } },
  { id: 'tarla', name: 'Tarla', icon: '🌾', desc: 'Tarla ile köyünüzde saatte tahıl üretebilirsiniz. Tahıl askerlerin beslenmesi ve aç kalmaması için gereklidir.', base: res(60, 60, 20, 20), time: 30, max: 20 },
  { id: 'degirmen', name: 'Değirmen', icon: '🌀', desc: 'Şehrin sahip olduğu tahıl kaynaklarındaki saatlik tahıl üretimini arttırır, şehrin tahıl kaynağı yoksa yararsızdır.', base: res(60, 80, 30, 30), time: 35, max: 20, produces: 'tahil', req: { merkez: 3 } },
  { id: 'demirci', name: 'Demirci', icon: '⚒️', desc: 'Şehrin sahip olduğu demir kaynaklarındaki demir üretimini arttırır, şehrin demir kaynağı yoksa yararsızdır.', base: res(90, 80, 40, 20), time: 40, max: 20, produces: 'demir', req: { merkez: 3 } },
  { id: 'ambar', name: 'Ambar', icon: '🏚️', desc: 'Taş, odun, tahıl ve demir depolama kapasitesini artırır.', base: res(130, 110, 40, 60), time: 50, max: 20 },
  { id: 'kisla', name: 'Kışla', icon: '🏯', desc: 'Piyade yetiştirir. Seviye eğitim süresini kısaltır.', base: res(220, 180, 80, 160), time: 100, max: 20, req: { merkez: 2 } },
  { id: 'okcu', name: 'Okçu Evi', icon: '🎯', desc: 'Okçu yetiştirir. Seviye eğitim süresini kısaltır.', base: res(200, 240, 80, 140), time: 110, max: 20, req: { kisla: 3 } },
  { id: 'ahir', name: 'Ahır', icon: '🐎', desc: 'At yetiştirir ve süvari eğitir. Seviye at üretimini artırır.', base: res(260, 300, 200, 220), time: 150, max: 20, req: { kisla: 5 } },
  { id: 'atolye', name: 'Atölye', icon: '🛠️', desc: 'Mancınık ve top gibi kuşatma araçları yapar.', base: res(420, 380, 120, 400), time: 200, max: 20, req: { okcu: 10 } },
  { id: 'sur', name: 'Sur', icon: '🧱', desc: 'Her seviye şehir savunmasını %6 artırır. Mancınık surları yıkabilir.', base: res(260, 120, 40, 90), time: 90, max: 20, req: { merkez: 3 } },
  { id: 'siginak', name: 'Sığınak', icon: '🕳️', desc: 'Sığınağın her seviyesi her üründen 500 adedi savaş sırasında yağmalanmaktan korur.', base: res(40, 60, 20, 10), time: 30, max: 10 },
  { id: 'pazar', name: 'Pazar', icon: '⚖️', desc: 'Tüccarla kaynak, altın ve at alım satımı yapılır. Seviye takas oranını iyileştirir.', base: res(140, 160, 60, 60), time: 80, max: 20, req: { merkez: 3 } },
  { id: 'tapinak', name: 'Tapınak', icon: '🛕', desc: 'Tapınaklar şehirlerde zamanla oluşan yeni nüfusun daha hızlı artmasını sağlar. Her seviye şehrin nüfusunu %5 artırır; Okul için gereklidir.', base: res(300, 300, 0, 0), time: 90, max: 10, req: { merkez: 3 } },
  { id: 'okul', name: 'Okul', icon: '📜', desc: 'Birlik kurmak için okul gereklidir, ayrıca şehrin sahip olduğu alanların genişleme hızını arttırır. Her seviye çemberin büyüme hızını %30 artırır.', base: res(240, 260, 100, 120), time: 120, max: 10, req: { merkez: 3, tapinak: 1 } },
]
export const BUILDING_MAP = Object.fromEntries(BUILDINGS.map((b) => [b.id, b])) as Record<BuildingId, BuildingDef>

// ---------------- birimler ----------------
export type UnitKind = 'piyade' | 'okcu' | 'casus' | 'suvari' | 'kusatma'
export type TrainBuilding = 'kisla' | 'okcu' | 'ahir' | 'atolye'
export interface UnitDef {
  name: string
  icon: string
  kind: UnitKind
  atk: number
  /** yayaya (piyade/okçu/kuşatma) karşı savunma */
  defInf: number
  /** atlıya (süvari) karşı savunma */
  defCav: number
  /** iki savunmanın ortalaması — bot özetleri için */
  def: number
  /** forumdaki hız değeri (ekranda gösterilen) */
  spd: number
  speed: number // kare / dakika
  /** okçu: yanında yakın dövüş askeri varsa 2 kat etkili */
  archer?: boolean
  carry: number
  cost: Partial<Res>
  time: number // saniye
  upkeep: number // tahıl / dakika
  building: TrainBuilding
  /** kuşatma etkisi: mancınık surlara, top binalara */
  siege?: 'sur' | 'bina'
}

interface Base { kind: UnitKind; cost: Partial<Res>; time: number; upkeep: number; building: TrainBuilding; siege?: 'sur' | 'bina' }
// İç sıra kayıtlarla uyumlu kalır; ekranda UNIT_ORDER ile oyundaki sıraya dizilir.
const BASE: Base[] = [
  { kind: 'piyade', cost: res(50, 70, 30, 30), time: 30, upkeep: 0.1, building: 'kisla' },
  { kind: 'piyade', cost: res(40, 60, 40, 80), time: 45, upkeep: 0.1, building: 'kisla' },
  { kind: 'piyade', cost: res(30, 40, 30, 20), time: 25, upkeep: 0.1, building: 'kisla' },
  { kind: 'okcu', cost: res(40, 100, 40, 60), time: 50, upkeep: 0.1, building: 'okcu' },
  { kind: 'casus', cost: res(20, 40, 40, 20, 0, 1), time: 40, upkeep: 0.1, building: 'ahir' },
  { kind: 'suvari', cost: res(80, 120, 60, 120, 0, 1), time: 90, upkeep: 0.3, building: 'ahir' },
  { kind: 'suvari', cost: res(100, 160, 80, 140, 0, 1), time: 110, upkeep: 0.3, building: 'ahir' },
  { kind: 'suvari', cost: res(160, 120, 100, 260, 40, 1), time: 160, upkeep: 0.4, building: 'ahir' },
  { kind: 'kusatma', cost: res(300, 400, 80, 200), time: 240, upkeep: 0.5, building: 'atolye', siege: 'sur' },
  { kind: 'kusatma', cost: res(500, 400, 100, 400, 60), time: 320, upkeep: 0.6, building: 'atolye', siege: 'bina' },
]
/**
 * [saldırı, yayaya savunma, atlıya savunma, hız, yağma] — forum ölçeği.
 * Barlas/Tarkan, Mavi Kurt/Kürşad, Alparslan/Sipahi forumdaki resmî değerler;
 * diğerleri oyun içi açıklamalardaki rollere göre aynı ölçekte kestirim.
 */
type Stat = [number, number, number, number, number]
const STATS: Record<TribeId, Stat[]> = {
  hun: [
    [35, 85, 50, 22, 40], // Tarık: piyadelere karşı savunma
    [120, 60, 90, 24, 80], // Barlas (forum)
    [30, 35, 25, 26, 40], // Toygun: hafif, zayıf
    [70, 45, 40, 22, 35], // Okçu
    [0, 5, 5, 80, 0], // Casus
    [100, 40, 30, 45, 90], // Talakan: saldırı + yağma
    [50, 90, 120, 34, 50], // Tunga: başta süvarilere karşı savunma
    [150, 110, 80, 40, 60], // Tarkan (forum)
    [60, 30, 30, 13, 0], // Mancınık
    [90, 20, 20, 11, 0], // Top
  ],
  gokturk: [
    [30, 60, 120, 20, 35], // Tapukçu: süvarilere karşı savunma
    [80, 100, 50, 20, 60], // Mavi Kurt (forum)
    [28, 40, 30, 22, 35], // Karabudun
    [65, 55, 45, 20, 30], // Kemankeş
    [0, 5, 5, 80, 0],
    [90, 45, 35, 42, 80], // Mavi Atlı: çevik yağmacı
    [45, 130, 80, 32, 45], // Muhafız: piyadelere karşı en iyi savunma
    [140, 100, 150, 30, 50], // Kürşad (forum)
    [60, 30, 30, 13, 0],
    [90, 20, 20, 11, 0],
  ],
  selcuklu: [
    [40, 80, 70, 20, 40], // Selçuk: ucuz, savunmada etkili
    [100, 100, 80, 18, 50], // Alparslan (forum)
    [28, 35, 30, 22, 35], // Gulam
    [70, 50, 45, 20, 30], // Okçu
    [0, 5, 5, 80, 0],
    [95, 40, 35, 40, 70], // Atlı Okçu
    [45, 80, 130, 34, 45], // Kargılı: süvarilerin korkulu rüyası
    [120, 120, 100, 35, 60], // Sipahi (forum)
    [60, 30, 30, 13, 0],
    [90, 20, 20, 11, 0],
  ],
}
/** forum hızı → kare/dakika */
const SPD_K = 0.15
/** oyundaki asker çubuğu sırası (iç index listesi) */
export const UNIT_ORDER = [2, 3, 0, 1, 6, 5, 7, 8, 9, 4]
/** iç index → orijinal portre numarası (/orig/u/{devlet}-{n}.jpg) */
export const UNIT_ART = [2, 3, 0, 1, 9, 5, 4, 6, 7, 8]

const NAMES: Record<TribeId, [string, string][]> = {
  hun: [['Tarık', '🛡️'], ['Barlas', '⚔️'], ['Toygun', '🔱'], ['Okçu', '🏹'], ['Casus', '🕵️'], ['Talakan', '🐎'], ['Tunga', '🏇'], ['Tarkan', '🐴'], ['Mancınık', '🪵'], ['Top', '☄️']],
  gokturk: [['Tapukçi', '🛡️'], ['Mavi Kurt', '⚔️'], ['Karabudun', '🔱'], ['Kemankeş', '🏹'], ['Casus', '🕵️'], ['Mavi Atlı', '🐎'], ['Muhafız', '🏇'], ['Kürşad', '🐴'], ['Mancınık', '🪵'], ['Top', '☄️']],
  selcuklu: [['Selçuk', '🛡️'], ['Alparslan', '⚔️'], ['Gulam', '🔱'], ['Okçu', '🏹'], ['Casus', '🕵️'], ['Atlı Okçu', '🐎'], ['Kargılı', '🏇'], ['Sipahi', '🐴'], ['Mancınık', '🪵'], ['Top', '☄️']],
}

function makeUnits(t: TribeId): UnitDef[] {
  return BASE.map((b, i) => {
    const [atk, defInf, defCav, spd, carry] = STATS[t][i]
    const cost = t === 'selcuklu' ? Object.fromEntries(Object.entries(b.cost).map(([k, v]) => [k, k === 'at' ? v : Math.round((v as number) * 0.9)])) : { ...b.cost }
    const archer = i === 3 || (t === 'selcuklu' && i === 5)
    return { ...b, atk, defInf, defCav, def: Math.round((defInf + defCav) / 2), spd, speed: +(spd * SPD_K).toFixed(2), carry, cost, archer, name: NAMES[t][i][0], icon: NAMES[t][i][1] }
  })
}
export const UNITS: Record<TribeId, UnitDef[]> = { hun: makeUnits('hun'), gokturk: makeUnits('gokturk'), selcuklu: makeUnits('selcuklu') }
export const UNIT_COUNT = BASE.length
export const SPY = 4
export const RAM = 8
export const CATAPULT = 9
export const emptyArmy = () => new Array<number>(UNIT_COUNT).fill(0)

// ---------------- şehir kurma ----------------
/** n. şehri kurmak için gereken tecrübe puanı (index = mevcut şehir sayısı) */
export const CITY_TP = [0, 1250, 3000, 7500, 15000, 30000, 60000, 100000, 200000, 300000]
export const MAX_CITIES = 10
/** Yeni köy maliyeti: gereken TP kadar taş, odun ve demir (2. köy 1250'şer). */
export const cityFoundCost = (n: number): Res => {
  const c = CITY_TP[Math.min(n, CITY_TP.length - 1)]
  return res(c, c, 0, c, 0, 0)
}

// ---------------- sunucular ----------------
export const SERVERS = [
  { id: 'yenisey', name: 'Yenisey', speed: 3, desc: '3x hız · sezon 150 gün' },
  { id: 'almaata', name: 'Almaata', speed: 1, desc: 'normal hız · sezon 300 gün' },
  { id: 'orhun', name: 'Orhun', speed: 2, desc: '2x hız · sezon 200 gün' },
  { id: 'otuken', name: 'Ötüken', speed: 10, desc: '10x hız · hızlı sezon 45 gün' },
]

// ---------------- isimler ----------------
export const FIRST_NAMES = [
  'Bilge', 'Kağan', 'Tonyukuk', 'Alp', 'Ertuğrul', 'Bumin', 'İstemi', 'Mete', 'Attila', 'Kürşad', 'Tomris', 'Börte', 'Oğuz',
  'Kaya', 'Tuğrul', 'Çağrı', 'Alparslan', 'Melikşah', 'Arslan', 'Temur', 'Aybars', 'Batuhan', 'Selim', 'Emre', 'Mert', 'Burak',
  'Kerem', 'Elif', 'Zeynep', 'Ayşe', 'Deniz', 'Ece', 'Yasin', 'Furkan', 'Onur', 'Can', 'Cem', 'Efe', 'Kaan', 'Umut', 'Gökhan',
  'Serkan', 'Hakan', 'Volkan', 'Tolga', 'Erdem', 'Asena', 'Bengü', 'Gökberk', 'Tarkan', 'Atakan', 'Oğuzhan', 'Barış', 'Doruk',
  'Alper', 'Ozan', 'Berk', 'Ege', 'Yiğit', 'Eren', 'Kutay', 'Tunç', 'Ilgaz', 'Ayaz', 'Bora', 'Çınar', 'Arda', 'Emir', 'Metehan',
  'Orhun', 'Yavuz', 'Kılıç', 'Tamer', 'Murat', 'Fatih', 'Ahmet', 'Mehmet', 'Mustafa', 'Hüseyin', 'Gizem', 'Merve', 'Büşra', 'Sena',
  'Aylin', 'Selin', 'Nehir', 'Ceren', 'Duygu', 'Pınar', 'Gülşah', 'Turan', 'Korkut', 'Dede', 'Bamsı', 'Beyrek', 'Kazan', 'Salur',
  'Atsız', 'Göktuğ', 'Akın', 'Baturalp', 'Togan', 'Uluğ', 'Kutlu', 'Erkin', 'Sungur', 'Tigin', 'Alptekin', 'İlteriş', 'Kapgan',
  'hunbey', 'fatalefe', 'kredi', 'patriot', 'saimhan', 'sserdar', 'kolpaa', 'agas', 'mystico', 'aslanmir', 'beyfati', 'kizilaslan',
]
export const NAME_PREFIX = ['Kara', 'Ak', 'Boz', 'Gök', 'Demir', 'Deli', 'Yalın', 'Ulu', 'Kızıl', 'Bozkurt', 'Asil', 'Genç', 'Yaşlı']
export const NAME_SUFFIX = ['Han', 'Bey', 'Kağan', 'Alp', 'Tigin', 'Hatun', 'Baba', 'Reis', 'Paşa', 'Er', 'bey', 'han']
export const CITY_NAMES = [
  'merkez', 'merkez2', 'Kale', 'Hisar', 'Ötüken', 'Kurgan', 'Yayla', 'Bozkır', 'Pınar', 'Tepe', 'XI', 'XX2', 'TÜRK3', 'Kara Yurt',
  'Ak Oba', 'Kızıl Hisar', 'Altın Otağ', 'Demir Kapı', 'Sisli Vadi', 'Ulu Kale', 'Gök Tepe', 'Boz Ova', 'çiftlik', 'depo', 'asker', 'yedek',
]

export const ALLIANCE_NAMES: [string, string][] = [
  ['Türk Töresi', 'TTT'], ['Tek Bayrak', 'ONE'], ['Fırtına 16', 'F16'], ['Ergenekon', 'ERG'], ['Bozkurtlar', 'BZK'],
  ['Kayı Boyu', 'KAYI'], ['Kutlu Yürüyüş', 'KTL'], ['Bilge Yurt', 'BY'], ['Asena', 'ASN'], ['Ötüken Muhafızları', 'ÖTK'],
  ['Tengri Kut', 'TNG'], ['Gök Börü', 'GB'], ['Alp Erenler', 'ALP'], ['Akıncılar', 'AKN'], ['Ice Kurtları', 'ICE'],
  ['Turan Birliği', 'TRN'], ['Altay Kartalları', 'ALT'], ['Kızıl Elma', 'KZL'], ['Orhun Yazıtları', 'ORH'], ['Tuna Boyları', 'TUN'],
  ['Selenga Atlıları', 'SLN'], ['Aral Kurtları', 'ARL'], ['Rüzgar Cengaver', 'RC'], ['Kafkas Kurtları', 'KFK'], ['Anadolu Erenleri', 'AND'],
  ['Malazgirt', 'MLZ'], ['Dandanakan', 'DND'], ['Talas', 'TLS'], ['Türk Cihan', 'TC3'], ['Kutlug Devleti', 'KTD'],
  ['Karahanlılar', 'KRH'], ['Gazneliler', 'GZN'], ['Harzemşahlar', 'HRZ'], ['Atabeyler', 'ATB'], ['Yörükler', 'YRK'],
  ['Çepniler', 'ÇPN'], ['Avşarlar', 'AVŞ'], ['Salurlar', 'SLR'], ['VIP Ulus', 'VIP'], ['Hazar Kartalları', 'HZR'],
]
/** birlik etiketi rengi (sıralama ve raporlarda) */
export const TAG_COLORS = ['#e8443a', '#3fd06b', '#e8443a', '#4fb3ff', '#ffb02e', '#c86bff', '#ff6fa3', '#7de0d0']
export const MAX_ALLIANCE = 30
