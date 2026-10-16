import { useEffect, useRef, useState } from 'react'
import { SPY, TRIBES, UNITS, emptyArmy } from '../game/data'
import {
  MISSION_NAME, type MissionType, allianceOf, attackPower, buyProtection, cityById, dist, mineAt, rankings, recall, sendMission, tp, tpLevel, travelMs,
} from '../game/engine'
import { hasPeace } from '../game/social'
import { useG } from '../ctx'
import { fmt, fmtAgo, fmtDur, fmtTime } from '../format'
import { Tag, Window } from './ui'

// ---------------- sefer ----------------
export function SendWin({ bot, ci, type: t0 }: { bot: number; ci: number; type: MissionType }) {
  const { g, now, act, cityId, open } = useG()
  const [type, setType] = useState<MissionType>(t0)
  const [from, setFrom] = useState(cityId)
  const [army, setArmy] = useState<number[]>(emptyArmy())
  const b = g.bots[bot]
  const target = b.cities[ci] ?? b.cities[0]
  const c = cityById(g, from)
  const units = UNITS[g.player.tribe]
  const d = dist(c.x, c.y, target.x, target.y)
  const picked = army.some((n) => n > 0)
  const a = allianceOf(g, b.allianceId)
  const set = (i: number, v: number) => setArmy(army.map((n, k) => (k === i ? Math.max(0, Math.min(c.army[i], v)) : n)))
  const allowed = (i: number) => (type === 'casus' ? i === SPY : true)

  useEffect(() => {
    if (type === 'casus') setArmy((ar) => ar.map((n, i) => (i === SPY ? n : 0)))
  }, [type])

  return (
    <Window title={`${MISSION_NAME[type]} · ${target.name}`} wide>
      <div className="send-head">
        <div>
          <b>{target.name}</b> ({target.x}|{target.y}) · <button className="link" onClick={() => open({ w: 'oyuncu', id: b.id })}>{b.name}</button>{' '}
          {a && <Tag tag={a.tag} color={a.color} />}
        </div>
        <small className="muted">{TRIBES[b.tribe].name} · nüfus {fmt(b.pop)} · {d.toFixed(1)} kare</small>
      </div>
      {hasPeace(g, b.id, now) && type !== 'casus' && <p className="note bad">🤝 Bu oyuncuyla barışın var. Saldırırsan barış bozulur ve hain ilan edilirsin.</p>}
      <div className="seg">
        {(['saldiri', 'yagma', 'casus'] as MissionType[]).map((m) => (
          <button key={m} className={type === m ? 'active' : ''} onClick={() => setType(m)}>
            {m === 'saldiri' ? '⚔️' : m === 'yagma' ? '💰' : '🕵️'} {MISSION_NAME[m]}
          </button>
        ))}
      </div>
      <p className="muted small">
        {type === 'saldiri' && 'Saldırı: düşman ordusunu yok etmeye çalışır; koçbaşı suru, mancınık binaları yıkar.'}
        {type === 'yagma' && 'Yağma: savaşmadan önce kaynak kapmaya odaklanır; kayıplar daha az, ganimet daha çok.'}
        {type === 'casus' && 'Casusluk: yalnız casuslar gider; düşmanın kaynaklarını ve ordusunu öğrenirsin.'}
      </p>
      {g.player.cities.length > 1 && (
        <label className="row">
          Çıkış şehri
          <select value={from} onChange={(e) => { setFrom(Number(e.target.value)); setArmy(emptyArmy()) }}>
            {g.player.cities.map((x) => <option key={x.id} value={x.id}>{x.name} ({x.x}|{x.y})</option>)}
          </select>
        </label>
      )}
      <div className="send-units">
        {units.map((u, i) => (
          <div key={i} className={`send-unit ${!allowed(i) || !c.army[i] ? 'off' : ''}`}>
            <span className="u-icon" title={u.name}>{u.icon}</span>
            <small>{u.name}</small>
            <input inputMode="numeric" disabled={!allowed(i) || !c.army[i]} value={army[i] || ''} placeholder="0" onChange={(e) => set(i, Number(e.target.value.replace(/\D/g, '')))} aria-label={u.name} />
            <button className="link" disabled={!allowed(i)} onClick={() => set(i, c.army[i])}>({fmt(c.army[i])})</button>
          </div>
        ))}
      </div>
      <div className="send-foot">
        <span>⚔️ Saldırı gücü <b>{fmt(attackPower(g.player.tribe, army))}</b></span>
        <span>⏱ Varış <b>{picked ? fmtDur(travelMs(g, army, d)) : '—'}</b></span>
        <span>🎒 Taşıma <b>{fmt(army.reduce((s, n, i) => s + n * units[i].carry, 0))}</b></span>
        <button className="link" onClick={() => setArmy(c.army.map((n, i) => (allowed(i) && (type === 'casus' || i !== SPY) ? n : 0)))}>Hepsini seç</button>
        <button
          className={type === 'casus' ? 'btn-gold' : 'btn-red'}
          disabled={!picked}
          onClick={() => {
            if (!act((g, n) => sendMission(g, c.id, type, bot, ci, army, n))) open({ w: 'hareket', tab: 'giden' })
          }}
        >
          Gönder
        </button>
      </div>
    </Window>
  )
}

