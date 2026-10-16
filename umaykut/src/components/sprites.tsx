import type { MineType } from '../game/data'

// Harita ve şehir için elle çizilmiş basit SVG grafikler.

const Tree = ({ x, y, s = 1 }: { x: number; y: number; s?: number }) => (
  <g transform={`translate(${x} ${y}) scale(${s})`}>
    <ellipse cx="0" cy="9" rx="7" ry="2.5" fill="rgba(0,0,0,.25)" />
    <rect x="-1.4" y="2" width="2.8" height="7" fill="#5b3a1c" />
    <circle cx="0" cy="-2" r="7.5" fill="#2c5e22" />
    <circle cx="-3" cy="-4" r="4.5" fill="#3d7c2e" />
    <circle cx="2.5" cy="-6" r="3" fill="#4f9539" />
  </g>
)

export function Forest() {
  return (
    <svg viewBox="0 0 64 64">
      <Tree x={20} y={26} s={0.9} />
      <Tree x={40} y={20} />
      <Tree x={48} y={38} s={0.95} />
      <Tree x={16} y={44} s={1.05} />
      <Tree x={32} y={42} s={1.15} />
    </svg>
  )
}

export function Quarry() {
  return (
    <svg viewBox="0 0 64 64">
      <ellipse cx="32" cy="48" rx="25" ry="7" fill="rgba(0,0,0,.25)" />
      <path d="M8 46 L14 30 L26 24 L34 32 L30 46 Z" fill="#8f8b84" />
      <path d="M14 30 L26 24 L22 34 Z" fill="#b5b1a9" />
      <path d="M28 46 L32 28 L44 18 L54 30 L56 46 Z" fill="#7c7871" />
      <path d="M32 28 L44 18 L42 30 Z" fill="#aaa69f" />
      <path d="M44 18 L54 30 L48 32 Z" fill="#605d58" />
      <path d="M20 50 L24 42 L34 40 L38 50 Z" fill="#9b978f" />
      <path d="M24 42 L34 40 L30 45 Z" fill="#c4c0b8" />
    </svg>
  )
}

export function Wheat() {
  return (
    <svg viewBox="0 0 64 64">
      <path d="M6 40 L28 16 L58 28 L36 54 Z" fill="#c9a23c" stroke="#8a6a1e" strokeWidth="1.2" />
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <path key={i} d={`M${10 + i * 4.4} ${36 - i * 4} L${40 + i * 3.6} ${49 - i * 4.2}`} stroke="#e6c35a" strokeWidth="1.6" />
      ))}
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <path key={'d' + i} d={`M${12 + i * 4.4} ${38 - i * 4} L${42 + i * 3.6} ${51 - i * 4.2}`} stroke="#a8831f" strokeWidth="0.8" />
      ))}
    </svg>
  )
}

export function Iron() {
  return (
    <svg viewBox="0 0 64 64">
      <ellipse cx="32" cy="48" rx="24" ry="7" fill="rgba(0,0,0,.28)" />
      <path d="M10 48 L16 30 L30 22 L40 30 L36 48 Z" fill="#45444c" />
      <path d="M16 30 L30 22 L26 34 Z" fill="#62616b" />
      <path d="M32 48 L38 26 L50 22 L56 36 L54 48 Z" fill="#3a3940" />
      <path d="M38 26 L50 22 L46 32 Z" fill="#5a5962" />
      <path d="M18 40 L24 34 M22 44 L30 36 M42 40 L48 32 M44 46 L52 38" stroke="#d26b2c" strokeWidth="2" strokeLinecap="round" />
      <path d="M26 30 L30 28 M46 28 L48 27" stroke="#f0a050" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  )
}

export function MineSprite({ type }: { type: MineType }) {
  if (type === 'odun') return <Forest />
  if (type === 'tas') return <Quarry />
  if (type === 'tahil') return <Wheat />
  return <Iron />
}

