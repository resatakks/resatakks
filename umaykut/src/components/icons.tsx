import type { ReactNode } from 'react'

// Arayüz madalyon/olay ikonları: orijinal oyundaki metal-gravür ikonların SVG yorumu.

type P = { arrow?: 'red' | 'green' | 'yellow' }

const ARROW = { red: '#e0402a', green: '#5cc23a', yellow: '#f0c030' }

function Arrow({ c }: { c: keyof typeof ARROW }) {
  return <path d="M30 26 h-8 v-4 l-8 7 8 7 v-4 h8 z" fill={ARROW[c]} stroke="#1a0d05" strokeWidth="1.2" strokeLinejoin="round" />
}

const Defs = () => (
  <defs>
    <linearGradient id="ic-steel" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stopColor="#f4f4f4" />
      <stop offset=".5" stopColor="#a9adb3" />
      <stop offset="1" stopColor="#5d6168" />
    </linearGradient>
    <linearGradient id="ic-gold" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stopColor="#ffe08a" />
      <stop offset="1" stopColor="#a8701c" />
    </linearGradient>
    <linearGradient id="ic-wood" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stopColor="#c98a4a" />
      <stop offset="1" stopColor="#6a3c16" />
    </linearGradient>
  </defs>
)

export function SwordIcon({ arrow }: P) {
  return (
    <svg viewBox="0 0 40 40">
      <Defs />
      <path d="M31 5 L34 8 L14 28 L11 25 Z" fill="url(#ic-steel)" stroke="#2a2a2a" strokeWidth="1" />
      <path d="M9 22 L18 31 L16 33 L7 24 Z" fill="url(#ic-gold)" stroke="#3a2208" strokeWidth="1" />
      <path d="M11 29 L5 35" stroke="#5a3214" strokeWidth="3.5" strokeLinecap="round" />
      <circle cx="4.5" cy="35.5" r="2" fill="url(#ic-gold)" />
      {arrow && <Arrow c={arrow} />}
    </svg>
  )
}

export function HelmetIcon({ arrow }: P) {
  return (
    <svg viewBox="0 0 40 40">
      <Defs />
      <path d="M20 3 L22 8 Q32 10 32 24 L32 30 L26 30 L26 22 L14 22 L14 30 L8 30 L8 24 Q8 10 18 8 Z" fill="url(#ic-steel)" stroke="#222" strokeWidth="1.2" />
      <path d="M8 24 H32" stroke="url(#ic-gold)" strokeWidth="2.4" />
      <path d="M20 8 V22" stroke="#555" strokeWidth="1.4" />
      <path d="M8 30 Q6 35 10 36 M32 30 Q34 35 30 36" stroke="#8a6a3a" strokeWidth="2" fill="none" />
      {arrow && <Arrow c={arrow} />}
    </svg>
  )
}

export function ScrollIcon({ arrow }: P) {
  return (
    <svg viewBox="0 0 40 40">
      <Defs />
      <path d="M8 10 L26 6 L32 28 L14 32 Z" fill="#e8cf95" stroke="#5a3a14" strokeWidth="1.2" />
      <path d="M12 14 L26 11 M13 18 L27 15 M14 22 L28 19" stroke="#8a6a3a" strokeWidth="1" />
      <ellipse cx="8.5" cy="10" rx="3" ry="4" transform="rotate(-13 8.5 10)" fill="url(#ic-wood)" stroke="#3a2208" />
      <ellipse cx="14.5" cy="32" rx="3" ry="4" transform="rotate(-13 14.5 32)" fill="url(#ic-wood)" stroke="#3a2208" />
      {arrow && <Arrow c={arrow} />}
    </svg>
  )
}

export function QuillIcon() {
  return (
    <svg viewBox="0 0 40 40">
      <Defs />
      <path d="M6 8 H28 V34 H6 Z" fill="#e8cf95" stroke="#5a3a14" strokeWidth="1.2" />
      <path d="M10 14 H24 M10 18 H24 M10 22 H20" stroke="#8a6a3a" strokeWidth="1" />
      <path d="M36 4 Q22 10 18 30 L20 31 Q28 16 36 4 Z" fill="#f6f2ea" stroke="#444" strokeWidth="1" />
      <path d="M18 30 L16 36" stroke="#222" strokeWidth="1.6" />
    </svg>
  )
}

