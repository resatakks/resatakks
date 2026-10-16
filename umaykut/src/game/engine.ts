import {
  BUILDINGS, BUILDING_MAP, BuildingId, CATAPULT, CITY_TP, MAX_CITIES, MINE_RADIUS, MINE_TYPES, MineType, RAM, RES_KEYS, Res, SPY, STORED,
  TRIBES, TribeId, TrainBuilding, UNITS, UNIT_COUNT, cityFoundCost, emptyArmy, zeroRes,
} from './data'
import {
  ALLIANCE_LINES, DM_PROTECT_END, DM_STRONG, DM_WEAK, GENERIC_REPLIES, REPLIES, WORLD_LINES, pick,
} from './chatter'
import {
  type Thread, botDm, deliverDm, hasPeace, humanize, mentionReply, queueMsg, raidBanter, shuffle, socialTick, supportDm, thread, worldChatter,
} from './social'

// ---------------- tipler ----------------
export interface BotCity { x: number; y: number; name: string }
export interface Bot {
  id: number
  name: string
  village: string
  tribe: TribeId
  x: number
  y: number
  cities: BotCity[]
  allianceId: string | null
  pop: number
  def: number
  atk: number
  res: number
  sur: number
  activity: number // 0 = inaktif
  aggr: number
  defF: number
  atkF: number
  online: boolean
  grudge: number
  raidPts: number
  defPts: number
  lastSeen: number
}

export interface Alliance {
  id: string
  name: string
  tag: string
  color: string
  umaykut: number
  progress: number
  minPop: number
  playerOwned?: boolean
}

export interface City {
  id: number
  name: string
  x: number
  y: number
  b: Record<BuildingId, number>
  army: number[]
  queue: BuildJob[]
  train: TrainJob[]
}

export interface Player {
  name: string
  tribe: TribeId
  /** başkent koordinatı */
  x: number
  y: number
  cities: City[]
  res: Res
  elmas: number
  allianceId: string | null
  protectionUntil: number
  protectionNotified: boolean
  raidPts: number
  defPts: number
  starveAcc: number
  lastDaily: number
}

export interface BuildJob { b: BuildingId; to: number; start: number; end: number }
export interface TrainJob { b: TrainBuilding; unit: number; count: number; done: number; start: number; each: number }
export type MissionType = 'yagma' | 'saldiri' | 'casus'
export const MISSION_NAME: Record<MissionType, string> = { yagma: 'Yağma', saldiri: 'Saldırı', casus: 'Casusluk' }
export interface Outgoing {
  id: number
  type: MissionType
  cityId: number
  target: number
  tc: number // hedef şehir sırası
  army: number[]
  start: number
  arrive: number
  back: number
  returning: boolean
  loot: Res
}
export interface Incoming { id: number; from: number; fc: number; cityId: number; power: number; army: number[]; launch: number; arrive: number }

export interface Side {
  name: string
  city: string
  tag: string | null
  tagColor?: string
  tribe: TribeId
  sent: number[]
  lost: number[]
  me?: boolean
}
export interface Battle { att: Side; def: Side; loot: Res; atkPts: number; defPts: number; notes: string[] }
export type ReportKind = 'saldiri' | 'savunma' | 'kesif' | 'mesaj' | 'bilgi'
export interface Report { id: number; time: number; kind: ReportKind; title: string; lines: string[]; read: boolean; win?: boolean; from?: number; battle?: Battle }
export interface ChatMsg { id: number; time: number; from: string; botId?: number; tribe?: TribeId; text: string; me?: boolean; system?: boolean }
export interface FeedItem { id: number; time: number; icon: string; text: string }
export interface Pending { at: number; typeAt: number; channel: 'world' | 'alliance' | 'dm'; from: number; text: string; topic?: Thread['topic']; invite?: string | null }

export interface Game {
  version: 3
  server: string
  speed: number
  seed: number
  seasonEnd: number
  player: Player
  bots: Bot[]
  alliances: Alliance[]
  out: Outgoing[]
  incoming: Incoming[]
  reports: Report[]
  feed: FeedItem[]
  chat: { world: ChatMsg[]; alliance: ChatMsg[] }
  pending: Pending[]
  dms: Thread[]
  application: { allianceId: string; at: number } | null
  worldStart: number
  created: number
  lastTick: number
  nextId: number
  winner: string | null
  online: number
  mapSize: number
  rev: number
}

// ---------------- harita: madenler (tohumdan, kaydedilmez) ----------------
function hash(seed: number, x: number, y: number, k = 0) {
  let h = (seed ^ Math.imul(x + 1013, 374761393) ^ Math.imul(y + 7919, 668265263) ^ Math.imul(k + 1, 2246822519)) >>> 0
  h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0
  h = (h ^ (h >>> 16)) >>> 0
  return h / 4294967296
}
export interface Mine { type: MineType; level: number }
export function mineAt(g: { seed: number; mapSize: number }, x: number, y: number): Mine | null {
  if (x < 0 || y < 0 || x >= g.mapSize || y >= g.mapSize) return null
  if (hash(g.seed, x, y) > 0.3) return null
  const t = MINE_TYPES[Math.floor(hash(g.seed, x, y, 1) * 4)]
  const level = 1 + Math.floor(Math.pow(hash(g.seed, x, y, 2), 1.6) * 9)
  return { type: t, level }
}
/** süs: boş çimende küçük çalı/çiçek */
export const decorAt = (g: { seed: number }, x: number, y: number) => {
  const h = hash(g.seed, x, y, 3)
  return h < 0.12 ? 1 : h < 0.2 ? 2 : 0
}

export type Occ = { bot: number; ci: number } | { city: number }
let occCache: { g: Game | null; rev: number; map: Map<number, Occ> } = { g: null, rev: -1, map: new Map() }
export const key = (x: number, y: number) => y * 10000 + x
export function occupancy(g: Game) {
  if (occCache.g === g && occCache.rev === g.rev) return occCache.map
  const map = new Map<number, Occ>()
  for (const b of g.bots) b.cities.forEach((c, ci) => map.set(key(c.x, c.y), { bot: b.id, ci }))
  for (const c of g.player.cities) map.set(key(c.x, c.y), { city: c.id })
  occCache = { g, rev: g.rev, map }
  return map
}

export function minesNear(g: Game, x: number, y: number, type?: MineType) {
  const out: { x: number; y: number; m: Mine }[] = []
  const r = Math.ceil(MINE_RADIUS)
  for (let dy = -r; dy <= r; dy++) {
    for (let dx = -r; dx <= r; dx++) {
      if (Math.hypot(dx, dy) > MINE_RADIUS) continue
      const m = mineAt(g, x + dx, y + dy)
      if (m && (!type || m.type === type)) out.push({ x: x + dx, y: y + dy, m })
    }
  }
  return out
}

// ---------------- formüller ----------------
export const prodPerMin = (level: number) => (level === 0 ? 0 : Math.round(8 * Math.pow(1.36, level - 1)))
export const storageCap = (level: number) => Math.round(1200 * Math.pow(1.33, level))
export const buildCost = (id: BuildingId, to: number): Res => {
  const b = BUILDING_MAP[id].base
  const m = Math.pow(1.55, to - 1)
  const r = zeroRes()
  for (const k of RES_KEYS) r[k] = Math.round((b[k] ?? 0) * m)
  return r
}
export const buildTime = (g: Game, c: City, id: BuildingId, to: number) =>
  (BUILDING_MAP[id].time * 1000 * Math.pow(1.45, to - 1) * Math.pow(0.95, c.b.merkez - 1)) / g.speed
