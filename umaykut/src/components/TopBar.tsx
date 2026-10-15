import { RES_INFO, RES_KEYS, TRIBES } from '../game/data'
import { allianceOf, cap, playerPop, rankings, rates } from '../game/engine'
import { useG } from '../ctx'
import { fmt, fmtDur } from '../format'

export default function TopBar({ onReset }: { onReset: () => void }) {
  const { g, now, setTab } = useG()
  const p = g.player
  const r = rates(g)
  const c = cap(g)
  const rank = rankings(g).findIndex((x) => x.id === -1) + 1
  const ally = allianceOf(g, p.allianceId)
  const protectedLeft = p.protectionUntil - now
  const incoming = g.incoming.filter((i) => i.launch <= now).sort((a, b) => a.arrive - b.arrive)

  return (
    <header className="topbar">
      <div className="brand">
        <span className="logo small">UMAYKUT</span>
        <span className="muted">Altay ×{g.speed}</span>
      </div>
      <div className="resources">
        {RES_KEYS.map((k) => (
          <div key={k} className={`res ${p.res[k] >= c * 0.98 ? 'full' : ''}`} title={`${RES_INFO[k].name}: ${fmt(r[k])}/dk`}>
            <span className="ri">{RES_INFO[k].icon}</span>
            <span className="rv">{fmt(p.res[k])}</span>
            <span className={`rr ${r[k] < 0 ? 'neg' : ''}`}>{r[k] >= 0 ? '+' : ''}{fmt(r[k])}/dk</span>
          </div>
        ))}
        <div className="res cap" title="Ambar kapasitesi">
          <span className="ri">🏚️</span>
          <span className="rv">{fmt(c)}</span>
        </div>
      </div>
      <div className="me">
        <span style={{ color: TRIBES[p.tribe].color }}>{TRIBES[p.tribe].emblem}</span> <b>{p.name}</b>
        <span className="muted"> · #{rank} · {fmt(playerPop(p))} nüfus{ally ? ` · [${ally.tag}]` : ''}</span>
        <span className="online">● {fmt(g.online)} çevrimiçi</span>
        <button className="link" onClick={onReset} title="Yeni dünya">↺</button>
      </div>
      {protectedLeft > 0 && <div className="banner info">🛡️ Acemi koruması: {fmtDur(protectedLeft)} (saldırı yaparsan biter)</div>}
      {incoming.length > 0 && (
        <button className="banner danger" onClick={() => setTab('ordu')}>
          ⚠️ {incoming.length} saldırı geliyor! İlki {fmtDur(incoming[0].arrive - now)} içinde — {g.bots[incoming[0].from].name}
        </button>
      )}
    </header>
  )
}
