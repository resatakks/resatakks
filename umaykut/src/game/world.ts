import {
  ALLIANCE_NAMES, CITY_NAMES, FIRST_NAMES, NAME_PREFIX, NAME_SUFFIX, SERVERS, TAG_COLORS, TRIBES, TRIBE_IDS, TribeId, emptyArmy, res,
} from './data'
import { WORLD_LINES, pick } from './chatter'
import { Alliance, Bot, BotCity, Game, addFeed, mineAt, newCityBuildings, seedWorkers } from './engine'

export const BOT_COUNT = 1000
const SIZE = 120
const SAVE_KEY = 'umaykut-save-v3'

const rnd = (a: number, b: number) => a + Math.random() * (b - a)
function gauss() {
  return Math.sqrt(-2 * Math.log(1 - Math.random())) * Math.cos(2 * Math.PI * Math.random())
}

function makeName(used: Set<string>) {
  for (;;) {
    const first = pick(FIRST_NAMES)
    const r = Math.random()
    let n: string
    if (r < 0.22) n = `${first}${Math.floor(rnd(1, 99))}`
    else if (r < 0.36) n = `${pick(NAME_PREFIX)}${first}`
    else if (r < 0.5) n = `${first}${pick(NAME_SUFFIX)}`
    else if (r < 0.6) n = `${first.toLowerCase()}${pick(['tr', 'han', 'alp', '06', '34', '35', 'xx', 'kurt', '_61'])}`
    else if (r < 0.64) n = `xX${first}Xx`
    else if (r < 0.74) n = first.toLowerCase()
    else if (r < 0.82) n = `${first.toLowerCase()}${Math.floor(rnd(1980, 2012))}`
    else n = first
    if (!used.has(n)) {
      used.add(n)
      return n
    }
  }
}

function cityName(owner: string, i: number) {
  if (i === 0) return Math.random() < 0.12 ? 'merkez' : Math.random() < 0.45 ? owner.slice(0, 10) : pick(CITY_NAMES)
  return Math.random() < 0.4 ? `${owner.slice(0, 8)}${i + 1}` : pick(CITY_NAMES)
}