export const trainTime = (g: Game, c: City, unit: number) => {
  const u = UNITS[g.player.tribe][unit]
  const lvl = c.b[u.building]
  return (u.time * 1000 * Math.pow(0.94, Math.max(0, lvl - 1))) / g.speed
}
export const umaykutCost = (level: number) => Math.round(40000 * Math.pow(1.6, level))
export const levelPop = (l: number) => (l * (l + 1)) / 2
export const unitCost = (tribe: TribeId, unit: number): Res => {
  const r = zeroRes()
  const c = UNITS[tribe][unit].cost
  for (const k of RES_KEYS) r[k] = c[k] ?? 0
  return r
}

export const cityPop = (c: City) => BUILDINGS.reduce((s, b) => s + levelPop(c.b[b.id]), 0)
export const playerPop = (p: Player) => p.cities.reduce((s, c) => s + cityPop(c), 0)
export const tp = (p: Player) => Math.floor(playerPop(p) + p.raidPts + p.defPts)
export const tpLevel = (t: number) => Math.floor(Math.sqrt(t / 30)) + 1
export const tpForLevel = (l: number) => 30 * (l - 1) * (l - 1)
export const cityById = (g: Game, id: number) => g.player.cities.find((c) => c.id === id) ?? g.player.cities[0]

export function mineFactor(g: Game, c: City, type: MineType) {
  const sum = minesNear(g, c.x, c.y, type).reduce((s, m) => s + m.m.level, 0)
  return Math.min(3.5, 0.5 + sum * 0.1)
}

export function cityRates(g: Game, c: City): Res {
  const p = g.player
  const r = zeroRes()
  const mineBonus = p.tribe === 'gokturk' ? 1.15 : 1
  for (const b of BUILDINGS) {
    if (!b.produces) continue
    r[b.produces] = (3 + prodPerMin(c.b[b.id]) * mineFactor(g, c, b.produces)) * mineBonus
  }
  r.altin = cityPop(c) * 0.12 * (p.tribe === 'selcuklu' ? 1.2 : 1)
  r.at = c.b.ahir * 0.4
  return r
}

export function upkeepPerMin(g: Game) {
  const units = UNITS[g.player.tribe]
  return totalArmy(g).reduce((s, n, i) => s + n * units[i].upkeep, 0)
}

export function rates(g: Game): Res {
  const r = zeroRes()
  for (const c of g.player.cities) {
    const cr = cityRates(g, c)
    for (const k of RES_KEYS) r[k] += cr[k]
  }
  r.tahil -= upkeepPerMin(g)
  for (const k of RES_KEYS) r[k] *= g.speed
  return r
}

export const cap = (g: Game) => g.player.cities.reduce((s, c) => s + storageCap(c.b.ambar), 0)

export function totalArmy(g: Game) {
  const t = emptyArmy()
  for (const c of g.player.cities) c.army.forEach((n, i) => (t[i] += n))
  for (const m of g.out) m.army.forEach((n, i) => (t[i] += n))
  return t
}

export function canAfford(p: Player, c: Res) {
  return RES_KEYS.every((k) => p.res[k] >= c[k])
}
function pay(p: Player, c: Res) {
  for (const k of RES_KEYS) p.res[k] -= c[k]
}

export function dist(ax: number, ay: number, bx: number, by: number) {
  return Math.hypot(ax - bx, ay - by)
}

export function botDefense(b: Bot) {
  return (b.def + 15 + b.pop * 1.5) * (1 + b.sur * 0.06) * (b.tribe === 'gokturk' ? 1.15 : b.tribe === 'hun' ? 0.9 : 1)
}

export function cityDefense(g: Game, c: City) {
  const p = g.player
  const units = UNITS[p.tribe]
  const troops = c.army.reduce((s, n, i) => s + n * units[i].def, 0)
  return (troops + 15 + cityPop(c) * 1.5) * (1 + c.b.sur * 0.06)
}

export function attackPower(tribe: TribeId, army: number[]) {
  const units = UNITS[tribe]
  return army.reduce((s, n, i) => s + n * units[i].atk, 0)
}

/** botun gücünü gerçekçi bir birlik dağılımına çevirir (raporlarda görünür) */
export function botArmy(b: Bot, power: number, mode: 'atk' | 'def', siege = false) {
  const units = UNITS[b.tribe]
  const w = units.map((u, i) => {
    if (i === SPY) return mode === 'def' ? 0.05 : 0
    if (u.kind === 'kusatma') return siege ? 0.15 : 0
    const stat = mode === 'atk' ? u.atk : u.def
    const pref = mode === 'atk' ? (u.kind === 'suvari' ? 1 + b.atkF * 0.3 : 0.6) : u.kind === 'suvari' ? 0.4 : 1 + b.defF * 0.2
    return (stat / 30) * pref * (0.4 + hash(b.id, i, mode === 'atk' ? 1 : 2) * 1.2)
  })
  const ws = w.reduce((s, x) => s + x, 0) || 1
  return units.map((u, i) => {
    const stat = Math.max(1, mode === 'atk' ? u.atk : u.def)
    return Math.max(0, Math.round((power * w[i]) / ws / stat))
  })
}

export interface RankRow { id: number; name: string; tribe: TribeId; allianceId: string | null; cities: number; pop: number; atk: number; def: number; tp: number }
export function rankings(g: Game, by: 'tp' | 'atk' | 'def' = 'tp'): RankRow[] {
  const list: RankRow[] = g.bots.map((b) => ({
    id: b.id, name: b.name, tribe: b.tribe, allianceId: b.allianceId, cities: b.cities.length,
    pop: Math.floor(b.pop), atk: Math.floor(b.raidPts), def: Math.floor(b.defPts), tp: Math.floor(b.pop + b.raidPts + b.defPts),
  }))
  const p = g.player
  list.push({ id: -1, name: p.name, tribe: p.tribe, allianceId: p.allianceId, cities: p.cities.length, pop: playerPop(p), atk: Math.floor(p.raidPts), def: Math.floor(p.defPts), tp: tp(p) })
  list.sort((a, b) => b[by] - a[by])
  return list
}

export function allianceStats(g: Game) {
  const map = new Map<string, { pop: number; members: number; tribes: Set<TribeId>; points: number; cities: number }>()
  for (const a of g.alliances) map.set(a.id, { pop: 0, members: 0, tribes: new Set(), points: 0, cities: 0 })
  for (const b of g.bots) {
    if (!b.allianceId) continue
    const s = map.get(b.allianceId)
    if (!s) continue
    s.pop += b.pop
    s.points += b.pop + b.raidPts + b.defPts
    s.members++
    s.cities += b.cities.length
    s.tribes.add(b.tribe)
  }
  if (g.player.allianceId) {
    const s = map.get(g.player.allianceId)
    if (s) {
      s.pop += playerPop(g.player)
      s.points += tp(g.player)
      s.members++
      s.cities += g.player.cities.length
      s.tribes.add(g.player.tribe)
    }
  }
  return map
}

