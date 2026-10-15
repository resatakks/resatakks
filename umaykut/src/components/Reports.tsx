import { useState } from 'react'
import type { ReportKind } from '../game/engine'
import { useG } from '../ctx'
import { fmtAgo, fmtClock } from '../format'

const KIND: Record<ReportKind, { icon: string; label: string }> = {
  saldiri: { icon: '🗡️', label: 'Saldırı' },
  savunma: { icon: '🛡️', label: 'Savunma' },
  kesif: { icon: '👁️', label: 'Keşif' },
  mesaj: { icon: '✉️', label: 'Mesaj' },
  bilgi: { icon: '📣', label: 'Bilgi' },
}

export default function Reports() {
  const { g, now, act, openBot, attack } = useG()
  const [open, setOpen] = useState<number | null>(null)
  const [filter, setFilter] = useState<ReportKind | 'all'>('all')
  const list = g.reports.filter((r) => r.time <= now && (filter === 'all' || r.kind === filter))

  return (
    <div>
      <h2>Raporlar ve mesajlar</h2>
      <div className="seg">
        <button className={filter === 'all' ? 'active' : ''} onClick={() => setFilter('all')}>Tümü</button>
        {(Object.keys(KIND) as ReportKind[]).map((k) => (
          <button key={k} className={filter === k ? 'active' : ''} onClick={() => setFilter(k)}>
            {KIND[k].icon} {KIND[k].label}
          </button>
        ))}
        <button className="link" onClick={() => act((g) => g.reports.forEach((r) => (r.read = true)))}>tümünü okundu say</button>
      </div>
      <section className="panel">
        {list.length === 0 && <p className="muted">Henüz rapor yok.</p>}
        {list.map((r) => (
          <div key={r.id} className={`report ${r.read ? '' : 'unread'} ${r.win === true ? 'win' : r.win === false ? 'loss' : ''}`}>
            <button
              className="report-head"
              onClick={() => {
                setOpen(open === r.id ? null : r.id)
                if (!r.read) act(() => (r.read = true))
              }}
            >
              <span>{KIND[r.kind].icon}</span>
              <span className="report-title">{r.title}</span>
              <span className="muted small" title={fmtClock(r.time)}>{fmtAgo(r.time, now)}</span>
            </button>
            {open === r.id && (
              <div className="report-body">
                {r.lines.map((l, i) => <p key={i}>{l}</p>)}
                {r.from !== undefined && (
                  <div className="row-btns">
                    <button onClick={() => openBot(r.from!)}>Profil</button>
                    <button className="primary" onClick={() => attack(r.from!)}>⚔️ Sefer düzenle</button>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </section>
    </div>
  )
}