export function MapIcon() {
  return (
    <svg viewBox="0 0 40 40">
      <Defs />
      <path d="M5 9 L14 6 L26 10 L35 7 V31 L26 34 L14 30 L5 33 Z" fill="#e2c88c" stroke="#4a2e10" strokeWidth="1.3" strokeLinejoin="round" />
      <path d="M14 6 V30 M26 10 V34" stroke="#9a7a44" strokeWidth="1" />
      <path d="M9 24 Q16 14 22 20 T32 14" stroke="#b03a20" strokeWidth="1.6" fill="none" strokeDasharray="2 2" />
      <path d="M30 12 l3 3 m0 -3 l-3 3" stroke="#b03a20" strokeWidth="1.6" />
    </svg>
  )
}

export function YurtIcon() {
  return (
    <svg viewBox="0 0 40 40">
      <Defs />
      <path d="M5 30 V22 Q20 4 35 22 V30 Z" fill="#efe3c2" stroke="#3a2208" strokeWidth="1.3" />
      <path d="M5 22 Q20 4 35 22" fill="none" stroke="#b0321f" strokeWidth="2.2" />
      <rect x="16" y="21" width="8" height="9" fill="#7a3a16" stroke="#3a2208" />
      <path d="M20 9 V2 L27 4 L20 6" fill="#d0301e" stroke="#3a2208" strokeWidth=".8" />
    </svg>
  )
}

export function BannerIcon() {
  return (
    <svg viewBox="0 0 40 40">
      <Defs />
      <path d="M10 3 V37" stroke="url(#ic-wood)" strokeWidth="3" />
      <path d="M11 6 H32 L27 13 L32 20 H11 Z" fill="#a8261a" stroke="#3a0a04" strokeWidth="1.2" />
      <path d="M16 13 Q20 8 25 12 Q21 14 22 17" stroke="url(#ic-gold)" strokeWidth="1.8" fill="none" />
      <circle cx="10" cy="3" r="2.4" fill="url(#ic-gold)" />
    </svg>
  )
}

export function CrownIcon() {
  return (
    <svg viewBox="0 0 40 40">
      <Defs />
      <path d="M6 30 L4 12 L13 20 L20 8 L27 20 L36 12 L34 30 Z" fill="url(#ic-gold)" stroke="#4a2c06" strokeWidth="1.3" strokeLinejoin="round" />
      <rect x="6" y="30" width="28" height="5" rx="1" fill="url(#ic-gold)" stroke="#4a2c06" />
      <circle cx="20" cy="24" r="2.4" fill="#c0281e" />
      <circle cx="12" cy="26" r="1.6" fill="#2a7ad0" />
      <circle cx="28" cy="26" r="1.6" fill="#2a7ad0" />
    </svg>
  )
}

export function LensIcon() {
  return (
    <svg viewBox="0 0 40 40">
      <Defs />
      <circle cx="17" cy="17" r="10" fill="rgba(180,220,255,.35)" stroke="url(#ic-gold)" strokeWidth="3.4" />
      <path d="M24 24 L35 35" stroke="url(#ic-wood)" strokeWidth="5" strokeLinecap="round" />
    </svg>
  )
}

export function CompassIcon() {
  return (
    <svg viewBox="0 0 40 40">
      <Defs />
      <circle cx="20" cy="20" r="15" fill="#e8d6a8" stroke="url(#ic-gold)" strokeWidth="3" />
      <path d="M20 7 L24 20 L20 33 L16 20 Z" fill="#b0321f" />
      <path d="M20 20 L24 20 L20 33 L16 20 Z" fill="#555" />
      <circle cx="20" cy="20" r="2" fill="url(#ic-gold)" />
    </svg>
  )
}

export function GearIcon() {
  return (
    <svg viewBox="0 0 40 40">
      <Defs />
      <path
        d="M17 4 h6 l1 5 4 2 4-3 4 4-3 4 2 4 5 1 v6 l-5 1-2 4 3 4-4 4-4-3-4 2-1 5 h-6 l-1-5-4-2-4 3-4-4 3-4-2-4-5-1 v-6 l5-1 2-4-3-4 4-4 4 3 4-2 z"
        fill="url(#ic-steel)"
        stroke="#2a2a2a"
        strokeWidth="1"
        transform="scale(.9) translate(2 2)"
      />
      <circle cx="20" cy="20" r="5" fill="#3a3a3a" />
    </svg>
  )
}

export function SacksIcon() {
  return (
    <svg viewBox="0 0 40 40">
      <Defs />
      <path d="M6 34 Q3 22 11 18 L9 13 H19 L17 18 Q25 22 22 34 Z" fill="#d8bf86" stroke="#5a3a14" strokeWidth="1.2" />
      <path d="M18 35 Q15 24 23 20 L21 15 H31 L29 20 Q37 24 34 35 Z" fill="#c9ab6c" stroke="#5a3a14" strokeWidth="1.2" />
      <path d="M9 13 H19 M21 15 H31" stroke="#8a2a14" strokeWidth="2" />
    </svg>
  )
}