// ---------------- yardımcılar ----------------
const nid = (g: Game) => g.nextId++
const chance = (ratePerSec: number, dt: number) => Math.random() < 1 - Math.exp(-ratePerSec * dt)
const rnd = (a: number, b: number) => a + Math.random() * (b - a)
export const allianceOf = (g: Game, id: string | null) => (id ? g.alliances.find((a) => a.id === id) ?? null : null)

function addReport(g: Game, r: Omit<Report, 'id' | 'read'>) {
  g.reports.unshift({ ...r, id: nid(g), read: false })
  if (g.reports.length > 200) g.reports.length = 200
}
export function addFeed(g: Game, time: number, icon: string, text: string) {
  g.feed.unshift({ id: nid(g), time, icon, text })
  if (g.feed.length > 80) g.feed.length = 80
}
export function addChat(g: Game, channel: 'world' | 'alliance', msg: Omit<ChatMsg, 'id'>) {
  const list = g.chat[channel]
  list.push({ ...msg, id: nid(g) })
  if (list.length > 120) list.splice(0, list.length - 120)
}

export function randomBot(g: Game, filter: (b: Bot) => boolean, tries = 40): Bot | null {
  for (let i = 0; i < tries; i++) {
    const b = g.bots[Math.floor(Math.random() * g.bots.length)]
    if (filter(b)) return b
  }
  return null
}

export function fill(g: Game, text: string, bot?: Bot) {
  const ally = g.alliances[Math.floor(Math.random() * Math.min(12, g.alliances.length))]
  const ally2 = pick(g.alliances)
  const other = randomBot(g, (b) => b !== bot) ?? g.bots[0]
  const inactive = randomBot(g, (b) => b.activity === 0) ?? other
  const tribe = bot ? TRIBES[bot.tribe].name : pick(Object.values(TRIBES)).name
  return text
    .replace(/\{x\}/g, String(text.includes('inaktif') ? inactive.x : (bot ?? other).x))
    .replace(/\{y\}/g, String(text.includes('inaktif') ? inactive.y : (bot ?? other).y))
    .replace(/\{name\}/g, other.name)
    .replace(/\{ally2\}/g, ally2.name)
    .replace(/\{ally\}/g, (bot && allianceOf(g, bot.allianceId)?.name) || ally.name)
    .replace(/\{me\}/g, g.player.name)
    .replace(/\{tribe\}/g, tribe)
    .replace(/\{n\}/g, String(Math.round(rnd(1, 9)) * (text.includes('kaynak') ? 1000 : 1)))
}

export function sideOfBot(g: Game, b: Bot, ci: number, sent: number[], lost: number[]): Side {
  const a = allianceOf(g, b.allianceId)
  return { name: b.name, city: b.cities[ci]?.name ?? b.village, tag: a?.tag ?? null, tagColor: a?.color, tribe: b.tribe, sent, lost }
}
export function sideOfPlayer(g: Game, c: City, sent: number[], lost: number[]): Side {
  const a = allianceOf(g, g.player.allianceId)
  return { name: g.player.name, city: c.name, tag: a?.tag ?? null, tagColor: a?.color, tribe: g.player.tribe, sent, lost, me: true }
}

// ---------------- oyuncu eylemleri: inşaat ----------------
export function canBuild(g: Game, c: City, id: BuildingId): string | null {
  const p = g.player
  const def = BUILDING_MAP[id]
  const queued = c.queue.filter((q) => q.b === id).length
  const to = c.b[id] + queued + 1
  if (to > def.max) return 'En yüksek seviyede'
  for (const [rid, lvl] of Object.entries(def.req ?? {})) {
    if (c.b[rid as BuildingId] < (lvl as number)) return `Gerekli: ${BUILDING_MAP[rid as BuildingId].name} ${lvl}. seviye`
  }
  if (c.queue.length >= 2) return 'İnşaat sırası dolu'
  const cost = buildCost(id, to)
  if (STORED.some((k) => cost[k] > cap(g))) return 'Ambar kapasitesi yetersiz'
  if (!canAfford(p, cost)) return 'Kaynak yetersiz'
  return null
}

export function build(g: Game, cityId: number, id: BuildingId, now: number) {
  const c = cityById(g, cityId)
  if (canBuild(g, c, id)) return
  const to = c.b[id] + c.queue.filter((q) => q.b === id).length + 1
  pay(g.player, buildCost(id, to))
  const start = c.queue.length ? c.queue[c.queue.length - 1].end : now
  c.queue.push({ b: id, to, start, end: start + buildTime(g, c, id, to) })
}

export function cancelBuild(g: Game, cityId: number, index: number) {
  const c = cityById(g, cityId)
  if (!c.queue[index]) return
  const removed = c.queue.splice(index)
  for (const r of removed) {
    const cost = buildCost(r.b, r.to)
    for (const k of RES_KEYS) g.player.res[k] += cost[k] * 0.8
  }
}

export const elmasCost = (ms: number) => Math.max(1, Math.ceil(ms / 120000))

export function finishBuildNow(g: Game, cityId: number, now: number): string | null {
  const c = cityById(g, cityId)
  const j = c.queue[0]
  if (!j) return null
  const cost = elmasCost(j.end - now)
  if (g.player.elmas < cost) return `Yeterli elmasın yok (${cost} gerekli)`
  g.player.elmas -= cost
  const d = j.end - now
  for (const q of c.queue) {
    q.start -= d
    q.end -= d
  }
  return null
}

export function buyProtection(g: Game, now: number): string | null {
  const COST = 30
  if (g.player.elmas < COST) return `Koruma için ${COST} elmas gerekir`
  if (g.out.some((m) => m.type !== 'casus' && !m.returning)) return 'Seferdeki ordun varken koruma alınamaz'
  g.player.elmas -= COST
  g.player.protectionUntil = Math.max(now, g.player.protectionUntil) + 24 * 3600 * 1000
  g.player.protectionNotified = false
  g.incoming = []
  return null
}

// ---------------- şehir kurma ----------------
export function canFoundCity(g: Game, x: number, y: number): string | null {
  const p = g.player
  const n = p.cities.length
  if (n >= MAX_CITIES) return 'En fazla 10 şehrin olabilir.'
  if (tp(p) < CITY_TP[n]) return `Köy kurulamıyor, tecrübe puanınız yetersiz! Yeni köy kurmak için gereken tecrübe puanı: ${CITY_TP[n]}`
  if (x < 1 || y < 1 || x >= g.mapSize - 1 || y >= g.mapSize - 1) return 'Harita sınırına köy kurulamaz.'
  if (mineAt(g, x, y)) return 'Maden üzerine köy kurulamaz.'
  for (const [k] of occupancy(g)) {
    const ox = k % 10000
    const oy = Math.floor(k / 10000)
    if (dist(ox, oy, x, y) < 3) return 'Başka bir şehre çok yakın. Şehirler arasında en az 3 kare olmalı.'
  }
  if (!canAfford(p, cityFoundCost(n))) return 'Köy kurmak için kaynak yetersiz.'
  return null
}

export function newCityBuildings(): Record<BuildingId, number> {
  const b = Object.fromEntries(BUILDINGS.map((x) => [x.id, 0])) as Record<BuildingId, number>
  b.merkez = 1
  b.ambar = 1
  return b
}

