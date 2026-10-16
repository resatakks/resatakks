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
/** madenlerin şehir üretimine katıldığı yarıçap (kare) */
export const MINE_RADIUS = 2.5

// ---------------- binalar ----------------
export type BuildingId =
  | 'merkez' | 'tasci' | 'oduncu' | 'tarla' | 'demirci' | 'ambar' | 'kisla' | 'okcu' | 'ahir' | 'atolye' | 'sur' | 'pazar'

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
  { id: 'merkez', name: 'Merkez Otağ', icon: '⛺', desc: 'Şehrin kalbi. Her seviye inşaat süresini kısaltır ve yeni binaların kilidini açar.', base: res(90, 120, 60, 40), time: 60, max: 20 },
  { id: 'tasci', name: 'Taşçı', icon: '⛏️', desc: 'Yakındaki taş ocaklarından taş çıkarır. Çevredeki ocakların seviyesi üretimi artırır.', base: res(40, 70, 40, 20), time: 35, max: 20, produces: 'tas' },
  { id: 'oduncu', name: 'Oduncu', icon: '🪓', desc: 'Yakındaki ormanlardan odun keser. Çevredeki ormanların seviyesi üretimi artırır.', base: res(70, 40, 40, 20), time: 35, max: 20, produces: 'odun' },
  { id: 'tarla', name: 'Tarla', icon: '🌾', desc: 'Tahıl üretir; halkı ve orduyu besler. Çevredeki tarlaların seviyesi üretimi artırır.', base: res(60, 60, 20, 20), time: 30, max: 20, produces: 'tahil' },
  { id: 'demirci', name: 'Demirci', icon: '⚒️', desc: 'Yakındaki demir madenlerini işler. Çevredeki madenlerin seviyesi üretimi artırır.', base: res(90, 80, 40, 20), time: 40, max: 20, produces: 'demir' },
  { id: 'ambar', name: 'Ambar', icon: '🏚️', desc: 'Taş, odun, tahıl ve demir depolama kapasitesini artırır.', base: res(130, 110, 40, 60), time: 50, max: 20 },
  { id: 'kisla', name: 'Kışla', icon: '🏯', desc: 'Piyade yetiştirir. Seviye eğitim süresini kısaltır.', base: res(220, 180, 80, 160), time: 100, max: 20, req: { merkez: 2 } },
  { id: 'okcu', name: 'Okçu Evi', icon: '🎯', desc: 'Okçu yetiştirir. Seviye eğitim süresini kısaltır.', base: res(200, 240, 80, 140), time: 110, max: 20, req: { merkez: 3, kisla: 1 } },
  { id: 'ahir', name: 'Ahır', icon: '🐎', desc: 'At yetiştirir ve süvari eğitir. Seviye at üretimini artırır.', base: res(260, 300, 200, 220), time: 150, max: 20, req: { merkez: 4, kisla: 3 } },
  { id: 'atolye', name: 'Atölye', icon: '🛠️', desc: 'Koçbaşı ve mancınık gibi kuşatma araçları yapar.', base: res(420, 380, 120, 400), time: 200, max: 20, req: { merkez: 7, ahir: 3 } },
  { id: 'sur', name: 'Sur', icon: '🧱', desc: 'Her seviye şehir savunmasını %6 artırır. Koçbaşı surları yıkabilir.', base: res(260, 120, 40, 90), time: 90, max: 20, req: { merkez: 3 } },
  { id: 'pazar', name: 'Pazar', icon: '⚖️', desc: 'Tüccarla kaynak, altın ve at alım satımı yapılır. Seviye takas oranını iyileştirir.', base: res(140, 160, 60, 60), time: 80, max: 20, req: { merkez: 3 } },
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
  def: number
  speed: number // kare / dakika
  carry: number
  cost: Partial<Res>
  time: number // saniye
  upkeep: number // tahıl / dakika
  building: TrainBuilding
  /** kuşatma etkisi: koçbaşı surlara, mancınık binalara */
  siege?: 'sur' | 'bina'
}

