import { useState } from 'react'
import { TRIBES } from '../game/data'
import { allianceOf, allianceStats, rankings, umaykutCost } from '../game/engine'
import { useG } from '../ctx'
import { fmt } from '../format'

const PAGE = 50

export default function Rankings() {
  const { g, openBot } = useG()
  const [view, setView] = useState<'oyuncu' | 'boy' | 'yagma' | 'umaykut'>('oyuncu')
  const [page, setPage] = useState(0)
  const list = rankings(g)
  const myRank = list.findIndex((x) => x.id === -1)

  const stats = allianceStats(g)
  const allies = g.alliances
    .map((a) => ({ a, s: stats.get(a.id)! }))
    .filter((x) => x.s && x.s.members > 0)

  return (
    <div>
      <h2>Sıralama</h2>
      <div className="seg">
        <button className={view === 'oyuncu' ? 'active' : ''} onClick={() => setView('oyuncu')}>Oyuncular</button>
        <button className={view === 'boy' ? 'active' : ''} onClick={() => setView('boy')}>Boylar</button>
        <button className={view === 'yagma' ? 'active' : ''} onClick={() => setView('yagma')}>Akıncılar</button>
        <button className={view === 'umaykut' ? 'active' : ''} onClick={() => setView('umaykut')}>Umaykut yarışı</button>
      </div>

      {view === 'oyuncu' && (
        <section className="panel">
          <div className="pager">
            <button disabled={page === 0} onClick={() => setPage(page - 1)}>◀</button>
            <span>{page * PAGE + 1}–{Math.min(list.length, (page + 1) * PAGE)} / {fmt(list.length)}</span>
            <button disabled={(page + 1) * PAGE >= list.length} onClick={() => setPage(page + 1)}>▶</button>
            <button onClick={() => setPage(Math.floor(myRank / PAGE))}>Beni bul (#{myRank + 1})</button>
          </div>
          <table className="table">
            <thead><tr><th>#</th><th>Oyuncu</th><th>Halk</th><th>Boy</th><th>Nüfus</th></tr></thead>
            <tbody>
              {list.slice(page * PAGE, (page + 1) * PAGE).map((r, i) => (
                <tr key={r.id} className={r.id === -1 ? 'me-row' : ''}>
                  <td>{page * PAGE + i + 1}</td>
                  <td>{r.id === -1 ? <b>{r.name}</b> : <button className="link" onClick={() => openBot(r.id)}>{r.name}</button>}</td>
                  <td style={{ color: TRIBES[r.tribe].color }}>{TRIBES[r.tribe].emblem} {TRIBES[r.tribe].name}</td>
                  <td>{allianceOf(g, r.allianceId)?.tag ?? '—'}</td>
                  <td>{fmt(r.pop)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {view === 'yagma' && (
        <section className="panel">
          <p className="muted small">En çok düşman askeri yok eden akıncılar.</p>
          <table className="table">
            <thead><tr><th>#</th><th>Oyuncu</th><th>Boy</th><th>Akın puanı</th></tr></thead>
            <tbody>
              {[...list].sort((a, b) => b.raidPts - a.raidPts).slice(0, 50).map((r, i) => (
                <tr key={r.id} className={r.id === -1 ? 'me-row' : ''}>
                  <td>{i + 1}</td>
                  <td>{r.id === -1 ? <b>{r.name}</b> : <button className="link" onClick={() => openBot(r.id)}>{r.name}</button>}</td>
                  <td>{allianceOf(g, r.allianceId)?.tag ?? '—'}</td>
                  <td>{fmt(r.raidPts)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {view === 'boy' && (
        <section className="panel">
          <table className="table">
            <thead><tr><th>#</th><th>Boy</th><th>Üye</th><th>Halklar</th><th>Toplam nüfus</th><th>Umaykut</th></tr></thead>
            <tbody>
              {[...allies].sort((a, b) => b.s.pop - a.s.pop).map(({ a, s }, i) => (
                <tr key={a.id} className={a.id === g.player.allianceId ? 'me-row' : ''}>
                  <td>{i + 1}</td>
                  <td>[{a.tag}] {a.name}</td>
                  <td>{s.members}</td>
                  <td>{[...s.tribes].map((t) => TRIBES[t].emblem).join(' ')}</td>
                  <td>{fmt(s.pop)}</td>
                  <td>{a.umaykut}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {view === 'umaykut' && (
        <section className="panel">
          <p className="muted small">
            Umaykut’u 10. seviyeye ilk çıkaran boy dünyayı kazanır. Son seviye için boyda üç halktan da (Hun, Göktürk, Selçuklu) en az bir üye olmalıdır.
          </p>
          {[...allies]
            .sort((a, b) => b.a.umaykut - a.a.umaykut || b.a.progress - a.a.progress)
            .slice(0, 15)
            .map(({ a, s }) => {
              const pct = a.umaykut >= 10 ? 100 : Math.min(100, (a.progress / umaykutCost(a.umaykut)) * 100)
              return (
                <div key={a.id} className={`race-row ${a.id === g.player.allianceId ? 'me-row' : ''}`}>
                  <span className="race-name">[{a.tag}] {a.name}</span>
                  <span className="race-lvl">{a.umaykut}/10</span>
                  <div className="race-bar">
                    {Array.from({ length: 10 }, (_, k) => (
                      <i key={k} className={k < a.umaykut ? 'done' : k === a.umaykut ? 'cur' : ''} style={k === a.umaykut ? { ['--p' as string]: pct + '%' } : undefined} />
                    ))}
                  </div>
                  <span className="muted small">{[...s.tribes].map((t) => TRIBES[t].emblem).join('')}</span>
                </div>
              )
            })}
        </section>
      )}
    </div>
  )
}