// ---------------- hareketler ----------------
export function Movements({ tab: t0 }: { tab?: 'giden' | 'gelen' }) {
  const { g, now, act, open } = useG()
  const [tab, setTab] = useState(t0 ?? 'giden')
  const units = UNITS[g.player.tribe]
  const inc = g.incoming.filter((i) => i.launch <= now)
  return (
    <Window title="Asker Hareketleri" wide>
      <div className="seg">
        <button className={tab === 'giden' ? 'active' : ''} onClick={() => setTab('giden')}>⚔️ Giden ({g.out.length})</button>
        <button className={tab === 'gelen' ? 'active' : ''} onClick={() => setTab('gelen')}>🛡️ Gelen saldırı ({inc.length})</button>
      </div>
      {tab === 'giden' && (
        <div className="moves">
          {g.out.length === 0 && <p className="muted">Seferde ordun yok. Haritada bir şehre tıklayıp “Saldır” diyebilirsin.</p>}
          {g.out.map((m) => {
            const b = g.bots[m.target]
            const t = b.cities[m.tc] ?? b.cities[0]
            const left = (m.returning ? m.back : m.arrive) - now
            return (
              <div key={m.id} className={`move ${m.returning ? 'back' : ''}`}>
                <div>
                  <b>{m.returning ? '↩ Dönüyor' : '➜ ' + MISSION_NAME[m.type]}</b> · {t.name} ({t.x}|{t.y}) · <button className="link" onClick={() => open({ w: 'oyuncu', id: b.id })}>{b.name}</button>
                  <div className="move-units">
                    {m.army.map((n, i) => (n ? <span key={i}>{units[i].icon} {fmt(n)}</span> : null))}
                  </div>
                </div>
                <b className="timer">{fmtDur(left)}</b>
                {!m.returning && <button className="mini" onClick={() => act((g, n) => recall(g, m.id, n))}>Geri çağır</button>}
              </div>
            )
          })}
        </div>
      )}
      {tab === 'gelen' && (
        <div className="moves">
          {inc.length === 0 && <p className="muted">Şu an sana gelen bir saldırı yok.</p>}
          {inc.map((m) => {
            const b = g.bots[m.from]
            const c = cityById(g, m.cityId)
            return (
              <div key={m.id} className="move incoming">
                <div>
                  <b>⚠ {b.name}</b> → {c.name} · güç ≈ {fmt(m.power)}
                  <small className="muted"> varış {fmtTime(m.arrive)}</small>
                </div>
                <b className="timer red">{fmtDur(m.arrive - now)}</b>
                <button className="mini" onClick={() => open({ w: 'mesaj', id: b.id })}>Mesaj</button>
              </div>
            )
          })}
          {inc.length > 0 && <p className="muted small">İpucu: Okçu ve mızrakçı eğit, Sur yükselt ya da Ayarlar’dan elmasla koruma al.</p>}
        </div>
      )}
    </Window>
  )
}

