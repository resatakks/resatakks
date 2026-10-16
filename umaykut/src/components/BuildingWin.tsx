import { useState } from 'react'
import {
  BUILDING_MAP, type BuildingId, MINE_NAME, RES_INFO, RES_KEYS, RING_MAX, RING_OKUL, type ResKey, type TrainBuilding, UNITS,
} from '../game/data'
import {
  buildCost, buildTime, canBuild, build, cityById, cityDefense, buildingMult, cityRates, idleFolk, marketRate, maxTrainable, minesNear, workersOn,
  renameCity, ringGrowthPerDay, storageCap, trade, train, trainTime, unitCost,
} from '../game/engine'
import { useG } from '../ctx'
import { fmt, fmtDur } from '../format'
import { BuildingPic, UnitArt } from './cityart'
import { Cost, Window } from './ui'

const TRAIN: TrainBuilding[] = ['kisla', 'okcu', 'ahir', 'atolye']

export default function BuildingWin({ id }: { id: BuildingId }) {
  const { g, now, act, cityId } = useG()
  const c = cityById(g, cityId)
  const def = BUILDING_MAP[id]
  const lvl = c.b[id]
  const queued = c.queue.filter((q) => q.b === id).length
  const to = lvl + queued + 1
  const err = canBuild(g, c, id)
  const maxed = to > def.max

  return (
    <Window title={`${def.name}${lvl ? ` · Seviye ${lvl}` : ''}`} wide={TRAIN.includes(id as TrainBuilding) || id === 'pazar'}>
      <div className="bwin-head">
        <div className="bwin-pic"><BuildingPic tribe={g.player.tribe} id={id} lvl={lvl} /></div>
        <div>
          <h6 className="lbl">Açıklama</h6>
          <p>{def.desc}</p>
        </div>
      </div>

      <Info id={id} />

      <section className="stone">
        <h5>{lvl === 0 && queued === 0 ? 'İnşa et' : `Seviye ${to} için yükselt`}</h5>
        {maxed ? (
          <p className="muted">Bu bina en yüksek seviyede.</p>
        ) : (
          <>
            <div className="upg-row">
              <Cost c={buildCost(id, to)} have={g.player.res} />
              <span className="muted">⏱ {fmtDur(buildTime(g, c, id, to))}</span>
            </div>
            {err && <p className="note bad">{err}</p>}
            <button className="btn-gold" disabled={!!err} onClick={() => act((g, n) => build(g, c.id, id, n))}>
              {lvl === 0 && queued === 0 ? 'İnşa et' : 'Yükselt'}
            </button>
          </>
        )}
        {queued > 0 && <p className="muted small">Sırada: {c.queue.filter((q) => q.b === id).map((q) => `→ ${q.to} (${fmtDur(q.end - now)})`).join(', ')}</p>}
      </section>

      {TRAIN.includes(id as TrainBuilding) && lvl > 0 && <TrainPanel b={id as TrainBuilding} />}
      {id === 'pazar' && lvl > 0 && <Market />}
    </Window>
  )
}

