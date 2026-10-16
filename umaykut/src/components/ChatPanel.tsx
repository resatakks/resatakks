import { useEffect, useRef, useState } from 'react'
import { TRIBES } from '../game/data'
import { sendChat } from '../game/engine'
import { useG } from '../ctx'
import { fmtAgo, fmtClock } from '../format'

export type Channel = 'world' | 'alliance' | 'feed'

export default function ChatPanel({ ch, setCh, onClose }: { ch: Channel; setCh: (c: Channel) => void; onClose: () => void }) {
  const { g, now, act, open } = useG()
  const [text, setText] = useState('')
  const box = useRef<HTMLDivElement>(null)
  const msgs = ch === 'feed' ? [] : g.chat[ch].filter((m) => m.time <= now)
  const last = msgs[msgs.length - 1]?.id
  const typers = ch === 'feed' ? [] : [...new Set(g.pending.filter((m) => m.channel === ch && m.typeAt <= now && m.at > now).map((m) => g.bots[m.from].name))]

  useEffect(() => {
    const el = box.current
    if (el) el.scrollTop = el.scrollHeight
  }, [last, ch, typers.length])

  const send = () => {
    if (!text.trim() || ch === 'feed') return
    act((g, n) => sendChat(g, ch, text, n))
    setText('')
  }

  return (
    <div className="chat-drawer panel">
      <button className="win-x" onClick={onClose} aria-label="Kapat">✕</button>
      <div className="seg">
        <button className={ch === 'world' ? 'active' : ''} onClick={() => setCh('world')}>🌍 Dünya</button>
        <button className={ch === 'alliance' ? 'active' : ''} onClick={() => setCh('alliance')} disabled={!g.player.allianceId}>🐺 Birlik</button>
        <button className={ch === 'feed' ? 'active' : ''} onClick={() => setCh('feed')}>📯 Olaylar</button>
      </div>
      {ch === 'feed' ? (
        <div className="chat-box feed">
          {g.feed.filter((f) => f.time <= now).map((f) => (
            <div key={f.id} className="feed-item">
              <span>{f.icon}</span> {f.text} <small className="muted">{fmtAgo(f.time, now)}</small>
            </div>
          ))}
        </div>
      ) : (
        <>
          <div className="chat-box" ref={box}>
            {msgs.map((m) => (
              <div key={m.id} className={`msg ${m.me ? 'mine' : ''} ${m.system ? 'system' : ''}`}>
                <small className="muted">{fmtClock(m.time)}</small>{' '}
                {!m.system && (
                  <button
                    className="link name"
                    style={{ color: m.tribe ? TRIBES[m.tribe].color : undefined }}
                    onClick={() => m.botId !== undefined && open({ w: 'oyuncu', id: m.botId })}
                  >
                    {m.from}:
                  </button>
                )}{' '}
                <span>{m.text}</span>
              </div>
            ))}
            {typers.length > 0 && (
              <div className="typing muted small">
                {typers.slice(0, 2).join(', ')}{typers.length > 2 ? ` ve ${typers.length - 2} kişi` : ''} yazıyor<span className="dots"><b>.</b><b>.</b><b>.</b></span>
              </div>
            )}
          </div>
          <div className="chat-input">
            <input
              value={text}
              maxLength={200}
              placeholder={ch === 'world' ? 'Dünyaya yaz…' : 'Birliğine yaz…'}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && send()}
            />
            <button className="btn-gold" onClick={send}>Gönder</button>
          </div>
        </>
      )}
    </div>
  )
}
