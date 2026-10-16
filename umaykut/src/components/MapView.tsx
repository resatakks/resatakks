import { type CSSProperties, type ReactNode, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { CITY_TP, MAX_CITIES, MINE_NAME, type MineType, TRIBES, cityFoundCost } from '../game/data'
import { MULT_BUILDING, allianceOf, buildingMult, canFoundCity, citiesReaching, cityPop, decorAt, dist, foundCity, idleFolk, key, mineAt, mineCapacity, occupancy, othersAt, oursAt, retrieveWorkers, ringOf, ringReach, sendWorkers, tp, travelMs, workerYield, hasBonus } from '../game/engine'
import { hasPeace } from '../game/social'
import { useG } from '../ctx'
import { fmt, fmtDur } from '../format'
import { Shield } from './sprites'
import { IsoDefs } from './isocity'
import { Cost, Tag } from './ui'
import { stage } from '../stage'

const T = 76

type Pt = { x: number; y: number }

export default function MapView({ focus, onHover }: { focus: { x: number; y: number; n: number }; onHover: (p: Pt) => void }) {
  const { g } = useG()
  const ref = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ w: 900, h: 600 })
  const [cam, setCam] = useState({ x: focus.x + 0.5, y: focus.y + 0.5 })
  const [sel, setSel] = useState<Pt | null>(null)
  const drag = useRef<{ sx: number; sy: number; cx: number; cy: number; moved: boolean } | null>(null)

  useEffect(() => {
    setCam({ x: focus.x + 0.5, y: focus.y + 0.5 })
    setSel({ x: focus.x, y: focus.y })
  }, [focus.n, focus.x, focus.y])

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }))
    ro.observe(el)
    setSize({ w: el.clientWidth, h: el.clientHeight })
    return () => ro.disconnect()
  }, [])

  const clamp = (v: number) => Math.max(0, Math.min(g.mapSize, v))
  const tileAt = (cx: number, cy: number): Pt => {
    const r = ref.current!.getBoundingClientRect()
    return { x: Math.floor(cam.x + ((cx - r.left) / stage.k - size.w / 2) / T), y: Math.floor(cam.y + ((cy - r.top) / stage.k - size.h / 2) / T) }
  }

  const occ = occupancy(g)
  const x0 = Math.floor(cam.x - size.w / 2 / T) - 1
  const x1 = Math.ceil(cam.x + size.w / 2 / T) + 1
  const y0 = Math.floor(cam.y - size.h / 2 / T) - 1
  const y1 = Math.ceil(cam.y + size.h / 2 / T) + 1
  const sx = (x: number) => (x - cam.x) * T + size.w / 2
  const sy = (y: number) => (y - cam.y) * T + size.h / 2

  const tiles = []
  const rings = []
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      if (x < 0 || y < 0 || x >= g.mapSize || y >= g.mapSize) continue
      const o = occ.get(key(x, y))
      const style = { left: sx(x), top: sy(y), width: T, height: T }
      if (o) {
        let name: string
        let size2 = 1
        let shield = '#8a8a8a'
        let tag: string | null = null
        let mine = false
        let lvl = 1
        let ring = 2.5
        let city = ''
        let pop = 0
        if ('city' in o) {
          name = g.player.name
          mine = true
          shield = '#3fd06b'
          tag = allianceOf(g, g.player.allianceId)?.tag ?? null
          size2 = tp(g.player) > 600 ? 2 : 1
          const pc = g.player.cities.find((c) => c.id === o.city)
          lvl = pc?.b.merkez ?? 1
          ring = ringOf(pc ?? {})
          city = pc?.name ?? ''
          pop = pc ? cityPop(pc) : 0
        } else {
          const b = g.bots[o.bot]
          const a = allianceOf(g, b.allianceId)
          name = b.name
          ring = ringOf(b.cities[o.ci] ?? {})
          city = b.cities[o.ci]?.name ?? ''
          pop = Math.round((b.pop * (o.ci ? 0.6 : 1.4)) / Math.max(1, b.cities.length))
          size2 = b.pop > 900 ? 3 : b.pop > 220 ? 2 : 1
          if (o.ci > 0) size2 = Math.max(1, size2 - 1)
          lvl = Math.max(1, Math.min(20, Math.round(Math.sqrt(b.pop / (o.ci + 1)) / 2)))
          shield = a ? (a.id === g.player.allianceId ? '#4fb3ff' : a.color) : '#8a8a8a'
          tag = a?.tag ?? null
        }
        rings.push(
          <div
            key={'r' + x + ',' + y}
            className={`ring ${mine ? 'own' : ''}`}
            style={{ left: sx(x + 0.5) - ringReach(ring) * T, top: sy(y + 0.5) - ringReach(ring) * T, width: ringReach(ring) * 2 * T, height: ringReach(ring) * 2 * T }}
          />,
        )
        tiles.push(
          <div key={x + ',' + y} className="tile city" style={style}>
            <img className="mspr city" src="/orig/m/c_hun.png" alt="" draggable={false} style={{ width: 70 + size2 * 18 }} />
            <span className="lvl">{lvl}</span>
            {mine && hasBonus(g, 'bayrak') && (
              <svg className="pflag" width="26" height="30" viewBox="0 0 26 30" aria-label="İktidar Bayrağı">
                <rect x="2" y="1" width="2" height="29" fill="#5a3b1c" />
                <path d="M4 2 C10 0 14 6 24 3 L24 15 C14 18 10 12 4 14 Z" fill={TRIBES[g.player.tribe].color} stroke="#2a1a08" strokeWidth=".8" />
                <circle cx="13" cy="8.5" r="2.6" fill="#ffd24a" />
              </svg>
            )}
            <span className="shield">
              <Shield color={shield} />
            </span>
            <span className="city-label">
              <i>{fmt(pop)}</i>
              <span>
                <b>{city}</b>
                <small>{tag && `[${tag}]`}{name}</small>
              </span>
            </span>
          </div>,
        )
        continue
      }
      const m = mineAt(g, x, y)
      if (m) {
        const owned = g.player.cities.some((c) => dist(c.x, c.y, x, y) <= ringReach(c.r))
        tiles.push(
          <div key={x + ',' + y} className={`tile mine m-${m.type}`} style={style}>
            <img className="mspr" src={`/orig/m/m_${m.type}${(x + y) % 2 && m.type !== 'tahil' ? '2' : ''}.png`} alt="" draggable={false} />
            <span className="lvl">{m.level}</span>
            {owned && <span className="verim">{m.level}</span>}
            {oursAt(g, x, y) > 0 && <span className="wk-badge" title="Bizim işçilerimiz">{oursAt(g, x, y)}</span>}
            <span className="mine-tip">
              <b>{MINE_NAME[m.type]}</b>
              <span>Verim <i>{m.level}</i></span>
              <span>İşçi <i>{oursAt(g, x, y)} / {mineCapacity(m.level)}</i></span>
              <span>{owned ? 'Çemberinde' : 'Çember dışı'}</span>
            </span>
          </div>,
        )
        continue
      }
      const d = decorAt(g, x, y)
      if (d) {
        tiles.push(
          <div key={x + ',' + y} className="tile" style={style}>
            <img className="mspr deco" src={`/orig/m/m_odun${d === 1 ? '2' : ''}.png`} alt="" draggable={false} style={{ width: d === 1 ? 44 : 34 }} />
          </div>,
        )
      }
    }
  }

  return (
    <div
      ref={ref}
      className="map"
      style={{ backgroundPosition: `${-cam.x * T + size.w / 2}px ${-cam.y * T + size.h / 2}px` }}
      onPointerDown={(e) => {
        if ((e.target as HTMLElement).closest('.tile-info')) return
        ;(e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId)
        drag.current = { sx: e.clientX, sy: e.clientY, cx: cam.x, cy: cam.y, moved: false }
      }}
      onPointerMove={(e) => {
        const d = drag.current
        if (d) {
          const dx = (e.clientX - d.sx) / stage.k
          const dy = (e.clientY - d.sy) / stage.k
          if (Math.abs(dx) + Math.abs(dy) > 6) d.moved = true
          if (d.moved) setCam({ x: clamp(d.cx - dx / T), y: clamp(d.cy - dy / T) })
        }
        if (e.pointerType === 'mouse') onHover(tileAt(e.clientX, e.clientY))
      }}
      onPointerUp={(e) => {
        const d = drag.current
        drag.current = null
        if (!d || d.moved) return
        const t = tileAt(e.clientX, e.clientY)
        onHover(t)
        setSel(sel && sel.x === t.x && sel.y === t.y ? null : t)
      }}
    >
      <svg className="iso-defs" width="0" height="0" aria-hidden="true"><IsoDefs /></svg>
      <div className="map-edge" style={{ left: sx(0), top: sy(0), width: g.mapSize * T, height: g.mapSize * T }} />
      {rings}
      {tiles}
      {sel && (
        <div className="tile-sel" style={{ left: sx(sel.x), top: sy(sel.y), width: T, height: T }} />
      )}
      {sel && (
        <TileInfo
          p={sel}
          style={{
            left: (() => {
              const w = mineAt(g, sel.x, sel.y) && !occupancy(g).get(key(sel.x, sel.y)) ? 360 : 290
              const right = sx(sel.x) + T + 6
              return Math.max(8, right + w > size.w ? sx(sel.x) - w + 20 : right)
            })(),
            top: Math.max(56, Math.min(size.h - 300, sy(sel.y) - 20)),
          }}
          onClose={() => setSel(null)}
        />
      )}
    </div>
  )
}

