import {
  ALLIANCE_NAMES, BUILDINGS, BuildingId, FIRST_NAMES, NAME_PREFIX, NAME_SUFFIX, TRIBE_IDS, TribeId, VILLAGE_ADJ, VILLAGE_NOUN, res,
} from './data'
import { WORLD_LINES, pick } from './chatter'
import { Alliance, Bot, Game, addFeed } from './engine'

export const BOT_COUNT = 1000
const SIZE = 100
const SAVE_KEY = 'umaykut-save-v1'

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
    else if (r < 0.38) n = `${pick(NAME_PREFIX)}${first}`
    else if (r < 0.54) n = `${first}${pick(NAME_SUFFIX)}`
    else if (r < 0.62) n = `${first.toLowerCase()}_${pick(['tr', 'han', 'alp', '06', '34', '35', 'xx', 'kurt'])}`
    else if (r < 0.68) n = `xX${first}Xx`
    else if (r < 0.76) n = `${first} ${pick(NAME_SUFFIX)}`
    else if (r < 0.84) n = `${first.toLowerCase()}${Math.floor(rnd(1980, 2012))}`
    else n = first
    if (!used.has(n)) {
      used.add(n)
      return n
    }
  }
}

function makeVillage(owner: string) {
  return Math.random() < 0.3 ? `${owner} Obası` : `${pick(VILLAGE_ADJ)} ${pick(VILLAGE_NOUN)}`
}