export function foundCity(g: Game, x: number, y: number, name: string, now: number): string | null {
  const err = canFoundCity(g, x, y)
  if (err) return err
  const p = g.player
  pay(p, cityFoundCost(p.cities.length))
  const c: City = { id: nid(g), name: name.trim().slice(0, 16) || `şehir${p.cities.length + 1}`, x, y, b: newCityBuildings(), army: emptyArmy(), queue: [], train: [] }
  p.cities.push(c)
  g.rev++
  addFeed(g, now, '🏕️', `${p.name}, ${x}|${y} koordinatında yeni bir şehir kurdu: ${c.name}`)
  addReport(g, { time: now, kind: 'bilgi', title: `Yeni şehir kuruldu: ${c.name}`, lines: [`${c.name} (${x}|${y}) artık senin. Yakındaki madenler bu şehrin üretimini artırır.`] })
  return null
}

export function renameCity(g: Game, cityId: number, name: string) {
  const c = cityById(g, cityId)
  if (name.trim()) c.name = name.trim().slice(0, 16)
}

// ---------------- eğitim ----------------
export function maxTrainable(g: Game, unit: number) {
  const c = unitCost(g.player.tribe, unit)
  return Math.floor(Math.min(...RES_KEYS.map((k) => (c[k] ? g.player.res[k] / c[k] : Infinity))))
}

export function train(g: Game, cityId: number, unit: number, count: number, now: number): string | null {
  const c = cityById(g, cityId)
  const u = UNITS[g.player.tribe][unit]
  if (c.b[u.building] < 1) return `${BUILDING_MAP[u.building].name} gerekli`
  count = Math.floor(count)
  if (count < 1) return 'Geçersiz sayı'
  if (count > maxTrainable(g, unit)) return 'Kaynak yetersiz'
  const total = unitCost(g.player.tribe, unit)
  for (const k of RES_KEYS) total[k] *= count
  pay(g.player, total)
  const same = c.train.filter((t) => t.b === u.building)
  const last = same[same.length - 1]
  const start = last ? last.start + last.count * last.each : now
  c.train.push({ b: u.building, unit, count, done: 0, start: Math.max(start, now), each: trainTime(g, c, unit) })
  return null
}

// ---------------- pazar ----------------
export const marketRate = (level: number) => Math.min(0.9, 0.5 + level * 0.02)
export function trade(g: Game, cityId: number, from: keyof Res, to: keyof Res, amount: number): string | null {
  const c = cityById(g, cityId)
  if (c.b.pazar < 1) return 'Pazar gerekli'
  amount = Math.floor(amount)
  if (amount <= 0) return 'Geçersiz miktar'
  if (g.player.res[from] < amount) return 'Yeterli kaynağın yok'
  // altın ve at değerli: 1 altın = 4 kaynak, 1 at = 25 kaynak
  const value = (k: keyof Res) => (k === 'altin' ? 4 : k === 'at' ? 25 : 1)
  const got = Math.floor((amount * value(from) * marketRate(c.b.pazar)) / value(to))
  if (got <= 0) return 'Miktar çok az'
  g.player.res[from] -= amount
  g.player.res[to] += got
  return null
}

// ---------------- sefer ----------------
export function travelMs(g: Game, army: number[], d: number) {
  const units = UNITS[g.player.tribe]
  const speed = Math.min(...army.map((n, i) => (n > 0 ? units[i].speed : Infinity)))
  return Math.max(15000, (d / speed) * 60000) / g.speed
}

export function sendMission(g: Game, cityId: number, type: MissionType, target: number, tc: number, army: number[], now: number): string | null {
  const p = g.player
  const c = cityById(g, cityId)
  if (army.every((n) => n <= 0)) return 'En az bir birim seçmelisin'
  if (army.some((n, i) => n < 0 || n > c.army[i])) return 'Şehirde o kadar asker yok'
  if (type === 'casus' && army.some((n, i) => n > 0 && i !== SPY)) return 'Casusluğa yalnız casus gönderilir'
  if (type !== 'casus' && army.every((n, i) => n === 0 || i === SPY)) return 'Saldırı için savaşçı birim seçmelisin'
  const b = g.bots[target]
  if (!b) return 'Hedef bulunamadı'
  const t = b.cities[tc] ?? b.cities[0]
  if (b.allianceId && b.allianceId === p.allianceId && type !== 'casus') return 'Kendi birliğine saldıramazsın'
  if (p.protectionUntil > now && type !== 'casus') p.protectionUntil = now // saldırı korumayı bitirir
  if (type !== 'casus' && hasPeace(g, target, now)) {
    const th = thread(g, target)
    th.peaceUntil = 0
    th.topic = 'traitor'
    th.mood = -1
  }
  const ms = travelMs(g, army, dist(c.x, c.y, t.x, t.y))
  army.forEach((n, i) => (c.army[i] -= n))
  g.out.push({ id: nid(g), type, cityId: c.id, target, tc, army: [...army], start: now, arrive: now + ms, back: now + 2 * ms, returning: false, loot: zeroRes() })
  return null
}

export function recall(g: Game, id: number, now: number) {
  const m = g.out.find((x) => x.id === id)
  if (!m || m.returning) return
  const gone = now - m.start
  m.returning = true
  m.arrive = now
  m.back = now + gone
}

// ---------------- birlik ----------------
export function applyAlliance(g: Game, allianceId: string, now: number) {
  if (g.player.allianceId || g.application) return
  g.application = { allianceId, at: now + rnd(6000, 20000) }
}

export function foundAlliance(g: Game, name: string, tag: string, now: number) {
  if (g.player.allianceId) return
  const id = 'p' + nid(g)
  g.alliances.push({ id, name, tag: tag.toUpperCase().slice(0, 4), color: '#ffd24a', umaykut: 0, progress: 0, minPop: 0, playerOwned: true })
  g.player.allianceId = id
  g.chat.alliance = []
  addChat(g, 'alliance', { time: now, from: 'Sistem', system: true, text: `${name} birliği kuruldu. Diğer oyuncular zamanla katılabilir.` })
  addFeed(g, now, '🏕️', `${g.player.name} yeni bir birlik kurdu: ${name} [${tag.toUpperCase()}]`)
}

export function leaveAlliance(g: Game, now: number) {
  const a = allianceOf(g, g.player.allianceId)
  if (!a) return
  g.player.allianceId = null
  g.chat.alliance = []
  if (a.playerOwned) {
    for (const b of g.bots) if (b.allianceId === a.id) b.allianceId = null
    g.alliances = g.alliances.filter((x) => x.id !== a.id)
  }
  addFeed(g, now, '🚪', `${g.player.name}, ${a.name} birliğinden ayrıldı`)
}

/** Umaykut’a bağış: altın 4 kat değerli sayılır */
export function contribute(g: Game, amount: Res, now: number) {
  const a = allianceOf(g, g.player.allianceId)
  if (!a) return
  let total = 0
  for (const k of RES_KEYS) {
    if (k === 'at') continue
    const v = Math.max(0, Math.min(Math.floor(amount[k]), Math.floor(g.player.res[k])))
    g.player.res[k] -= v
    total += v * (k === 'altin' ? 4 : 1)
  }
  a.progress += total
  if (total > 0) {
    addChat(g, 'alliance', { time: now, from: 'Sistem', system: true, text: `${g.player.name} Umaykut’a ${total.toLocaleString('tr-TR')} değerinde kaynak bağışladı.` })
    checkUmaykut(g, a, now)
  }
}