export function Portrait({ tribe }: { tribe: string }) {
  const beard = tribe === 'selcuklu' ? '#3a2412' : '#5a3a1c'
  return (
    <svg viewBox="0 0 40 40">
      <circle cx="20" cy="20" r="19" fill="#4a3a2a" />
      <path d="M8 40 Q8 28 20 28 Q32 28 32 40 Z" fill="#7a3a1a" />
      <ellipse cx="20" cy="20" rx="8" ry="9.5" fill="#d9a77a" />
      <path d="M12 22 Q13 33 20 33 Q27 33 28 22 Q25 28 20 28 Q15 28 12 22 Z" fill={beard} />
      <path d="M10 15 Q12 4 20 4 Q28 4 30 15 L27 13 Q20 9 13 13 Z" fill="#8a6a3a" stroke="#3a2410" strokeWidth=".8" />
      <path d="M20 2 V6" stroke="#c0281e" strokeWidth="2" />
      <circle cx="17" cy="19" r="1" fill="#2a1a0a" />
      <circle cx="23" cy="19" r="1" fill="#2a1a0a" />
    </svg>
  )
}

// ---------------- asker portreleri (alt şerit / eğitim) ----------------
const TINT: Record<string, { coat: string; trim: string; helm: string }> = {
  hun: { coat: '#7a4a24', trim: '#c89a4a', helm: '#6a6a70' },
  gokturk: { coat: '#3a5a7a', trim: '#d8b860', helm: '#8a8e96' },
  selcuklu: { coat: '#8a2a1e', trim: '#e0c070', helm: '#9a9aa2' },
}

function Footman({ t, cloak, children }: { t: (typeof TINT)[string]; cloak?: boolean; children?: ReactNode }) {
  return (
    <g>
      <path d="M19 44 L21 34 M29 44 L27 34" stroke="#2a1a0c" strokeWidth="3" strokeLinecap="round" />
      <path d="M16 23 Q24 19 32 23 L33 37 L15 37 Z" fill={cloak ? '#2e3a24' : t.coat} stroke="#1a0e04" strokeWidth=".8" />
      {!cloak && <path d="M15.5 30 H32.5" stroke={t.trim} strokeWidth="2" />}
      <circle cx="24" cy="15" r="4.6" fill="#d4a070" />
      {cloak ? (
        <path d="M18 18 Q17 6 24 6 Q31 6 30 18 Q27 12 24 12 Q21 12 18 18 Z" fill="#26301c" />
      ) : (
        <>
          <path d="M19 14 Q24 2 29 14 Z" fill={t.helm} stroke="#222" strokeWidth=".7" />
          <path d="M24 5 V1.5" stroke="#b02818" strokeWidth="1.6" />
        </>
      )}
      {children}
    </g>
  )
}

function Horse({ t, armored }: { t: (typeof TINT)[string]; armored?: boolean }) {
  return (
    <g>
      <path d="M13 36 L11 46 M17 37 L17 46 M31 37 L32 46 M35 36 L38 45" stroke="#2a1608" strokeWidth="2.6" strokeLinecap="round" />
      <ellipse cx="24" cy="33" rx="14" ry="6.5" fill={armored ? t.coat : '#6a3a18'} stroke="#1a0c02" strokeWidth=".8" />
      <path d="M12 31 Q6 24 6 18 L10 16 Q13 23 16 28 Z" fill={armored ? t.coat : '#6a3a18'} stroke="#1a0c02" strokeWidth=".8" />
      <path d="M5 17 l5 -3 l1 4 Z" fill="#4a2a10" />
      <path d="M37 31 Q44 33 43 42" stroke="#2a1608" strokeWidth="2.4" fill="none" />
      {armored && <path d="M12 36 H36" stroke={t.trim} strokeWidth="1.6" />}
    </g>
  )
}

function Rider({ t, children }: { t: (typeof TINT)[string]; children?: ReactNode }) {
  return (
    <g>
      <path d="M20 21 Q25 18 30 21 L30 30 L20 30 Z" fill={t.coat} stroke="#1a0e04" strokeWidth=".8" />
      <path d="M24 30 L22 36" stroke="#2a1a0c" strokeWidth="2.6" />
      <circle cx="25" cy="15" r="4" fill="#d4a070" />
      <path d="M20.6 14 Q25 3.5 29.4 14 Z" fill={t.helm} stroke="#222" strokeWidth=".7" />
      {children}
    </g>
  )
}

