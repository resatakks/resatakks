// Gerçek oyuncu hissi: özel mesajlar, botlar arası sohbet zinciri, yazım tarzı, "yazıyor…".
import { TRIBES } from './data'
import { pick } from './chatter'
import type { Bot, Game, Pending } from './engine'
import { addChat, addFeed, allianceOf, dist, fill, playerPop, randomBot } from './engine'

export type Topic = 'invite' | 'peace' | 'threat' | 'beg' | 'greet' | 'support' | 'chat' | 'traitor'

export interface DmMsg { id: number; time: number; me: boolean; text: string }
export interface Thread {
  botId: number
  msgs: DmMsg[]
  unread: number
  mood: number // -1 düşman … +1 dost
  topic: Topic
  peaceUntil: number
  invite: string | null
  seenAt: number // botun oyuncunun son mesajını gördüğü an
}

const rnd = (a: number, b: number) => a + Math.random() * (b - a)
export const shuffle = <T,>(arr: T[]) => {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}
const chance = (ratePerSec: number, dt: number) => Math.random() < 1 - Math.exp(-ratePerSec * dt)

// ---------------- yazım tarzı ----------------
// Her botun sabit bir tarzı var: kimi Türkçe karakter kullanmaz, kimi hep küçük harf yazar, kimi harf uzatır.
const ASCII: Record<string, string> = { ş: 's', Ş: 'S', ı: 'i', İ: 'I', ğ: 'g', Ğ: 'G', ç: 'c', Ç: 'C', ö: 'o', Ö: 'O', ü: 'u', Ü: 'U' }
export function humanize(text: string, b: Bot) {
  const s = (b.id * 2654435761) >>> 0
  const ascii = s % 5 === 0
  const lower = s % 3 === 0
  const stretch = s % 7 === 0
  const noPunct = s % 2 === 0
  let t = text
  if (lower) t = t.toLocaleLowerCase('tr-TR')
  if (ascii) t = t.replace(/[şŞıİğĞçÇöÖüÜ]/g, (c) => ASCII[c])
  if (noPunct) t = t.replace(/[.!?]+$/u, '')
  if (stretch && Math.random() < 0.5) t = t.replace(/([aeıioöuü])(\S*)$/u, (_m, v: string, rest: string) => v + v + v + rest)
  if (Math.random() < 0.06 && t.length > 6) {
    // küçük yazım hatası: iki harfin yeri değişir
    const i = 1 + Math.floor(Math.random() * (t.length - 3))
    if (/\p{L}\p{L}/u.test(t.slice(i, i + 2))) t = t.slice(0, i) + t[i + 1] + t[i] + t.slice(i + 2)
  }
  return t
}

// ---------------- kuyruk ----------------
export function queueMsg(g: Game, p: Omit<Pending, 'typeAt'> & { typeAt?: number }) {
  const lead = Math.min(rnd(1800, 4500), Math.max(0, p.at - Date.now()))
  g.pending.push({ ...p, typeAt: p.typeAt ?? p.at - lead })
}

/** çevrimiçiyse saniyeler, değilse dakikalar sonra cevap verir */
export function replyDelay(b: Bot) {
  if (b.online) return rnd(4000, 16000)
  if (b.activity === 0) return Infinity
  return rnd(60000, 6 * 60000) / Math.max(0.3, b.activity)
}

// ---------------- özel mesajlar ----------------
export function thread(g: Game, botId: number): Thread {
  let t = g.dms.find((x) => x.botId === botId)
  if (!t) {
    t = { botId, msgs: [], unread: 0, mood: 0, topic: 'chat', peaceUntil: 0, invite: null, seenAt: 0 }
    g.dms.unshift(t)
  }
  return t
}

export function botDm(g: Game, b: Bot, text: string, at: number, topic: Topic, invite: string | null = null) {
  if (!isFinite(at)) return
  queueMsg(g, { at, channel: 'dm', from: b.id, text: humanize(fill(g, text, b), b), topic, invite })
}

export function deliverDm(g: Game, m: Pending) {
  const t = thread(g, m.from)
  t.msgs.push({ id: g.nextId++, time: m.at, me: false, text: m.text })
  if (t.msgs.length > 60) t.msgs.splice(0, t.msgs.length - 60)
  t.unread++
  if (m.topic) t.topic = m.topic
  if (m.invite) t.invite = m.invite
  g.bots[m.from].lastSeen = m.at
  // en yeni konuşma en üstte
  g.dms = [t, ...g.dms.filter((x) => x !== t)]
}

export const hasPeace = (g: Game, botId: number, now: number) => (g.dms.find((t) => t.botId === botId)?.peaceUntil ?? 0) > now