interface Base { kind: UnitKind; atk: number; def: number; speed: number; carry: number; cost: Partial<Res>; time: number; upkeep: number; building: TrainBuilding; siege?: 'sur' | 'bina' }
const BASE: Base[] = [
  { kind: 'piyade', atk: 10, def: 30, speed: 3, carry: 35, cost: res(50, 70, 30, 30), time: 30, upkeep: 0.1, building: 'kisla' },
  { kind: 'piyade', atk: 38, def: 14, speed: 3, carry: 50, cost: res(40, 60, 40, 80), time: 45, upkeep: 0.1, building: 'kisla' },
  { kind: 'okcu', atk: 24, def: 30, speed: 3.4, carry: 30, cost: res(30, 90, 40, 40), time: 45, upkeep: 0.1, building: 'okcu' },
  { kind: 'okcu', atk: 45, def: 38, speed: 3, carry: 40, cost: res(60, 120, 50, 110), time: 75, upkeep: 0.2, building: 'okcu' },
  { kind: 'casus', atk: 0, def: 2, speed: 12, carry: 0, cost: res(20, 40, 40, 20, 0, 1), time: 40, upkeep: 0.1, building: 'ahir' },
  { kind: 'suvari', atk: 55, def: 20, speed: 8, carry: 90, cost: res(80, 120, 60, 120, 0, 1), time: 90, upkeep: 0.3, building: 'ahir' },
  { kind: 'suvari', atk: 70, def: 26, speed: 7.5, carry: 80, cost: res(100, 160, 80, 140, 0, 1), time: 110, upkeep: 0.3, building: 'ahir' },
  { kind: 'suvari', atk: 95, def: 60, speed: 6, carry: 100, cost: res(160, 120, 100, 260, 40, 1), time: 160, upkeep: 0.4, building: 'ahir' },
  { kind: 'kusatma', atk: 40, def: 20, speed: 2, carry: 0, cost: res(300, 400, 80, 200), time: 240, upkeep: 0.5, building: 'atolye', siege: 'sur' },
  { kind: 'kusatma', atk: 60, def: 10, speed: 1.6, carry: 0, cost: res(500, 400, 100, 400, 60), time: 320, upkeep: 0.6, building: 'atolye', siege: 'bina' },
]

const NAMES: Record<TribeId, [string, string][]> = {
  hun: [['Mızrakçı', '🔱'], ['Kılıçlı', '⚔️'], ['Okçu', '🏹'], ['Ağır Okçu', '🎯'], ['Casus', '🕵️'], ['Hafif Atlı', '🐎'], ['Atlı Okçu', '🏇'], ['Ağır Süvari', '🛡️'], ['Koçbaşı', '🪵'], ['Mancınık', '☄️']],
  gokturk: [['Kalkan Eri', '🔱'], ['Bahadır', '⚔️'], ['Gök Okçu', '🏹'], ['Tarkan Okçu', '🎯'], ['Casus', '🕵️'], ['Börü Atlı', '🐎'], ['Kurt Süvarisi', '🏇'], ['Zırhlı Süvari', '🛡️'], ['Koçbaşı', '🪵'], ['Mancınık', '☄️']],
  selcuklu: [['Gulam Piyade', '🔱'], ['Serdengeçti', '⚔️'], ['Okçu', '🏹'], ['Ağır Okçu', '🎯'], ['Casus', '🕵️'], ['Akıncı', '🐎'], ['Atlı Okçu', '🏇'], ['Gulam Süvari', '🛡️'], ['Koçbaşı', '🪵'], ['Mancınık', '☄️']],
}

function makeUnits(t: TribeId): UnitDef[] {
  return BASE.map((b, i) => {
    let atk = b.atk
    let def = b.def
    let carry = b.carry
    let cost = { ...b.cost }
    if (t === 'hun') {
      if (b.kind === 'suvari') atk = Math.round(atk * 1.15)
      carry = Math.round(carry * 1.2)
      def = Math.round(def * 0.9)
    } else if (t === 'gokturk') {
      def = Math.round(def * 1.15)
      atk = Math.round(atk * 0.95)
    } else {
      cost = Object.fromEntries(Object.entries(cost).map(([k, v]) => [k, k === 'at' ? v : Math.round((v as number) * 0.9)]))
    }
    return { ...b, atk, def, carry, cost, name: NAMES[t][i][0], icon: NAMES[t][i][1] }
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
export const CITY_TP = [0, 1250, 4000, 9000, 16000, 26000, 40000, 58000, 80000, 110000]
export const MAX_CITIES = 10
export const cityFoundCost = (n: number): Res => res(800 * n, 800 * n, 800 * n, 500 * n, 300 * n, 0)

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
