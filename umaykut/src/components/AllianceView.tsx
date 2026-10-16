import { useState } from 'react'
import { RES_INFO, RES_KEYS, TRIBES, TRIBE_IDS, zeroRes } from '../game/data'
import {
  allianceOf, allianceStats, applyAlliance, contribute, foundAlliance, leaveAlliance, playerPop, umaykutCost,
} from '../game/engine'
import { useG } from '../ctx'
import { fmt, fmtDur } from '../format'
import { Tag, Window } from './ui'

export default function AllianceView() {
  const { g, now, act, open } = useG()
  const p = g.player
  const ally = allianceOf(g, p.allianceId)
  const stats = allianceStats(g)
  const [name, setName] = useState('')
  const [tag, setTag] = useState('')
  const [gift, setGift] = useState<Record<string, string>>({})

  if (!ally) {
    const list = g.alliances
      .map((a) => ({ a, s: stats.get(a.id)! }))
      .filter((x) => x.s.members > 0)
      .sort((a, b) => b.s.pop - a.s.pop)
    const pp = playerPop(p)
    return (
      <Window title="Birlik" wide>
        <p className="muted">Bir birliğe katıl ya da kendi birliğini kur. Birlikler birbirini korur ve birlikte Umaykut’u diker.</p>
        {g.application && (
          <p className="note">
            {allianceOf(g, g.application.allianceId)?.name} birliğine başvurdun. Birlik lideri değerlendiriyor… ({fmtDur(g.application.at - now)})
          </p>
        )}
        <section className="panel">
          <h3>Birlikler</h3>
          <table className="table">
            <thead><tr><th>Birlik</th><th>Üye</th><th>Nüfus</th><th>Umaykut</th><th>Şart</th><th></th></tr></thead>
            <tbody>
              {list.map(({ a, s }) => (
                <tr key={a.id}>
                  <td><Tag tag={a.tag} color={a.color} /> {a.name}</td>
                  <td>{s.members}</td>
                  <td>{fmt(s.pop)}</td>
                  <td>{a.umaykut}</td>
                  <td className={pp < a.minPop ? 'lack' : ''}>{a.minPop ? `${a.minPop}+ nüfus` : 'herkes'}</td>
                  <td>
                    <button disabled={!!g.application} onClick={() => act((g, n) => applyAlliance(g, a.id, n))}>Başvur</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
        <section className="panel">
          <h3>Kendi birliğini kur</h3>
          <div className="row-btns">
            <input placeholder="Birlik adı" value={name} maxLength={24} onChange={(e) => setName(e.target.value)} />
            <input placeholder="Etiket" value={tag} maxLength={3} style={{ width: 80 }} onChange={(e) => setTag(e.target.value)} />
            <button className="btn-gold" disabled={name.trim().length < 3 || tag.trim().length < 2} onClick={() => act((g, n) => foundAlliance(g, name.trim(), tag.trim(), n))}>
              Kur
            </button>
          </div>
          <p className="muted small">Kendi birliğini kurarsan yakındaki birliksiz oyuncular zamanla katılır.</p>
        </section>
      </Window>
    )
  }

  const s = stats.get(ally.id)!
  const members = g.bots.filter((b) => b.allianceId === ally.id).sort((a, b) => b.pop - a.pop)
  const cost = umaykutCost(ally.umaykut)
  const pct = ally.umaykut >= 10 ? 100 : Math.min(100, (ally.progress / cost) * 100)
  const giftRes = zeroRes()
  for (const k of RES_KEYS) giftRes[k] = Math.max(0, Math.floor(+(gift[k] || 0)))

  return (
    <Window title={`[${ally.tag}] ${ally.name}`} wide>
      <section className="panel umaykut-panel">
        <div className="umaykut-visual">
          {Array.from({ length: 10 }, (_, k) => (
            <i key={k} className={k < ally.umaykut ? 'done' : ''} style={{ width: `${100 - k * 6}%` }} />
          ))}
          <span>🏛️</span>
        </div>
        <div>
          <h3>Umaykut · {ally.umaykut}. seviye</h3>
          <div className="bar big"><div style={{ width: pct + '%' }} /></div>
          <p className="muted">
            {ally.umaykut >= 10 ? 'Tamamlandı!' : `${fmt(ally.progress)} / ${fmt(cost)} kaynak — sonraki seviye`}
          </p>
          <p className="small">
            Devletler: {TRIBE_IDS.map((t) => (
              <span key={t} className={s.tribes.has(t) ? '' : 'lack'}>{TRIBES[t].emblem} {TRIBES[t].name}{s.tribes.has(t) ? ' ✓' : ' ✗'} </span>
            ))}
          </p>
          <div className="gift">
            {RES_KEYS.map((k) => (
              <label key={k}>
                {RES_INFO[k].icon}
                <input type="number" min={0} placeholder="0" value={gift[k] ?? ''} onChange={(e) => setGift({ ...gift, [k]: e.target.value })} />
              </label>
            ))}
            <button className="link" onClick={() => setGift(Object.fromEntries(RES_KEYS.map((k) => [k, String(Math.floor(p.res[k] * 0.5))])))}>yarısı</button>
            <button
              className="btn-gold"
              disabled={RES_KEYS.every((k) => giftRes[k] === 0)}
              onClick={() => {
                act((g, n) => contribute(g, giftRes, n))
                setGift({})
              }}
            >
              Bağışla
            </button>
          </div>
        </div>
      </section>

      <section className="panel">
        <h3>Üyeler ({s.members}) · Toplam nüfus {fmt(s.pop)}</h3>
        <table className="table">
          <thead><tr><th>Oyuncu</th><th>Devlet</th><th>Nüfus</th><th>Koordinat</th><th>Durum</th></tr></thead>
          <tbody>
            <tr className="me-row">
              <td><b>{p.name}</b></td>
              <td>{TRIBES[p.tribe].emblem}</td>
              <td>{fmt(playerPop(p))}</td>
              <td>{p.x}|{p.y}</td>
              <td className="online">● sen</td>
            </tr>
            {members.map((b) => (
              <tr key={b.id}>
                <td><button className="link" onClick={() => open({ w: 'oyuncu', id: b.id })}>{b.name}</button></td>
                <td>{TRIBES[b.tribe].emblem}</td>
                <td>{fmt(b.pop)}</td>
                <td>{b.x}|{b.y}</td>
                <td>{b.online ? <span className="online">● çevrimiçi</span> : b.activity === 0 ? <span className="muted">uzun süredir yok</span> : <span className="muted">çevrimdışı</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <button
          className="btn-red"
          onClick={() => confirm(ally.playerOwned ? 'Kurucu ayrılırsa birlik dağılır. Emin misin?' : 'Birlikten ayrılmak istediğine emin misin?') && act((g, n) => leaveAlliance(g, n))}
        >
          Birlikten ayrıl
        </button>
      </section>
    </Window>
  )
}
