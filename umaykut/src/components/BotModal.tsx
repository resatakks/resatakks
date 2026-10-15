import { TRIBES } from '../game/data'
import { allianceOf, dist, rankings } from '../game/engine'
import { useG } from '../ctx'
import { fmt } from '../format'

export default function BotModal({ id, onClose }: { id: number; onClose: () => void }) {
  const { g, showOnMap, attack } = useG()
  const b = g.bots[id]
  const ally = allianceOf(g, b.allianceId)
  const rank = rankings(g).findIndex((r) => r.id === id) + 1
  const mine = ally && ally.id === g.player.allianceId
  const lastReport = g.reports.find((r) => r.from === id && (r.kind === 'kesif' || r.kind === 'saldiri'))

  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal panel" onClick={(e) => e.stopPropagation()}>
        <button className="link close" onClick={onClose}>✕</button>
        <div className="profile-head">
          <span className="avatar" style={{ background: TRIBES[b.tribe].color }}>{TRIBES[b.tribe].emblem}</span>
          <div>
            <h3>{b.name}</h3>
            <span className="muted">
              {TRIBES[b.tribe].name} · #{rank} · {b.online ? <span className="online">● çevrimiçi</span> : 'çevrimdışı'}
            </span>
          </div>
        </div>
        <table className="table compact">
          <tbody>
            <tr><td>Köy</td><td>{b.village} ({b.x}|{b.y})</td></tr>
            <tr><td>Nüfus</td><td>{fmt(b.pop)}</td></tr>
            <tr><td>Boy</td><td>{ally ? `[${ally.tag}] ${ally.name}` : 'Boysuz'}</td></tr>
            <tr><td>Uzaklık</td><td>{dist(g.player.x, g.player.y, b.x, b.y).toFixed(1)} kare</td></tr>
            <tr><td>Akın puanı</td><td>{fmt(b.raidPts)}</td></tr>
          </tbody>
        </table>
        {lastReport && <p className="muted small">Son istihbarat: {lastReport.lines[1]}</p>}
        <div className="row-btns">
          <button onClick={() => showOnMap(b.x, b.y)}>🗺️ Haritada göster</button>
          {!mine && <button className="primary" onClick={() => attack(id)}>⚔️ Sefer düzenle</button>}
        </div>
      </div>
    </div>
  )
}