function Info({ id }: { id: BuildingId }) {
  const { g, act, cityId } = useG()
  const c = cityById(g, cityId)
  const def = BUILDING_MAP[id]
  const lvl = c.b[id]
  const [name, setName] = useState(c.name)
  const hour = 60 * g.speed

  if (def.produces) {
    const type = def.produces
    const mines = minesNear(g, c.x, c.y, type, c.r)
    const cur = cityRates(g, c)[type] * hour
    const w = workersOn(g, c, type)
    return (
      <section className="stone">
        <table className="kv">
          <tbody>
            <tr><td>Saatlik üretim</td><td><b>{fmt(cur)}</b> {RES_INFO[type].name}</td></tr>
            <tr><td>Üretim artışı</td><td>+%{Math.round((buildingMult(lvl) - 1) * 100)}{lvl < def.max ? ` (sonraki seviye +%${Math.round((buildingMult(lvl + 1) - 1) * 100)})` : ''}</td></tr>
            <tr><td>Kaynaklardaki işçi</td><td>{fmt(w)} · boşta {fmt(idleFolk(c))}</td></tr>
            <tr><td>Çember içindeki {MINE_NAME[type]}</td><td>{mines.length ? mines.map((m) => `Sv.${m.m.level}`).join(' · ') : 'yok'}</td></tr>
          </tbody>
        </table>
        {!mines.length && <p className="muted small">Şehrin {MINE_NAME[type].toLowerCase()} kaynağı yoksa bu bina yararsızdır. Çember her gün genişler, Okul bu büyümeyi hızlandırır.</p>}
        {mines.length > 0 && !w && <p className="muted small">Kaynaklarda hiç işçi çalışmıyor. Haritada kaynağa tıklayıp işçi gönderin.</p>}
      </section>
    )
  }
  if (id === 'ambar') {
    return (
      <section className="stone">
        <table className="kv"><tbody>
          <tr><td>Bu şehrin kapasitesi</td><td><b>{fmt(storageCap(lvl))}</b></td></tr>
          {lvl < def.max && <tr><td>Sonraki seviye</td><td>{fmt(storageCap(lvl + 1))}</td></tr>}
          <tr><td>Toplam (tüm şehirler)</td><td>{fmt(g.player.cities.reduce((s, x) => s + storageCap(x.b.ambar), 0))}</td></tr>
        </tbody></table>
      </section>
    )
  }
  if (id === 'sur') {
    return (
      <section className="stone">
        <table className="kv"><tbody>
          <tr><td>Savunma bonusu</td><td><b>+%{lvl * 6}</b></td></tr>
          <tr><td>Yayaya karşı savunma</td><td>{fmt(cityDefense(g, c, 0))}</td></tr>
          <tr><td>Atlıya karşı savunma</td><td>{fmt(cityDefense(g, c, 1))}</td></tr>
        </tbody></table>
        <p className="muted small">Düşman mancınıkları Sur seviyesini düşürebilir.</p>
      </section>
    )
  }
  const ringRows = (
    <>
      <tr><td>Köy çemberi</td><td><b>{c.r.toFixed(2).replace('.', ',')}</b> / {RING_MAX.toString().replace('.', ',')} birim</td></tr>
      <tr><td>Günlük genişleme</td><td>{c.r >= RING_MAX ? 'en geniş hali' : `+${ringGrowthPerDay(g, c).toFixed(2).replace('.', ',')} birim · dolmasına ${fmtDur(((RING_MAX - c.r) / ringGrowthPerDay(g, c)) * 86400000)}`}</td></tr>
    </>
  )
  if (id === 'okul') {
    return (
      <section className="stone">
        <table className="kv"><tbody>
          {ringRows}
          <tr><td>Okul etkisi</td><td>+%{Math.round(lvl * RING_OKUL * 100)} büyüme hızı</td></tr>
          {lvl < def.max && <tr><td>Sonraki seviye</td><td>+%{Math.round((lvl + 1) * RING_OKUL * 100)}</td></tr>}
          <tr><td>Birlik kapasitesine katkı</td><td>+{lvl * 3} üye</td></tr>
        </tbody></table>
        <p className="muted small">Her Okul yalnız bulunduğu köyün çemberini etkiler.</p>
      </section>
    )
  }
  if (id === 'tapinak') {
    return (
      <section className="stone">
        <table className="kv"><tbody>
          <tr><td>Nüfus artışı</td><td><b>+%{lvl * 5}</b></td></tr>
          <tr><td>Sonraki seviye</td><td>+%{Math.min(10, lvl + 1) * 5}</td></tr>
        </tbody></table>
        <p className="muted small">Tapınaklar şehirde zamanla oluşan yeni nüfusun daha hızlı artmasını sağlar. Okul için en az 1. seviye Tapınak gerekir.</p>
      </section>
    )
  }
  if (id === 'merkez') {
    return (
      <section className="stone">
        <table className="kv"><tbody>
          {ringRows}
          <tr><td>İnşaat hızı</td><td>−%{Math.round((1 - Math.pow(0.95, lvl - 1)) * 100)}</td></tr>
          <tr><td>Koordinat</td><td>{c.x}|{c.y}</td></tr>
        </tbody></table>
        <div className="row">
          <input value={name} maxLength={16} onChange={(e) => setName(e.target.value)} aria-label="Şehir adı" />
          <button onClick={() => act((g) => renameCity(g, c.id, name))}>Adını değiştir</button>
        </div>
      </section>
    )
  }
  return null
}

