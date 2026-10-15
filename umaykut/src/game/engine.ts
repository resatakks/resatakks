import {
  BUILDINGS, BUILDING_MAP, BuildingId, RES_KEYS, Res, TribeId, TRIBES, UNITS, zeroRes,
} from './data'
import {
  ALLIANCE_LINES, DM_PROTECT_END, DM_STRONG, DM_WEAK, GENERIC_REPLIES, REPLIES, WORLD_LINES, pick,
} from './chatter'
import {
  type Thread, botDm, deliverDm, hasPeace, humanize, mentionReply, queueMsg, raidBanter, shuffle, socialTick, supportDm, thread, worldChatter,
} from './social'

// ---------------- tipler ----------------
export interface Bot {
  id: number
  name: string
  village: string
  tribe: TribeId
  x: number
  y: number
  allianceId: string | null
  pop: number
  def: number
  atk: number
  res: number
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
  umaykut: number
  progress: number
  minPop: number
  playerOwned?: boolean
}

export interface Player {
  name: string
  village: string
  tribe: TribeId
  x: number
  y: number
  buildings: Record<BuildingId, number>
  res: Res
  army: number[]
  queue: BuildJob[]
  train: TrainJob[]
  allianceId: string | null
  protectionUntil: number
  protectionNotified: boolean
  raidPts: number
  defPts: number
  starveAcc: number
}

export interface BuildJob { b: BuildingId; to: number; start: number; end: number }
export interface TrainJob { b: 'kisla' | 'ahir'; unit: number; count: number; done: number; start: number; each: number }
export type MissionType = 'raid' | 'attack' | 'scout'
export interface Outgoing {
  id: number
  type: MissionType
  target: number
  army: number[]
  start: number
  arrive: number
  back: number
  returning: boolean
  loot: Res
}
export interface Incoming { id: number; from: number; power: number; troops: number; launch: number; arrive: number; army?: number[] }
export type ReportKind = 'saldiri' | 'savunma' | 'kesif' | 'mesaj' | 'bilgi'
export interface Report { id: number; time: number; kind: ReportKind; title: string; lines: string[]; read: boolean; win?: boolean; from?: number }
export interface ChatMsg { id: number; time: number; from: string; botId?: number; tribe?: TribeId; text: string; me?: boolean; system?: boolean }
export interface FeedItem { id: number; time: number; icon: string; text: string }
export interface Pending { at: number; typeAt: number; channel: 'world' | 'alliance' | 'dm'; from: number; text: string; topic?: Thread['topic']; invite?: string | null }

export interface Game {
  version: 2
  speed: number
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
}

// ---------------- formüller ----------------
export const prodPerMin = (level: number) => (level === 0 ? 3 : Math.round(10 * Math.pow(1.38, level - 1)))
export const storageCap = (level: number) => Math.round(1000 * Math.pow(1.35, level))
export const buildCost = (id: BuildingId, to: number): Res => {
  const b = BUILDING_MAP[id].base
  const m = Math.pow(1.55, to - 1)
  return { odun: Math.round(b.odun * m), tas: Math.round(b.tas * m), demir: Math.round(b.demir * m), yiyecek: Math.round(b.yiyecek * m) }
}
export const buildTime = (g: Game, id: BuildingId, to: number) =>
  (BUILDING_MAP[id].time * 1000 * Math.pow(1.45, to - 1) * Math.pow(0.95, g.player.buildings.otag - 1)) / g.speed
export const trainTime = (g: Game, unit: number) => {
  const u = UNITS[g.player.tribe][unit]
  const lvl = g.player.buildings[u.building]
  return (u.time * 1000 * Math.pow(0.94, Math.max(0, lvl - 1))) / g.speed
}
export const umaykutCost = (level: number) => Math.round(40000 * Math.pow(1.6, level))
export const levelPop = (l: number) => (l * (l + 1)) / 2

export function playerPop(p: Player) {
  return BUILDINGS.reduce((s, b) => s + levelPop(p.buildings[b.id]), 0)
}

export function upkeepPerMin(g: Game) {
  const units = UNITS[g.player.tribe]
  const total = totalArmy(g)
  return total.reduce((s, n, i) => s + n * units[i].upkeep, 0)
}

