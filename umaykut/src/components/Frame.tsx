import { CITY_TP, MAX_CITIES, RES_INFO, RES_KEYS, SERVERS, STORED, TRIBES } from '../game/data'
import { allianceOf, cap, cityById, cityPop, rates, tp, tpForLevel, tpLevel } from '../game/engine'
import { useG } from '../ctx'
import { fmt, fmtDur, fmtTime } from '../format'
import { Logo } from './sprites'
import { Tag } from './ui'

export function Hud({ hover }: { hover: { x: number; y: number } | null }) {
  const { g, now, view, setView, open, cityId, toggleSide } = useG()
  const p = g.player
  const t = tp(p)
  const lvl = tpLevel(t)
  const lo = tpForLevel(lvl)
  const hi = tpForLevel(lvl + 1)
  const pct = Math.min(100, ((t - lo) / Math.max(1, hi - lo)) * 100)
  const c = cityById(g, cityId)
  const incoming = g.incoming.filter((i) => i.launch <= now).length
  const server = SERVERS.find((s) => s.id === g.server)
  const pos = view === 'harita' && hover ? hover : { x: c.x, y: c.y }

  return (
    <>
      <div className="hud-tl">
        <button className="avatar" style={{ background: TRIBES[p.tribe].color }} onClick={() => open({ w: 'oyuncu', id: -1 })} title="Profilim">
          <span>{TRIBES[p.tribe].emblem}</span>
          <b className="avatar-lvl">{lvl}</b>
        </button>
        <div className="xp plaque">
          <small>Tecrübe Puanı</small>
          <b>{fmt(t)}</b>
          <div className="bar"><div style={{ width: pct + '%' }} /></div>
        </div>
        <button className="elmas plaque" onClick={() => open({ w: 'elmas' })} title="Elmas">
          💎 <b>{fmt(p.elmas)}</b> <span className="plus">+</span>
        </button>
      </div>

      <div className="hud-left">
        <button className="round" onClick={() => setView(view === 'harita' ? 'sehir' : 'harita')} title={view === 'harita' ? 'Şehre dön' : 'Harita'}>
          {view === 'harita' ? '🏕️' : '🗺️'}
          <small>{view === 'harita' ? 'Şehir' : 'Harita'}</small>
        </button>
        <button className="round" onClick={() => open({ w: 'birlik' })} title="Birlik">🐺<small>Birlik</small></button>
        <button className="round" onClick={() => open({ w: 'siralama' })} title="Sıralama">🏆<small>Sıralama</small></button>
        <button className="round" onClick={() => open({ w: 'ara' })} title="Konum ara">🔍<small>Ara</small></button>
        <button className="round" onClick={() => open({ w: 'mini' })} title="Mini harita">🧭<small>Dünya</small></button>
        <button className={`round ${incoming ? 'alarm' : ''}`} onClick={() => open({ w: 'hareket', tab: incoming ? 'gelen' : 'giden' })} title="Asker hareketleri">
          🏇<small>Hareket</small>
          {incoming > 0 && <b className="badge red">{incoming}</b>}
          {!incoming && g.out.length > 0 && <b className="badge">{g.out.length}</b>}
        </button>
        <button className="round" onClick={() => open({ w: 'yardim' })} title="Yardım">❔<small>Yardım</small></button>
      </div>

      <div className="hud-tr">
        {p.protectionUntil > now && <div className="plaque prot" title="Acemi koruması: saldırı alamazsın">🛡️ Koruma {fmtDur(p.protectionUntil - now)}</div>}
        <button className="plaque menu-btn" onClick={toggleSide} aria-label="Menü">☰</button>
      </div>

      <div className="hud-res">
        {RES_KEYS.slice(0, 5).map((k) => (
          <span key={k} title={RES_INFO[k].name}>{RES_INFO[k].icon}<b>{fmt(p.res[k])}</b></span>
        ))}
      </div>

      <div className="hud-top">
        <span className="plaque coord">X <b>{pos.x}</b></span>
        <span className="plaque coord">Y <b>{pos.y}</b></span>
      </div>

      <div className="hud-bottom">
        <span>{c.name} · {c.x}|{c.y}</span>
        <span>🕒 {fmtTime(now)}</span>
        <span>{server?.name ?? g.server} · ×{g.speed}</span>
        <span className="online">● {fmt(g.online)} çevrimiçi</span>
      </div>
    </>
  )
}

