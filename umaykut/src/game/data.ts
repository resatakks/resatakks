export type ResKey = 'odun' | 'tas' | 'demir' | 'yiyecek'
export type Res = Record<ResKey, number>
export const RES_KEYS: ResKey[] = ['odun', 'tas', 'demir', 'yiyecek']
export const RES_INFO: Record<ResKey, { name: string; icon: string }> = {
  odun: { name: 'Odun', icon: '🪵' },
  tas: { name: 'Taş', icon: '🪨' },
  demir: { name: 'Demir', icon: '⚒️' },
  yiyecek: { name: 'Yiyecek', icon: '🌾' },
}

export const res = (odun: number, tas: number, demir: number, yiyecek: number): Res => ({ odun, tas, demir, yiyecek })
export const zeroRes = (): Res => res(0, 0, 0, 0)

export type TribeId = 'hun' | 'gokturk' | 'selcuklu'
export const TRIBE_IDS: TribeId[] = ['hun', 'gokturk', 'selcuklu']
export const TRIBES: Record<TribeId, { name: string; color: string; emblem: string; desc: string; bonus: string }> = {
  hun: {
    name: 'Hunlar',
    color: '#d0563b',
    emblem: '🏹',
    desc: 'Mete Han’ın torunları. Bozkırın en hızlı ve en yıkıcı atlıları.',
    bonus: 'Atlı birlikler %15 daha güçlü saldırır',
  },
  gokturk: {
    name: 'Göktürkler',
    color: '#4a90d9',
    emblem: '🐺',
    desc: 'Bumin ve İstemi’nin kurduğu kağanlık. Ötüken’in bereketi onlarla.',
    bonus: 'Tüm kaynak üretimi %10 fazla',
  },
  selcuklu: {
    name: 'Selçuklular',
    color: '#4fae6a',
    emblem: '🛡️',
    desc: 'Tuğrul ve Çağrı beylerin devleti. Sağlam surların ve disiplinli ordunun sahibi.',
    bonus: 'Köy savunması ve sur etkisi %15 daha güçlü',
  },
}

export type BuildingId = 'otag' | 'oduncu' | 'tasocagi' | 'demirmadeni' | 'tarla' | 'ambar' | 'kisla' | 'ahir' | 'sur'

export interface BuildingDef {
  id: BuildingId
  name: string
  icon: string
  desc: string
  base: Res
  time: number // saniye, 1. seviye
  max: number
  req?: Partial<Record<BuildingId, number>>
  produces?: ResKey
}

export const BUILDINGS: BuildingDef[] = [
  { id: 'otag', name: 'Ana Otağ', icon: '⛺', desc: 'Köyün kalbi. Her seviye inşaat süresini kısaltır.', base: res(70, 40, 60, 20), time: 50, max: 20 },
  { id: 'oduncu', name: 'Oduncu', icon: '🪓', desc: 'Ormandan odun keser.', base: res(40, 60, 40, 30), time: 35, max: 20, produces: 'odun' },
  { id: 'tasocagi', name: 'Taş Ocağı', icon: '⛏️', desc: 'Dağdan taş çıkarır.', base: res(60, 40, 50, 30), time: 35, max: 20, produces: 'tas' },
  { id: 'demirmadeni', name: 'Demir Madeni', icon: '⚒️', desc: 'Ergenekon’un demirini işler.', base: res(80, 70, 30, 40), time: 40, max: 20, produces: 'demir' },
  { id: 'tarla', name: 'Tarla', icon: '🌾', desc: 'Halkı ve orduyu besler.', base: res(50, 60, 40, 10), time: 30, max: 20, produces: 'yiyecek' },
  { id: 'ambar', name: 'Ambar', icon: '🏚️', desc: 'Kaynak depolama kapasitesini artırır.', base: res(100, 120, 70, 20), time: 55, max: 20 },
  { id: 'kisla', name: 'Kışla', icon: '🏯', desc: 'Piyade ve okçu yetiştirir. Seviye eğitim süresini kısaltır.', base: res(200, 150, 180, 60), time: 110, max: 20, req: { otag: 2 } },
  { id: 'ahir', name: 'Ahır', icon: '🐎', desc: 'Atlı birlik yetiştirir.', base: res(300, 250, 350, 100), time: 170, max: 20, req: { otag: 5, kisla: 3 } },
  { id: 'sur', name: 'Sur', icon: '🧱', desc: 'Her seviye köy savunmasını %5 artırır.', base: res(120, 200, 80, 50), time: 90, max: 20, req: { otag: 3 } },
]
export const BUILDING_MAP = Object.fromEntries(BUILDINGS.map((b) => [b.id, b])) as Record<BuildingId, BuildingDef>