export function sendChat(g: Game, channel: 'world' | 'alliance', text: string, now: number) {
  text = text.trim().slice(0, 200)
  if (!text) return
  addChat(g, channel, { time: now, from: g.player.name, tribe: g.player.tribe, text, me: true })
  const pool = channel === 'alliance' ? g.bots.filter((b) => b.allianceId === g.player.allianceId && b.activity > 0) : null
  const matched = REPLIES.filter((r) => r.re.test(text))
  const nReplies = matched.length ? 1 + (matched.length > 1 || Math.random() < 0.4 ? 1 : 0) : Math.random() < 0.55 ? 1 : 0
  for (let i = 0; i < nReplies; i++) {
    const bot = pool && pool.length ? pick(pool) : randomBot(g, (b) => b.online) ?? pick(g.bots)
    const lines = matched.length ? matched[i % matched.length].lines : GENERIC_REPLIES
    let reply = humanize(fill(g, pick(lines), bot), bot)
    if (Math.random() < 0.6) reply = `@${g.player.name} ${reply}`
    queueMsg(g, { at: now + rnd(2500, 9000) * (i + 1), channel, from: bot.id, text: reply })
  }
  if (!nReplies || Math.random() < 0.5) mentionReply(g, channel, text, now)
}

// ---------------- savaş ----------------
function lossRatios(att: number, def: number, type: 'yagma' | 'saldiri') {
  const win = att > def
  const x = Math.pow(Math.min(att, def) / Math.max(att, def, 1), 1.5)
  if (type === 'yagma') {
    const wl = x / (1 + x)
    const ll = 1 / (1 + x)
    return { win, attLoss: win ? wl : ll, defLoss: win ? ll : wl }
  }
  return { win, attLoss: win ? x : 1, defLoss: win ? 1 : x }
}

function applyLoss(army: number[], ratio: number) {
  return army.map((n) => {
    const exact = n * ratio
    const l = Math.floor(exact) + (Math.random() < exact - Math.floor(exact) ? 1 : 0)
    return Math.min(n, l)
  })
}

const fmt = (n: number) => Math.round(n).toLocaleString('tr-TR')
const BOT_BUILDINGS = ['Ambar', 'Kışla', 'Tarla', 'Taşçı', 'Oduncu', 'Demirci', 'Ahır', 'Pazar']

function siegeNotes(rams: number, cats: number, win: boolean, surBefore: number, drop: number, catNote: string | null) {
  const notes: string[] = []
  if (rams > 0) {
    if (drop > 0) notes.push(`Şehirdeki Sur seviyesi ${surBefore} seviyesinden ${surBefore - drop} seviyesine düştü`)
    else if (surBefore > 0) notes.push('Şehirdeki Sur hasar verildi ancak yapı seviye kaybetmedi')
  }
  if (cats > 0 && catNote) notes.push(catNote)
  else if (cats > 0 && !win) notes.push('Mancınıklar hedefe ulaşamadı')
  return notes
}

function resolveOutgoing(g: Game, m: Outgoing, now: number) {
  const b = g.bots[m.target]
  const p = g.player
  const c = cityById(g, m.cityId)
  const tcity = b.cities[m.tc] ?? b.cities[0]
  m.returning = true
  if (m.type === 'casus') {
    const noise = () => rnd(0.9, 1.1)
    const defArmy = botArmy(b, botDefense(b) / (1 + b.sur * 0.06) * 0.8, 'def')
    const caught = Math.random() < Math.min(0.5, defArmy[SPY] / Math.max(1, m.army[SPY] * 4))
    if (caught) {
      const lost = [...m.army]
      m.army = emptyArmy()
      addReport(g, { time: m.arrive, kind: 'kesif', title: `Casusların yakalandı: ${tcity.name} (${tcity.x}|${tcity.y})`, from: b.id, lines: [`${b.name} şehrinde casuslarını yakaladı. ${lost[SPY]} casus öldü.`] })
      return
    }
    addReport(g, {
      time: m.arrive, kind: 'kesif', title: `Casus raporu: ${tcity.name} (${tcity.x}|${tcity.y})`, from: b.id,
      battle: { att: sideOfPlayer(g, c, m.army, emptyArmy()), def: sideOfBot(g, b, m.tc, defArmy, emptyArmy()), loot: zeroRes(), atkPts: 0, defPts: 0, notes: [] },
      lines: [
        `Sahibi: ${b.name} · ${TRIBES[b.tribe].name} · ${b.cities.length} şehir · Nüfus ${fmt(b.pop)}`,
        `Tahmini savunma gücü: ~${fmt(botDefense(b) * noise())}`,
        `Sur seviyesi: ${b.sur}`,
        `Depodaki tahmini kaynak: ~${fmt(b.res * noise())}`,
        b.activity === 0 ? 'Şehir çok sessiz, uzun süredir kimse ilgilenmiyor gibi. (inaktif olabilir)' : b.online ? 'Şehrin sahibi şu an çevrimiçi!' : 'Şehirde hareketlilik var.',
      ],
    })
    return
  }
  const type = m.type
  const sent = [...m.army]
  const att = attackPower(p.tribe, m.army) * (p.tribe === 'hun' ? 1 + 0.15 * (m.army.slice(5, 8).reduce((s, n) => s + n, 0) / Math.max(1, m.army.reduce((s, n) => s + n, 0))) : 1)
  const def = botDefense(b) * rnd(0.95, 1.05)
  const { win, attLoss, defLoss } = lossRatios(att, def, type)
  const defArmy = botArmy(b, (b.def + 15 + b.pop * 1.5), 'def')
  const defLost = applyLoss(defArmy, defLoss)
  const lost = applyLoss(m.army, attLoss)
  m.army = m.army.map((n, i) => n - lost[i])
  const defBefore = botDefense(b)
  b.def = Math.max(0, b.def * (1 - defLoss))
  b.defPts += (att * attLoss) / 100
  const survivors = m.army.reduce((s, n) => s + n, 0)
  if (win && survivors > 0) {
    const units = UNITS[p.tribe]
    const carry = m.army.reduce((s, n, i) => s + n * units[i].carry, 0)
    const total = Math.min(carry, b.res)
    b.res -= total
    const keys: (keyof Res)[] = ['tas', 'odun', 'tahil', 'demir', 'altin']
    const w = keys.map((k) => (k === 'altin' ? 0.25 : 1) * rnd(0.6, 1.4))
    const ws = w.reduce((s, x) => s + x, 0)
    keys.forEach((k, i) => (m.loot[k] = Math.floor(((total * w[i]) / ws) / (k === 'altin' ? 4 : 1))))
    if (m.army.slice(5, 8).some((n) => n > 0) && b.activity > 0) m.loot.at = Math.floor(rnd(0, 0.03) * carry / 25)
  }
  // kuşatma
  const rams = type === 'saldiri' ? m.army[RAM] : 0
  const cats = type === 'saldiri' ? m.army[CATAPULT] : 0
  const surBefore = b.sur
  let drop = 0
  let catNote: string | null = null
  if (win && rams > 0) {
    drop = Math.min(b.sur, Math.floor(Math.sqrt(rams) * rnd(0.6, 1.3)))
    b.sur -= drop
  }
  if (win && cats > 0) {
    const name = pick(BOT_BUILDINGS)
    const lvl = Math.max(1, Math.min(20, Math.round(Math.sqrt(b.pop) / 1.6)))
    const d = Math.min(lvl, Math.floor(Math.sqrt(cats) * rnd(0.5, 1.2)))
    catNote = d > 0 ? `Şehirdeki ${name} seviyesi ${lvl} seviyesinden ${lvl - d} seviyesine düştü` : `Şehirdeki ${name} hasar verildi ancak yapı seviye kaybetmedi`
    b.pop = Math.max(3, b.pop - d * 3)
  }
  const killed = defBefore * defLoss
  const atkPts = Math.round(killed / 10)
  const defPts = Math.round((att * attLoss) / 10)
  p.raidPts += atkPts
  if (win) p.elmas += Math.random() < 0.15 ? 1 : 0
  const title = `${MISSION_NAME[type]}: ${tcity.name} (${tcity.x}|${tcity.y}) — ${win ? 'Zafer' : 'Yenilgi'}`
  const notes = siegeNotes(rams, cats, win, surBefore, drop, catNote)
  if (survivors === 0) notes.push('Hiçbir askerin geri dönmedi.')
  addReport(g, {
    time: m.arrive, kind: 'saldiri', title, win, from: b.id, lines: [],
    battle: { att: sideOfPlayer(g, c, sent, lost), def: sideOfBot(g, b, m.tc, defArmy, defLost), loot: { ...m.loot }, atkPts, defPts, notes },
  })
  if (win) addFeed(g, m.arrive, '🗡️', `${p.name}, ${b.name} adlı oyuncunun şehrini ${type === 'yagma' ? 'yağmaladı' : 'bastı'}!`)

  // tepki
  if (b.activity > 0) {
    if (b.aggr > 0.35 && b.atk > att * 0.3) {
      b.grudge = now + (rnd(2, 10) * 60000) / g.speed
      const th = thread(g, b.id)
      th.mood = Math.max(-1, th.mood - 0.4)
      if (th.topic === 'traitor') botDm(g, b, pick(['barış yapmıştık! şimdi göreceksin', 'sözünü bozdun, birliğime de söyledim', 'hain! bunu unutmayacağım']), m.arrive + rnd(15000, 60000), 'traitor')
      else if (Math.random() < 0.7) botDm(g, b, pick(DM_STRONG), m.arrive + rnd(20000, 90000), 'threat')
    } else if (Math.random() < 0.6) {
      thread(g, b.id).mood -= 0.2
      botDm(g, b, pick(DM_WEAK), m.arrive + rnd(20000, 90000), 'peace')
    }
  }
}