const YES = /\b(evet|olur|tamam|ok|okey|kabul|anlaştık|tm|tmm|peki|neden olmasın|olsun)\b/i
const NO = /\b(hayır|yok|olmaz|istemem|gerek yok|sanane|boşver)\b/i
const PEACE = /(barış|anlaş|dokunma|saldırma|özür|pardon|kusura|affet|dost|kardeş)/i
const THREAT = /(gel|vururum|yok ederim|ezerim|korkmuyorum|bekle sen|göreceksin|haddini|aptal|salak|gerizekalı|mal\b|ağla)/i
const RES_ASK = /(kaynak|demir|odun|taş|yiyecek|takas|ver)/i
const WHO = /(kimsin|kim bu|nerelisin|kaç yaşındasın|nerden|nereden)/i
const HELLO = /\b(selam|merhaba|slm|sa|naber|nbr|hey|selamün)\b/i

export function playerDm(g: Game, botId: number, text: string, now: number) {
  text = text.trim().slice(0, 300)
  if (!text) return
  const b = g.bots[botId]
  const t = thread(g, botId)
  t.msgs.push({ id: g.nextId++, time: now, me: true, text })
  t.unread = 0
  const delay = replyDelay(b)
  if (!isFinite(delay)) return // inaktif oyuncu hiç cevap vermez
  t.seenAt = now + delay * rnd(0.3, 0.8)
  const at = now + delay
  const strong = b.atk > playerPop(g.player) * 6
  const allyName = allianceOf(g, b.allianceId)?.name

  if (t.topic === 'invite' && t.invite && YES.test(text)) {
    return botDm(g, b, pick(['süper! aşağıdaki davet butonuna bas, kabul ediyorum 👍', 'tamamdır davet hâlâ geçerli, katıl hemen', 'hoş geldin şimdiden 🐺 daveti onayla']), at, 'invite', t.invite)
  }
  if (t.topic === 'invite' && NO.test(text)) {
    t.invite = null
    return botDm(g, b, pick(['peki, fikrin değişirse yaz', 'sen bilirsin, boysuz zor ama', 'tamam kardeş bol şans']), at, 'chat')
  }
  if (t.topic === 'traitor') {
    t.mood = Math.max(-1, t.mood - 0.2)
    return botDm(g, b, pick(['konuşacak bir şey kalmadı', 'söz verdin bozdun, hesabını vereceksin', '...']), at, 'traitor')
  }
  if (THREAT.test(text)) {
    t.mood = Math.max(-1, t.mood - 0.5)
    if (b.aggr > 0.4 || strong) {
      b.grudge = now + rnd(3, 20) * 60000 / g.speed
      return botDm(g, b, pick(['bekle o zaman 😈', 'sen bilirsin, geliyorum', 'büyük konuşma {me}', 'tamam, ordumu hazırlıyorum', 'haha göreceğiz']), at, 'threat')
    }
    return botDm(g, b, pick(['tamam sakin ol', 'ben bir şey demedim ki', 'kavga istemiyorum', 'hadi ya 😕']), at, 'chat')
  }
  if (PEACE.test(text) || ((t.topic === 'peace' || t.topic === 'beg') && YES.test(text))) {
    const accept = t.mood > -0.6 && (b.aggr < 0.75 || Math.random() < 0.4)
    if (accept) {
      t.mood = Math.min(1, t.mood + 0.4)
      t.peaceUntil = now + (24 * 3600 * 1000) / g.speed
      b.grudge = 0
      return botDm(g, b, pick(['anlaştık, birbirimize dokunmuyoruz 🤝', 'tamam barış. sözünü tut ama', 'olur, 1 gün dokunmam sonra bakarız', 'kabul. komşuyuz zaten']), at, 'peace')
    }
    return botDm(g, b, pick(['barış mı? önce kaybımı öde', 'yok kardeş, intikam alacağım', 'çok geç', 'sana güvenmiyorum']), at, 'threat')
  }
  if (RES_ASK.test(text)) {
    return botDm(g, b, pick(['benim de az, kusura bakma', 'takas sistemi yok ki bu oyunda :D', 'inaktiflere yağma at, kaynak orda', 'ambarım boş valla']), at, t.topic)
  }
  if (WHO.test(text)) {
    return botDm(g, b, pick([`ben ${b.x}|${b.y} deyim, ${TRIBES[b.tribe].name.toLowerCase()} oynuyorum`, `${allyName ? allyName + ' boyundanım' : 'boysuzum şimdilik'}`, 'eski oyuncuyum, facebook zamanından beri', 'izmirden yazıyorum', 'öğrenciyim, boş vakitlerde oynuyorum']), at, 'chat')
  }
  if (HELLO.test(text)) {
    return botDm(g, b, pick(['as', 'aleyküm selam', 'selam {me}, hayırdır?', 'selam kardeş', 'iyidir sen?']), at, t.topic === 'chat' ? 'greet' : t.topic)
  }
  if (YES.test(text)) return botDm(g, b, pick(['👍', 'tamamdır', 'iyi']), at, t.topic)
  if (Math.random() < 0.75) botDm(g, b, pick(['hmm', 'anladım', 'ok', 'he', 'tamam', 'ne diyorsun anlamadım :D', 'sonra konuşalım biraz meşgulüm', 'haha']), at, t.topic)
}