export function rates(g: Game): Res {
  const p = g.player
  const bonus = p.tribe === 'gokturk' ? 1.1 : 1
  const r = zeroRes()
  for (const b of BUILDINGS) if (b.produces) r[b.produces] = prodPerMin(p.buildings[b.id]) * bonus
  r.yiyecek -= upkeepPerMin(g)
  for (const k of RES_KEYS) r[k] *= g.speed
  return r
}

export const cap = (g: Game) => storageCap(g.player.buildings.ambar)

export function totalArmy(g: Game) {
  const t = [...g.player.army]
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
  return b.def + 15 + b.pop * 1.5
}

export function playerDefense(g: Game) {
  const p = g.player
  const units = UNITS[p.tribe]
  const troops = p.army.reduce((s, n, i) => s + n * units[i].def, 0)
  const sel = p.tribe === 'selcuklu'
  const wall = 1 + p.buildings.sur * 0.05 * (sel ? 1.15 : 1)
  return (troops + 15 + playerPop(p) * 1.5) * wall * (sel ? 1.15 : 1)
}

export function attackPower(tribe: TribeId, army: number[]) {
  const units = UNITS[tribe]
  return army.reduce((s, n, i) => s + n * units[i].atk * (tribe === 'hun' && units[i].cav ? 1.15 : 1), 0)
}

export function rankings(g: Game) {
  const list: { id: number; name: string; pop: number; tribe: TribeId; allianceId: string | null; raidPts: number }[] = g.bots.map((b) => ({
    id: b.id, name: b.name, pop: Math.floor(b.pop), tribe: b.tribe, allianceId: b.allianceId, raidPts: Math.floor(b.raidPts),
  }))
  list.push({ id: -1, name: g.player.name, pop: playerPop(g.player), tribe: g.player.tribe, allianceId: g.player.allianceId, raidPts: g.player.raidPts })
  list.sort((a, b) => b.pop - a.pop)
  return list
}