function nearestCity(g: Game, x: number, y: number) {
  let best = g.player.cities[0]
  let bd = Infinity
  for (const c of g.player.cities) {
    const d = dist(c.x, c.y, x, y)
    if (d < bd) { bd = d; best = c }
  }
  return best
}

function launchBotAttack(g: Game, b: Bot, now: number, revenge: boolean) {
  const target = nearestCity(g, b.x, b.y)
  const d = dist(target.x, target.y, b.x, b.y)
  const speed = rnd(3, 7.5)
  const power = b.atk * rnd(0.35, 0.85)
  if (power < 20 || hasPeace(g, b.id, now)) return
  const travel = Math.max(30000, (d / speed) * 60000) / g.speed
  const army = botArmy(b, power, 'atk', power > 3000 && Math.random() < 0.5)
  g.incoming.push({ id: nid(g), from: b.id, fc: 0, cityId: target.id, power, army, launch: now, arrive: now + travel })
  if (revenge && Math.random() < 0.5) botDm(g, b, pick(['ordum yolda 😈', 'hazırlan', 'geliyorum {me}', 'sırada sen varsın']), now + rnd(5000, 30000), 'threat')
  b.atk -= power * 0.3
  if (revenge) b.grudge = 0
}

function resolveIncoming(g: Game, inc: Incoming) {
  const p = g.player
  const b = g.bots[inc.from]
  const c = cityById(g, inc.cityId)
  const def = cityDefense(g, c) * (p.tribe === 'gokturk' ? 1.15 : p.tribe === 'hun' ? 0.9 : 1)
  const { win, attLoss, defLoss } = lossRatios(inc.power, def, 'yagma')
  const lost = applyLoss(c.army, defLoss)
  const armyBefore = [...c.army]
  c.army = c.army.map((n, i) => n - lost[i])
  const attLost = applyLoss(inc.army, attLoss)
  b.atk = Math.max(0, b.atk - inc.power * attLoss)
  const loot = zeroRes()
  const notes: string[] = []
  if (win) {
    const carry = inc.power * 0.9
    const keys: (keyof Res)[] = ['tas', 'odun', 'tahil', 'demir', 'altin']
    const have = keys.reduce((s, k) => s + p.res[k] * 0.35, 0)
    const take = Math.min(carry, have)
    for (const k of keys) {
      loot[k] = have > 0 ? Math.floor(((p.res[k] * 0.35) / have) * take) : 0
      p.res[k] -= loot[k]
    }
    b.res += take
    b.raidPts += (inc.power * defLoss) / 100
    const rams = inc.army[RAM] - attLost[RAM]
    if (rams > 0) {
      const before = c.b.sur
      const drop = Math.min(before, Math.floor(Math.sqrt(rams) * rnd(0.5, 1.2)))
      c.b.sur -= drop
      notes.push(...siegeNotes(rams, 0, true, before, drop, null))
    }
  } else {
    p.defPts += Math.round((inc.power * attLoss) / 10)
  }
  addReport(g, {
    time: inc.arrive, kind: 'savunma', title: `${win ? `${c.name} yağmalandı` : 'Saldırı püskürtüldü'} — ${b.name}`, win: !win, from: b.id, lines: [],
    battle: {
      att: sideOfBot(g, b, inc.fc, inc.army, attLost),
      def: sideOfPlayer(g, c, armyBefore, lost),
      loot, atkPts: Math.round((def * defLoss) / 10), defPts: Math.round((inc.power * attLoss) / 10), notes,
    },
  })
  if (!win) addFeed(g, inc.arrive, '🛡️', `${p.name}, ${b.name} adlı oyuncunun saldırısını püskürttü`)
  else supportDm(g, inc.arrive)
}

// ---------------- Umaykut ----------------
function checkUmaykut(g: Game, a: Alliance, now: number) {
  while (a.umaykut < 10 && a.progress >= umaykutCost(a.umaykut)) {
    if (a.umaykut === 9) {
      const s = allianceStats(g).get(a.id)
      if (!s || s.tribes.size < 3) {
        a.progress = umaykutCost(9)
        return
      }
    }
    a.progress -= umaykutCost(a.umaykut)
    a.umaykut++
    addFeed(g, now, '🏛️', `${a.name} [${a.tag}] Umaykut’u ${a.umaykut}. seviyeye yükseltti!`)
    if (a.id === g.player.allianceId) addChat(g, 'alliance', { time: now, from: 'Sistem', system: true, text: `🏛️ Umaykut ${a.umaykut}. seviyeye ulaştı!` })
    if (a.umaykut === 10 && !g.winner) {
      g.winner = a.id
      addFeed(g, now, '👑', `${a.name} Umaykut’u tamamladı ve Türk devletlerini birleştirdi! Sezon sona erdi.`)
    }
  }
}