export function generateWorld(playerName: string, tribe: TribeId, speed: number): Game {
  const now = Date.now()
  const occupied = new Set<string>()
  const used = new Set<string>([playerName])
  const bots: Bot[] = []
  const center = SIZE / 2

  for (let i = 0; i < BOT_COUNT; i++) {
    let x = 0
    let y = 0
    let r = 0
    do {
      r = 46 * Math.pow(Math.random(), 0.7)
      const a = Math.random() * Math.PI * 2
      x = Math.round(center + r * Math.cos(a))
      y = Math.round(center + r * Math.sin(a))
    } while (x < 1 || y < 1 || x > SIZE - 1 || y > SIZE - 1 || occupied.has(`${x},${y}`))
    occupied.add(`${x},${y}`)
    const centerBoost = 1.35 - (r / 46) * 0.8
    const pop = Math.max(3, Math.min(2600, Math.exp(gauss() * 0.95 + 4.4) * centerBoost))
    const inactive = Math.random() < 0.17
    const aggr = Math.pow(Math.random(), 1.4)
    const defF = 1.5 + (1 - aggr) * 5
    const atkF = 1 + aggr * 5
    const name = makeName(used)
    bots.push({
      id: i,
      name,
      village: makeVillage(name),
      tribe: pick(TRIBE_IDS),
      x,
      y,
      allianceId: null,
      pop,
      def: inactive ? pop * 0.3 : pop * defF * rnd(0.6, 1.1),
      atk: inactive ? 0 : pop * atkF * rnd(0.5, 1),
      res: inactive ? (500 + pop * 40) * rnd(0.4, 1) : (300 + pop * 12) * rnd(0.1, 0.9),
      activity: inactive ? 0 : rnd(0.3, 1),
      aggr,
      defF,
      atkF,
      online: !inactive && Math.random() < 0.3,
      grudge: 0,
      raidPts: inactive ? rnd(0, 20) : pop * aggr * rnd(0.5, 3),
      defPts: pop * (1 - aggr) * rnd(0.2, 1.5),
    })
  }

  // boylar: büyük boylar en güçlü oyuncuların etrafında toplanır
  const alliances: Alliance[] = []
  const byPop = [...bots].filter((b) => b.activity > 0).sort((a, b) => b.pop - a.pop)
  ALLIANCE_NAMES.forEach(([name, tag], k) => {
    const id = 'a' + k
    const size = Math.round(48 / Math.pow(k + 1, 0.55) + rnd(-3, 3))
    const leader = byPop.find((b) => !b.allianceId && Math.random() < 0.5) ?? byPop.find((b) => !b.allianceId)
    if (!leader) return
    leader.allianceId = id
    const near = bots
      .filter((b) => !b.allianceId && (b.activity > 0 || Math.random() < 0.3))
      .map((b) => ({ b, d: Math.hypot(b.x - leader.x, b.y - leader.y) + rnd(0, 12) }))
      .sort((a, b) => a.d - b.d)
      .slice(0, size - 1)
    for (const { b } of near) b.allianceId = id
    alliances.push({
      id,
      name,
      tag,
      umaykut: k === 0 ? 3 : k < 3 ? 2 : k < 10 ? Math.floor(rnd(0, 2)) : 0,
      progress: rnd(0, 20000),
      minPop: k < 5 ? Math.round(rnd(150, 300)) : k < 15 ? Math.round(rnd(30, 90)) : 0,
    })
  })

  // oyuncu kenarlarda doğar
  let px = 0
  let py = 0
  do {
    const r = rnd(32, 40)
    const a = Math.random() * Math.PI * 2
    px = Math.round(center + r * Math.cos(a))
    py = Math.round(center + r * Math.sin(a))
  } while (occupied.has(`${px},${py}`))

  const buildings = Object.fromEntries(BUILDINGS.map((b) => [b.id, 0])) as Record<BuildingId, number>
  buildings.otag = 1
  buildings.ambar = 1

  const g: Game = {
    version: 1,
    speed,
    player: {
      name: playerName,
      village: `${playerName} Obası`,
      tribe,
      x: px,
      y: py,
      buildings,
      res: res(750, 750, 750, 750),
      army: [0, 0, 0, 0],
      queue: [],
      train: [],
      allianceId: null,
      protectionUntil: now + (2 * 3600 * 1000) / speed,
      protectionNotified: false,
      raidPts: 0,
      defPts: 0,
      starveAcc: 0,
    },
    bots,
    alliances,
    out: [],
    incoming: [],
    reports: [],
    feed: [],
    chat: { world: [], alliance: [] },
    pending: [],
    application: null,
    worldStart: now - 12 * 24 * 3600 * 1000,
    created: now,
    lastTick: now,
    nextId: 1,
    winner: null,
    online: 0,
    mapSize: SIZE,
  }

  // geçmişten biraz sohbet ve olay
  for (let i = 0; i < 14; i++) {
    const b = pick(bots.filter((x) => x.online)) ?? pick(bots)
    const text = pick(WORLD_LINES)
      .replace(/\{x\}/g, String(b.x)).replace(/\{y\}/g, String(b.y))
      .replace(/\{name\}/g, pick(bots).name).replace(/\{ally2?\}/g, pick(alliances).name)
      .replace(/\{tribe\}/g, 'Hunlar').replace(/\{me\}/g, playerName).replace(/\{n\}/g, '3')
    g.chat.world.push({ id: g.nextId++, time: now - (14 - i) * 40000 - rnd(0, 30000), from: b.name, botId: b.id, tribe: b.tribe, text })
  }
  g.chat.world.push({ id: g.nextId++, time: now, from: 'Sistem', system: true, text: `${playerName} Altay dünyasına katıldı. Hoş geldin!` })
  addFeed(g, now, '🏕️', `${playerName} (${TRIBE_LABEL[tribe]}) ${px}|${py} koordinatında yeni bir oba kurdu`)
  return g
}

const TRIBE_LABEL: Record<TribeId, string> = { hun: 'Hun', gokturk: 'Göktürk', selcuklu: 'Selçuklu' }

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
    return g.version === 1 ? g : null
  } catch {
    return null
  }
}

export function clearSave() {
  try {
    localStorage.removeItem(SAVE_KEY)
  } catch {
    /* yok say */
  }
}
