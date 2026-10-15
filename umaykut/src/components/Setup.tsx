import { useState } from 'react'
import { TRIBE_IDS, TRIBES, TribeId, UNITS } from '../game/data'
import { generateWorld, BOT_COUNT } from '../game/world'
import type { Game } from '../game/engine'

const SPEEDS = [
  { v: 1, label: 'Normal', desc: 'Klasik tempo, günlerce süren bir dünya' },
  { v: 3, label: 'Hızlı', desc: '3 kat hızlı üretim, inşaat ve yürüyüş' },
  { v: 10, label: 'Yıldırım', desc: '10 kat hız, bir akşamda Umaykut yarışı' },
]

export default function Setup({ onStart }: { onStart: (g: Game) => void }) {
  const [name, setName] = useState('')
  const [tribe, setTribe] = useState<TribeId>('gokturk')
  const [speed, setSpeed] = useState(3)
  const [loading, setLoading] = useState(false)
  const valid = name.trim().length >= 3 && name.trim().length <= 18

  const start = () => {
    if (!valid) return
    setLoading(true)
    setTimeout(() => onStart(generateWorld(name.trim(), tribe, speed)), 50)
  }

  return (
    <div className="setup">
      <header className="setup-hero">
        <div className="logo">UMAYKUT</div>
        <p>Türk tarihinin bozkırlarında obanı kur, ordunu topla, boyunla birlikte Umaykut’u dik.</p>
        <p className="muted">Altay dünyası · {BOT_COUNT.toLocaleString('tr-TR')} oyuncu · 40 boy</p>
      </header>

      <section className="panel">
        <h3>Bey adın</h3>
        <input value={name} maxLength={18} placeholder="ör. KaraTuğrul" onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && start()} />
      </section>

      <section className="panel">
        <h3>Halkını seç</h3>
        <div className="tribe-grid">
          {TRIBE_IDS.map((t) => (
            <button key={t} className={`tribe-card ${tribe === t ? 'selected' : ''}`} style={{ ['--tc' as string]: TRIBES[t].color }} onClick={() => setTribe(t)}>
              <div className="tribe-emblem">{TRIBES[t].emblem}</div>
              <b>{TRIBES[t].name}</b>
              <small>{TRIBES[t].desc}</small>
              <span className="bonus">✦ {TRIBES[t].bonus}</span>
              <span className="units">{UNITS[t].map((u) => u.icon + ' ' + u.name).join(' · ')}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="panel">
        <h3>Dünya hızı</h3>
        <div className="speed-row">
          {SPEEDS.map((s) => (
            <button key={s.v} className={`speed ${speed === s.v ? 'selected' : ''}`} onClick={() => setSpeed(s.v)}>
              <b>{s.label} ×{s.v}</b>
              <small>{s.desc}</small>
            </button>
          ))}
        </div>
      </section>

      <button className="primary big" disabled={!valid || loading} onClick={start}>
        {loading ? 'Dünya oluşturuluyor…' : 'Dünyaya katıl'}
      </button>
      <p className="muted small">Oyun tarayıcında kaydedilir. Sekmeyi kapatsan da köyün üretmeye, diğer oyuncular büyümeye devam eder.</p>
    </div>
  )
}