// ---------------- bot simülasyonu ----------------
function botExpand(g: Game, b: Bot, now: number, quiet: boolean) {
  const occ = occupancy(g)
  for (let i = 0; i < 12; i++) {
    const a = Math.random() * Math.PI * 2
    const r = rnd(3, 7)
    const x = Math.round(b.x + Math.cos(a) * r)
    const y = Math.round(b.y + Math.sin(a) * r)
    if (x < 1 || y < 1 || x >= g.mapSize - 1 || y >= g.mapSize - 1 || mineAt(g, x, y)) continue
    let ok = true
    for (const [k] of occ) {
      if (Math.abs((k % 10000) - x) < 3 && Math.abs(Math.floor(k / 10000) - y) < 3) { ok = false; break }
    }
    if (!ok) continue
    const name = b.cities.length < 3 ? `${b.cities[0].name}${b.cities.length + 1}` : pick(['Kale', 'Hisar', 'çiftlik', 'depo', 'asker', 'yedek', 'XI', 'TÜRK' + b.cities.length])
    b.cities.push({ x, y, name })
    g.rev++
    if (!quiet) addFeed(g, now, '🏕️', `${b.name}, ${x}|${y} koordinatında yeni bir şehir kurdu`)
    return
  }
}

function simulateBots(g: Game, dtReal: number, now: number, quiet: boolean) {
  const dt = dtReal * g.speed // oyun saniyesi
  const hour = new Date(now).getHours()
  const dayFactor = hour >= 2 && hour < 8 ? 0.35 : hour >= 18 ? 1.15 : 0.85
  let online = 0
  const toggle = Math.min(1, dtReal / 300)
  for (const b of g.bots) {
    if (b.activity > 0) {
      b.pop += b.activity * dt * (0.0008 + b.pop * 0.0000008) * rnd(0.3, 1.7)
      b.def += (b.pop * b.defF - b.def) * Math.min(1, dt / 1500)
      b.atk += (b.pop * b.atkF - b.atk) * Math.min(1, dt / 1500)
      b.res = Math.min(b.res + b.pop * 0.4 * (dt / 60), 300 + b.pop * 12)
      if (b.sur < 20 && Math.random() < dt * b.defF * 0.00002) b.sur++
    } else {
      b.res = Math.min(b.res + (20 + b.pop * 0.6) * (dt / 60), 500 + b.pop * 40)
      b.def += (b.pop * 0.3 - b.def) * Math.min(1, dt / 3600)
    }
    if (Math.random() < toggle) b.online = b.activity > 0 && Math.random() < b.activity * 0.55 * dayFactor
    if (b.online) { online++; b.lastSeen = now }
  }
  g.online = online + 1

  if (chance(1 / 900, dt)) {
    const b = randomBot(g, (x) => x.activity > 0)
    if (b) b.activity = 0
  }
  if (chance(1 / 2400, dt)) {
    const b = randomBot(g, (x) => x.activity === 0)
    if (b) b.activity = rnd(0.3, 0.9)
  }
  // şehir genişlemesi
  if (chance(1 / 600, dt)) {
    const b = randomBot(g, (x) => x.activity > 0 && x.cities.length < 10 && x.pop > 250 * x.cities.length)
    if (b) botExpand(g, b, now, quiet)
  }

  // Umaykut ilerlemesi
  const stats = allianceStats(g)
  for (const a of g.alliances) {
    const s = stats.get(a.id)
    if (!s) continue
    let botPop = s.pop
    if (a.id === g.player.allianceId) botPop -= playerPop(g.player)
    a.progress += botPop * 0.001 * dt * rnd(0.5, 1.5)
    checkUmaykut(g, a, now)
  }

  const evDt = dtReal * Math.min(g.speed, 3)

  // botlar arası savaşlar
  if (!quiet && chance(1 / 7, evDt)) {
    const a = randomBot(g, (x) => x.activity > 0 && x.aggr > 0.3 && x.atk > 50)
    if (a) {
      let target: Bot | null = null
      let best = Infinity
      for (let i = 0; i < 25; i++) {
        const c = g.bots[Math.floor(Math.random() * g.bots.length)]
        if (c === a || (c.allianceId && c.allianceId === a.allianceId)) continue
        const d = dist(a.x, a.y, c.x, c.y) * (c.activity === 0 ? 0.5 : 1)
        if (d < best) { best = d; target = c }
      }
      if (target) {
        const power = a.atk * rnd(0.3, 0.8)
        const def = botDefense(target)
        const { win, attLoss, defLoss } = lossRatios(power, def, 'yagma')
        a.atk -= power * attLoss
        target.def *= 1 - defLoss
        if (win) {
          const loot = Math.min(target.res, power * 0.8)
          target.res -= loot
          a.res += loot
          a.raidPts += (def * defLoss) / 100
          addFeed(g, now, '🗡️', `${a.name}, ${target.name} adlı oyuncunun şehrini yağmaladı (${fmt(loot)} kaynak)`)
          raidBanter(g, a, target, now)
        } else {
          target.defPts += (power * attLoss) / 100
          addFeed(g, now, '🛡️', `${target.name}, ${a.name} adlı oyuncunun saldırısını püskürttü`)
        }
      }
    }
  }

  if (!quiet && chance(1 / 13, dtReal)) {
    if (!worldChatter(g, now)) {
      const b = randomBot(g, (x) => x.online) ?? pick(g.bots)
      addChat(g, 'world', { time: now, from: b.name, botId: b.id, tribe: b.tribe, text: humanize(fill(g, pick(WORLD_LINES), b), b) })
    }
  }
  if (!quiet) socialTick(g, dtReal, now)
  if (!quiet && chance(1 / 45, dtReal)) {
    const b = randomBot(g, (x) => x.online)
    if (b) addFeed(g, now, pick(['🔨', '🏛️', '🐎']), pick([
      `${b.name} şehrinde Merkez Otağ’ı yükseltti`,
      `${b.name}, ${allianceOf(g, b.allianceId)?.name ?? 'birliksiz'} olarak Umaykut’a kaynak bağışladı`,
      `${b.name} yeni bir ordu topladı`,
    ]))
  }
  if (!quiet && chance(1 / 240, dtReal)) {
    const b = randomBot(g, (x) => x.activity > 0)
    if (b) addFeed(g, now, '🆕', `${b.name} sunucuya katıldı (${TRIBES[b.tribe].name})`)
  }
  if (!quiet && g.player.allianceId && chance(1 / 40, dtReal)) {
    const members = g.bots.filter((x) => x.allianceId === g.player.allianceId && x.activity > 0)
    if (members.length) {
      const b = pick(members)
      addChat(g, 'alliance', { time: now, from: b.name, botId: b.id, tribe: b.tribe, text: humanize(fill(g, pick(ALLIANCE_LINES), b), b) })
    }
  }
  const own = allianceOf(g, g.player.allianceId)
  if (own?.playerOwned && chance(1 / 400, dt)) {
    const pp = playerPop(g.player)
    const b = randomBot(g, (x) => !x.allianceId && x.activity > 0 && x.pop < pp * 2 + 60 && dist(x.x, x.y, g.player.x, g.player.y) < 30)
    if (b && g.bots.filter((x) => x.allianceId === own.id).length < 29) {
      b.allianceId = own.id
      addChat(g, 'alliance', { time: now, from: 'Sistem', system: true, text: `${b.name} (${TRIBES[b.tribe].name}) birliğinize katıldı.` })
      if (!quiet) queueMsg(g, { at: now + 4000, channel: 'alliance', from: b.id, text: pick(['selam birlik', 'herkese selam, birlikte büyüyelim', 'merhaba, hangi koordinattasınız?']) })
    }
  }

  // oyuncuya saldırılar
  const p = g.player
  if (now >= p.protectionUntil) {
    if (!p.protectionNotified) {
      p.protectionNotified = true
      addReport(g, { time: p.protectionUntil, kind: 'bilgi', title: 'Koruman sona erdi', lines: [DM_PROTECT_END] })
    }
    for (const b of g.bots) {
      if (b.grudge && now >= b.grudge) {
        if (Math.random() < 0.85) launchBotAttack(g, b, now, true)
        b.grudge = 0
      }
    }
    const pp = playerPop(p)
    if (g.incoming.length < 3 && chance(1 / 1500, dt)) {
      const b = randomBot(
        g,
        (x) => x.activity > 0 && x.aggr > 0.45 && x.allianceId !== p.allianceId && x.pop < pp * 2.5 + 25 && dist(x.x, x.y, p.x, p.y) < 28,
        120,
      )
      if (b) launchBotAttack(g, b, now, false)
    }
  }
}