// ---------------- oyuncu profili ----------------
export function PlayerWin({ id }: { id: number }) {
  const { g, now, open, goto } = useG()
  const list = rankings(g)
  const rank = list.findIndex((r) => r.id === id) + 1
  if (id === -1) {
    const p = g.player
    const a = allianceOf(g, p.allianceId)
    return (
      <Window title="Profilim">
        <div className="profile">
          <span className="avatar big" style={{ background: TRIBES[p.tribe].color }}>{TRIBES[p.tribe].emblem}</span>
          <div>
            <h3>{p.name}</h3>
            <p className="muted">{TRIBES[p.tribe].name} · Seviye {tpLevel(tp(p))} · Sıra #{rank}</p>
            {a && <p><Tag tag={a.tag} color={a.color} /> {a.name}</p>}
          </div>
        </div>
        <table className="kv"><tbody>
          <tr><td>Tecrübe puanı</td><td>{fmt(tp(p))}</td></tr>
          <tr><td>Saldırı puanı</td><td>{fmt(p.raidPts)}</td></tr>
          <tr><td>Savunma puanı</td><td>{fmt(p.defPts)}</td></tr>
          <tr><td>Şehirler</td><td>{p.cities.map((c) => `${c.name} (${c.x}|${c.y})`).join(', ')}</td></tr>
        </tbody></table>
        <ul className="bonus-list">{TRIBES[p.tribe].bonus.map((x) => <li key={x}>{x}</li>)}</ul>
      </Window>
    )
  }
  const b = g.bots[id]
  const a = allianceOf(g, b.allianceId)
  const ally = !!a && a.id === g.player.allianceId
  return (
    <Window title={b.name}>
      <div className="profile">
        <span className="avatar big" style={{ background: TRIBES[b.tribe].color }}>{TRIBES[b.tribe].emblem}</span>
        <div>
          <h3>{b.name} {b.online && <span className="online">●</span>}</h3>
          <p className="muted">{TRIBES[b.tribe].name} · Sıra #{rank} · {b.online ? 'çevrimiçi' : `son görülme ${fmtAgo(b.lastSeen, now)}`}</p>
          {a && <p><Tag tag={a.tag} color={a.color} /> {a.name}</p>}
          {hasPeace(g, b.id, now) && <p className="note ok">🤝 Barış anlaşmanız var</p>}
        </div>
      </div>
      <table className="kv"><tbody>
        <tr><td>Nüfus</td><td>{fmt(b.pop)}</td></tr>
        <tr><td>Saldırı puanı</td><td>{fmt(b.raidPts)}</td></tr>
        <tr><td>Savunma puanı</td><td>{fmt(b.defPts)}</td></tr>
      </tbody></table>
      <h5>Şehirler</h5>
      <div className="plist">
        {b.cities.map((c, i) => (
          <div key={i} className="prow">
            <button className="link" onClick={() => goto(c.x, c.y)}>{c.name} ({c.x}|{c.y})</button>
            {!ally && <button className="mini red" onClick={() => open({ w: 'sefer', bot: b.id, ci: i, type: 'saldiri' })}>⚔️</button>}
            {!ally && <button className="mini" onClick={() => open({ w: 'sefer', bot: b.id, ci: i, type: 'yagma' })}>💰</button>}
            <button className="mini" onClick={() => open({ w: 'sefer', bot: b.id, ci: i, type: 'casus' })}>🕵️</button>
          </div>
        ))}
      </div>
      <div className="ti-actions">
        <button className="btn-gold" onClick={() => open({ w: 'mesaj', id: b.id })}>✉️ Mesaj yaz</button>
      </div>
    </Window>
  )
}

// ---------------- konum ara ----------------
export function SearchWin() {
  const { g, goto, open } = useG()
  const [x, setX] = useState('')
  const [y, setY] = useState('')
  const [q, setQ] = useState('')
  const found = q.trim().length >= 2 ? g.bots.filter((b) => b.name.toLowerCase().includes(q.trim().toLowerCase())).slice(0, 12) : []
  return (
    <Window title="Konum Ara">
      <div className="row">
        <input inputMode="numeric" placeholder="X" value={x} onChange={(e) => setX(e.target.value.replace(/\D/g, ''))} aria-label="X" />
        <input inputMode="numeric" placeholder="Y" value={y} onChange={(e) => setY(e.target.value.replace(/\D/g, ''))} aria-label="Y" />
        <button className="btn-gold" disabled={!x || !y} onClick={() => goto(Math.min(g.mapSize - 1, Number(x)), Math.min(g.mapSize - 1, Number(y)))}>Git</button>
      </div>
      <h5>Oyuncu ara</h5>
      <input placeholder="oyuncu adı" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Oyuncu adı" />
      <div className="plist">
        {found.map((b) => (
          <div key={b.id} className="prow">
            <button className="link" onClick={() => open({ w: 'oyuncu', id: b.id })}>{b.name}</button>
            <small className="muted">{fmt(b.pop)} nüfus</small>
            <button className="mini" onClick={() => goto(b.x, b.y)}>{b.x}|{b.y}</button>
          </div>
        ))}
      </div>
    </Window>
  )
}

