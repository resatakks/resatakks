import { type CSSProperties, type ReactNode, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { CITY_TP, MAX_CITIES, MINE_NAME, MINE_RADIUS, TRIBES, cityFoundCost } from '../game/data'
import { allianceOf, canFoundCity, decorAt, dist, foundCity, key, mineAt, occupancy, tp, travelMs } from '../game/engine'
import { hasPeace } from '../game/social'
import { useG } from '../ctx'
import { fmt, fmtDur } from '../format'
import { Bush, CitySprite, MineSprite, Shield } from './sprites'
import { Cost, Tag } from './ui'

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
    return { x: Math.floor(cam.x + (cx - r.left - size.w / 2) / T), y: Math.floor(cam.y + (cy - r.top - size.h / 2) / T) }
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
        if ('city' in o) {
          const c = g.player.cities.find((c) => c.id === o.city)!
          name = c.name
          mine = true
          shield = '#3fd06b'
          tag = allianceOf(g, g.player.allianceId)?.tag ?? null
          size2 = tp(g.player) > 600 ? 2 : 1
        } else {
          const b = g.bots[o.bot]
          const a = allianceOf(g, b.allianceId)
          name = b.cities[o.ci].name
          size2 = b.pop > 900 ? 3 : b.pop > 220 ? 2 : 1
          if (o.ci > 0) size2 = Math.max(1, size2 - 1)
          shield = a ? (a.id === g.player.allianceId ? '#4fb3ff' : a.color) : '#8a8a8a'
          tag = a?.tag ?? null
        }
        rings.push(
          <div
            key={'r' + x + ',' + y}
            className={`ring ${mine ? 'own' : ''}`}
            style={{ left: sx(x + 0.5) - MINE_RADIUS * T, top: sy(y + 0.5) - MINE_RADIUS * T, width: MINE_RADIUS * 2 * T, height: MINE_RADIUS * 2 * T }}
          />,
        )
        tiles.push(
          <div key={x + ',' + y} className="tile city" style={style}>
            <CitySprite size={size2} mine={mine} />
            <span className="shield">
              <Shield color={shield} />
            </span>
            <span className="city-label">
              {tag && <b>{tag} </b>}
              {name}
            </span>
          </div>,
        )
        continue
      }
      const m = mineAt(g, x, y)
      if (m) {
        tiles.push(
          <div key={x + ',' + y} className={`tile mine m-${m.type}`} style={style}>
            <MineSprite type={m.type} />
            <span className="lvl">{m.level}</span>
          </div>,
        )
        continue
      }
      const d = decorAt(g, x, y)
      if (d) {
        tiles.push(
          <div key={x + ',' + y} className="tile" style={style}>
            <Bush v={d} />
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
          const dx = e.clientX - d.sx
          const dy = e.clientY - d.sy
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
            left: Math.max(8, Math.min(size.w - 290, sx(sel.x) + T + 6)),
            top: Math.max(56, Math.min(size.h - 260, sy(sel.y) - 20)),
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
        {peace && <p className="note ok">🤝 Aranızda barış var</p>}
        <div className="ti-actions">
          {!ally && <button className="btn-red" onClick={() => open({ w: 'sefer', bot: b.id, ci: o.ci, type: 'saldiri' })}>⚔️ Saldır</button>}
          {!ally && <button className="btn-gold" onClick={() => open({ w: 'sefer', bot: b.id, ci: o.ci, type: 'yagma' })}>💰 Yağmala</button>}
          <button onClick={() => open({ w: 'sefer', bot: b.id, ci: o.ci, type: 'casus' })}>🕵️ Casus</button>
          <button onClick={() => open({ w: 'mesaj', id: b.id })}>✉️ Mesaj</button>
        </div>
      </>
    )
  } else {
    const m = mineAt(g, p.x, p.y)
    if (m) {
      const users = g.player.cities.filter((c) => dist(c.x, c.y, p.x, p.y) <= MINE_RADIUS)
      body = (
        <>
          <h4>{MINE_NAME[m.type]}</h4>
          <p className="muted">{p.x}|{p.y} · Seviye {m.level}</p>
          <p className="small">
            {users.length
              ? `${users.map((c) => c.name).join(', ')} bu madenden faydalanıyor.`
              : `Bu madenin ${MINE_RADIUS} kare çevresine kurulan şehirler üretimine +%${m.level * 10} katkı alır.`}
          </p>
        </>
      )
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
              <button className="btn-gold" onClick={() => (err ? notify(err) : setNaming(true))}>🏕️ Köy kur</button>
            </div>
          )}
        </>
      )
    }
  }

  return (
    <div className="tile-info panel" style={style} onPointerDown={(e) => e.stopPropagation()}>
      <button className="win-x" onClick={onClose} aria-label="Kapat">✕</button>
      {body}
    </div>
  )
}