function TileInfo({ p, style, onClose }: { p: Pt; style: CSSProperties; onClose: () => void }) {
  const { g, now, act, open, setCity, setView, cityId, notify } = useG()
  const [naming, setNaming] = useState(false)
  const [name, setName] = useState('')
  const o = occupancy(g).get(key(p.x, p.y))
  const here = g.player.cities.find((c) => c.id === cityId) ?? g.player.cities[0]
  const d = dist(here.x, here.y, p.x, p.y)
  let body: ReactNode

  if (o && 'city' in o) {
    const c = g.player.cities.find((c) => c.id === o.city)!
    body = (
      <>
        <h4>{c.name}</h4>
        <p className="muted">Senin şehrin · {p.x}|{p.y}</p>
        <div className="ti-actions">
          <button className="btn-gold" onClick={() => { setCity(c.id); setView('sehir') }}>Şehre gir</button>
        </div>
      </>
    )
  } else if (o) {
    const b = g.bots[o.bot]
    const c = b.cities[o.ci]
    const a = allianceOf(g, b.allianceId)
    const ally = !!a && a.id === g.player.allianceId
    const peace = hasPeace(g, b.id, now)
    const walk = travelMs(g, [0, 0, 0, 0, 0, 1], d)
    body = (
      <>
        <h4>{c.name}</h4>
        <p className="muted">{p.x}|{p.y} · {o.ci === 0 ? 'Başkent' : 'Şehir'}</p>
        <table className="kv">
          <tbody>
            <tr><td>Oyuncu</td><td><button className="link" onClick={() => open({ w: 'oyuncu', id: b.id })}>{b.name}</button> {b.online && <span className="online">●</span>}</td></tr>
            <tr><td>Birlik</td><td>{a ? <><Tag tag={a.tag} color={a.color} /> {a.name}</> : '—'}</td></tr>
            <tr><td>Devlet</td><td>{TRIBES[b.tribe].name}</td></tr>
            <tr><td>Nüfus</td><td>{fmt(b.pop)}</td></tr>
            <tr><td>Uzaklık</td><td>{d.toFixed(1)} kare · süvari {fmtDur(walk)}</td></tr>
          </tbody>
        </table>
        {ally && <p className="note ok">Birlik üyesi</p>}
        {peace && <p className="note ok">Aranızda barış var</p>}
        <div className="ti-actions">
          {!ally && <button className="btn-red" onClick={() => open({ w: 'sefer', bot: b.id, ci: o.ci, type: 'saldiri' })}>Saldır</button>}
          {!ally && <button className="btn-gold" onClick={() => open({ w: 'sefer', bot: b.id, ci: o.ci, type: 'yagma' })}>Yağmala</button>}
          {ally && <button className="btn-gold" onClick={() => open({ w: 'sefer', bot: b.id, ci: o.ci, type: 'destek' })}>Destek Gönder</button>}
          <button onClick={() => open({ w: 'sefer', bot: b.id, ci: o.ci, type: 'casus' })}>Casus gönder</button>
          <button onClick={() => open({ w: 'mesaj', id: b.id })}>Mesaj gönder</button>
        </div>
      </>
    )
  } else {
    const m = mineAt(g, p.x, p.y)
    if (m) {
      body = <MineInfo p={p} />
    } else {
      const n = g.player.cities.length
      const err = canFoundCity(g, p.x, p.y)
      body = (
        <>
          <h4>Boş arazi</h4>
          <p className="muted">{p.x}|{p.y} · {d.toFixed(1)} kare uzakta</p>
          {n < MAX_CITIES && (
            <p className="small">
              Yeni köy: TP {fmt(tp(g.player))} / {fmt(CITY_TP[n])} · <Cost c={cityFoundCost(n)} have={g.player.res} />
            </p>
          )}
          {naming ? (
            <div className="row">
              <input autoFocus value={name} maxLength={16} placeholder="Şehir adı" onChange={(e) => setName(e.target.value)} />
              <button
                className="btn-gold"
                onClick={() => {
                  const r = act((g, n) => foundCity(g, p.x, p.y, name || `şehir${g.player.cities.length + 1}`, n))
                  if (!r) {
                    const c = g.player.cities[g.player.cities.length - 1]
                    setCity(c.id)
                    onClose()
                  }
                }}
              >
                Kur
              </button>
            </div>
          ) : (
            <div className="ti-actions">
              <button className="btn-gold" onClick={() => (err ? notify(err) : setNaming(true))}>Köy kur</button>
            </div>
          )}
        </>
      )
    }
  }

  return (
    <div className={`tile-info panel ${!o && mineAt(g, p.x, p.y) ? "wide" : ""}`} style={style} onPointerDown={(e) => e.stopPropagation()}>
      <button className="win-x" onClick={onClose} aria-label="Kapat">✕</button>
      {body}
    </div>
  )
}

