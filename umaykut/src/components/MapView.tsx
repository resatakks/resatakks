import { useEffect, useMemo, useRef, useState } from 'react'
import { TRIBES } from '../game/data'
import { Bot, allianceOf, dist, playerPop } from '../game/engine'
import { useG } from '../ctx'
import { fmt } from '../format'

const VIEW = 13
const TERRAIN = ['', '', '', '', '', '🌲', '🌲', '⛰️', '🌿', '💧']

function terrain(x: number, y: number) {
  const h = Math.abs(Math.sin(x * 12.9898 + y * 78.233) * 43758.5453) % 1
  return TERRAIN[Math.floor(h * TERRAIN.length)]
}

export default function MapView({ focus }: { focus: { x: number; y: number } | null }) {
  const { g, openBot, attack } = useG()
  const p = g.player
  const [c, setC] = useState(() => focus ?? { x: p.x, y: p.y })
  const [colorBy, setColorBy] = useState<'tribe' | 'alliance'>('tribe')
  const [hover, setHover] = useState<Bot | null>(null)
  const mini = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    if (focus) setC(focus)
  }, [focus])

  const grid = useMemo(() => {
    const m = new Map<string, Bot>()
    for (const b of g.bots) m.set(`${b.x},${b.y}`, b)
    return m
  }, [g.bots])

  const allyColor = (id: string | null) => {
    if (!id) return '#777'
    if (id === p.allianceId) return '#5fd0ff'
    let h = 0
    for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) % 360
    return `hsl(${(h * 47) % 360} 65% 55%)`
  }
  const colorOf = (b: Bot) => (b.activity === 0 ? '#5a5248' : colorBy === 'tribe' ? TRIBES[b.tribe].color : allyColor(b.allianceId))

  useEffect(() => {
    const cv = mini.current
    if (!cv) return
    const ctx = cv.getContext('2d')!
    const s = cv.width / g.mapSize
    ctx.fillStyle = '#1d1a14'
    ctx.fillRect(0, 0, cv.width, cv.height)
    for (const b of g.bots) {
      ctx.fillStyle = colorOf(b)
      const r = b.pop > 600 ? 2.2 : b.pop > 150 ? 1.6 : 1.1
      ctx.fillRect(b.x * s - r, b.y * s - r, r * 2, r * 2)
    }
    ctx.fillStyle = '#fff'
    ctx.fillRect(p.x * s - 3, p.y * s - 3, 6, 6)
    ctx.strokeStyle = '#f2c94c'
    ctx.lineWidth = 1.5
    const half = Math.floor(VIEW / 2)
    ctx.strokeRect((c.x - half) * s, (c.y - half) * s, VIEW * s, VIEW * s)
  })

  const half = Math.floor(VIEW / 2)
  const clamp = (v: number) => Math.max(half, Math.min(g.mapSize - 1 - half, v))
  const move = (dx: number, dy: number) => setC({ x: clamp(c.x + dx), y: clamp(c.y + dy) })
  const cx = clamp(c.x)
  const cy = clamp(c.y)

  const cells = []
  for (let y = cy - half; y <= cy + half; y++) {
    for (let x = cx - half; x <= cx + half; x++) {
      const b = grid.get(`${x},${y}`)
      const me = x === p.x && y === p.y
      if (me) {
        cells.push(
          <div key={`${x},${y}`} className="cell me" title="Senin köyün">
            <span>🏯</span>
            <small>{p.name}</small>
          </div>,
        )
      } else if (b) {
        const ally = allianceOf(g, b.allianceId)
        cells.push(
          <button
            key={`${x},${y}`}
            className={`cell village ${b.activity === 0 ? 'inactive' : ''}`}
            style={{ ['--vc' as string]: colorOf(b) }}
            onClick={() => openBot(b.id)}
            onMouseEnter={() => setHover(b)}
          >
            <span>{b.pop > 600 ? '🏰' : b.pop > 150 ? '🏘️' : '⛺'}</span>
            <small>{ally ? `[${ally.tag}]` : b.name.slice(0, 7)}</small>
            {b.online && <i className="dot" />}
          </button>,
        )
      } else {
        cells.push(
          <div key={`${x},${y}`} className="cell empty">
            {terrain(x, y)}
          </div>,
        )
      }
    }
  }

  return (
    <div>
      <h2>Harita</h2>
      <div className="map-layout">
        <div>
          <div className="map-controls">
            <button onClick={() => move(0, -5)}>▲</button>
            <button onClick={() => move(-5, 0)}>◀</button>
            <button onClick={() => move(5, 0)}>▶</button>
            <button onClick={() => move(0, 5)}>▼</button>
            <button onClick={() => setC({ x: p.x, y: p.y })}>🏯 Köyüm</button>
            <span className="muted mono">
              ({cx}|{cy})
            </span>
          </div>
          <div className="map-grid" style={{ gridTemplateColumns: `repeat(${VIEW}, 1fr)` }} onMouseLeave={() => setHover(null)}>
            {cells}
          </div>
        </div>
        <div className="map-side">
          <canvas
            ref={mini}
            width={250}
            height={250}
            className="minimap"
            onClick={(e) => {
              const r = e.currentTarget.getBoundingClientRect()
              setC({
                x: clamp(Math.round(((e.clientX - r.left) / r.width) * g.mapSize)),
                y: clamp(Math.round(((e.clientY - r.top) / r.height) * g.mapSize)),
              })
            }}
          />
          <div className="seg">
            <button className={colorBy === 'tribe' ? 'active' : ''} onClick={() => setColorBy('tribe')}>Halka göre</button>
            <button className={colorBy === 'alliance' ? 'active' : ''} onClick={() => setColorBy('alliance')}>Boya göre</button>
          </div>
          <div className="legend small">
            {colorBy === 'tribe' ? (
              Object.values(TRIBES).map((t) => (
                <span key={t.name}><i style={{ background: t.color }} /> {t.name}</span>
              ))
            ) : (
              <span><i style={{ background: '#5fd0ff' }} /> Senin boyun · <i style={{ background: '#777' }} /> Boysuz</span>
            )}
            <span><i style={{ background: '#5a5248' }} /> İnaktif</span>
          </div>
          {hover && (
            <div className="panel hover-card">
              <b>{hover.village}</b> ({hover.x}|{hover.y})
              <div>
                {TRIBES[hover.tribe].emblem} {hover.name} {hover.online && <span className="online">● çevrimiçi</span>}
              </div>
              <div className="muted">
                {fmt(hover.pop)} nüfus · {allianceOf(g, hover.allianceId)?.name ?? 'Boysuz'} · {dist(p.x, p.y, hover.x, hover.y).toFixed(1)} kare
              </div>
              <div className="row-btns">
                <button className="primary" onClick={() => attack(hover.id)}>⚔️ Sefer</button>
                <button onClick={() => openBot(hover.id)}>Profil</button>
              </div>
            </div>
          )}
          <p className="muted small">Senin nüfusun: {fmt(playerPop(p))}. Gri köyler sahipsiz kalmış (inaktif) köylerdir — en kolay yağma hedefleri.</p>
        </div>
      </div>
    </div>
  )
}