export function Sidebar({ onTab }: { onTab: () => void }) {
  const { g, now, cityId, setCity, setView, view, open, goto } = useG()
  const p = g.player
  const r = rates(g)
  const capacity = cap(g)
  const a = allianceOf(g, p.allianceId)
  const n = p.cities.length
  const unread = g.reports.filter((x) => !x.read && x.time <= now).length
  const unreadAtk = g.reports.filter((x) => !x.read && x.time <= now && x.kind === 'saldiri').length
  const unreadDef = g.reports.filter((x) => !x.read && x.time <= now && x.kind === 'savunma').length
  const dm = g.dms.reduce((s, t) => s + t.unread, 0)
  const incoming = g.incoming.filter((i) => i.launch <= now).length
  const go = (fn: () => void) => () => {
    fn()
    onTab()
  }

  return (
    <aside className="sidebar">
      <Logo />
      <div className="who">
        <b>{p.name}</b>
        <small>
          {TRIBES[p.tribe].name} · {a ? <><Tag tag={a.tag} color={a.color} /> {a.name}</> : 'Birliksiz'}
        </small>
      </div>

      <section className="side-box">
        <h4>KAYNAKLAR</h4>
        {RES_KEYS.map((k) => {
          const full = STORED.includes(k) && p.res[k] >= capacity * 0.98
          return (
            <div key={k} className={`res-row ${full ? 'full' : ''} ${r[k] < 0 ? 'neg' : ''}`} title={`${RES_INFO[k].name}: ${fmt(r[k] * 60)} / saat`}>
              <span className="res-icon">{RES_INFO[k].icon}</span>
              <span className="res-name">{RES_INFO[k].name}</span>
              <b>{fmt(p.res[k])}</b>
              <small>{r[k] >= 0 ? '+' : ''}{fmt(r[k] * 60)}/s</small>
            </div>
          )
        })}
        <div className="res-row elmas-row">
          <span className="res-icon">💎</span>
          <span className="res-name">Elmas</span>
          <b>{fmt(p.elmas)}</b>
          <button className="mini gold" onClick={go(() => open({ w: 'elmas' }))}>+</button>
        </div>
        <p className="cap">Ambar: {fmt(capacity)}</p>
      </section>

      <section className="side-box">
        <h4>ŞEHİRLER ({n}/{MAX_CITIES})</h4>
        {p.cities.map((c) => (
          <div key={c.id} className={`city-row ${c.id === cityId ? 'active' : ''}`}>
            <button className="city-name" onClick={go(() => { setCity(c.id); setView('sehir') })}>
              🏕️ {c.name} <small>({cityPop(c)})</small>
              {c.queue.length > 0 && <span className="mini-timer">🔨 {fmtDur(c.queue[0].end - now)}</span>}
            </button>
            <button className="mini" title="Haritada göster" onClick={go(() => goto(c.x, c.y))}>{c.x}|{c.y}</button>
          </div>
        ))}
        {n < MAX_CITIES && (
          <p className="hint">
            Yeni köy için {fmt(CITY_TP[n])} TP gerekir {tp(p) >= CITY_TP[n] ? '— haritada boş bir yere tıkla!' : `(${fmt(Math.max(0, CITY_TP[n] - tp(p)))} kaldı)`}
          </p>
        )}
        <button className="side-wide" onClick={go(() => setView(view === 'harita' ? 'sehir' : 'harita'))}>{view === 'harita' ? '🏕️ Şehre dön' : '🗺️ Haritaya git'}</button>
      </section>

      <section className="side-box">
        <h4>OLAYLAR</h4>
        <div className="events">
          <button onClick={go(() => open({ w: 'rapor' }))}>📜<small>Raporlar</small>{unread > 0 && <b className="badge">{unread}</b>}</button>
          <button onClick={go(() => open({ w: 'hareket', tab: 'giden' }))}>⚔️<small>Saldırılar</small>{unreadAtk > 0 && <b className="badge">{unreadAtk}</b>}</button>
          <button className={incoming ? 'alarm' : ''} onClick={go(() => open({ w: 'hareket', tab: 'gelen' }))}>
            🛡️<small>Savunma</small>
            {incoming > 0 ? <b className="badge red">{incoming}</b> : unreadDef > 0 && <b className="badge">{unreadDef}</b>}
          </button>
          <button onClick={go(() => open({ w: 'mesaj' }))}>✉️<small>Mesajlar</small>{dm > 0 && <b className="badge">{dm}</b>}</button>
          <button onClick={go(() => open({ w: 'birlik' }))}>🐺<small>Birlik</small></button>
          <button onClick={go(() => open({ w: 'ayar' }))}>⚙️<small>Ayarlar</small></button>
        </div>
      </section>
    </aside>
  )
}
