import type { ReactNode } from 'react'
import { RES_INFO, RES_KEYS, type Res } from '../game/data'
import { useG } from '../ctx'
import { fmt } from '../format'

export function Window({ title, children, wide, onClose }: { title: string; children: ReactNode; wide?: boolean; onClose?: () => void }) {
  const { close } = useG()
  const done = onClose ?? close
  return (
    <div className="win-bg" onPointerDown={(e) => e.target === e.currentTarget && done()}>
      <div className={`win ${wide ? 'wide' : ''}`} role="dialog" aria-label={title}>
        <div className="win-title">
          <span>{title}</span>
          <button className="win-x" onClick={done} aria-label="Kapat">✕</button>
        </div>
        <div className="win-body">{children}</div>
      </div>
    </div>
  )
}

/** kaynak bedeli; yetmeyen kalem kırmızı görünür */
export function Cost({ c, have }: { c: Res; have?: Res }) {
  return (
    <span className="cost">
      {RES_KEYS.filter((k) => c[k] > 0).map((k) => (
        <span key={k} className={have && have[k] < c[k] ? 'short' : ''} title={RES_INFO[k].name}>
          {RES_INFO[k].icon} {fmt(c[k])}
        </span>
      ))}
    </span>
  )
}

export function Tag({ tag, color }: { tag: string | null | undefined; color?: string }) {
  if (!tag) return null
  return (
    <b className="tag" style={{ color }}>
      {tag}
    </b>
  )
}
