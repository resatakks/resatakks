import { BUILDING_MAP, type BuildingId, UNITS } from '../game/data'
import { cancelBuild, canBuild, cityById, elmasCost, finishBuildNow } from '../game/engine'
import { useG } from '../ctx'
import { fmt, fmtDur } from '../format'
import { BuildingSprite } from './sprites'

const SPOTS: { id: BuildingId; x: number; y: number; color: string; trim: string }[] = [
  { id: 'merkez', x: 50, y: 44, color: '#b3312a', trim: '#f3d27a' },
  { id: 'kisla', x: 27, y: 27, color: '#8f2a24', trim: '#f1e2c0' },
  { id: 'okcu', x: 42, y: 17, color: '#2f5e8a', trim: '#f1e2c0' },
  { id: 'ahir', x: 59, y: 17, color: '#6b4a2a', trim: '#e9d9b5' },
  { id: 'atolye', x: 74, y: 27, color: '#5a3a20', trim: '#d8b25a' },
  { id: 'pazar', x: 82, y: 47, color: '#2f7a52', trim: '#f6e7b0' },
  { id: 'ambar', x: 18, y: 47, color: '#8c5a2b', trim: '#f1e2c0' },
  { id: 'tasci', x: 24, y: 67, color: '#7d7a74', trim: '#e9e2cf' },
  { id: 'oduncu', x: 37, y: 76, color: '#7a4a22', trim: '#e9d9b5' },
  { id: 'tarla', x: 63, y: 76, color: '#c9a23c', trim: '#fff0c0' },
  { id: 'demirci', x: 76, y: 67, color: '#4a4a52', trim: '#f0a050' },
  { id: 'sur', x: 50, y: 91, color: '#6f6a62', trim: '#d9d2c2' },
]

function Palisade() {
  const stakes = []
  const n = 96
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2
    const deg = (a * 180) / Math.PI
    if (Math.abs(deg - 90) < 7) continue // kapı
    const x = 500 + Math.cos(a) * 440
    const y = 345 + Math.sin(a) * 290
    stakes.push({ x, y, back: Math.sin(a) < 0 })
  }
  const stake = (s: { x: number; y: number }, i: number) => (
    <path key={i} d={`M${s.x - 8} ${s.y + 6} V${s.y - 24} L${s.x} ${s.y - 36} L${s.x + 8} ${s.y - 24} V${s.y + 6} Z`} fill="#7a4e26" stroke="#3a220e" strokeWidth="2" />
  )
  return (
    <svg className="palisade" viewBox="0 0 1000 700">
      <defs>
        <radialGradient id="dirt" cx="50%" cy="48%" r="55%">
          <stop offset="0%" stopColor="#b9965c" />
          <stop offset="70%" stopColor="#a5824a" />
          <stop offset="100%" stopColor="#8a6a38" />
        </radialGradient>
      </defs>
      <ellipse cx="500" cy="350" rx="452" ry="300" fill="rgba(0,0,0,.25)" />
      <ellipse cx="500" cy="345" rx="440" ry="290" fill="url(#dirt)" />
      <path d="M500 640 Q500 470 500 330" stroke="#94733f" strokeWidth="38" fill="none" opacity=".55" />
      {stakes.filter((s) => s.back).map(stake)}
      <path d="M60 345 Q500 200 940 345" stroke="rgba(80,55,25,.18)" strokeWidth="2" fill="none" />
      {stakes.filter((s) => !s.back).map(stake)}
    </svg>
  )
}

export default function CityView() {
  const { g, now, act, cityId, open } = useG()
  const c = cityById(g, cityId)
  const units = UNITS[g.player.tribe]
  const busy = new Set(c.queue.map((q) => q.b))
  const training = new Set(c.train.map((t) => t.b))

  return (
    <div className="cityview">
      <div className="city-stage">
        <Palisade />
        {SPOTS.map((s) => {
          const lvl = c.b[s.id]
          const def = BUILDING_MAP[s.id]
          const locked = lvl === 0 && !!canBuild(g, c, s.id)?.startsWith('Gerekli')
          return (
            <button
              key={s.id}
              className={`bld ${s.id === 'merkez' ? 'big' : ''} ${lvl === 0 ? 'empty' : ''} ${locked ? 'locked' : ''}`}
              style={{ left: `${s.x}%`, top: `${s.y}%` }}
              onClick={() => open({ w: 'bina', b: s.id })}
              title={def.name}
            >
              <BuildingSprite color={s.color} roof={s.trim} big={s.id === 'merkez'} empty={lvl === 0} />
              <span className="bld-icon">{def.icon}</span>
              {lvl > 0 && <span className="lvl">{lvl}</span>}
              {busy.has(s.id) && <span className="bld-busy">🔨</span>}
              {training.has(s.id as never) && <span className="bld-busy train">⚔️</span>}
              <span className="bld-name">{def.name}</span>
            </button>
          )
        })}
      </div>

      {c.queue.length > 0 && (
        <div className="queue panel">
          <h5>İnşaat</h5>
          {c.queue.map((q, i) => (
            <div key={i} className="queue-row">
              <span>
                {BUILDING_MAP[q.b].icon} {BUILDING_MAP[q.b].name} → {q.to}
              </span>
              <b className="timer">{fmtDur((i === 0 ? q.end : q.end) - now)}</b>
              {i === 0 && (
                <button className="mini gold" title="Elmasla hemen bitir" onClick={() => act((g, n) => finishBuildNow(g, c.id, n))}>
                  💎{elmasCost(q.end - now)}
                </button>
              )}
              <button className="mini" title="İptal (%80 iade)" onClick={() => act((g) => cancelBuild(g, c.id, i))}>✕</button>
            </div>
          ))}
        </div>
      )}

      <div className="unit-strip">
        {units.map((u, i) => (
          <div key={i} className={`unit-slot ${c.army[i] ? '' : 'zero'}`} title={u.name}>
            <span className="u-icon">{u.icon}</span>
            <b>{fmt(c.army[i])}</b>
          </div>
        ))}
      </div>
    </div>
  )
}