export interface UnitDef {
  name: string
  icon: string
  atk: number
  def: number
  speed: number // kare / dakika
  carry: number
  cost: Res
  time: number // saniye
  upkeep: number // yiyecek / dakika
  building: 'kisla' | 'ahir'
  cav: boolean
}

const U = (
  name: string,
  icon: string,
  atk: number,
  def: number,
  speed: number,
  carry: number,
  cost: Res,
  time: number,
  upkeep: number,
  cav = false,
): UnitDef => ({ name, icon, atk, def, speed, carry, cost, time, upkeep, building: cav ? 'ahir' : 'kisla', cav })

export const UNITS: Record<TribeId, UnitDef[]> = {
  hun: [
    U('Mızrakçı', '🔱', 10, 32, 3, 40, res(80, 60, 40, 30), 35, 0.1),
    U('Kılıçlı', '⚔️', 42, 14, 3, 50, res(100, 50, 90, 40), 50, 0.1),
    U('Okçu', '🏹', 30, 28, 3.5, 30, res(90, 40, 70, 40), 45, 0.1),
    U('Atlı Okçu', '🐎', 75, 22, 8, 90, res(200, 150, 220, 80), 110, 0.3, true),
  ],
  gokturk: [
    U('Kalkan Eri', '🛡️', 10, 34, 3, 40, res(80, 60, 40, 30), 35, 0.1),
    U('Bahadır', '⚔️', 40, 16, 3, 50, res(100, 50, 90, 40), 50, 0.1),
    U('Gök Okçu', '🏹', 34, 30, 3.5, 35, res(90, 40, 70, 40), 45, 0.1),
    U('Börü Süvarisi', '🐺', 68, 28, 7.5, 100, res(200, 150, 220, 80), 110, 0.3, true),
  ],
  selcuklu: [
    U('Gulam Piyade', '🛡️', 12, 38, 3, 40, res(80, 60, 40, 30), 35, 0.1),
    U('Serdengeçti', '⚔️', 40, 15, 3, 50, res(100, 50, 90, 40), 50, 0.1),
    U('Okçu', '🏹', 30, 30, 3.5, 30, res(90, 40, 70, 40), 45, 0.1),
    U('Akıncı', '🐎', 66, 30, 7.5, 90, res(200, 150, 220, 80), 110, 0.3, true),
  ],
}