// ---------------- mini harita ----------------
export function MiniMap() {
  const { g, goto } = useG()
  const ref = useRef<HTMLCanvasElement>(null)
  const S = g.mapSize
  useEffect(() => {
    const cv = ref.current
    if (!cv) return
    const ctx = cv.getContext('2d')!
    const px = 3
    cv.width = S * px
    cv.height = S * px
    ctx.fillStyle = '#5f8a3a'
    ctx.fillRect(0, 0, cv.width, cv.height)
    const MC: Record<string, string> = { tas: '#9b978f', odun: '#2c5e22', tahil: '#d9b44a', demir: '#45444c' }
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const m = mineAt(g, x, y)
      if (m) {
        ctx.fillStyle = MC[m.type]
        ctx.fillRect(x * px, y * px, px, px)
      }
    }
    for (const b of g.bots) {
      const a = allianceOf(g, b.allianceId)
      ctx.fillStyle = a ? (a.id === g.player.allianceId ? '#4fb3ff' : a.color) : '#e0d6c0'
      for (const c of b.cities) ctx.fillRect(c.x * px - 1, c.y * px - 1, px + 1, px + 1)
    }
    ctx.fillStyle = '#3fff6b'
    for (const c of g.player.cities) ctx.fillRect(c.x * px - 3, c.y * px - 3, px + 5, px + 5)
  }, [g, S])
  return (
    <Window title="Dünya Haritası" wide>
      <canvas
        ref={ref}
        className="minimap"
        onClick={(e) => {
          const r = e.currentTarget.getBoundingClientRect()
          goto(Math.floor(((e.clientX - r.left) / r.width) * S), Math.floor(((e.clientY - r.top) / r.height) * S))
        }}
      />
      <p className="muted small">Yeşil kare: şehirlerin · mavi: birlik üyeleri · renkli: diğer birlikler. Tıkla, oraya git.</p>
    </Window>
  )
}

// ---------------- elmas ----------------
export function ElmasWin() {
  const { g, act, now } = useG()
  return (
    <Window title="Elmas">
      <p>Elmasın: <b>💎 {fmt(g.player.elmas)}</b></p>
      <p className="muted small">Bu yerel sürümde gerçek para yok. Elmas her gün giriş ödülü olarak, savunma zaferlerinde ve görevlerde kazanılır.</p>
      <table className="kv"><tbody>
        <tr><td>İnşaatı hemen bitir</td><td>her 2 dakika için 1 💎</td></tr>
        <tr><td>24 saat koruma</td><td>30 💎</td></tr>
      </tbody></table>
      <button className="btn-gold" onClick={() => act((g, n) => buyProtection(g, n))}>🛡️ 24 saat koruma al (30 💎)</button>
      {g.player.protectionUntil > now && <p className="note ok">Koruma aktif: {fmtDur(g.player.protectionUntil - now)}</p>}
    </Window>
  )
}

// ---------------- ayarlar ----------------
export function SettingsWin() {
  const { g, reset, now } = useG()
  return (
    <Window title="Ayarlar">
      <table className="kv"><tbody>
        <tr><td>Sunucu</td><td>{g.server} · ×{g.speed} hız</td></tr>
        <tr><td>Dünyada oynayan</td><td>{fmt(g.bots.length + 1)} oyuncu</td></tr>
        <tr><td>Sezon bitişi</td><td>{fmtDur(g.seasonEnd - now)}</td></tr>
      </tbody></table>
      <p className="muted small">Oyun bu tarayıcıya kaydedilir; kapatıp açsan da dünya akmaya devam eder.</p>
      <button className="btn-red" onClick={reset}>Dünyayı sil ve baştan başla</button>
    </Window>
  )
}

// ---------------- yardım ----------------
export function HelpWin() {
  return (
    <Window title="Yardım" wide>
      <div className="help">
        <h5>Başlangıç</h5>
        <p>Şehrindeki binalara tıkla: Taşçı, Oduncu, Tarla ve Demirci kaynak üretir. Ambar depolama sınırını, Merkez inşaat hızını belirler. Aynı anda 2 inşaat sıraya girebilir.</p>
        <h5>Madenler</h5>
        <p>Haritadaki taş ocağı, orman, tahıl tarlası ve demir madenleri {`2,5`} kare çevresindeki şehirlerin üretimini artırır. Yeni köyünü madenlerin arasına kur.</p>
        <h5>Ordu</h5>
        <p>Kışla, Okçu Evi, Ahır ve Atölye asker eğitir. Askerler tahıl tüketir. Saldırı ordu öldürür, yağma kaynak kapar, casus bilgi getirir.</p>
        <h5>Pazar</h5>
        <p>Altın ve atlarını sat, fazla kaynağını takas et.</p>
        <h5>Birlik ve Umaykut</h5>
        <p>Bir birliğe katıl ya da kur. Birlik üyeleri kaynak bağışlayarak Umaykut’u yükseltir; Hun, Göktürk ve Selçuklu üyeleri olan ilk birlik 10. seviyeye ulaşırsa sezonu kazanır.</p>
        <h5>Koruma</h5>
        <p>Yeni oyuncular acemi korumasındadır. Saldırı yaparsan koruma biter.</p>
      </div>
    </Window>
  )
}