export function allianceStats(g: Game) {
  const map = new Map<string, { pop: number; members: number; tribes: Set<TribeId> }>()
  for (const a of g.alliances) map.set(a.id, { pop: 0, members: 0, tribes: new Set() })
  for (const b of g.bots) {
    if (!b.allianceId) continue
    const s = map.get(b.allianceId)
    if (!s) continue
    s.pop += b.pop
    s.members++
    s.tribes.add(b.tribe)
  }
  if (g.player.allianceId) {
    const s = map.get(g.player.allianceId)
    if (s) {
      s.pop += playerPop(g.player)
      s.members++
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
  if (g.reports.length > 150) g.reports.length = 150
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

// ---------------- oyuncu eylemleri ----------------
export function canBuild(g: Game, id: BuildingId): string | null {
  const p = g.player
  const def = BUILDING_MAP[id]
  const queued = p.queue.filter((q) => q.b === id).length
  const to = p.buildings[id] + queued + 1
  if (to > def.max) return 'En yüksek seviyede'
  for (const [rid, lvl] of Object.entries(def.req ?? {})) {
    if (p.buildings[rid as BuildingId] < (lvl as number)) return `Gerekli: ${BUILDING_MAP[rid as BuildingId].name} ${lvl}`
  }
  if (p.queue.length >= 2) return 'İnşaat sırası dolu'
  const c = buildCost(id, to)
  if (RES_KEYS.some((k) => c[k] > cap(g))) return 'Ambar yetersiz'
  if (!canAfford(p, c)) return 'Kaynak yetersiz'
  return null
}

export function build(g: Game, id: BuildingId, now: number) {
  if (canBuild(g, id)) return
  const p = g.player
  const to = p.buildings[id] + p.queue.filter((q) => q.b === id).length + 1
  pay(p, buildCost(id, to))
  const start = p.queue.length ? p.queue[p.queue.length - 1].end : now
  p.queue.push({ b: id, to, start, end: start + buildTime(g, id, to) })
}

export function cancelBuild(g: Game, index: number, now: number) {
  const p = g.player
  const job = p.queue[index]
  if (!job) return
  // sonraki aynı bina işleri de iptal edilir
  const removed = p.queue.splice(index)
  for (const r of removed) {
    const c = buildCost(r.b, r.to)
    for (const k of RES_KEYS) p.res[k] = Math.min(cap(g), p.res[k] + c[k] * 0.8)
  }
  // kalan işlerin zamanlarını düzelt
  let t = now
  for (const q of p.queue) {
    if (q.start > t) {
      const d = q.end - q.start
      q.start = t
      q.end = t + d
    }
    t = q.end
  }
}

export function maxTrainable(g: Game, unit: number) {
  const c = UNITS[g.player.tribe][unit].cost
  return Math.floor(Math.min(...RES_KEYS.map((k) => (c[k] ? g.player.res[k] / c[k] : Infinity))))
}

export function train(g: Game, unit: number, count: number, now: number): string | null {
  const p = g.player
  const u = UNITS[p.tribe][unit]
  if (p.buildings[u.building] < 1) return `${BUILDING_MAP[u.building].name} gerekli`
  count = Math.floor(count)
  if (count < 1) return 'Geçersiz sayı'
  if (count > maxTrainable(g, unit)) return 'Kaynak yetersiz'
  const total: Res = zeroRes()
  for (const k of RES_KEYS) total[k] = u.cost[k] * count
  pay(p, total)
  const same = p.train.filter((t) => t.b === u.building)
  const last = same[same.length - 1]
  const start = last ? last.start + last.count * last.each : now
  p.train.push({ b: u.building, unit, count, done: 0, start: Math.max(start, now), each: trainTime(g, unit) })
  return null
}

export function travelMs(g: Game, army: number[], d: number) {
  const units = UNITS[g.player.tribe]
  const speed = Math.min(...army.map((n, i) => (n > 0 ? units[i].speed : Infinity)))
  return Math.max(15000, (d / speed) * 60000) / g.speed
}

export function sendMission(g: Game, type: MissionType, target: number, army: number[], now: number): string | null {
  const p = g.player
  if (army.every((n) => n <= 0)) return 'En az bir birim seçmelisin'
  if (army.some((n, i) => n < 0 || n > p.army[i])) return 'Köyde o kadar asker yok'
  const b = g.bots[target]
  if (!b) return 'Hedef bulunamadı'
  if (b.allianceId && b.allianceId === p.allianceId && type !== 'scout') return 'Kendi boyuna saldıramazsın'
  if (p.protectionUntil > now && type !== 'scout') p.protectionUntil = now // saldırı korumayı bitirir
  if (type !== 'scout' && hasPeace(g, target, now)) {
    const th = thread(g, target)
    th.peaceUntil = 0
    th.topic = 'traitor'
    th.mood = -1
  }
  const t = travelMs(g, army, dist(p.x, p.y, b.x, b.y))
  army.forEach((n, i) => (p.army[i] -= n))
  g.out.push({ id: nid(g), type, target, army: [...army], start: now, arrive: now + t, back: now + 2 * t, returning: false, loot: zeroRes() })
  return null
}

export function applyAlliance(g: Game, allianceId: string, now: number) {
  if (g.player.allianceId || g.application) return
  g.application = { allianceId, at: now + rnd(6000, 20000) }
}

export function foundAlliance(g: Game, name: string, tag: string, now: number) {
  if (g.player.allianceId) return
  const id = 'p' + nid(g)
  g.alliances.push({ id, name, tag: tag.toUpperCase().slice(0, 4), umaykut: 0, progress: 0, minPop: 0, playerOwned: true })
  g.player.allianceId = id
  g.chat.alliance = []
  addChat(g, 'alliance', { time: now, from: 'Sistem', system: true, text: `${name} boyu kuruldu. Diğer oyuncular zamanla katılabilir.` })
  addFeed(g, now, '🏕️', `${g.player.name} yeni bir boy kurdu: ${name} [${tag.toUpperCase()}]`)
}

export function leaveAlliance(g: Game, now: number) {
  const a = allianceOf(g, g.player.allianceId)
  if (!a) return
  g.player.allianceId = null
  g.chat.alliance = []
  if (a.playerOwned) {
    // kurucu ayrılınca üyeler dağılır
    for (const b of g.bots) if (b.allianceId === a.id) b.allianceId = null
    g.alliances = g.alliances.filter((x) => x.id !== a.id)
  }
  addFeed(g, now, '🚪', `${g.player.name}, ${a.name} boyundan ayrıldı`)
}

export function contribute(g: Game, amount: Res, now: number) {
  const a = allianceOf(g, g.player.allianceId)
  if (!a) return
  let total = 0
  for (const k of RES_KEYS) {
    const v = Math.max(0, Math.min(Math.floor(amount[k]), Math.floor(g.player.res[k])))
    g.player.res[k] -= v
    total += v
  }
  a.progress += total
  if (total > 0) {
    addChat(g, 'alliance', { time: now, from: 'Sistem', system: true, text: `${g.player.name} Umaykut’a ${total.toLocaleString('tr-TR')} kaynak bağışladı.` })
    checkUmaykut(g, a, now)
  }
}

export function sendChat(g: Game, channel: 'world' | 'alliance', text: string, now: number) {
  text = text.trim().slice(0, 200)
  if (!text) return
  addChat(g, channel, { time: now, from: g.player.name, tribe: g.player.tribe, text, me: true })
  // botlar cevap verir
  const pool =
    channel === 'alliance'
      ? g.bots.filter((b) => b.allianceId === g.player.allianceId && b.activity > 0)
      : null
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
function lossRatios(att: number, def: number, type: 'raid' | 'attack') {
  const win = att > def
  const x = Math.pow(Math.min(att, def) / Math.max(att, def, 1), 1.5)
  if (type === 'raid') {
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
const armyLine = (g: Game, army: number[]) =>
  UNITS[g.player.tribe].map((u, i) => (army[i] ? `${u.icon} ${u.name}: ${fmt(army[i])}` : '')).filter(Boolean).join(' · ') || '—'
const resLine = (r: Res) => `🪵 ${fmt(r.odun)}  🪨 ${fmt(r.tas)}  ⚒️ ${fmt(r.demir)}  🌾 ${fmt(r.yiyecek)}`

function resolveOutgoing(g: Game, m: Outgoing, now: number) {
  const b = g.bots[m.target]
  const p = g.player
  m.returning = true
  if (m.type === 'scout') {
    const noise = () => rnd(0.9, 1.1)
    const growth = b.activity === 0 ? 'Köy çok sessiz, uzun süredir kimse ilgilenmiyor gibi. (inaktif olabilir)' : b.online ? 'Köy sahibi şu an çevrimiçi!' : 'Köyde hareketlilik var.'
    addReport(g, {
      time: m.arrive, kind: 'kesif', title: `Keşif: ${b.village} (${b.x}|${b.y})`, from: b.id,
      lines: [
        `Sahibi: ${b.name} · ${TRIBES[b.tribe].name} · Nüfus ${fmt(b.pop)}`,
        `Tahmini savunma gücü: ~${fmt(botDefense(b) * noise())}`,
        `Depodaki tahmini kaynak: ~${fmt(b.res * noise())}`,
        growth,
      ],
    })
    return
  }
  const type = m.type
  const att = attackPower(p.tribe, m.army)
  const def = botDefense(b) * rnd(0.95, 1.05)
  const { win, attLoss, defLoss } = lossRatios(att, def, type)
  const lost = applyLoss(m.army, attLoss)
  m.army = m.army.map((n, i) => n - lost[i])
  const defBefore = botDefense(b)
  b.def = Math.max(0, b.def * (1 - defLoss))
  b.defPts += att * attLoss * 0.01
  const survivors = m.army.reduce((s, n) => s + n, 0)
  if (win && survivors > 0) {
    const units = UNITS[p.tribe]
    const carry = m.army.reduce((s, n, i) => s + n * units[i].carry, 0)
    const total = Math.min(carry, b.res)
    b.res -= total
    const w = RES_KEYS.map(() => rnd(0.6, 1.4))
    const ws = w.reduce((s, x) => s + x, 0)
    RES_KEYS.forEach((k, i) => (m.loot[k] = Math.floor((total * w[i]) / ws)))
  }
  const killed = defBefore * defLoss
  p.raidPts += Math.round(killed / 10)
  const title = `${type === 'raid' ? 'Yağma' : 'Saldırı'}: ${b.village} (${b.x}|${b.y}) — ${win ? 'Zafer' : 'Yenilgi'}`
  const lines = [
    `Hedef: ${b.name} · ${TRIBES[b.tribe].name}`,
    `Saldırı gücün: ${fmt(att)} · Düşman savunması: ~${fmt(def)}`,
    `Kayıpların: ${armyLine(g, lost)}`,
    `Hayatta kalanlar: ${armyLine(g, m.army)}`,
    win ? `Ganimet: ${resLine(m.loot)}` : 'Ordun geri püskürtüldü.',
  ]
  if (survivors === 0) lines.push('Hiçbir askerin geri dönmedi.')
  addReport(g, { time: m.arrive, kind: 'saldiri', title, lines, win, from: b.id })
  if (win) addFeed(g, m.arrive, '🗡️', `${p.name}, ${b.name} adlı oyuncunun köyünü ${type === 'raid' ? 'yağmaladı' : 'bastı'}!`)

  // tepki
  if (b.activity > 0) {
    if (b.aggr > 0.35 && b.atk > att * 0.3) {
      b.grudge = now + rnd(2, 10) * 60000 / g.speed
      const th = thread(g, b.id)
      th.mood = Math.max(-1, th.mood - 0.4)
      if (th.topic === 'traitor') botDm(g, b, pick(['barış yapmıştık! şimdi göreceksin', 'sözünü bozdun, boyuma da söyledim', 'hain! bunu unutmayacağım']), m.arrive + rnd(15000, 60000), 'traitor')
      else if (Math.random() < 0.7) botDm(g, b, pick(DM_STRONG), m.arrive + rnd(20000, 90000), 'threat')
    } else if (Math.random() < 0.6) {
      thread(g, b.id).mood -= 0.2
      botDm(g, b, pick(DM_WEAK), m.arrive + rnd(20000, 90000), 'peace')
    }
  }
}

function launchBotAttack(g: Game, b: Bot, now: number, revenge: boolean) {
  const p = g.player
  const d = dist(p.x, p.y, b.x, b.y)
  const speed = rnd(3, 7.5)
  const power = b.atk * rnd(0.35, 0.85)
  if (power < 20 || hasPeace(g, b.id, now)) return
  const travel = Math.max(30000, (d / speed) * 60000) / g.speed
  // gerçek birlik dağılımı: saldırı gücünü botun boy birimlerine böl
  const units = UNITS[b.tribe]
  const w = units.map((u, i) => (i === 0 ? 0.5 : u.atk >= 30 ? 1 + b.atkF : 0.8) * rnd(0.4, 1.6))
  const ws = w.reduce((s, x) => s + x, 0)
  const army = units.map((u, i) => Math.max(0, Math.round((power * w[i]) / ws / Math.max(1, u.atk))))
  g.incoming.push({ id: nid(g), from: b.id, power, troops: army.reduce((s, n) => s + n, 0), launch: now, arrive: now + travel, army })
  if (revenge && Math.random() < 0.5) botDm(g, b, pick(['ordum yolda 😈', 'hazırlan', 'geliyorum {me}', 'sırada sen varsın']), now + rnd(5000, 30000), 'threat')
  b.atk -= power * 0.3
  if (revenge) b.grudge = 0
}

function resolveIncoming(g: Game, inc: Incoming) {
  const p = g.player
  const b = g.bots[inc.from]
  const def = playerDefense(g)
  const { win, attLoss, defLoss } = lossRatios(inc.power, def, 'raid')
  // win: saldırgan kazandı
  const lost = applyLoss(p.army, defLoss)
  const armyBefore = [...p.army]
  p.army = p.army.map((n, i) => n - lost[i])
  b.atk = Math.max(0, b.atk - inc.power * attLoss)
  const loot = zeroRes()
  if (win) {
    const carry = inc.power * 0.9
    const have = RES_KEYS.reduce((s, k) => s + p.res[k], 0)
    const take = Math.min(carry, have)
    for (const k of RES_KEYS) {
      loot[k] = have > 0 ? Math.floor((p.res[k] / have) * take) : 0
      p.res[k] -= loot[k]
    }
    b.res += take
    b.raidPts += inc.power * defLoss * 0.01
  } else {
    p.defPts += Math.round((inc.power * attLoss) / 10)
  }
  const lines = [
    `Saldıran: ${b.name} (${b.village}, ${b.x}|${b.y}) · ${TRIBES[b.tribe].name}`,
    `Düşman gücü: ~${fmt(inc.power)} · Senin savunman: ${fmt(def)}`,
    `Köydeki askerlerin: ${armyLine(g, armyBefore)}`,
    `Kayıpların: ${armyLine(g, lost)}`,
    win ? `Yağmalanan: ${resLine(loot)}` : `Düşmanın ${Math.round(attLoss * 100)}% kaybıyla geri püskürtüldü!`,
  ]
  addReport(g, { time: inc.arrive, kind: 'savunma', title: `${win ? 'Köyün yağmalandı' : 'Saldırı püskürtüldü'} — ${b.name}`, lines, win: !win, from: b.id })
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
      addFeed(g, now, '👑', `${a.name} Umaykut’u tamamladı ve Türk halklarını birleştirdi! Dünya sona erdi.`)
    }
  }
}

// ---------------- bot simülasyonu ----------------
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
    } else {
      b.res = Math.min(b.res + (20 + b.pop * 0.6) * (dt / 60), 500 + b.pop * 40)
      b.def += (b.pop * 0.3 - b.def) * Math.min(1, dt / 3600)
    }
    if (Math.random() < toggle) b.online = b.activity > 0 && Math.random() < b.activity * 0.55 * dayFactor
    if (b.online) { online++; b.lastSeen = now }
  }
  g.online = online + 1

  // nadiren biri inaktif olur, nadiren biri geri döner
  if (chance(1 / 900, dt)) {
    const b = randomBot(g, (x) => x.activity > 0)
    if (b) b.activity = 0
  }
  if (chance(1 / 2400, dt)) {
    const b = randomBot(g, (x) => x.activity === 0)
    if (b) b.activity = rnd(0.3, 0.9)
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
        const { win, attLoss, defLoss } = lossRatios(power, def, 'raid')
        a.atk -= power * attLoss
        target.def *= 1 - defLoss
        if (win) {
          const loot = Math.min(target.res, power * 0.8)
          target.res -= loot
          a.res += loot
          a.raidPts += (def * defLoss) / 100
          addFeed(g, now, '🗡️', `${a.name}, ${target.name} adlı oyuncunun köyünü yağmaladı (${fmt(loot)} kaynak)`)
          raidBanter(g, a, target, now)
        } else {
          target.defPts += (power * attLoss) / 100
          addFeed(g, now, '🛡️', `${target.name}, ${a.name} adlı oyuncunun saldırısını püskürttü`)
        }
      }
    }
  }

  // dünya sohbeti
  if (!quiet && chance(1 / 13, dtReal)) {
    if (!worldChatter(g, now)) {
      const b = randomBot(g, (x) => x.online) ?? pick(g.bots)
      addChat(g, 'world', { time: now, from: b.name, botId: b.id, tribe: b.tribe, text: humanize(fill(g, pick(WORLD_LINES), b), b) })
    }
  }
  if (!quiet) socialTick(g, dtReal, now)
  // boy içi olaylar: bina/Umaykut haberleri
  if (!quiet && chance(1 / 45, dtReal)) {
    const b = randomBot(g, (x) => x.online)
    if (b) addFeed(g, now, pick(['🔨', '🏛️', '🐎']), pick([
      `${b.name} köyünde Otağ’ı yükseltti`,
      `${b.name}, ${allianceOf(g, b.allianceId)?.name ?? 'boysuz'} olarak Umaykut’a kaynak bağışladı`,
      `${b.name} yeni bir ordu topladı`,
    ]))
  }
  if (!quiet && chance(1 / 240, dtReal)) {
    const b = randomBot(g, (x) => x.activity > 0)
    if (b) addFeed(g, now, '🆕', `${b.name} dünyaya katıldı (${TRIBES[b.tribe].name})`)
  }
  // boy sohbeti
  if (!quiet && g.player.allianceId && chance(1 / 40, dtReal)) {
    const members = g.bots.filter((x) => x.allianceId === g.player.allianceId && x.activity > 0)
    if (members.length) {
      const b = pick(members)
      addChat(g, 'alliance', { time: now, from: b.name, botId: b.id, tribe: b.tribe, text: humanize(fill(g, pick(ALLIANCE_LINES), b), b) })
    }
  }
  // kendi boyuna katılım
  const own = allianceOf(g, g.player.allianceId)
  if (own?.playerOwned && chance(1 / 400, dt)) {
    const pp = playerPop(g.player)
    const b = randomBot(g, (x) => !x.allianceId && x.activity > 0 && x.pop < pp * 2 + 60 && dist(x.x, x.y, g.player.x, g.player.y) < 30)
    if (b) {
      b.allianceId = own.id
      addChat(g, 'alliance', { time: now, from: 'Sistem', system: true, text: `${b.name} (${TRIBES[b.tribe].name}) boyunuza katıldı.` })
      if (!quiet) queueMsg(g, { at: now + 4000, channel: 'alliance', from: b.id, text: pick(['selam boy', 'herkese selam, birlikte büyüyelim', 'merhaba, hangi koordinattasınız?']) })
    }
  }

  // oyuncuya saldırılar
  const p = g.player
  if (now >= p.protectionUntil) {
    if (!p.protectionNotified) {
      p.protectionNotified = true
      addReport(g, { time: p.protectionUntil, kind: 'bilgi', title: 'Acemi koruman sona erdi', lines: [DM_PROTECT_END] })
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
  for (const k of RES_KEYS) p.res[k] = Math.max(0, Math.min(c, p.res[k] + r[k] * dtMin))
  if (p.res.yiyecek <= 0 && r.yiyecek < 0) {
    p.starveAcc += -r.yiyecek * dtMin
    const units = UNITS[p.tribe]
    while (p.starveAcc > 5) {
      const i = p.army.findIndex((n) => n > 0)
      if (i < 0) { p.starveAcc = 0; break }
      p.army[i]--
      p.starveAcc -= units[i].upkeep * 50
      if (Math.random() < 0.05) addReport(g, { time: t1, kind: 'bilgi', title: 'Askerlerin açlıktan dağılıyor!', lines: ['Yiyecek üretimin ordunu beslemeye yetmiyor. Tarlayı yükselt ya da asker sayını azalt.'] })
    }
  }

  // inşaat
  while (p.queue.length && p.queue[0].end <= t1) {
    const j = p.queue.shift()!
    p.buildings[j.b] = j.to
    addFeed(g, j.end, '🔨', `${BUILDING_MAP[j.b].name} ${j.to}. seviyeye yükseldi`)
  }

  // eğitim
  for (const j of p.train) {
    const produced = Math.min(j.count, Math.floor(Math.max(0, t1 - j.start) / j.each))
    if (produced > j.done) {
      p.army[j.unit] += produced - j.done
      j.done = produced
    }
  }
  p.train = p.train.filter((j) => j.done < j.count)

  // giden ordular
  for (const m of [...g.out]) {
    if (!m.returning && m.arrive <= t1) resolveOutgoing(g, m, m.arrive)
    if (m.returning && m.back <= t1) {
      const survivors = m.army.reduce((s, n) => s + n, 0)
      m.army.forEach((n, i) => (p.army[i] += n))
      for (const k of RES_KEYS) p.res[k] = Math.min(cap(g), p.res[k] + m.loot[k])
      g.out = g.out.filter((x) => x !== m)
      if (survivors > 0 && m.type !== 'scout' && RES_KEYS.some((k) => m.loot[k] > 0)) addFeed(g, m.back, '🐎', `Ordun ganimetle döndü: ${resLine(m.loot)}`)
    }
  }
  g.out = g.out.filter((m) => !(m.returning && m.army.every((n) => n === 0)))

  // gelen saldırılar
  for (const inc of [...g.incoming]) {
    if (inc.arrive <= t1) {
      resolveIncoming(g, inc)
      g.incoming = g.incoming.filter((x) => x !== inc)
    }
  }

  // boy başvurusu
  if (g.application && g.application.at <= t1) {
    const a = allianceOf(g, g.application.allianceId)
    g.application = null
    if (a) {
      const pp = playerPop(p)
      if (pp >= a.minPop) {
        p.allianceId = a.id
        g.chat.alliance = []
        addReport(g, { time: t1, kind: 'bilgi', title: `${a.name} boyuna kabul edildin!`, lines: ['Boy sohbetinden üyelerle konuşabilir, Umaykut’a kaynak bağışlayabilirsin.'] })
        addChat(g, 'alliance', { time: t1, from: 'Sistem', system: true, text: `${p.name} boya katıldı.` })
        const members = shuffle(g.bots.filter((b) => b.allianceId === a.id && b.activity > 0))
        const lines = shuffle(['hoş geldin {me}! 🐺', 'aramıza hoş geldin', 'hoş geldin kardeş, koordinatın ne?', 'hg {me}', 'selam, Umaykut’a katkı bekliyoruz :)'])
        for (let i = 0; i < Math.min(3, members.length); i++) {
          const b = members[i]
          queueMsg(g, { at: t1 + rnd(2000, 15000) * (i + 1), channel: 'alliance', from: b.id, text: humanize(fill(g, lines[i], b), b) })
        }
      } else {
        addReport(g, { time: t1, kind: 'mesaj', title: `${a.name} başvurunu reddetti`, lines: [`Boy beyi: “Kardeşim en az ${a.minPop} nüfusa ulaşınca tekrar başvur.”`] })
      }
    }
  }

  // bekleyen bot mesajları
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