const RES_SRC: Record<MineType, string> = { tas: 'Taş Kaynağı', tahil: 'Tahıl Kaynağı', odun: 'Odun Kaynağı', demir: 'Demir Kaynağı' }

/** Orijinal kaynak penceresi: seviye, verim, kapasite, işçi gönder / geri çek. */
function MineInfo({ p }: { p: Pt }) {
  const { g, act, cityId } = useG()
  const m = mineAt(g, p.x, p.y)!
  const reach = citiesReaching(g, p.x, p.y)
  const [sel, setSel] = useState(reach.find((c) => c.id === cityId)?.id ?? reach[0]?.id)
  const [send, setSend] = useState('')
  const [back, setBack] = useState('')
  const c = reach.find((x) => x.id === sel) ?? reach[0]
  const others = othersAt(g, p.x, p.y)
  const ours = oursAt(g, p.x, p.y)
  const capN = mineCapacity(m.level)
  const here = c ? c.work[String(key(p.x, p.y))] ?? 0 : 0
  const idle = c ? idleFolk(c) : 0
  const free = Math.max(0, capN - others - ours)
  const mult = c ? buildingMult(c.b[MULT_BUILDING[m.type]]) : 1
  const perHour = workerYield(m.level) * mult * 60 * g.speed
  return (
    <>
      <h4>{RES_SRC[m.type]}</h4>
      <p className="muted">{p.x}|{p.y} · Seviye {m.level}</p>
      <table className="kv">
        <tbody>
          <tr><td>Verim</td><td>{fmt(perHour)} / saat / işçi</td></tr>
          <tr><td>Kaynak Kapasitesi</td><td>{fmt(capN)}</td></tr>
          <tr><td>Toplam İşçi</td><td>{fmt(others + ours)}</td></tr>
          <tr><td>Bizim işçilerimiz</td><td>{fmt(ours)}</td></tr>
          <tr><td>Diğer İşçiler</td><td>{fmt(others)}</td></tr>
        </tbody>
      </table>
      {!c ? (
        <p className="small">Hiçbir köyünüzün çemberi bu kaynağa ulaşmıyor. Çember her gün genişler; Okul büyümeyi hızlandırır.</p>
      ) : (
        <>
          {reach.length > 1 && (
            <p className="small">Köy:{' '}
              <select value={c.id} onChange={(e) => setSel(+e.target.value)}>
                {reach.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
              </select>
            </p>
          )}
          <table className="kv">
            <tbody>
              <tr><td>Boştaki İşçiler</td><td><b>{fmt(idle)}</b></td></tr>
              <tr><td>Kaynaktaki İşçiler</td><td><b>{fmt(here)}</b> · {fmt(here * perHour)} / saat</td></tr>
            </tbody>
          </table>
          <div className="wk-row">
            <span>Gönderilecek İşçi Sayısı</span>
            <input inputMode="numeric" value={send} placeholder="0" onChange={(e) => setSend(e.target.value.replace(/\D/g, ''))} />
            <button className="link" onClick={() => setSend(String(Math.min(idle, free)))}>({fmt(Math.min(idle, free))})</button>
            <button className="btn-gold" onClick={() => { if (!act((g) => sendWorkers(g, c.id, p.x, p.y, Number(send)))) setSend('') }}>İşçi Gönder</button>
          </div>
          <div className="wk-row">
            <span>Geri Çekilecek İşçi Sayısı</span>
            <input inputMode="numeric" value={back} placeholder="0" onChange={(e) => setBack(e.target.value.replace(/\D/g, ''))} />
            <button className="link" onClick={() => setBack(String(here))}>({fmt(here)})</button>
            <button onClick={() => { if (!act((g) => retrieveWorkers(g, c.id, p.x, p.y, Number(back)))) setBack('') }}>İşçi Geri Çek</button>
          </div>
        </>
      )}
    </>
  )
}