// ---------- isimler ----------
export const FIRST_NAMES = [
  'Bilge', 'Kağan', 'Tonyukuk', 'Alp', 'Ertuğrul', 'Bumin', 'İstemi', 'Mete', 'Attila', 'Kürşad', 'Tomris', 'Börte', 'Oğuz',
  'Kaya', 'Tuğrul', 'Çağrı', 'Alparslan', 'Melikşah', 'Arslan', 'Temur', 'Aybars', 'Batuhan', 'Selim', 'Emre', 'Mert', 'Burak',
  'Kerem', 'Elif', 'Zeynep', 'Ayşe', 'Deniz', 'Ece', 'Yasin', 'Furkan', 'Onur', 'Can', 'Cem', 'Efe', 'Kaan', 'Umut', 'Gökhan',
  'Serkan', 'Hakan', 'Volkan', 'Tolga', 'Erdem', 'Asena', 'Bengü', 'Gökberk', 'Tarkan', 'Atakan', 'Oğuzhan', 'Barış', 'Doruk',
  'Alper', 'Ozan', 'Berk', 'Ege', 'Yiğit', 'Eren', 'Kutay', 'Tunç', 'Ilgaz', 'Ayaz', 'Bora', 'Çınar', 'Arda', 'Emir', 'Metehan',
  'Orhun', 'Yavuz', 'Kılıç', 'Tamer', 'Murat', 'Fatih', 'Ahmet', 'Mehmet', 'Mustafa', 'Hüseyin', 'Gizem', 'Merve', 'Büşra', 'Sena',
  'Aylin', 'Selin', 'Nehir', 'Ceren', 'Duygu', 'Pınar', 'Gülşah', 'Turan', 'Korkut', 'Dede', 'Bamsı', 'Beyrek', 'Kazan', 'Salur',
  'Atsız', 'Göktuğ', 'Akın', 'Baturalp', 'Togan', 'Uluğ', 'Kutlu', 'Erkin', 'Sungur', 'Tigin', 'Alptekin', 'İlteriş', 'Kapgan',
]
export const NAME_PREFIX = ['Kara', 'Ak', 'Boz', 'Gök', 'Demir', 'Deli', 'Yalın', 'Ulu', 'Kızıl', 'Bozkurt', 'Asil', 'Genç', 'Yaşlı']
export const NAME_SUFFIX = ['Han', 'Bey', 'Kağan', 'Alp', 'Tigin', 'Hatun', 'Baba', 'Reis', 'Paşa', 'Er']
export const VILLAGE_ADJ = ['Kara', 'Ak', 'Kızıl', 'Gök', 'Boz', 'Yeşil', 'Demir', 'Altın', 'Gümüş', 'Ulu', 'Yüce', 'Sarı', 'Sisli', 'Rüzgarlı', 'Issız']
export const VILLAGE_NOUN = ['Yurt', 'Oba', 'Otağ', 'Kale', 'Hisar', 'Ova', 'Yayla', 'Bozkır', 'Pınar', 'Tepe', 'Dağ', 'Kurgan', 'Vadi', 'Göl', 'Orman']

export const ALLIANCE_NAMES: [string, string][] = [
  ['Kayı Boyu', 'KAYI'], ['Bozkurtlar', 'BZK'], ['Asena’nın Çocukları', 'ASN'], ['Ötüken Muhafızları', 'ÖTK'], ['Tengri Kut', 'TNG'],
  ['Gök Börü', 'GB'], ['Alp Erenler', 'ALP'], ['Akıncılar', 'AKN'], ['Demirciler', 'DMR'], ['Turan Birliği', 'TRN'],
  ['Altay Kartalları', 'ALT'], ['Ergenekon', 'ERG'], ['Kızıl Elma', 'KZL'], ['Orhun Yazıtları', 'ORH'], ['Tuna Boyları', 'TUN'],
  ['Selenga Atlıları', 'SLN'], ['Aral Kurtları', 'ARL'], ['İdil Bekçileri', 'İDL'], ['Kafkas Kurtları', 'KFK'], ['Anadolu Erenleri', 'AND'],
  ['Malazgirt', 'MLZ'], ['Dandanakan', 'DND'], ['Talas', 'TLS'], ['Bilge Kağan Ordusu', 'BKO'], ['Kutlug Devleti', 'KTL'],
  ['Karahanlılar', 'KRH'], ['Gazneliler', 'GZN'], ['Harzemşahlar', 'HRZ'], ['Atabeyler', 'ATB'], ['Yörükler', 'YRK'],
  ['Çepniler', 'ÇPN'], ['Avşarlar', 'AVŞ'], ['Salurlar', 'SLR'], ['Eymür', 'EYM'], ['Döğer', 'DĞR'],
  ['Yazırlar', 'YZR'], ['Bayındır', 'BYD'], ['Kınık', 'KNK'], ['Türkmen Yurdu', 'TRK'], ['Hazar Kartalları', 'HZR'],
]