/** boy davetini kabul et (nüfus şartı aranmaz) */
export function acceptInvite(g: Game, botId: number, now: number) {
  const t = thread(g, botId)
  const a = allianceOf(g, t.invite)
  t.invite = null
  if (!a || g.player.allianceId) return
  g.player.allianceId = a.id
  g.application = null
  g.chat.alliance = []
  addChat(g, 'alliance', { time: now, from: 'Sistem', system: true, text: `${g.player.name} boya katıldı (${g.bots[botId].name} davet etti).` })
  addFeed(g, now, '🐺', `${g.player.name}, ${a.name} boyuna katıldı`)
  t.topic = 'chat'
  const members = shuffle(g.bots.filter((b) => b.allianceId === a.id && b.activity > 0 && b.online && b.id !== botId))
  const lines = shuffle(['hoş geldin {me}! 🐺', 'hg', 'aramıza hoş geldin', 'hoş geldin kardeş, koordinatın ne?', 'hg kardeş, Umaykut’a katkı bekliyoruz :)'])
  queueMsg(g, { at: now + rnd(3000, 8000), channel: 'alliance', from: botId, text: humanize(fill(g, 'hoş geldin {me}, sorunun olursa yaz 👍', g.bots[botId]), g.bots[botId]) })
  for (let i = 0; i < Math.min(2, members.length); i++) {
    const b = members[i]
    queueMsg(g, { at: now + rnd(6000, 16000) * (i + 1), channel: 'alliance', from: b.id, text: humanize(fill(g, lines[i], b), b) })
  }
}

// ---------------- dünya sohbetinde zincirler ----------------
const QA: [string, string[]][] = [
  ['mızrakçı mı okçu mu savunmada daha iyi', ['mızrakçı tabi', 'okçu daha dengeli bence', 'ikisinden de bas', 'atlıya karşı mızrakçı']],
  ['Umaykut kimin olacak sizce?', ['{ally} kesin', 'bizim boy 😎', 'daha çok erken', '{ally2} çok hızlı gidiyor']],
  ['yeni başladım ne yapmam lazım', ['kaynak binalarını yükselt önce', 'bir boya katıl', 'acemi koruman bitmeden sur yap', 'hoş geldin, tarla kas']],
  ['hunlar mı göktürkler mi?', ['hunlar, atlı okçu çok iyi', 'göktürk uzun vadede kazandırır', 'selçuklu diyen yok mu :(']],
  ['sunucunun en büyüğü kim şu an', ['{name} galiba', 'sıralamaya bak', '{name} çok büyüdü']],
  ['kimse yok mu', ['burdayım', 'var var', 'gece herkes uyuyor', 'buradayız']],
  ['demir lazım takas yapan?', ['takas yok bu oyunda', 'inaktif yağmala', 'bende de yok']],
  ['kurultay kaçta?', ['9da', 'akşam', 'bilmiyorum bizimkinde yok']],
  ['oyun kasıyor mu bende mi', ['bende de biraz', 'bende yok', 'sayfayı yenile']],
]
const COMEBACKS = ['ağlama :D', 'oyun bu kardeş', 'sur yapsaydın', 'sıra sende değil', 'kaynağın için teşekkürler 😂', 'tekrar gelirim']
const VICTIM = ['{name} sana da sıra gelecek', '{name} gece saldırısı mı yaptın ya', '{name} bunun hesabını soracağım', 'yine yağmalandım ya', '{name} kardeş neden ben']

function botSay(g: Game, b: Bot, text: string, at: number) {
  queueMsg(g, { at, channel: 'world', from: b.id, text: humanize(fill(g, text, b), b) })
}

export function worldChatter(g: Game, now: number) {
  const b = randomBot(g, (x) => x.online) ?? pick(g.bots)
  if (Math.random() < 0.3) {
    const [q, answers] = pick(QA)
    addChat(g, 'world', { time: now, from: b.name, botId: b.id, tribe: b.tribe, text: humanize(fill(g, q, b), b) })
    b.lastSeen = now
    const n = 1 + (Math.random() < 0.45 ? 1 : 0)
    for (let i = 0; i < n; i++) {
      const r = randomBot(g, (x) => x.online && x !== b)
      if (!r) continue
      const ans = pick(answers)
      botSay(g, r, Math.random() < 0.4 ? `@${b.name} ${ans}` : ans, now + rnd(5000, 25000) * (i + 1))
    }
    return true
  }
  return false
}