const Bow = ({ x = 34 }: { x?: number }) => (
  <g>
    <path d={`M${x} 8 Q${x + 9} 22 ${x} 36`} stroke="#6a3a12" strokeWidth="2.2" fill="none" />
    <path d={`M${x} 8 L${x - 3} 22 L${x} 36`} stroke="#e8e0c8" strokeWidth=".7" fill="none" />
  </g>
)
const Spear = ({ x1 = 34, y1 = 44, x2 = 37, y2 = 4 }: { x1?: number; y1?: number; x2?: number; y2?: number }) => (
  <g>
    <path d={`M${x1} ${y1} L${x2} ${y2}`} stroke="#6a4420" strokeWidth="1.8" />
    <path d={`M${x2} ${y2 - 4} l2 6 h-4 Z`} fill="#c8ccd2" />
  </g>
)

export function UnitPortrait({ tribe, i }: { tribe: string; i: number }) {
  const t = TINT[tribe] ?? TINT.hun
  const fig = (() => {
    switch (i) {
      case 0:
        return (
          <Footman t={t}>
            <Spear />
            <circle cx="15" cy="28" r="7" fill={t.trim} stroke="#3a2208" strokeWidth="1.2" />
            <circle cx="15" cy="28" r="2" fill="#6a4a1a" />
          </Footman>
        )
      case 1:
        return (
          <Footman t={t}>
            <path d="M31 27 L41 7" stroke="#d8dce2" strokeWidth="2.4" strokeLinecap="round" />
            <path d="M29 26 l5 3" stroke={t.trim} strokeWidth="2" />
          </Footman>
        )
      case 2:
        return <Footman t={t}><Bow /></Footman>
      case 3:
        return (
          <Footman t={t}>
            <Bow />
            <path d="M16 25 H32 M16 28 H32 M16 33 H33" stroke="#9a9ea6" strokeWidth="1" />
            <rect x="10" y="22" width="5" height="14" rx="1" fill="#6a4420" />
          </Footman>
        )
      case 4:
        return (
          <Footman t={t} cloak>
            <path d="M31 30 L36 24" stroke="#d8dce2" strokeWidth="1.8" />
          </Footman>
        )
      case 5:
        return (
          <g>
            <Horse t={t} />
            <Rider t={t}><Spear x1={18} y1={34} x2={8} y2={6} /></Rider>
          </g>
        )
      case 6:
        return (
          <g>
            <Horse t={t} />
            <Rider t={t}><Bow x={33} /></Rider>
          </g>
        )
      case 7:
        return (
          <g>
            <Horse t={t} armored />
            <Rider t={t}>
              <Spear x1={30} y1={30} x2={44} y2={8} />
              <circle cx="20" cy="25" r="5" fill={t.trim} stroke="#3a2208" />
            </Rider>
          </g>
        )
      case 8:
        return (
          <g>
            <path d="M6 22 L24 10 L42 22 Z" fill="#7a5a30" stroke="#2a1a08" />
            <rect x="8" y="22" width="32" height="14" fill="#5a3e1e" stroke="#2a1a08" />
            <path d="M2 30 H40" stroke="#a8784a" strokeWidth="5" strokeLinecap="round" />
            <path d="M2 27 v6" stroke="#6a6a70" strokeWidth="3" />
            <circle cx="13" cy="39" r="4" fill="#3a2410" />
            <circle cx="35" cy="39" r="4" fill="#3a2410" />
          </g>
        )
      default:
        return (
          <g>
            <path d="M8 38 L40 38 M12 38 L22 24 L32 38" stroke="#6a4420" strokeWidth="3" fill="none" />
            <path d="M22 26 L38 6" stroke="#8a5a2a" strokeWidth="3" />
            <path d="M36 4 q6 0 4 6 Z" fill="#4a3018" />
            <circle cx="40" cy="5" r="3" fill="#8a8a8a" />
            <circle cx="12" cy="40" r="4" fill="#3a2410" />
            <circle cx="36" cy="40" r="4" fill="#3a2410" />
          </g>
        )
    }
  })()
  return (
    <svg viewBox="0 0 48 48">
      <defs>
        <linearGradient id="up-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#d6c08a" />
          <stop offset=".6" stopColor="#8a7448" />
          <stop offset="1" stopColor="#3a2e1a" />
        </linearGradient>
      </defs>
      <rect width="48" height="48" fill="url(#up-sky)" />
      <path d="M0 40 Q14 36 26 39 T48 38 V48 H0 Z" fill="#4a3c22" />
      {fig}
    </svg>
  )
}