export function Bush({ v }: { v: number }) {
  return (
    <svg viewBox="0 0 64 64">
      {v === 1 ? (
        <g>
          <circle cx="28" cy="36" r="5" fill="#4d7d2a" />
          <circle cx="34" cy="34" r="6" fill="#5c8f31" />
          <circle cx="31" cy="31" r="3.5" fill="#6ea43b" />
        </g>
      ) : (
        <g>
          <circle cx="24" cy="30" r="1.8" fill="#e8e3a0" />
          <circle cx="30" cy="34" r="1.6" fill="#f0c0d0" />
          <circle cx="36" cy="29" r="1.8" fill="#e8e3a0" />
          <circle cx="40" cy="35" r="1.5" fill="#fff" />
        </g>
      )}
    </svg>
  )
}

/** keçe çadır (yurt) */
export function Yurt({ color = '#b3312a', trim = '#f1e2c0', x = 32, y = 46, s = 1 }: { color?: string; trim?: string; x?: number; y?: number; s?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <ellipse cx="0" cy="2" rx="22" ry="5" fill="rgba(0,0,0,.3)" />
      <path d="M-20 0 L-20 -12 Q0 -36 20 -12 L20 0 Z" fill={color} stroke="#3a120c" strokeWidth="1.2" />
      <path d="M-20 -12 Q0 -36 20 -12" fill="none" stroke={trim} strokeWidth="2" />
      <path d="M-20 -6 H20" stroke={trim} strokeWidth="1.6" />
      <path d="M-14 -20 L-10 -6 M14 -20 L10 -6 M0 -24 L0 -12" stroke="rgba(0,0,0,.2)" strokeWidth="1.2" />
      <rect x="-5" y="-11" width="10" height="11" rx="1.5" fill="#5a2a14" stroke={trim} strokeWidth="1" />
      <circle cx="0" cy="-27" r="2.6" fill={trim} />
    </g>
  )
}

export function CitySprite({ size, mine }: { size: number; mine?: boolean }) {
  const color = mine ? '#c23b2c' : '#a92d25'
  return (
    <svg viewBox="0 0 64 64">
      {size >= 3 && <Yurt x={14} y={40} s={0.55} color={color} />}
      {size >= 2 && <Yurt x={50} y={42} s={0.6} color={color} />}
      <Yurt x={32} y={50} s={size >= 3 ? 0.95 : 0.85} color={color} />
      {size >= 3 && (
        <g>
          <rect x="48" y="12" width="1.6" height="20" fill="#3a2410" />
          <path d="M49.6 12 L60 15 L49.6 19 Z" fill={mine ? '#3fd06b' : '#d8b25a'} />
        </g>
      )}
    </svg>
  )
}

export function Shield({ color }: { color: string }) {
  return (
    <svg viewBox="0 0 32 32">
      <path d="M5 3 H27 V14 Q27 24 16 30 Q5 24 5 14 Z" fill={color} stroke="#1e1208" strokeWidth="2" />
      <path d="M9 7 H23 V14 Q23 21 16 25" fill="none" stroke="rgba(255,255,255,.45)" strokeWidth="1.6" />
    </svg>
  )
}

/** şehir içi bina: rengi ve süsü binaya göre değişen çadır */
export function BuildingSprite({ color, roof, big, empty }: { color: string; roof: string; big?: boolean; empty?: boolean }) {
  if (empty) {
    return (
      <svg viewBox="0 0 64 64">
        <ellipse cx="32" cy="44" rx="22" ry="9" fill="rgba(70,45,20,.45)" stroke="#d8b25a" strokeWidth="1.4" strokeDasharray="4 3" />
        <path d="M32 36 V52 M24 44 H40" stroke="#f1d58a" strokeWidth="3" strokeLinecap="round" />
      </svg>
    )
  }
  return (
    <svg viewBox="0 0 64 64">
      <Yurt x={32} y={54} s={big ? 1.25 : 1} color={color} trim={roof} />
      {big && (
        <g>
          <rect x="31" y="2" width="2" height="16" fill="#3a2410" />
          <path d="M33 2 L46 6 L33 10 Z" fill="#d8b25a" />
        </g>
      )}
    </svg>
  )
}

export function Logo({ small }: { small?: boolean }) {
  return (
    <div className={`logo-banner ${small ? '' : 'big'}`}>
      <span className="logo-text">UMAYKUT</span>
      <span className="logo-orn" />
    </div>
  )
}
