import { useState } from 'react'
import { RES_INFO, RES_KEYS, UNITS } from '../game/data'
import { type Report, type ReportKind, type Side, sendChat } from '../game/engine'
import { useG } from '../ctx'
import { fmt, fmtAgo, fmtDate } from '../format'
import { Tag, Window } from './ui'

const KIND: Record<ReportKind, { icon: string; label: string }> = {
  saldiri: { icon: '🗡️', label: 'Saldırı' },
  savunma: { icon: '🛡️', label: 'Savunma' },
  kesif: { icon: '👁️', label: 'Keşif' },
  mesaj: { icon: '✉️', label: 'Mesaj' },
  bilgi: { icon: '📣', label: 'Bilgi' },
}

function SideBox({ s, title }: { s: Side; title: string }) {
  const units = UNITS[s.tribe]
  return (
    <div className={`bside ${s.me ? 'me' : ''}`}>
      <h5>{title}</h5>
      <p>
        <Tag tag={s.tag} color={s.tagColor} /> <b>{s.name}</b> <small className="muted">· {s.city}</small>
      </p>
      <table className="btable">
        <tbody>
          <tr>
            <th />
            {units.map((u, i) => <th key={i} title={u.name}>{u.icon}</th>)}
          </tr>
          <tr>
            <td>Giden</td>
            {units.map((_, i) => <td key={i}>{s.sent[i] ? fmt(s.sent[i]) : '–'}</td>)}
          </tr>
          <tr className="lost">
            <td>Ölen</td>
            {units.map((_, i) => <td key={i}>{s.lost[i] ? fmt(s.lost[i]) : '–'}</td>)}
          </tr>
        </tbody>
      </table>
    </div>
  )
}

function Detail({ r }: { r: Report }) {
  const { act, open } = useG()
  const b = r.battle
  return (
    <div className={`report-detail ${r.win === true ? 'win' : r.win === false ? 'loss' : ''}`}>
      <div className="rd-head">
        <span>{KIND[r.kind].icon}</span>
        <b>{r.title}</b>
        <small className="muted">{fmtDate(r.time)}</small>
      </div>
      {b && (
        <>
          <div className={`verdict ${r.win ? 'win' : 'loss'}`}>{r.win ? 'ZAFER' : 'YENİLGİ'}</div>
          <SideBox s={b.att} title="Saldıran" />
          <SideBox s={b.def} title="Savunan" />
          {RES_KEYS.some((k) => b.loot[k] > 0) && (
            <div className="loot">
              <h5>Ganimetler</h5>
              {RES_KEYS.filter((k) => b.loot[k] > 0).map((k) => <span key={k}>{RES_INFO[k].icon} {fmt(b.loot[k])}</span>)}
            </div>
          )}
          <p className="pts">Saldırı puanı: <b>{fmt(b.atkPts)}</b> · Savunma puanı: <b>{fmt(b.defPts)}</b></p>
          {b.notes.map((n, i) => <p key={i} className="small">• {n}</p>)}
        </>
      )}
      {!b && r.lines.map((l, i) => <p key={i}>{l}</p>)}
      {b && r.lines.length > 0 && <div className="small muted">{r.lines.map((l, i) => <p key={i}>{l}</p>)}</div>}
      <div className="ti-actions">
        {r.from !== undefined && <button onClick={() => open({ w: 'oyuncu', id: r.from! })}>Profil</button>}
        {r.from !== undefined && <button className="btn-red" onClick={() => open({ w: 'sefer', bot: r.from!, ci: 0, type: 'saldiri' })}>⚔️ Sefer düzenle</button>}
        {b && <button onClick={() => act((g, n) => sendChat(g, 'world', `[Rapor] ${r.title} — ${r.win ? 'zafer' : 'yenilgi'}, ganimet ${fmt(RES_KEYS.reduce((s, k) => s + b.loot[k], 0))}`, n))}>Paylaş</button>}
      </div>
    </div>
  )
}

export default function Reports({ id }: { id?: number }) {
  const { g, now, act } = useG()
  const [filter, setFilter] = useState<ReportKind | 'all'>('all')
  const [sel, setSel] = useState<number | null>(id ?? null)
  const list = g.reports.filter((r) => r.time <= now && (filter === 'all' || r.kind === filter))
  const idx = list.findIndex((r) => r.id === sel)
  const cur = idx >= 0 ? list[idx] : null

  const pick = (r: Report) => {
    setSel(r.id)
    if (!r.read) act(() => { r.read = true })
  }

  return (
    <Window title="Raporlar" wide>
      <div className="seg">
        <button className={filter === 'all' ? 'active' : ''} onClick={() => setFilter('all')}>Tümü</button>
        {(Object.keys(KIND) as ReportKind[]).map((k) => (
          <button key={k} className={filter === k ? 'active' : ''} onClick={() => setFilter(k)}>{KIND[k].icon} {KIND[k].label}</button>
        ))}
      </div>
      {cur ? (
        <>
          <div className="pager">
            <button onClick={() => setSel(null)}>◀ Liste</button>
            <button disabled={idx <= 0} onClick={() => pick(list[idx - 1])}>‹</button>
            <span>{idx + 1} / {list.length}</span>
            <button disabled={idx >= list.length - 1} onClick={() => pick(list[idx + 1])}>›</button>
          </div>
          <Detail r={cur} />
        </>
      ) : (
        <div className="rlist">
          {list.length === 0 && <p className="muted">Henüz rapor yok.</p>}
          {list.slice(0, 80).map((r) => (
            <button key={r.id} className={`rrow ${r.read ? '' : 'unread'} ${r.win === true ? 'win' : r.win === false ? 'loss' : ''}`} onClick={() => pick(r)}>
              <span>{KIND[r.kind].icon}</span>
              <span className="rtitle">{r.title}</span>
              <small className="muted">{fmtAgo(r.time, now)}</small>
            </button>
          ))}
          {list.some((r) => !r.read) && (
            <button className="link" onClick={() => act((g) => g.reports.forEach((r) => (r.read = true)))}>Tümünü okundu say</button>
          )}
        </div>
      )}
    </Window>
  )
}