export function generateWorld(playerName: string, tribe: TribeId, serverId: string): Game {
  const now = Date.now()
  const server = SERVERS.find((s) => s.id === serverId) ?? SERVERS[0]
  const speed = server.speed
  const seed = Math.floor(Math.random() * 2 ** 31)
  const probe = { seed, mapSize: SIZE }
  const taken: [number, number][] = []
  const grid = new Set<number>()
  const k = (x: number, y: number) => y * 10000 + x
  const free = (x: number, y: number) => {
    if (x < 1 || y < 1 || x >= SIZE - 1 || y >= SIZE - 1 || mineAt(probe, x, y)) return false
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) if (grid.has(k(x + dx, y + dy))) return false
    return true
  }
  const take = (x: number, y: number) => {
    grid.add(k(x, y))
    taken.push([x, y])
  }
  const used = new Set<string>([playerName])
  const bots: Bot[] = []
  const center = SIZE / 2

  for (let i = 0; i < BOT_COUNT; i++) {
    let x = 0
    let y = 0
    let r = 0
    let tries = 0
    do {
      r = 56 * Math.pow(Math.random(), 0.65)
      const a = Math.random() * Math.PI * 2
      x = Math.round(center + r * Math.cos(a))
      y = Math.round(center + r * Math.sin(a))
      tries++
    } while (!free(x, y) && tries < 200)
    if (tries >= 200) continue
    take(x, y)
    const centerBoost = 1.4 - (r / 56) * 0.85
    const pop = Math.max(3, Math.min(6000, Math.exp(gauss() * 1.05 + 4.6) * centerBoost))
    const inactive = Math.random() < 0.17
    const aggr = Math.pow(Math.random(), 1.4)
    const defF = 1.5 + (1 - aggr) * 5
    const atkF = 1 + aggr * 5
    const name = makeName(used)
    // sezon ortasına girilir: eski köylerin çemberi büyümüş, yenilerinki küçük
    const r0 = Math.max(0.5, Math.min(2.5, 0.4 + Math.log10(pop) * 0.62 + rnd(-0.3, 0.3)))
    const cities: BotCity[] = [{ x, y, name: cityName(name, 0), r: r0 }]
    const want = Math.min(10, 1 + Math.floor(pop / 320 + rnd(0, 0.7)))
    for (let c = 1; c < want; c++) {
      for (let t = 0; t < 20; t++) {
        const a = Math.random() * Math.PI * 2
        const rr = rnd(3, 7 + c)
        const cx = Math.round(x + Math.cos(a) * rr)
        const cy = Math.round(y + Math.sin(a) * rr)
        if (free(cx, cy)) {
          take(cx, cy)
          cities.push({ x: cx, y: cy, name: cityName(name, c), r: Math.max(0.5, r0 - rnd(0.2, 0.6) * c) })
          break
        }
      }
    }
    bots.push({
      id: bots.length,
      name,
      village: cities[0].name,
      tribe: pick(TRIBE_IDS),
      x,
      y,
      cities,
      allianceId: null,
      pop,
      def: inactive ? pop * 0.3 : pop * defF * rnd(0.6, 1.1),
      atk: inactive ? 0 : pop * atkF * rnd(0.5, 1),
      res: inactive ? (500 + pop * 40) * rnd(0.4, 1) : (300 + pop * 12) * rnd(0.1, 0.9),
      sur: Math.min(20, Math.floor(Math.sqrt(pop) / 3 * (0.4 + (1 - aggr)) * rnd(0.5, 1.2))),
      activity: inactive ? 0 : rnd(0.3, 1),
      aggr,
      defF,
      atkF,
      online: !inactive && Math.random() < 0.3,
      grudge: 0,
      raidPts: inactive ? rnd(0, 20) : pop * aggr * rnd(0.5, 3),
      defPts: pop * (1 - aggr) * rnd(0.2, 1.5),
      lastSeen: now - (inactive ? rnd(3, 30) * 86400000 : rnd(0, 20) * 3600000),
    })
  }

  // birlikler: büyükler en güçlü oyuncuların etrafında toplanır (en fazla 30 üye)
  const alliances: Alliance[] = []
  const byPop = [...bots].filter((b) => b.activity > 0).sort((a, b) => b.pop - a.pop)
  ALLIANCE_NAMES.forEach(([name, tag], i) => {
    const id = 'a' + i
    const size = Math.min(30, Math.round(32 / Math.pow(i + 1, 0.42) + rnd(-3, 2)))
    const leader = byPop.find((b) => !b.allianceId && Math.random() < 0.5) ?? byPop.find((b) => !b.allianceId)
    if (!leader) return
    leader.allianceId = id
    const near = bots
      .filter((b) => !b.allianceId && (b.activity > 0 || Math.random() < 0.3))
      .map((b) => ({ b, d: Math.hypot(b.x - leader.x, b.y - leader.y) + rnd(0, 14) }))
      .sort((a, b) => a.d - b.d)
      .slice(0, size - 1)
    for (const { b } of near) b.allianceId = id
    alliances.push({
      id,
      name,
      tag,
      color: TAG_COLORS[i % TAG_COLORS.length],
      umaykut: i === 0 ? 3 : i < 3 ? 2 : i < 10 ? Math.floor(rnd(0, 2)) : 0,
      progress: rnd(0, 20000),
      minPop: i < 5 ? Math.round(rnd(150, 300)) : i < 15 ? Math.round(rnd(30, 90)) : 0,
    })
  })

  // oyuncu kenarda doğar
  let px = 0
  let py = 0
  let guard = 0
  do {
    const r = rnd(38, 50)
    const a = Math.random() * Math.PI * 2
    px = Math.round(center + r * Math.cos(a))
    py = Math.round(center + r * Math.sin(a))
    guard++
  } while (!free(px, py) && guard < 2000)

  const g: Game = {
    version: 3,
    server: server.name,
    speed,
    seed,
    seasonEnd: now + (speed >= 10 ? 45 : speed >= 3 ? 150 : speed >= 2 ? 200 : 300) * 86400000 * rnd(0.55, 0.8),
    player: {
      name: playerName,
      tribe,
      x: px,
      y: py,
      cities: [{ id: 1, name: 'merkez', x: px, y: py, r: 0.5, b: newCityBuildings(), army: emptyArmy(), queue: [], train: [], folk: 20, work: {}, guests: [] }],
      res: res(900, 900, 900, 900, 150, 0),
      elmas: 100,
      allianceId: null,
      protectionUntil: now + (3 * 24 * 3600 * 1000) / speed,
      protectionNotified: false,
      raidPts: 0,
      defPts: 0,
      starveAcc: 0,
      lastDaily: now,
      bonus: {},
      guardUses: 0,
    },
    bots,
    alliances,
    out: [],
    supports: [],
    incoming: [],
    reports: [],
    feed: [],
    chat: { world: [], alliance: [] },
    pending: [],
    dms: [],
    application: null,
    worldStart: now - 34 * 24 * 3600 * 1000,
    created: now,
    lastTick: now,
    nextId: 2,
    winner: null,
    online: 0,
    mapSize: SIZE,
    rev: 0,
  }

  for (let i = 0; i < 14; i++) {
    const b = pick(bots.filter((x) => x.online)) ?? pick(bots)
    const text = pick(WORLD_LINES)
      .replace(/\{x\}/g, String(b.x)).replace(/\{y\}/g, String(b.y))
      .replace(/\{name\}/g, pick(bots).name).replace(/\{ally2?\}/g, pick(alliances).name)
      .replace(/\{tribe\}/g, 'Hunlar').replace(/\{me\}/g, playerName).replace(/\{n\}/g, '3')
    g.chat.world.push({ id: g.nextId++, time: now - (14 - i) * 40000 - rnd(0, 30000), from: b.name, botId: b.id, tribe: b.tribe, text })
  }
  g.chat.world.push({ id: g.nextId++, time: now, from: 'Sistem', system: true, text: `${playerName} ${server.name} sunucusuna katıldı. Hoş geldin!` })
  addFeed(g, now, '🏕️', `${playerName} (${TRIBES[tribe].name}) ${px}|${py} koordinatında yeni bir şehir kurdu`)
  g.reports.unshift({
    id: g.nextId++, time: now, kind: 'bilgi', read: false, title: 'Umaykut Online’a hoş geldin!',
    lines: [
      'Şehrinin çevresindeki madenler (orman, taş ocağı, tarla, demir) üretimini artırır. Taşçı, Oduncu, Tarla ve Demirci’yi yükselt.',
      'Acemi koruman bitene kadar kimse sana saldıramaz. Bu sürede Kışla kur, Sur yükselt.',
      'Tecrübe puanın (TP) yettiğinde haritada boş bir kareye yeni şehir kurabilirsin.',
      'Bir birliğe katıl; Umaykut’u 10. seviyeye çıkaran birlik sezonu kazanır (üç devletten de üye gerekir).',
    ],
  })
  return g
}

export function saveGame(g: Game) {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(g))
  } catch {
    /* depolama yoksa oyun yine çalışır */
  }
}

export function loadGame(): Game | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY)
    if (!raw) return null
    const g = JSON.parse(raw) as Game
    if (g.version !== 3) return null
    // eski kayıt: çember ve yeni binalar yoksa ekle
    for (const c of g.player.cities) {
      c.r ??= 2.5
      c.b.tapinak ??= 0
      c.b.okul ??= 0
      c.b.degirmen ??= 0
      c.b.siginak ??= 0
      c.guests ??= []
    }
    // eski kayıt: işçi sistemi yoksa köylüleri doldur ve kaynaklara dağıt
    for (const c of g.player.cities) if (c.folk == null || !c.work) seedWorkers(g, c)
    g.supports ??= []
    g.player.bonus ??= {}
    g.player.guardUses ??= 0
    for (const b of g.bots) b.cities.forEach((c, i) => (c.r ??= i ? 1.5 : 2.5))
    return g
  } catch {
    return null
  }
}

export function clearSave() {
  try {
    localStorage.removeItem(SAVE_KEY)
    localStorage.removeItem('umaykut-save-v1')
  } catch {
    /* yok say */
  }
}
