import { useState } from 'react'
import { BUILDINGS, BUILDING_MAP, type BuildingId } from '../game/data'
import { build, buildCost, buildTime, cancelBuild, canBuild, cityById, elmasCost, finishBuildNow } from '../game/engine'
import { useG } from '../ctx'
import { Cost } from './ui'
import { fmtDur } from '../format'
import { BuildingPic, cityLayout, spriteFor } from './cityart'
import { IsoBuilding } from './isocity'

/** Orijinal şehir ekranı: devletin zemini, sabit parseller ve bina görselleri. */
export default function CityView() {
  const { g, now, act, cityId, open } = useG()
  const c = cityById(g, cityId)
  const tribe = g.player.tribe
  const L = cityLayout(tribe, c.b.merkez, c.b.sur)
  const busy = new Map(c.queue.map((q, i) => [q.b, i === 0 ? q.end - now : null]))
  const [menu, setMenu] = useState(false)
  const [qopen, setQopen] = useState(false)
  const spots = [{ id: 'merkez' as BuildingId, ...L.merkez }, ...L.plots].sort((a, b) => a.y - b.y)

  return (
    <div className="cityview" style={{ backgroundImage: `url(${L.bg})` }}>
      {L.wall && <img className="cwall" src={L.wall} alt="" draggable={false} />}
      {(c.b.sur > 0 || busy.has('sur')) && (
        <span className="clabel csur" style={{ left: L.surLabel.x, top: L.surLabel.y }} onClick={() => open({ w: 'bina', b: 'sur' })} role="button">
          Sur (Seviye {c.b.sur}){busy.get('sur') != null ? ` (${fmtDur(busy.get('sur')!)})` : ''}
        </span>
      )}
      {spots.map((s, n) => {
        const id = s.id
        const lvl = id ? c.b[id] : 0
        const left = id ? busy.get(id) : undefined
        const sp = id ? spriteFor(tribe, id, lvl) : null
        const shown = id && (lvl > 0 || left !== undefined)
        const target = id ? c.queue.filter((q) => q.b === id).at(-1)?.to : undefined
        return (
          <div
            key={id ?? `free${n}`}
            className={`cplot ${shown ? 'built' : 'free'} ${lvl === 0 && left !== undefined ? 'ghost' : ''}`}
            style={{ left: s.x, top: s.y }}
            onClick={() => (id && shown ? open({ w: 'bina', b: id }) : setMenu(true))}
            role="button"
            title={id ? `${BUILDING_MAP[id].name}${lvl ? ` (Seviye ${lvl})` : ' — inşa et'}` : 'Boş arsa — inşa et'}
          >
            <i className="cplot-hit" />
            {shown && sp && (
              <img src={sp.src} width={sp.w} height={sp.h} alt="" draggable={false} style={{ left: sp.dx ?? -sp.w / 2, top: sp.dy ?? -sp.h / 2 }} />
            )}
            {shown && !sp && id && (
              <svg className="cplot-svg" width="96" height="74" viewBox="-95 -118 190 145" aria-hidden>
                <IsoBuilding id={id} lvl={Math.max(1, lvl)} />
              </svg>
            )}
            {shown && id && left === undefined && <span className="clabel">{BUILDING_MAP[id].name} (Seviye {lvl})</span>}
            {id && left !== undefined && (
              <span className="clabel">{BUILDING_MAP[id].name} seviye : {target} ({left !== null ? fmtDur(left) : 'sırada'})</span>
            )}
          </div>
        )
      })}

      {menu && <BuildMenu onClose={() => setMenu(false)} />}

      {c.queue.length > 0 && (() => {
        const q = c.queue[0]
        const pct = Math.min(100, Math.max(0, ((now - q.start) / Math.max(1, q.end - q.start)) * 100))
        return (
          <>
            <div className="qbar" title={`${BUILDING_MAP[q.b].name} → Seviye ${q.to}`}>
              <span className="qbar-t">{fmtDur(q.end - now)}</span>
              <i className="qbar-p"><b style={{ width: `${pct}%` }} /></i>
              <span className="qbar-n">{BUILDING_MAP[q.b].name}{c.queue.length > 1 ? ` +${c.queue.length - 1}` : ''}</span>
            </div>
            <button className="qbtn" onClick={() => setQopen(!qopen)} aria-label="Hızlandır" />
          </>
        )
      })()}

      {qopen && c.queue.length > 0 && (
        <div className="queue metal-panel">
          <h5>İnşaat</h5>
          {c.queue.map((q, i) => (
            <div key={i} className="queue-row">
              <span>
                {BUILDING_MAP[q.b].name} → {q.to}
              </span>
              <b className="timer">{fmtDur(q.end - now)}</b>
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
    </div>
  )
}

/** Son dönem: boş arsaya tıklayınca açılan "… inşa et" listesi ve üzerine gelince önizleme. */
function BuildMenu({ onClose }: { onClose: () => void }) {
  const { g, act, cityId } = useG()
  const c = cityById(g, cityId)
  const list = BUILDINGS.filter((b) => b.id !== 'merkez' && c.b[b.id] === 0 && !c.queue.some((q) => q.b === b.id))
  const [hover, setHover] = useState<BuildingId | null>(list[0]?.id ?? null)
  const def = hover ? BUILDING_MAP[hover] : null
  const req = def ? Object.entries(def.req ?? {}).map(([r, l]) => `${BUILDING_MAP[r as BuildingId].name} Binası (Seviye ${l})`) : []
  return (
    <div className="bmenu-back" onClick={onClose}>
      <div className="bmenu" onClick={(e) => e.stopPropagation()}>
        <div className="bmenu-list">
          {list.length === 0 && <p className="muted small">Bu şehirde inşa edilecek yeni bina kalmadı.</p>}
          {list.map((b) => {
            const err = canBuild(g, c, b.id)
            return (
              <button
                key={b.id}
                className={`${err ? 'off' : ''} ${hover === b.id ? 'on' : ''}`}
                onMouseEnter={() => setHover(b.id)}
                onFocus={() => setHover(b.id)}
                onClick={() => {
                  if (hover !== b.id) return setHover(b.id)
                  if (!err) { act((g, n) => build(g, c.id, b.id, n)); onClose() }
                }}
                title={err ?? undefined}
              >
                {b.name} inşa et
              </button>
            )
          })}
        </div>
        {def && (
          <div className="bmenu-prev">
            <div className="bmenu-pic"><BuildingPic tribe={g.player.tribe} id={def.id} lvl={1} /></div>
            <div className="bmenu-info">
              <h5>{def.name}</h5>
              <b>Açıklama</b>
              <p>{def.desc}</p>
              <b>Maliyet</b>
              <Cost c={buildCost(def.id, 1)} have={g.player.res} />
              {req.length > 0 && (
                <>
                  <b>Gereksinim</b>
                  <p>{req.join(', ')}</p>
                </>
              )}
              <b>Süre</b>
              <p>{fmtDur(buildTime(g, c, def.id, 1))}</p>
              {canBuild(g, c, def.id) && <p className="bad small">{canBuild(g, c, def.id)}</p>}
            </div>
          </div>
        )}
        <button className="win-x" onClick={onClose} aria-label="Kapat">✕</button>
      </div>
    </div>
  )
}
