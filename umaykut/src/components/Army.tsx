import { useEffect, useState } from 'react'
import { BUILDING_MAP, RES_INFO, RES_KEYS, TRIBES, UNITS } from '../game/data'
import {
  MissionType, attackPower, dist, maxTrainable, playerDefense, sendMission, totalArmy, train, trainTime, travelMs, upkeepPerMin,
} from '../game/engine'
import { useG } from '../ctx'
import { fmt, fmtDur } from '../format'

const MISSION_LABEL: Record<MissionType, string> = { raid: 'Yağma', attack: 'Saldırı', scout: 'Keşif' }

export default function Army({ target, clearTarget }: { target: number | null; clearTarget: () => void }) {
  const { g, now, act, openBot } = useG()
  const p = g.player
  const units = UNITS[p.tribe]
  const total = totalArmy(g)
  const [counts, setCounts] = useState<string[]>(['', '', '', ''])
  const [send, setSend] = useState<string[]>(['', '', '', ''])
  const [coord, setCoord] = useState('')
  const [type, setType] = useState<MissionType>('raid')
  const [msg, setMsg] = useState<string | null>(null)

  useEffect(() => {
    if (target !== null) {
      const b = g.bots[target]
      setCoord(`${b.x}|${b.y}`)
      clearTarget()
    }
  }, [target, g, clearTarget])

  const m = coord.match(/^\s*(\d+)\s*[|,/ ]\s*(\d+)\s*$/)
  const tBot = m ? g.bots.find((b) => b.x === +m[1] && b.y === +m[2]) : undefined
  const sendArmy = send.map((v, i) => Math.max(0, Math.min(p.army[i], Math.floor(+v || 0))))
  const d = tBot ? dist(p.x, p.y, tBot.x, tBot.y) : 0
  const anySend = sendArmy.some((n) => n > 0)

  const doSend = () => {
    if (!tBot) return setMsg('Bu koordinatta bir köy yok')
    let err: string | null = null
    act((g, n) => (err = sendMission(g, type, tBot.id, sendArmy, n)))
    setMsg(err ?? `${MISSION_LABEL[type]} ordusu yola çıktı → ${tBot.village}`)
    if (!err) setSend(['', '', '', ''])
  }

  const incoming = g.incoming.filter((i) => i.launch <= now).sort((a, b) => a.arrive - b.arrive)

  return (
    <div>
      <h2>Ordu</h2>
      <section className="panel">
        <div className="stats-row">
          <span>⚔️ Saldırı gücü (köyde): <b>{fmt(attackPower(p.tribe, p.army))}</b></span>
          <span>🛡️ Savunma gücü: <b>{fmt(playerDefense(g))}</b></span>
          <span>🌾 Ordu tüketimi: <b>{fmt(upkeepPerMin(g) * g.speed)}/dk</b></span>
        </div>
        <table className="table">
          <thead>
            <tr><th>Birim</th><th>Saldırı</th><th>Savunma</th><th>Hız</th><th>Taşıma</th><th>Köyde</th><th>Toplam</th></tr>
          </thead>
          <tbody>
            {units.map((u, i) => (
              <tr key={i}>
                <td>{u.icon} {u.name}</td>
                <td>{u.atk}{p.tribe === 'hun' && u.cav ? '+15%' : ''}</td>
                <td>{u.def}</td>
                <td>{u.speed}</td>
                <td>{u.carry}</td>
                <td><b>{fmt(p.army[i])}</b></td>
                <td>{fmt(total[i])}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {incoming.length > 0 && (
        <section className="panel danger-panel">
          <h3>⚠️ Gelen saldırılar</h3>
          {incoming.map((i) => {
            const b = g.bots[i.from]
            return (
              <div key={i.id} className="move-row">
                <span>
                  <button className="link" onClick={() => openBot(b.id)}>{b.name}</button> ({b.x}|{b.y}) · ~{fmt(i.troops)} asker
                </span>
                <span className="mono red">{fmtDur(i.arrive - now)}</span>
              </div>
            )
          })}
          <p className="muted small">İpucu: Savunma birimi bas, suru yükselt ya da kaynaklarını harca ki yağmalanacak bir şey kalmasın.</p>
        </section>
      )}

      <section className="panel">
        <h3>Asker yetiştir</h3>
        <div className="train-grid">
          {units.map((u, i) => {
            const lvl = p.buildings[u.building]
            const max = maxTrainable(g, i)
            return (
              <div key={i} className={`train-card ${lvl === 0 ? 'disabled' : ''}`}>
                <b>{u.icon} {u.name}</b>
                <div className="cost">
                  {RES_KEYS.map((k) => <span key={k}>{RES_INFO[k].icon} {u.cost[k]}</span>)}
                  <span>⏱ {fmtDur(trainTime(g, i))}</span>
                </div>
                {lvl === 0 ? (
                  <span className="muted small">{BUILDING_MAP[u.building].name} gerekli</span>
                ) : (
                  <div className="train-input">
                    <input type="number" min={0} value={counts[i]} placeholder="0" onChange={(e) => setCounts(counts.map((c, j) => (j === i ? e.target.value : c)))} />
                    <button className="link" onClick={() => setCounts(counts.map((c, j) => (j === i ? String(max) : c)))}>(maks {fmt(max)})</button>
                    <button
                      className="primary"
                      disabled={!(+counts[i] > 0) || +counts[i] > max}
                      onClick={() => {
                        act((g, n) => train(g, i, +counts[i], n))
                        setCounts(counts.map((c, j) => (j === i ? '' : c)))
                      }}
                    >
                      Eğit
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
        {p.train.length > 0 && (
          <div className="train-queue">
            {p.train.map((j, k) => {
              const u = units[j.unit]
              const end = j.start + j.count * j.each
              return (
                <div key={k} className="queue-row">
                  <span>{u.icon} {j.done}/{j.count} {u.name}</span>
                  <div className="bar"><div style={{ width: (j.done / j.count) * 100 + '%' }} /></div>
                  <span className="mono">{fmtDur(end - now)}</span>
                </div>
              )
            })}
          </div>
        )}
      </section>

      <section className="panel">
        <h3>Sefer düzenle</h3>
        <div className="send-form">
          <label>
            Hedef koordinat
            <input value={coord} placeholder="x|y" onChange={(e) => setCoord(e.target.value)} />
          </label>
          {tBot ? (
            <div className="target-info">
              <span style={{ color: TRIBES[tBot.tribe].color }}>{TRIBES[tBot.tribe].emblem}</span>{' '}
              <button className="link" onClick={() => openBot(tBot.id)}>{tBot.name}</button> · {tBot.village} · {fmt(tBot.pop)} nüfus · {d.toFixed(1)} kare
            </div>
          ) : (
            coord && <div className="muted">Bu koordinatta köy yok</div>
          )}
          <div className="seg">
            {(['raid', 'attack', 'scout'] as MissionType[]).map((t) => (
              <button key={t} className={type === t ? 'active' : ''} onClick={() => setType(t)}>{MISSION_LABEL[t]}</button>
            ))}
          </div>
          <p className="muted small">
            {type === 'raid' && 'Yağma: kazanırsan ganimet taşırsın, iki taraf da daha az kayıp verir.'}
            {type === 'attack' && 'Saldırı: kaybeden taraf tamamen yok olur. Düşman ordusunu ezmek için.'}
            {type === 'scout' && 'Keşif: savaşmadan savunma ve depo bilgisini öğrenirsin. Tek atlı yeterli.'}
          </p>
          <div className="send-units">
            {units.map((u, i) => (
              <label key={i}>
                {u.icon} {u.name} <small>({fmt(p.army[i])})</small>
                <input type="number" min={0} max={p.army[i]} value={send[i]} placeholder="0" onChange={(e) => setSend(send.map((c, j) => (j === i ? e.target.value : c)))} />
              </label>
            ))}
            <button className="link" onClick={() => setSend(p.army.map((n) => String(n)))}>tümü</button>
          </div>
          {tBot && anySend && (
            <p className="muted">
              Varış süresi: {fmtDur(travelMs(g, sendArmy, d))} · Saldırı gücü {fmt(attackPower(p.tribe, sendArmy))} · Taşıma{' '}
              {fmt(sendArmy.reduce((s, n, i) => s + n * units[i].carry, 0))}
            </p>
          )}
          <button className="primary" disabled={!tBot || !anySend} onClick={doSend}>
            Seferi başlat
          </button>
          {msg && <p className="note">{msg}</p>}
        </div>
      </section>

      <section className="panel">
        <h3>Seferdeki ordular</h3>
        {g.out.length === 0 && <p className="muted">Seferde ordu yok.</p>}
        {g.out.map((m) => {
          const b = g.bots[m.target]
          return (
            <div key={m.id} className="move-row">
              <span>
                {m.returning ? '↩️ Dönüş' : '➡️ ' + MISSION_LABEL[m.type]} · <button className="link" onClick={() => openBot(b.id)}>{b.village}</button> ({b.x}|{b.y}) ·{' '}
                {units.map((u, i) => (m.army[i] ? `${u.icon}${m.army[i]} ` : '')).join('')}
              </span>
              <span className="mono">{fmtDur((m.returning ? m.back : m.arrive) - now)}</span>
            </div>
          )
        })}
      </section>
    </div>
  )
}
