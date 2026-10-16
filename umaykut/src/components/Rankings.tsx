import { useState } from 'react'
import { TRIBES } from '../game/data'
import { allianceOf, allianceStats, rankings } from '../game/engine'
import { useG } from '../ctx'
import { fmt } from '../format'
import { Tag, Window } from './ui'

const PAGE = 15
type Tab = 'tp' | 'atk' | 'def' | 'birlik'

export default function Rankings() {
  const { g, open } = useG()
  const [tab, setTab] = useState<Tab>('tp')
  const [page, setPage] = useState(0)
  const players = tab === 'birlik' ? [] : rankings(g, tab)
  const stats = allianceStats(g)
  const allies = g.alliances
    .map((a) => ({ a, s: stats.get(a.id)! }))
    .filter((x) => x.s && x.s.members > 0)
    .sort((x, y) => y.a.umaykut - x.a.umaykut || y.s.points - x.s.points)
  const total = tab === 'birlik' ? allies.length : players.length
  const pages = Math.max(1, Math.ceil(total / PAGE))
  const me = players.findIndex((r) => r.id === -1)
  const switchTab = (t: Tab) => { setTab(t); setPage(0) }

  return (
    <Window title="Sıralama" wide>
      <div className="rank-tabs">
        {([['tp', '🏆', 'Genel'], ['atk', '⚔️', 'Saldırı'], ['def', '🛡️', 'Savunma'], ['birlik', '🐺', 'Birlik']] as [Tab, string, string][]).map(([k, i, l]) => (
          <button key={k} className={`round ${tab === k ? 'active' : ''}`} onClick={() => switchTab(k)}>{i}<small>{l}</small></button>
        ))}
      </div>
      <div className="table-wrap">
        {tab !== 'birlik' ? (
          <table className="table">
            <thead><tr><th>Sıra</th><th>Oyuncu</th><th>Şehir</th><th>Puan</th><th>Devlet</th></tr></thead>
            <tbody>
              {players.slice(page * PAGE, (page + 1) * PAGE).map((r, i) => {
                const a = allianceOf(g, r.allianceId)
                return (
                  <tr key={r.id} className={r.id === -1 ? 'me-row' : ''}>
                    <td>{page * PAGE + i + 1}</td>
                    <td>
                      <Tag tag={a?.tag} color={a?.color} />{' '}
                      <button className="link" onClick={() => open({ w: 'oyuncu', id: r.id })}>{r.name}</button>
                    </td>
                    <td>{r.cities}</td>
                    <td>{fmt(r[tab])}</td>
                    <td style={{ color: TRIBES[r.tribe].color }}>{TRIBES[r.tribe].emblem} {TRIBES[r.tribe].short}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        ) : (
          <table className="table">
            <thead><tr><th>Sıra</th><th>Birlik</th><th>Üye</th><th>Puan</th><th>Umaykut</th></tr></thead>
            <tbody>
              {allies.slice(page * PAGE, (page + 1) * PAGE).map(({ a, s }, i) => (
                <tr key={a.id} className={a.id === g.player.allianceId ? 'me-row' : ''}>
                  <td>{page * PAGE + i + 1}</td>
                  <td><Tag tag={a.tag} color={a.color} /> {a.name}</td>
                  <td>{s.members}</td>
                  <td>{fmt(s.points)}</td>
                  <td>{a.umaykut}/10 {s.tribes.size === 3 ? '✓' : `(${s.tribes.size}/3 devlet)`}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <div className="pager">
        <button disabled={page === 0} onClick={() => setPage(0)}>«</button>
        <button disabled={page === 0} onClick={() => setPage(page - 1)}>‹</button>
        <span>{page + 1} / {pages}</span>
        <button disabled={page >= pages - 1} onClick={() => setPage(page + 1)}>›</button>
        <button disabled={page >= pages - 1} onClick={() => setPage(pages - 1)}>»</button>
        {tab !== 'birlik' && <button onClick={() => setPage(Math.floor(me / PAGE))}>Beni bul (#{me + 1})</button>}
      </div>
    </Window>
  )
}