function TrainPanel({ b }: { b: TrainBuilding }) {
  const { g, now, act, cityId } = useG()
  const c = cityById(g, cityId)
  const units = UNITS[g.player.tribe]
  const [counts, setCounts] = useState<Record<number, string>>({})
  const list = units.map((u, i) => ({ u, i })).filter((x) => x.u.building === b)
  const jobs = c.train.filter((t) => t.b === b)

  return (
    <section className="stone">
      <h5>Asker eğit</h5>
      <table className="train">
        <thead>
          <tr><th>Birim</th><th title="Saldırı">Saldırı</th><th title="Yayaya karşı savunma">Yayaya Sav.</th><th title="Atlıya karşı savunma">Atlıya Sav.</th><th title="Hız">Hız</th><th title="Yağma (taşıma)">Yağma</th><th>Bedel</th><th>Şehirde</th><th /></tr>
        </thead>
        <tbody>
          {list.map(({ u, i }) => {
            const max = maxTrainable(g, i, c)
            const v = counts[i] ?? ''
            return (
              <tr key={i}>
                <td><span className="u-icon"><UnitArt tribe={g.player.tribe} i={i} /></span> <b>{u.name}</b><br /><small className="muted">⏱ {fmtDur(trainTime(g, c, i))}</small></td>
                <td>{u.atk}{u.archer && <small className="muted" title="Yanında yakın dövüş askeri varsa 2 kat etkili"> ×2</small>}</td>
                <td>{u.defInf}</td>
                <td>{u.defCav}</td>
                <td>{u.spd}</td>
                <td>{u.carry}</td>
                <td><Cost c={unitCost(g.player.tribe, i)} have={g.player.res} /></td>
                <td>{fmt(c.army[i])}</td>
                <td className="train-in">
                  <input inputMode="numeric" value={v} placeholder="0" onChange={(e) => setCounts({ ...counts, [i]: e.target.value.replace(/\D/g, '') })} aria-label={`${u.name} sayısı`} />
                  <button className="link" onClick={() => setCounts({ ...counts, [i]: String(max) })}>({fmt(max)})</button>
                  <button
                    className="btn-gold"
                    disabled={!Number(v)}
                    onClick={() => {
                      if (!act((g, n) => train(g, c.id, i, Number(v), n))) setCounts({ ...counts, [i]: '' })
                    }}
                  >
                    Eğit
                  </button>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
      {jobs.length > 0 && (
        <div className="train-queue">
          {jobs.map((j, k) => (
            <div key={k} className="queue-row">
              <span>{units[j.unit].icon} {units[j.unit].name} {j.done}/{j.count}</span>
              <b className="timer">{fmtDur(j.start + j.count * j.each - now)}</b>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

function Market() {
  const { g, act, cityId } = useG()
  const c = cityById(g, cityId)
  const [from, setFrom] = useState<ResKey>('altin')
  const [to, setTo] = useState<ResKey>('tas')
  const [amount, setAmount] = useState('')
  const rate = marketRate(c.b.pazar)
  const value = (k: ResKey) => (k === 'altin' ? 4 : k === 'at' ? 25 : 1)
  const got = Math.floor((Number(amount || 0) * value(from) * rate) / value(to))

  return (
    <section className="stone market">
      <div className="merchant">
        <span className="merchant-face">🧔🏻</span>
        <p>“Hoş geldin Han! Altınını, atını ya da fazla kaynağını getir; karşılığını veririm. Bugünkü oranım %{Math.round(rate * 100)}.”</p>
      </div>
      <div className="seg">
        <button className={from === 'altin' ? 'active' : ''} onClick={() => setFrom('altin')}>🪙 Altın Sat</button>
        <button className={from === 'at' ? 'active' : ''} onClick={() => setFrom('at')}>🐴 At Sat</button>
        <button className={from !== 'altin' && from !== 'at' ? 'active' : ''} onClick={() => setFrom('tas')}>⚖️ Takas</button>
      </div>
      <div className="trade">
        <label>
          Ver
          <select value={from} onChange={(e) => setFrom(e.target.value as ResKey)}>
            {RES_KEYS.map((k) => <option key={k} value={k}>{RES_INFO[k].name} ({fmt(g.player.res[k])})</option>)}
          </select>
        </label>
        <input inputMode="numeric" value={amount} placeholder="miktar" onChange={(e) => setAmount(e.target.value.replace(/\D/g, ''))} aria-label="Miktar" />
        <button className="link" onClick={() => setAmount(String(Math.floor(g.player.res[from])))}>hepsi</button>
        <label>
          Al
          <select value={to} onChange={(e) => setTo(e.target.value as ResKey)}>
            {RES_KEYS.filter((k) => k !== from).map((k) => <option key={k} value={k}>{RES_INFO[k].name}</option>)}
          </select>
        </label>
        <span className="got">= {RES_INFO[to].icon} {fmt(got)}</span>
        <button
          className="btn-gold"
          disabled={!got || from === to}
          onClick={() => {
            if (!act((g) => trade(g, c.id, from, to, Number(amount)))) setAmount('')
          }}
        >
          Takas et
        </button>
      </div>
    </section>
  )
}
