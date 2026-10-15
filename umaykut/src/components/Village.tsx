import { BUILDINGS, BUILDING_MAP, RES_INFO, RES_KEYS, TRIBES } from '../game/data'
import { build, buildCost, buildTime, canBuild, cancelBuild, prodPerMin, storageCap } from '../game/engine'
import { useG } from '../ctx'
import { fmt, fmtDur } from '../format'

export default function Village() {
  const { g, now, act } = useG()
  const p = g.player
  const bonus = p.tribe === 'gokturk' ? 1.1 : 1

  const effect = (id: string, lvl: number) => {
    const def = BUILDING_MAP[id as keyof typeof BUILDING_MAP]
    if (def.produces) return `${fmt(prodPerMin(lvl) * bonus * g.speed)}/dk`
    if (id === 'ambar') return `Kapasite ${fmt(storageCap(lvl))}`
    if (id === 'sur') return `Savunma +%${Math.round(lvl * 5 * (p.tribe === 'selcuklu' ? 1.15 : 1))}`
    if (id === 'otag') return `İnşaat −%${Math.round((1 - Math.pow(0.95, lvl - 1)) * 100)}`
    if (id === 'kisla' || id === 'ahir') return lvl ? `Eğitim −%${Math.round((1 - Math.pow(0.94, lvl - 1)) * 100)}` : 'Kurulmadı'
    return ''
  }

  return (
    <div>
      <div className="village-head">
        <div>
          <h2>{p.village}</h2>
          <span className="muted">
            ({p.x}|{p.y}) · {TRIBES[p.tribe].name} · ✦ {TRIBES[p.tribe].bonus}
          </span>
        </div>
      </div>

      <section className="panel">
        <h3>İnşaat sırası</h3>
        {p.queue.length === 0 && <p className="muted">Şu an inşaat yok. Ustalar emrini bekliyor.</p>}
        {p.queue.map((q, i) => {
          const active = q.start <= now
          const pct = active ? Math.min(100, ((now - q.start) / (q.end - q.start)) * 100) : 0
          return (
            <div key={i} className="queue-row">
              <span>
                {BUILDING_MAP[q.b].icon} {BUILDING_MAP[q.b].name} → {q.to}. seviye
              </span>
              <div className="bar"><div style={{ width: pct + '%' }} /></div>
              <span className="mono">{active ? fmtDur(q.end - now) : 'sırada'}</span>
              <button className="link" onClick={() => act((g, n) => cancelBuild(g, i, n))} title="İptal (%80 iade)">✕</button>
            </div>
          )
        })}
      </section>

      <div className="building-grid">
        {BUILDINGS.map((b) => {
          const lvl = p.buildings[b.id]
          const queued = p.queue.filter((q) => q.b === b.id).length
          const next = lvl + queued + 1
          const err = canBuild(g, b.id)
          const maxed = next > b.max
          const cost = maxed ? null : buildCost(b.id, next)
          const building = p.queue.some((q) => q.b === b.id && q.start <= now)
          return (
            <div key={b.id} className={`building ${lvl === 0 ? 'empty' : ''} ${building ? 'working' : ''}`}>
              <div className="b-top">
                <span className="b-icon">{b.icon}</span>
                <div>
                  <b>{b.name}</b>
                  <div className="lvl">Seviye {lvl}{queued ? ` (+${queued})` : ''}</div>
                </div>
                <span className="b-effect">{effect(b.id, lvl)}</span>
              </div>
              <p className="muted small">{b.desc}</p>
              {cost && (
                <div className="cost">
                  {RES_KEYS.map((k) => (
                    <span key={k} className={p.res[k] < cost[k] ? 'lack' : ''}>
                      {RES_INFO[k].icon} {fmt(cost[k])}
                    </span>
                  ))}
                  <span>⏱ {fmtDur(buildTime(g, b.id, next))}</span>
                </div>
              )}
              <button className="primary" disabled={!!err} onClick={() => act((g, n) => build(g, b.id, n))}>
                {maxed ? 'En yüksek seviye' : err ?? (lvl === 0 && !queued ? 'İnşa et' : `${next}. seviyeye yükselt`)}
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
