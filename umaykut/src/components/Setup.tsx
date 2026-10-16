import { useState } from 'react'
import { SERVERS, TRIBE_IDS, TRIBES, type TribeId, UNITS } from '../game/data'
import { generateWorld, BOT_COUNT } from '../game/world'
import type { Game } from '../game/engine'
import { Logo } from './sprites'

export default function Setup({ onStart }: { onStart: (g: Game) => void }) {
  const [name, setName] = useState('')
  const [tribe, setTribe] = useState<TribeId>('gokturk')
  const [server, setServer] = useState(SERVERS[0].id)
  const [loading, setLoading] = useState(false)
  const n = name.trim()
  const valid = n.length >= 3 && n.length <= 18

  const start = () => {
    if (!valid) return
    setLoading(true)
    setTimeout(() => onStart(generateWorld(n, tribe, server)), 50)
  }

  return (
    <div className="login">
      <div className="login-card">
        <Logo />
        <p className="tagline">SERÜVENİ YENİDEN CANLANIYOR</p>
        <p className="muted small">{BOT_COUNT.toLocaleString('tr-TR')} oyuncu · bozkırda yerini al, şehrini kur, birliğinle Umaykut’u dik.</p>

        <label className="field">
          <span>Han adın</span>
          <input value={name} maxLength={18} placeholder="ör. KaraTuğrul" onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && start()} />
        </label>

        <div className="field">
          <span>Sunucu</span>
          <div className="servers">
            {SERVERS.map((s) => (
              <button key={s.id} className={`server ${server === s.id ? 'selected' : ''}`} onClick={() => setServer(s.id)}>
                <b>{s.name}</b>
                <small>{s.desc}</small>
              </button>
            ))}
          </div>
        </div>

        <div className="field">
          <span>Devlet</span>
          <div className="tribes">
            {TRIBE_IDS.map((t) => (
              <button key={t} className={`tribe ${tribe === t ? 'selected' : ''}`} style={{ ['--tc' as string]: TRIBES[t].color }} onClick={() => setTribe(t)}>
                <span className="tribe-emblem">{TRIBES[t].emblem}</span>
                <b>{TRIBES[t].name}</b>
                <small>{TRIBES[t].desc}</small>
                <ul>{TRIBES[t].bonus.map((x) => <li key={x}>{x}</li>)}</ul>
                <span className="units">{UNITS[t].slice(0, 5).map((u) => u.icon).join(' ')}</span>
              </button>
            ))}
          </div>
        </div>

        <button className="btn-gold big" disabled={!valid || loading} onClick={start}>
          {loading ? 'Dünya hazırlanıyor…' : 'OYUNA GİRİŞ'}
        </button>
        <p className="muted small">Oyun tarayıcına kaydedilir. Sekmeyi kapatsan da şehrin üretmeye, diğer oyuncular büyümeye devam eder.</p>
      </div>
    </div>
  )
}