// ---------------- ana döngü ----------------
export function tick(g: Game, now: number) {
  if (now - g.lastTick > 48 * 3600 * 1000) g.lastTick = now - 48 * 3600 * 1000
  while (g.lastTick < now) {
    const catchUp = now - g.lastTick > 5000
    const t0 = g.lastTick
    const t1 = Math.min(now, t0 + (catchUp ? 60000 : 5000))
    step(g, t0, t1, catchUp && now - t1 > 5000)
    g.lastTick = t1
  }
}

function step(g: Game, t0: number, t1: number, quiet: boolean) {
  const p = g.player
  const dtMin = (t1 - t0) / 60000

  // kaynaklar
  const r = rates(g)
  const c = cap(g)
  for (const k of RES_KEYS) {
    const v = p.res[k] + r[k] * dtMin
    p.res[k] = Math.max(0, STORED.includes(k) ? Math.min(Math.max(c, p.res[k]), v) : v)
  }
  if (p.res.tahil <= 0 && r.tahil < 0) {
    p.starveAcc += -r.tahil * dtMin
    while (p.starveAcc > 5) {
      const city = p.cities.find((x) => x.army.some((n) => n > 0))
      if (!city) { p.starveAcc = 0; break }
      const i = city.army.findIndex((n) => n > 0)
      city.army[i]--
      p.starveAcc -= UNITS[p.tribe][i].upkeep * 50
      if (Math.random() < 0.05) addReport(g, { time: t1, kind: 'bilgi', title: 'Askerlerin açlıktan dağılıyor!', lines: ['Tahıl üretimin ordunu beslemeye yetmiyor. Tarlayı yükselt ya da asker sayını azalt.'] })
    }
  }

  // günlük elmas
  if (t1 - p.lastDaily > 20 * 3600 * 1000) {
    p.lastDaily = t1
    p.elmas += 10
    addReport(g, { time: t1, kind: 'bilgi', title: 'Günlük ödül: 10 elmas', lines: ['Her gün oyuna girdiğinde 10 elmas kazanırsın. Elmasla inşaatı hızlandırabilir ya da koruma alabilirsin.'] })
  }

  for (const city of p.cities) {
    while (city.queue.length && city.queue[0].end <= t1) {
      const j = city.queue.shift()!
      city.b[j.b] = j.to
      addFeed(g, j.end, '🔨', `${city.name}: ${BUILDING_MAP[j.b].name} ${j.to}. seviyeye yükseldi`)
    }
    for (const j of city.train) {
      const produced = Math.min(j.count, Math.floor(Math.max(0, t1 - j.start) / j.each))
      if (produced > j.done) {
        city.army[j.unit] += produced - j.done
        j.done = produced
      }
    }
    city.train = city.train.filter((j) => j.done < j.count)
  }

  for (const m of [...g.out]) {
    if (!m.returning && m.arrive <= t1) resolveOutgoing(g, m, m.arrive)
    if (m.returning && m.back <= t1) {
      const home = cityById(g, m.cityId)
      const survivors = m.army.reduce((s, n) => s + n, 0)
      m.army.forEach((n, i) => (home.army[i] += n))
      for (const k of RES_KEYS) p.res[k] += m.loot[k]
      g.out = g.out.filter((x) => x !== m)
      if (survivors > 0 && m.type !== 'casus' && RES_KEYS.some((k) => m.loot[k] > 0)) addFeed(g, m.back, '🐎', `Ordun ganimetle ${home.name} şehrine döndü`)
    }
  }
  g.out = g.out.filter((m) => !(m.returning && m.army.every((n) => n === 0)))

  for (const inc of [...g.incoming]) {
    if (inc.arrive <= t1) {
      resolveIncoming(g, inc)
      g.incoming = g.incoming.filter((x) => x !== inc)
    }
  }

  if (g.application && g.application.at <= t1) {
    const a = allianceOf(g, g.application.allianceId)
    g.application = null
    if (a) {
      const pp = playerPop(p)
      const full = (allianceStats(g).get(a.id)?.members ?? 0) >= 30
      if (pp >= a.minPop && !full) {
        p.allianceId = a.id
        g.chat.alliance = []
        addReport(g, { time: t1, kind: 'mesaj', title: `${a.name} birliğine kabul edildin!`, lines: ['Birlik mesajından üyelerle konuşabilir, Umaykut’a kaynak bağışlayabilirsin.'] })
        addChat(g, 'alliance', { time: t1, from: 'Sistem', system: true, text: `${p.name} birliğe katıldı.` })
        const members = shuffle(g.bots.filter((b) => b.allianceId === a.id && b.activity > 0))
        const lines = shuffle(['hoş geldin {me}! 🐺', 'aramıza hoş geldin', 'hoş geldin kardeş, koordinatın ne?', 'hg {me}', 'selam, Umaykut’a katkı bekliyoruz :)'])
        for (let i = 0; i < Math.min(3, members.length); i++) {
          const b = members[i]
          queueMsg(g, { at: t1 + rnd(2000, 15000) * (i + 1), channel: 'alliance', from: b.id, text: humanize(fill(g, lines[i], b), b) })
        }
      } else {
        addReport(g, { time: t1, kind: 'mesaj', title: `${a.name} başvurunu reddetti`, lines: [full ? 'Birlik beyi: “Birlik dolu kardeş (30/30).”' : `Birlik beyi: “Kardeşim en az ${a.minPop} nüfusa ulaşınca tekrar başvur.”`] })
      }
    }
  }

  if (g.pending.length) {
    const due = g.pending.filter((m) => m.at <= t1)
    g.pending = g.pending.filter((m) => m.at > t1)
    for (const m of due) {
      const b = g.bots[m.from]
      if (m.channel === 'dm') { deliverDm(g, m); continue }
      if (m.channel === 'alliance' && !g.player.allianceId) continue
      b.lastSeen = m.at
      addChat(g, m.channel, { time: m.at, from: b.name, botId: b.id, tribe: b.tribe, text: m.text })
    }
  }

  simulateBots(g, (t1 - t0) / 1000, t1, quiet)
}

export const unitsTotal = (a: number[]) => a.reduce((s, n) => s + n, 0)
export { UNIT_COUNT }
