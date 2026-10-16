import { useEffect, useRef, useState } from 'react'
import { TRIBES } from '../game/data'
import { allianceOf } from '../game/engine'
import { acceptInvite, playerDm, thread } from '../game/social'
import { useG } from '../ctx'
import { fmtAgo, fmtClock } from '../format'
import { Window } from './ui'

const TOPIC_LABEL: Record<string, string> = {
  invite: '🐺 Birlik daveti', peace: '🤝 Barış', threat: '⚔️ Tehdit', beg: '🙏 Rica', greet: '👋', support: '🛡️ Birlik', chat: '', traitor: '💢 Hain',
}

export default function Messages({ openId }: { openId?: number }) {
  const { g, now, act, open } = useG()
  const [sel, setSel] = useState<number | null>(openId ?? g.dms[0]?.botId ?? null)
  const [text, setText] = useState('')
  const box = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (openId !== undefined) {
      act((g) => void thread(g, openId))
      setSel(openId)
    }
  }, [openId]) // eslint-disable-line react-hooks/exhaustive-deps

  const t = sel !== null ? g.dms.find((x) => x.botId === sel) : undefined
  const b = sel !== null ? g.bots[sel] : null
  const typing = sel !== null && g.pending.some((m) => m.channel === 'dm' && m.from === sel && m.typeAt <= now && m.at > now)
  const lastMine = t ? [...t.msgs].reverse().find((m) => m.me) : undefined
  const seen = t && lastMine && t.seenAt && t.seenAt <= now && !t.msgs.some((m) => !m.me && m.time > lastMine.time)

  useEffect(() => {
    if (t && t.unread) act(() => { t.unread = 0 })
    const el = box.current
    if (el) el.scrollTop = el.scrollHeight
  }, [sel, t?.msgs.length, typing]) // eslint-disable-line react-hooks/exhaustive-deps

  const send = () => {
    if (sel === null || !text.trim()) return
    act((g, n) => {
      thread(g, sel)
      playerDm(g, sel, text, n)
    })
    setText('')
  }

  const list = g.dms.filter((x) => x.msgs.length || x.botId === sel)
  const invite = t?.invite ? allianceOf(g, t.invite) : null

  return (
    <Window title="Mesajlar" wide>
    <div className="dm-layout">
      <section className="panel dm-list">
        <h3>✉️ Mesajlar</h3>
        {list.length === 0 && <p className="muted small">Henüz mesaj yok. Bir oyuncunun profilinden “Mesaj yaz” diyebilirsin.</p>}
        {list.map((x) => {
          const bb = g.bots[x.botId]
          const last = x.msgs[x.msgs.length - 1]
          return (
            <button key={x.botId} className={`dm-row ${x.botId === sel ? 'active' : ''}`} onClick={() => setSel(x.botId)}>
              <span className="avatar sm" style={{ background: TRIBES[bb.tribe].color }}>{TRIBES[bb.tribe].emblem}</span>
              <span className="dm-meta">
                <b>{bb.name}</b> {bb.online && <span className="online">●</span>} {x.unread > 0 && <b className="badge">{x.unread}</b>}
                <small className="muted ellipsis">{last ? (last.me ? 'Sen: ' : '') + last.text : '—'}</small>
              </span>
              <small className="muted">{TOPIC_LABEL[x.topic]}</small>
            </button>
          )
        })}
      </section>
      <section className="panel dm-thread">
        {!b || !t ? (
          <p className="muted">Bir konuşma seç.</p>
        ) : (
          <>
            <div className="dm-head">
              <button className="link name" style={{ color: TRIBES[b.tribe].color }} onClick={() => open({ w: 'oyuncu', id: b.id })}>{b.name}</button>
              <small className="muted">
                {b.online ? <span className="online">● çevrimiçi</span> : `son görülme ${fmtAgo(b.lastSeen ?? now, now)}`}
                {t.peaceUntil > now && ' · 🤝 barış var'}
              </small>
            </div>
            <div className="chat-box dm-box" ref={box}>
              {t.msgs.map((m) => (
                <div key={m.id} className={`bubble ${m.me ? 'mine' : ''}`}>
                  {m.text}
                  <small className="muted"> {fmtClock(m.time)}</small>
                </div>
              ))}
              {seen && <small className="muted seen">Görüldü ✓✓</small>}
              {typing && <div className="bubble typing"><i>{b.name} yazıyor</i><span className="dots"><b>.</b><b>.</b><b>.</b></span></div>}
            </div>
            {invite && !g.player.allianceId && (
              <div className="invite-box">
                <span>🐺 <b>[{invite.tag}] {invite.name}</b> seni birliğe davet ediyor.</span>
                <button className="btn-gold" onClick={() => act((g, n) => acceptInvite(g, b.id, n))}>Daveti kabul et</button>
              </div>
            )}
            <div className="chat-input">
              <input
                value={text}
                maxLength={300}
                placeholder={`${b.name} kişisine yaz…`}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && send()}
              />
              <button className="btn-gold" onClick={send}>Gönder</button>
            </div>
          </>
        )}
      </section>
    </div>
    </Window>
  )
}