/** bot-bot yağmasından sonra kurban sohbete yazabilir, saldıran cevap verebilir */
export function raidBanter(g: Game, attacker: Bot, victim: Bot, now: number) {
  if (!victim.online || Math.random() > 0.25) return
  const t0 = now + rnd(20000, 90000)
  botSay(g, victim, pick(VICTIM).replace(/\{name\}/g, attacker.name), t0)
  if (attacker.online && Math.random() < 0.6) botSay(g, attacker, `@${victim.name} ${pick(COMEBACKS)}`, t0 + rnd(8000, 30000))
}

/** oyuncu sohbette bir botun adını anarsa o bot cevap verir */
export function mentionReply(g: Game, channel: 'world' | 'alliance', text: string, now: number) {
  const recent = g.chat[channel].slice(-30).filter((m) => m.botId !== undefined)
  const low = text.toLocaleLowerCase('tr-TR')
  const hit = recent.find((m) => low.includes(m.from.toLocaleLowerCase('tr-TR')))
  if (!hit) return false
  const b = g.bots[hit.botId!]
  const d = replyDelay(b)
  if (!isFinite(d)) return false
  queueMsg(g, {
    at: now + Math.min(d, 40000),
    channel,
    from: b.id,
    text: humanize(fill(g, `@{me} ${pick(['efendim?', 'ne oldu', 'buyur', 'he?', 'ben mi', 'sana ne :D', 'söyle kardeş', 'dm at'])}`, b), b),
  })
  return true
}

// ---------------- botların kendiliğinden attığı özel mesajlar ----------------
const INVITE_LINES = [
  'selam {me}, haritada gördüm seni. {ally} boyuna gelmek ister misin?',
  'kardeş yeni misin? boyumuz üye arıyor, istersen davet ediyorum',
  'selam! {ally} olarak yakındaki aktif oyuncuları topluyoruz. katılır mısın?',
  'boysuz kalma, bizim boy birbirini korur. davet atıyorum',
]
const NEIGHBOR_LINES = [
  'selam komşu, ben {bx}|{by} deyim. birbirimize dokunmayalım mı?',
  'komşu selam, barış yapalım mı? ikimiz de büyürüz',
  'yakınız seninle, kavga etmeyelim bence ne dersin',
]
const BEG_LINES = ['kardeş biraz kaynak verebilir misin? çok geride kaldım', 'bana saldırma lütfen yeni başladım', 'boyuna alır mısın beni?']
const SUPPORT_LINES = ['saldırı yedin gördüm, iyi misin? sur yükselt', 'kim vurdu sana? boyca karşılık verelim', 'destek lazımsa söyle']

export function socialTick(g: Game, dtReal: number, now: number) {
  const p = g.player
  const age = now - g.created
  const near = (r: number) => (x: Bot) => x.activity > 0 && dist(x.x, x.y, p.x, p.y) < r && !g.dms.some((t) => t.botId === x.id)

  // ilk dakikalarda bir boy beyi davet atar, sonra seyrek
  if (!p.allianceId && !g.dms.some((t) => t.invite) && chance(age < 8 * 60000 ? 1 / 150 : 1 / 2400, dtReal)) {
    const b = randomBot(g, (x) => near(45)(x) && !!x.allianceId && x.online && (allianceOf(g, x.allianceId)?.minPop ?? 0) < playerPop(p) + 120, 200)
    if (b) botDm(g, b, pick(INVITE_LINES), now + rnd(2000, 8000), 'invite', b.allianceId)
  }
  // komşu barış teklifi
  if (chance(1 / 1800, dtReal)) {
    const b = randomBot(g, (x) => near(14)(x) && x.aggr < 0.6 && x.online, 200)
    if (b) botDm(g, b, pick(NEIGHBOR_LINES).replace('{bx}', String(b.x)).replace('{by}', String(b.y)), now + 3000, 'peace')
  }
  // küçük oyuncular yalvarır
  if (chance(1 / 3000, dtReal)) {
    const b = randomBot(g, (x) => near(20)(x) && x.pop < playerPop(p) * 0.6 && x.online, 200)
    if (b) botDm(g, b, pick(BEG_LINES), now + 3000, 'beg')
  }
}

export function supportDm(g: Game, now: number) {
  if (!g.player.allianceId || Math.random() > 0.5) return
  const b = randomBot(g, (x) => x.allianceId === g.player.allianceId && x.online, 120)
  if (b) botDm(g, b, pick(SUPPORT_LINES), now + rnd(30000, 120000), 'support')
}
