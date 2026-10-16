import { useState } from 'react'
import { RES_INFO, RES_KEYS, UNITS, UNIT_ORDER } from '../game/data'
import { UnitArt } from './cityart'
import { type Report, type ReportKind, type Side, sendChat } from '../game/engine'
import { useG } from '../ctx'
import { fmt, fmtAgo, fmtDate } from '../format'
import { Tag, Window } from './ui'

const KIND: Record<ReportKind, { label: string }> = {
  saldiri: { label: 'Saldırı' },
  savunma: { label: 'Savunma' },
  kesif: { label: 'Casusluk' },
  mesaj: { label: 'Mesaj' },
  bilgi: { label: 'Sistem' },
}

const RES_ICON: Record<string, string> = { tas: 'tas', odun: 'odun', tahil: 'tahil', demir: 'demir', altin: 'altin', at: 'at' }

/** Orijinal rapor bloğu: başlık şeridi (Saldıran/Savunan · oyuncu · şehir · Kazanan!/Kaybeden), portre satırı, asker ve "Yok Edilen!" satırları. */
function SideBox({ s, title, won }: { s: Side; title: string; won: boolean }) {
  const units = UNITS[s.tribe]
  return (
    <div className={`bside ${s.me ? 'me' : ''}`}>
      <div className="bs-head">
        <b className="bs-role">{title}</b>
        <span className="bs-who"><Tag tag={s.tag} color={s.tagColor} /> {s.name}</span>
        <span className="bs-city">{s.city}</span>
        <b className={`bs-res ${won ? 'ok' : 'bad'}`}>{won ? 'Kazanan!' : 'Kaybeden'}</b>
      </div>
      <table className="btable">
        <tbody>
          <tr className="pics">
            <td />
            {UNIT_ORDER.map((i) => <td key={i} title={units[i].name}><UnitArt tribe={s.tribe} i={i} /></td>)}
          </tr>
          <tr>
            <th>Giden</th>
            {UNIT_ORDER.map((i) => <td key={i} className={s.sent[i] ? '' : 'z'}>{fmt(s.sent[i] ?? 0)}</td>)}
          </tr>
          <tr className="lost">
            <th>Ölen</th>
            {UNIT_ORDER.map((i) => <td key={i} className={s.lost[i] ? '' : 'z'}>{fmt(s.lost[i] ?? 0)}</td>)}
          </tr>
        </tbody>
      </table>
    </div>
  )
}

function Detail({ r }: { r: Report }) {
  const { act, open } = useG()
  const b = r.battle
  const attWon = r.kind === 'savunma' ? r.win === false : r.win === true
  return (
    <div className={`report-detail ${r.win === true ? 'rw' : r.win === false ? 'rl' : ''}`}>
      <div className="rd-head">
        <b>{r.title}</b>
        <small>{fmtDate(r.time)}</small>
      </div>
      {b && (
        <>
          <SideBox s={b.att} title="Saldıran" won={attWon} />
          <SideBox s={b.def} title="Savunan" won={!attWon} />
          <div className="rd-foot">
            <div className="loot">
              <b>Ganimetler</b>
              {RES_KEYS.map((k) => (
                <span key={k} title={RES_INFO[k].name} className={b.loot[k] ? '' : 'z'}>
                  <img src={`/orig/r/${RES_ICON[k]}.png`} width={22} height={22} alt="" /> {fmt(b.loot[k])}
                </span>
              ))}
            </div>
            <p className="pts">Saldırı Puanı: <b>{fmt(b.atkPts)}</b> · Savunma Puanı: <b>{fmt(b.defPts)}</b></p>
          </div>
          {UNIT_ORDER.every((i) => !b.def.sent[i]) && <p className="small">Düşman şehri savunan hiçbir asker yoktu</p>}
          {b.notes.map((n, i) => <p key={i} className="small">{n}</p>)}
        </>
      )}
      {!b && r.lines.map((l, i) => <p key={i}>{l}</p>)}
      {b && r.lines.length > 0 && <div className="small">{r.lines.map((l, i) => <p key={i}>{l}</p>)}</div>}
      <div className="ti-actions">
        {r.from !== undefined && <button onClick={() => open({ w: 'oyuncu', id: r.from! })}>Profil</button>}
        {r.from !== undefined && <button onClick={() => open({ w: 'sefer', bot: r.from!, ci: 0, type: 'saldiri' })}>Saldırı</button>}
        {b && <button onClick={() => act((g, n) => sendChat(g, 'world', `[Rapor] ${r.title} — ${r.win ? 'Kazanan' : 'Kaybeden'}, ganimet ${fmt(RES_KEYS.reduce((s, k) => s + b.loot[k], 0))}`, n))}>Paylaş</button>}
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
    <Window title="Savaş Raporları" wide>
      <div className="seg">
        <button className={filter === 'all' ? 'active' : ''} onClick={() => setFilter('all')}>Tümü</button>
        {(Object.keys(KIND) as ReportKind[]).map((k) => (
          <button key={k} className={filter === k ? 'active' : ''} onClick={() => setFilter(k)}>{KIND[k].label}</button>
        ))}
      </div>
      {cur ? (
        <>
          <div className="pager">
            <button onClick={() => setSel(null)}>Geri Dön</button>
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
            <button key={r.id} className={`rrow ${r.read ? '' : 'unread'} ${r.win === true ? 'rw' : r.win === false ? 'rl' : ''}`} onClick={() => pick(r)}>
              <span className={`rkind ${r.kind}`}>{KIND[r.kind].label}</span>
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

