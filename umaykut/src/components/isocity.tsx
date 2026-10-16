import { memo, type ReactNode } from 'react'
import type { BuildingId } from '../game/data'

// Son dönem (umaykutefsanesi, 2012–2014) şehir ekranı: çimenli izometrik arazi, taş döşeli yollarla
// ayrılmış 4×4 elmas parsel ızgarası, ortada altın kubbeli merkez, kenarlarda ağaçlar ve gölet.
// Bina çizimleri parsel merkezine (0,0) göre; zemin 2:1 izometrik.

export const SCENE_W = 1000
export const SCENE_H = 680
export const GRID = 4
const HW = 118
const HH = 59
const OX = 500
const OY = 96
const CY = OY + GRID * HH

/** ızgara köşesi (i,j) → sahne koordinatı */
export const P = (i: number, j: number): [number, number] => [OX + (i - j) * HW, OY + (i + j) * HH]
/** parsel merkezi */
export const lot = (i: number, j: number) => P(i + 0.5, j + 0.5)
const pts = (a: [number, number][]) => a.map((p) => p.join(',')).join(' ')
/** parsel elması (yol payı kadar içeride), merkeze göre */
export const lotPoly = (k = 0.78) => pts([[0, -HH * k], [HW * k, 0], [0, HH * k], [-HW * k, 0]])

function rng(seed: number) {
  let s = seed
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296
    return s / 4294967296
  }
}

const inDiamond = (x: number, y: number) => Math.abs(x - OX) / (GRID * HW) + Math.abs(y - CY) / (GRID * HH)

// ---------------- zemin ----------------
/** ortak gradyan/filtreler — harita da kullanır */
export function IsoDefs() {
  return (
  <defs>
    <filter id="iso-grain" x="0" y="0" width="1" height="1">
      <feTurbulence type="fractalNoise" baseFrequency=".75" numOctaves="2" seed="4" />
      <feColorMatrix values="0 0 0 0 .16  0 0 0 0 .21  0 0 0 0 .04  1.7 0 0 0 -.62" />
    </filter>
    <filter id="iso-patch" x="0" y="0" width="1" height="1">
      <feTurbulence type="fractalNoise" baseFrequency=".007" numOctaves="3" seed="9" />
      <feColorMatrix values="0 0 0 0 .78  0 0 0 0 .74  0 0 0 0 .36  2.4 0 0 0 -1.15" />
    </filter>
    <filter id="iso-dark" x="0" y="0" width="1" height="1">
      <feTurbulence type="fractalNoise" baseFrequency=".012" numOctaves="2" seed="21" />
      <feColorMatrix values="0 0 0 0 .2  0 0 0 0 .26  0 0 0 0 .08  2.6 0 0 0 -1.35" />
    </filter>
    <linearGradient id="iso-water" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stopColor="#7d8f8c" />
      <stop offset="1" stopColor="#4c5e5a" />
    </linearGradient>
    <radialGradient id="iso-gold" cx=".35" cy=".3" r=".8">
      <stop offset="0" stopColor="#fff2b0" />
      <stop offset=".45" stopColor="#e8b440" />
      <stop offset="1" stopColor="#8a5a10" />
    </radialGradient>
    <linearGradient id="iso-hay" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stopColor="#f2d264" />
      <stop offset="1" stopColor="#c8962c" />
    </linearGradient>
  </defs>
  )
}

export const Ground = memo(function Ground() {
  return (
    <g>
      <IsoDefs />
      <rect x="-400" y="-400" width="1800" height="1480" fill="#7a8838" />
      <rect x="-400" y="-400" width="1800" height="1480" filter="url(#iso-patch)" opacity=".55" />
      <rect x="-400" y="-400" width="1800" height="1480" filter="url(#iso-dark)" opacity=".7" />
      <rect x="-400" y="-400" width="1800" height="1480" filter="url(#iso-grain)" opacity=".55" />
      {/* gölet + bataklık (sağ üst) */}
      <path
        d="M770 70 Q800 30 870 34 Q950 30 990 70 Q1030 110 990 150 Q950 176 880 160 Q820 168 790 140 Q750 110 770 70 Z"
        fill="#5f6f4a"
        opacity=".7"
      />
      <path d="M790 78 Q820 46 880 50 Q945 48 972 82 Q995 114 960 138 Q920 156 870 144 Q820 150 802 126 Q776 104 790 78 Z" fill="url(#iso-water)" />
      <path d="M820 80 Q860 66 910 74 M840 112 Q880 104 930 114" stroke="rgba(255,255,255,.25)" strokeWidth="2" fill="none" />
      {[796, 812, 958, 970, 830, 940].map((x, i) => (
        <path key={i} d={`M${x} ${i < 2 ? 120 : i < 4 ? 112 : i === 4 ? 146 : 148} l-3 -12 m3 12 l2 -14 m-2 14 l6 -10`} stroke="#3e4a22" strokeWidth="1.6" fill="none" />
      ))}
      {/* toprak lekeleri */}
      <ellipse cx="160" cy="610" rx="70" ry="22" fill="#8a7a48" opacity=".35" />
      <ellipse cx="850" cy="600" rx="60" ry="18" fill="#8a7a48" opacity=".3" />
    </g>
  )
})

// ---------------- yollar ----------------
export const Roads = memo(function Roads() {
  const lines: string[] = []
  for (let k = 0; k <= GRID; k++) {
    lines.push(`M${pts([P(k, 0)])} L${pts([P(k, GRID)])}`)
    lines.push(`M${pts([P(0, k)])} L${pts([P(GRID, k)])}`)
  }
  const d = lines.join(' ')
  // parsel içleri: yol kenarında hafif açık çimen
  const lots: [number, number][] = []
  for (let i = 0; i < GRID; i++) for (let j = 0; j < GRID; j++) lots.push(lot(i, j))
  return (
    <g>
      {lots.map(([x, y], n) => (
        <polygon key={n} transform={`translate(${x} ${y})`} points={lotPoly(0.86)} fill="#8d9748" opacity=".55" />
      ))}
      <path d={d} stroke="rgba(30,30,10,.35)" strokeWidth="24" strokeLinecap="square" fill="none" transform="translate(2 3)" />
      <path d={d} stroke="#66645a" strokeWidth="21" strokeLinecap="square" fill="none" />
      <path d={d} stroke="#a29e90" strokeWidth="16" strokeLinecap="square" fill="none" />
      <path d={d} stroke="#8a8678" strokeWidth="16" strokeDasharray="3 6" fill="none" />
      <path d={d} stroke="#b8b4a6" strokeWidth="5" strokeDasharray="7 9" fill="none" opacity=".6" />
    </g>
  )
})

/** sur seviyesi > 0 ise ızgaranın çevresinde taş duvar */
export function CityWall({ lvl }: { lvl: number }) {
  if (lvl <= 0) return null
  const k = 1.075
  const ring = [P(0, 0), P(GRID, 0), P(GRID, GRID), P(0, GRID)].map(([x, y]) => [OX + (x - OX) * k, CY + (y - CY) * k] as [number, number])
  const h = 6 + Math.min(lvl, 20) * 0.5
  const d = 'M' + ring.map((p) => p.join(',')).join(' L') + ' Z'
  return (
    <g pointerEvents="none">
      <path d={d} stroke="#4a463c" strokeWidth="9" fill="none" />
      <path d={d} stroke="#8c8778" strokeWidth="7" fill="none" transform={`translate(0 ${-h})`} />
      <path d={d} stroke="#b4ae9c" strokeWidth="7" strokeDasharray="5 5" fill="none" transform={`translate(0 ${-h - 3})`} />
    </g>
  )
}

// ---------------- ağaçlar ----------------
const Leafy = ({ x, y, s, t }: { x: number; y: number; s: number; t: number }) => {
  const c = t > 0.5 ? ['#2e4a1c', '#3f6326', '#5f8436'] : ['#34481e', '#4a6428', '#73903e']
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <ellipse cx="10" cy="3" rx="20" ry="7" fill="rgba(20,30,0,.38)" />
      <path d="M-2 2 L-1.5 -16 L1.5 -16 L2 2 Z" fill="#4a3018" />
      <circle cx="-9" cy="-20" r="11" fill={c[0]} />
      <circle cx="9" cy="-21" r="11" fill={c[0]} />
      <circle cx="0" cy="-31" r="13" fill={c[1]} />
      <circle cx="-7" cy="-24" r="8" fill={c[1]} />
      <circle cx="-4" cy="-35" r="6" fill={c[2]} />
      <circle cx="-11" cy="-25" r="4" fill={c[2]} />
      <circle cx="6" cy="-28" r="4" fill={c[2]} opacity=".7" />
    </g>
  )
}

const Pine = ({ x, y, s }: { x: number; y: number; s: number }) => (
  <g transform={`translate(${x} ${y}) scale(${s})`}>
    <ellipse cx="8" cy="2" rx="13" ry="4.5" fill="rgba(20,30,0,.38)" />
    <rect x="-1.5" y="-6" width="3" height="8" fill="#4a2e14" />
    <path d="M0 -44 L10 -22 L5 -22 L13 -6 L-13 -6 L-5 -22 L-10 -22 Z" fill="#23401a" />
    <path d="M0 -44 L10 -22 L5 -22 L13 -6 L0 -6 Z" fill="#1a3212" />
    <path d="M0 -44 L-4 -30 L0 -32 Z" fill="#4a7a2c" />
  </g>
)

export const Trees = memo(function Trees({ front }: { front?: boolean }) {
  const r = rng(11)
  const t: { x: number; y: number; s: number; k: number }[] = []
  let guard = 0
  while (t.length < 330 && guard++ < 6000) {
    const x = -380 + r() * 1760
    const y = -260 + r() * 1180
    const d = inDiamond(x, y)
    if (d < 1.12) continue
    if (x > 760 && x < 1000 && y > 20 && y < 170) continue // gölet
    // merkeze yakın kenar seyrek, dışa doğru sık
    if (d < 1.5 && r() < 0.55) continue
    t.push({ x, y, s: 0.75 + r() * 0.55, k: r() })
  }
  t.sort((a, b) => a.y - b.y)
  const shown = t.filter((p) => (p.y > CY) === !!front)
  return (
    <g pointerEvents="none">
      {shown.map((p, i) => (p.k < 0.32 ? <Pine key={i} x={p.x} y={p.y} s={p.s} /> : <Leafy key={i} x={p.x} y={p.y} s={p.s} t={p.k} />))}
    </g>
  )
})

// ---------------- izometrik kutu yardımcıları ----------------
type Wall = { l: string; r: string; t: string }
const SAND: Wall = { l: '#c9ae74', r: '#9c814c', t: '#e2cc94' }
const STONE: Wall = { l: '#a8a294', r: '#7c776a', t: '#c4bfb0' }
const TIMBER: Wall = { l: '#9a6a3a', r: '#704a24', t: '#b88650' }
const WHITE: Wall = { l: '#e4dccb', r: '#b5ab95', t: '#f2ecdd' }

/** kare taban (yarı genişlik a), yükseklik h; (dx,dy) ötelemesi */
function Box({ a, h, w, dx = 0, dy = 0, children }: { a: number; h: number; w: Wall; dx?: number; dy?: number; children?: ReactNode }) {
  const b = a / 2
  return (
    <g transform={`translate(${dx} ${dy})`}>
      <path d={`M${-a} 0 L0 ${b} L0 ${b - h} L${-a} ${-h} Z`} fill={w.l} stroke="rgba(40,25,5,.45)" strokeWidth=".8" />
      <path d={`M0 ${b} L${a} 0 L${a} ${-h} L0 ${b - h} Z`} fill={w.r} stroke="rgba(40,25,5,.45)" strokeWidth=".8" />
      <path d={`M0 ${-b - h} L${a} ${-h} L0 ${b - h} L${-a} ${-h} Z`} fill={w.t} stroke="rgba(40,25,5,.35)" strokeWidth=".8" />
      {children}
    </g>
  )
}

/** kırma (piramit) çatı */
function Hip({ a, h, rh, c, dx = 0, dy = 0 }: { a: number; h: number; rh: number; c: [string, string, string]; dx?: number; dy?: number }) {
  const e = a * 1.14
  const b = e / 2
  const ap = `0 ${-h - rh}`
  return (
    <g transform={`translate(${dx} ${dy})`}>
      <path d={`M${-e} ${-h} L0 ${-b - h} L${ap} Z`} fill={c[2]} />
      <path d={`M0 ${-b - h} L${e} ${-h} L${ap} Z`} fill={c[1]} />
      <path d={`M${-e} ${-h} L0 ${b - h} L${ap} Z`} fill={c[0]} stroke="rgba(30,15,0,.4)" strokeWidth=".8" />
      <path d={`M0 ${b - h} L${e} ${-h} L${ap} Z`} fill={c[1]} stroke="rgba(30,15,0,.4)" strokeWidth=".8" />
    </g>
  )
}

/** sırtlı (beşik) çatı: sırt sol-arka → sağ-ön yönünde */
function Gable({ a, h, rh, c }: { a: number; h: number; rh: number; c: [string, string] }) {
  const e = a * 1.1
  const b = e / 2
  return (
    <g>
      <path d={`M${-e} ${-h} L${-e / 2} ${-b / 2 - h - rh} L${e / 2} ${b / 2 - h - rh} L0 ${b - h} Z`} fill={c[0]} stroke="rgba(30,15,0,.4)" strokeWidth=".8" />
      <path d={`M0 ${b - h} L${e / 2} ${b / 2 - h - rh} L${e} ${-h} Z`} fill={c[1]} stroke="rgba(30,15,0,.4)" strokeWidth=".8" />
      <path d={`M${-e / 2} ${-b / 2 - h - rh} L${e / 2} ${b / 2 - h - rh}`} stroke="rgba(255,240,200,.35)" strokeWidth="1.2" />
    </g>
  )
}

/** sol yüzde (t: 0..1 soldan öne) z yüksekliğinde nokta */
const fl = (a: number, t: number, z: number) => `${-a + t * a} ${(t * a) / 2 - z}`
const fr = (a: number, t: number, z: number) => `${t * a} ${a / 2 - (t * a) / 2 - z}`
/** yüzeye kemerli kapı/pencere */
function Arch({ a, t, w, z0, z1, side, fill = '#2e2414' }: { a: number; t: number; w: number; z0: number; z1: number; side: 'l' | 'r'; fill?: string }) {
  const f = side === 'l' ? fl : fr
  const t0 = t - w / 2
  const t1 = t + w / 2
  const peak = f(a, t, z1 + (w * a) / 2.2)
  return <path d={`M${f(a, t0, z0)} L${f(a, t0, z1)} Q${peak} ${f(a, t1, z1)} L${f(a, t1, z0)} Z`} fill={fill} />
}

const Shadow = ({ a }: { a: number }) => <polygon points={pts([[6, -a / 2 + 4], [a + 14, 4], [6, a / 2 + 6], [-a + 4, 4]])} fill="rgba(25,25,0,.3)" />

const Flag = ({ x, y, c = '#f0c419' }: { x: number; y: number; c?: string }) => (
  <g transform={`translate(${x} ${y})`}>
    <path d="M0 0 V-30" stroke="#3a2a14" strokeWidth="1.8" />
    <path d="M1 -30 Q8 -33 16 -29 Q12 -25 16 -20 Q8 -24 1 -20 Z" fill={c} stroke="#6a4a08" strokeWidth=".7">
      <animate attributeName="d" dur="2.4s" repeatCount="indefinite" values="M1 -30 Q8 -33 16 -29 Q12 -25 16 -20 Q8 -24 1 -20 Z;M1 -30 Q8 -28 16 -30 Q13 -25 16 -21 Q8 -19 1 -20 Z;M1 -30 Q8 -33 16 -29 Q12 -25 16 -20 Q8 -24 1 -20 Z" />
    </path>
  </g>
)

function Dome({ r, y, flag }: { r: number; y: number; flag?: boolean }) {
  return (
    <g transform={`translate(0 ${y})`}>
      <ellipse cx="0" cy="0" rx={r * 1.1} ry={r * 0.45} fill="#b8862c" />
      <path d={`M${-r} 0 A${r} ${r * 1.05} 0 0 1 ${r} 0 Z`} fill="url(#iso-gold)" stroke="#7a5010" strokeWidth=".8" />
      <path d={`M${-r * 0.5} ${-r * 0.75} Q${-r * 0.2} ${-r * 0.95} 0 ${-r * 1.02}`} stroke="rgba(255,255,230,.7)" strokeWidth="2" fill="none" />
      <path d={`M0 ${-r * 1.04} V${-r * 1.3}`} stroke="#c89a30" strokeWidth="2" />
      <circle cx="0" cy={-r * 1.32} r="2.4" fill="#ffe58a" />
      {flag && <Flag x={0} y={-r * 1.32} />}
    </g>
  )
}

/** kuleli kale dişleri: kutunun ön iki üst kenarı boyunca */
function Crenels({ a, h, w }: { a: number; h: number; w: Wall }) {
  const n = 4
  const out: ReactNode[] = []
  for (let k = 0; k < n; k++) {
    const t = (k + 0.5) / n
    const [lx, ly] = fl(a, t, h).split(' ').map(Number)
    const [rx, ry] = fr(a, t, h).split(' ').map(Number)
    out.push(<Box key={'l' + k} a={a * 0.11} h={5} w={w} dx={lx + a * 0.06} dy={ly - a * 0.03} />)
    out.push(<Box key={'r' + k} a={a * 0.11} h={5} w={w} dx={rx - a * 0.06} dy={ry - a * 0.03} />)
  }
  return <g>{out}</g>
}

// ---------------- binalar ----------------
const ROOF_RED: [string, string, string] = ['#a8432a', '#7c2e1a', '#c4583a']
const ROOF_GREEN: [string, string, string] = ['#5a8a3c', '#3e6628', '#74a24e']
const ROOF_STRAW: [string, string, string] = ['#c8a050', '#9a7834', '#dcb868']
const ROOF_SLATE: [string, string, string] = ['#5e646c', '#41464c', '#7a8088']

function Merkez() {
  return (
    <g>
      <Shadow a={62} />
      <Box a={60} h={34} w={{ l: '#d8be84', r: '#ab9058', t: '#ead7a6' }}>
        {[0.2, 0.5, 0.8].map((t) => (
          <Arch key={'l' + t} a={60} t={t} w={0.14} z0={3} z1={22} side="l" />
        ))}
        {[0.2, 0.5, 0.8].map((t) => (
          <Arch key={'r' + t} a={60} t={t} w={t === 0.5 ? 0.2 : 0.14} z0={t === 0.5 ? 0 : 3} z1={22} side="r" />
        ))}
        <path d={`M${fl(60, 0, 30)} L${fl(60, 1, 30)} L${fr(60, 1, 30)}`} stroke="#8a6a30" strokeWidth="2" fill="none" />
      </Box>
      <Box a={38} h={16} w={SAND} dy={-34} />
      <Dome r={26} y={-50} flag />
      {[[-46, -34], [46, -34], [0, -11], [0, -57]].map(([x, y], i) => (
        <g key={i} transform={`translate(${x} ${y})`}>
          <Box a={7} h={12} w={SAND} />
          <Dome r={6} y={-12} />
        </g>
      ))}
    </g>
  )
}

function Kisla() {
  return (
    <g>
      <Shadow a={56} />
      <Box a={52} h={22} w={STONE}>
        {[0.25, 0.75].map((t) => <Arch key={t} a={52} t={t} w={0.12} z0={2} z1={14} side="l" />)}
        <Arch a={52} t={0.5} w={0.2} z0={0} z1={16} side="r" />
      </Box>
      <Hip a={52} h={22} rh={22} c={ROOF_RED} />
      <Flag x={-38} y={-24} c="#c8281c" />
    </g>
  )
}

function Okcu() {
  return (
    <g>
      <Shadow a={44} />
      <Box a={40} h={24} w={WHITE} dx={-12} dy={-4}>
        <Arch a={40} t={0.5} w={0.2} z0={0} z1={15} side="r" />
        <Arch a={40} t={0.5} w={0.14} z0={8} z1={17} side="l" />
      </Box>
      <Hip a={40} h={24} rh={20} c={ROOF_GREEN} dx={-12} dy={-4} />
      {/* hedef tahtası */}
      <g transform="translate(40 14)">
        <path d="M-6 6 L-2 -8 M6 6 L2 -8" stroke="#5a3a18" strokeWidth="2" />
        <ellipse cx="0" cy="-12" rx="9" ry="10" fill="#efe6cc" stroke="#5a3a18" />
        <ellipse cx="0" cy="-12" rx="6" ry="6.6" fill="#c8281c" />
        <ellipse cx="0" cy="-12" rx="2.6" ry="2.8" fill="#efe6cc" />
      </g>
    </g>
  )
}

function Ahir() {
  return (
    <g>
      <Shadow a={52} />
      <Box a={46} h={20} w={TIMBER} dx={-6} dy={-6}>
        <Arch a={46} t={0.3} w={0.16} z0={0} z1={13} side="r" fill="#2a1a0a" />
        <Arch a={46} t={0.7} w={0.16} z0={0} z1={13} side="r" fill="#2a1a0a" />
      </Box>
      <g transform="translate(-6 -6)">
        <Gable a={46} h={20} rh={18} c={['#c8a050', '#9a7834']} />
      </g>
      {/* çit ve at */}
      <path d="M10 34 L58 10 M10 28 L58 4" stroke="#7a5a30" strokeWidth="2" />
      {[10, 26, 42, 58].map((x, i) => (
        <path key={x} d={`M${x} ${36 - i * 8} v-12`} stroke="#5a3e1e" strokeWidth="2.4" />
      ))}
      <g transform="translate(34 12)">
        <ellipse cx="0" cy="6" rx="10" ry="2.6" fill="rgba(0,0,0,.3)" />
        <path d="M-7 0 v6 M-4 0 v6 M4 0 v6 M7 0 v6" stroke="#2a1608" strokeWidth="1.6" />
        <ellipse cx="0" cy="-2" rx="9" ry="4.2" fill="#6a3a18" />
        <path d="M7 -3 L12 -10 L14 -8 L10 -1 Z" fill="#6a3a18" />
      </g>
    </g>
  )
}

function Atolye() {
  return (
    <g>
      <Shadow a={56} />
      <Box a={50} h={30} w={STONE} dx={-6} dy={-4}>
        <Arch a={50} t={0.5} w={0.34} z0={0} z1={20} side="r" />
      </Box>
      <Box a={50} h={4} w={{ l: '#8c8678', r: '#6a665a', t: '#9a9688' }} dx={-6} dy={-34} />
      <g transform="translate(-6 -38)">
        <Crenels a={50} h={0} w={STONE} />
      </g>
      {/* mancınık */}
      <g transform="translate(44 24)">
        <path d="M-14 4 L10 -8 M-10 8 L14 -4" stroke="#6a4420" strokeWidth="3" />
        <circle cx="-12" cy="6" r="4" fill="#4a3018" />
        <circle cx="12" cy="-6" r="4" fill="#4a3018" />
        <path d="M0 0 L-4 -26" stroke="#8a5a2a" strokeWidth="3" />
        <path d="M-4 -26 l-6 -2" stroke="#4a3018" strokeWidth="3" />
        <path d="M-4 0 L2 -14 L6 0" stroke="#6a4420" strokeWidth="2.4" fill="none" />
      </g>
    </g>
  )
}

function Ambar() {
  return (
    <g>
      <Shadow a={46} />
      <Box a={42} h={26} w={TIMBER}>
        <path d={`M${fl(42, 0, 9)} L${fl(42, 1, 9)} M${fl(42, 0, 18)} L${fl(42, 1, 18)}`} stroke="rgba(40,20,0,.35)" strokeWidth="1" />
        <Arch a={42} t={0.5} w={0.3} z0={0} z1={18} side="r" fill="#3a220c" />
      </Box>
      <Gable a={42} h={26} rh={26} c={['#8a3a22', '#62281a']} />
      {/* çuvallar */}
      {[[-52, 10], [-44, 16], [-56, 18]].map(([x, y], i) => (
        <g key={i} transform={`translate(${x} ${y})`}>
          <path d="M-6 4 Q-8 -6 -3 -8 L3 -8 Q8 -6 6 4 Z" fill="#d8c088" stroke="#6a4a1a" strokeWidth=".8" />
        </g>
      ))}
    </g>
  )
}

function Pazar() {
  const tents: [number, number, [string, string, string]][] = [
    [-30, -10, ['#c8392a', '#9a2a1c', '#e0584a']],
    [8, -24, ['#e8c040', '#b8901c', '#f4d870']],
    [30, 6, ['#2a6ab0', '#1e4e84', '#4a8ad0']],
    [-6, 18, ['#3a8a3a', '#2a682a', '#5aaa5a']],
  ]
  return (
    <g>
      <Shadow a={56} />
      {tents.map(([x, y, c], i) => (
        <g key={i} transform={`translate(${x} ${y})`}>
          <Box a={16} h={10} w={WHITE} />
          <Hip a={16} h={10} rh={13} c={c} />
        </g>
      ))}
      {[[-48, 18], [44, -16]].map(([x, y], i) => (
        <g key={i} transform={`translate(${x} ${y})`}>
          <ellipse cx="0" cy="4" rx="6" ry="2" fill="rgba(0,0,0,.25)" />
          <rect x="-5" y="-6" width="10" height="10" rx="2" fill="#8a5a2a" stroke="#4a2c10" strokeWidth=".8" />
        </g>
      ))}
    </g>
  )
}

function Sur() {
  return (
    <g>
      <Shadow a={56} />
      <Box a={52} h={22} w={STONE} dy={4}>
        <Arch a={52} t={0.5} w={0.26} z0={0} z1={16} side="r" fill="#241a0c" />
      </Box>
      <g transform="translate(0 -18)">
        <Crenels a={52} h={0} w={STONE} />
      </g>
      {[[-40, 0], [40, 0]].map(([x, y], i) => (
        <g key={i} transform={`translate(${x} ${y})`}>
          <Box a={14} h={44} w={STONE} />
          <Hip a={14} h={44} rh={18} c={ROOF_SLATE} />
        </g>
      ))}
    </g>
  )
}

function Tasci({ iron }: { iron?: boolean } = {}) {
  const rocks: [number, number, number][] = [[-26, -4, 1.3], [-4, -18, 1.1], [18, 2, 1.4], [-8, 16, 0.9], [34, -14, 0.8]]
  return (
    <g>
      <Shadow a={50} />
      {rocks.map(([x, y, s], i) => (
        <g key={i} transform={`translate(${x} ${y}) scale(${s})`}>
          <path d="M-14 4 L-10 -10 L0 -16 L12 -8 L14 4 L2 8 Z" fill={iron ? '#55535a' : '#9a968c'} stroke="#3a3830" strokeWidth=".8" />
          <path d="M0 -16 L12 -8 L14 4 L2 8 Z" fill={iron ? '#3c3a40' : '#6e6a60'} />
          <path d="M-10 -10 L0 -16 L2 -4 Z" fill={iron ? '#78767e' : '#c4c0b4'} />
          {iron && <path d="M-8 -2 L-3 -8 M4 0 L9 -6" stroke="#e07a30" strokeWidth="1.8" strokeLinecap="round" />}
        </g>
      ))}
      <g transform="translate(-40 20)">
        <Box a={16} h={14} w={TIMBER} />
        <Hip a={16} h={14} rh={12} c={ROOF_STRAW} />
      </g>
    </g>
  )
}

function Demirci() {
  return (
    <g>
      <Shadow a={48} />
      <Box a={42} h={22} w={STONE} dx={-6}>
        <Arch a={42} t={0.5} w={0.24} z0={0} z1={14} side="r" fill="#5a1e08" />
        <Arch a={42} t={0.5} w={0.14} z0={4} z1={10} side="l" fill="#e0782a" />
      </Box>
      <g transform="translate(-6 0)">
        <Hip a={42} h={22} rh={18} c={ROOF_SLATE} />
      </g>
      <Box a={6} h={46} w={STONE} dx={6} dy={-14} />
      <g className="smoke">
        <circle cx="6" cy="-66" r="6" fill="rgba(200,200,200,.55)" />
        <circle cx="12" cy="-76" r="8" fill="rgba(200,200,200,.35)" />
      </g>
      <g transform="translate(38 18)">
        <path d="M-8 0 h16 l-3 -5 h-10 Z" fill="#2a2a2e" />
        <rect x="-3" y="0" width="6" height="7" fill="#3a3a3e" />
      </g>
    </g>
  )
}

function Tarla({ lvl }: { lvl: number }) {
  const k = 0.55 + Math.min(lvl, 20) * 0.012
  const rows = 7
  const lines: ReactNode[] = []
  for (let n = 1; n < rows; n++) {
    const t = n / rows - 0.5
    lines.push(<path key={n} d={`M${(-HW * k) / 2 + t * HW * k} ${(-HH * k) / 2 - t * HH * k} l${HW * k} ${HH * k}`} stroke="#b8862a" strokeWidth="1.4" opacity=".7" />)
  }
  return (
    <g>
      <polygon points={lotPoly(k)} fill="rgba(60,40,0,.35)" transform="translate(3 4)" />
      <polygon points={lotPoly(k)} fill="url(#iso-hay)" stroke="#8a6418" strokeWidth="1.2" />
      {lines}
      <polygon points={lotPoly(k)} fill="none" stroke="#fff0a0" strokeWidth=".8" opacity=".5" transform="translate(0 -1.5)" />
      <g transform={`translate(${HW * k * 0.95} ${-6})`}>
        <ellipse cx="2" cy="3" rx="11" ry="4" fill="rgba(0,0,0,.25)" />
        <path d="M-10 2 Q-10 -18 0 -20 Q10 -18 10 2 Z" fill="#dcb256" stroke="#8a6418" strokeWidth=".8" />
      </g>
    </g>
  )
}

function Oduncu() {
  const logs: [number, number][] = [[10, 6], [18, 2], [14, -3], [24, -2], [20, -7]]
  return (
    <g>
      <Shadow a={48} />
      <g transform="translate(-18 -6)">
        <Box a={30} h={20} w={TIMBER}>
          <Arch a={30} t={0.5} w={0.24} z0={0} z1={12} side="r" fill="#2a1a0a" />
        </Box>
        <Gable a={30} h={20} rh={16} c={['#6a8a3a', '#4a6a26']} />
      </g>
      {logs.map(([x, y], i) => (
        <g key={i} transform={`translate(${x + 14} ${y + 12})`}>
          <path d="M-10 4 L8 -5" stroke="#7a4e24" strokeWidth="6" strokeLinecap="round" />
          <ellipse cx="9" cy="-5.5" rx="3" ry="3" fill="#d8aa6a" stroke="#6a4018" strokeWidth=".8" />
        </g>
      ))}
      <g transform="translate(-48 18)">
        <rect x="-6" y="-6" width="12" height="7" rx="1" fill="#8a5a2a" />
        <path d="M2 -6 L6 -16" stroke="#5a3a18" strokeWidth="1.6" />
        <path d="M4 -17 l5 2 l-2 3 Z" fill="#9a9a9a" />
      </g>
    </g>
  )
}

function Tapinak() {
  return (
    <g>
      <Shadow a={54} />
      <Box a={50} h={10} w={WHITE} />
      <Box a={40} h={24} w={WHITE} dy={-10}>
        <Arch a={40} t={0.5} w={0.26} z0={0} z1={16} side="r" fill="#3a2c18" />
        {[0.3, 0.7].map((t) => <Arch key={t} a={40} t={t} w={0.12} z0={6} z1={16} side="l" fill="#3a2c18" />)}
      </Box>
      <Hip a={40} h={34} rh={12} c={ROOF_SLATE} />
      <g transform="translate(0 -46)">
        <Box a={14} h={10} w={WHITE} />
        <Dome r={12} y={-10} />
      </g>
      <g transform="translate(-40 6)">
        <Box a={6} h={34} w={WHITE} />
        <path d="M-6 -34 L0 -48 L6 -34 Z" fill="#5e646c" />
      </g>
    </g>
  )
}

function Okul() {
  return (
    <g>
      <Shadow a={52} />
      <g transform="translate(-4 -2)">
        <Box a={46} h={24} w={SAND}>
          {[0.2, 0.45, 0.7].map((t) => <Arch key={t} a={46} t={t} w={0.1} z0={8} z1={18} side="l" fill="#2a3a5a" />)}
          <Arch a={46} t={0.5} w={0.2} z0={0} z1={16} side="r" />
        </Box>
        <Gable a={46} h={24} rh={20} c={['#3e6a9a', '#2c4e74']} />
      </g>
      <g transform="translate(34 12)">
        <rect x="-10" y="-14" width="20" height="13" rx="2" fill="#f2e2b0" stroke="#7a5a20" strokeWidth="1" />
        <path d="M-6 -10 h12 M-6 -7 h9 M-6 -4 h11" stroke="#7a5a20" strokeWidth=".8" />
      </g>
      <Flag x={36} y={-20} c="#3e6a9a" />
    </g>
  )
}

/** değirmen: taş gövde, dört kanat */
function Degirmen() {
  return (
    <g>
      <ellipse cx="0" cy="4" rx="34" ry="14" fill="rgba(0,0,0,.25)" />
      <path d="M-18 4 L-13 -48 L13 -48 L18 4 Z" fill="#b59a6e" stroke="#4a3418" strokeWidth="1.4" />
      <path d="M0 4 L0 -48 L13 -48 L18 4 Z" fill="#8f7550" />
      <path d="M-16 -48 L0 -64 L16 -48 Z" fill="#7a3a1c" stroke="#3a1a08" strokeWidth="1.2" />
      <rect x="-5" y="-14" width="10" height="18" rx="4" fill="#3a2410" />
      <g transform="translate(0 -46)" stroke="#4a3418" strokeWidth="1.2">
        <path d="M0 0 L-6 -40 L4 -40 Z M0 0 L40 -6 L40 4 Z M0 0 L6 40 L-4 40 Z M0 0 L-40 6 L-40 -4 Z" fill="#e8dcc0" />
        <circle r="4" fill="#5a3b1c" />
      </g>
    </g>
  )
}

/** sığınak: toprak örtülü yeraltı girişi */
function Siginak() {
  return (
    <g>
      <ellipse cx="0" cy="2" rx="40" ry="17" fill="rgba(0,0,0,.25)" />
      <path d="M-38 2 Q0 -42 38 2 Q0 18 -38 2 Z" fill="#7d6a3c" stroke="#3e2e12" strokeWidth="1.4" />
      <path d="M-30 -2 Q0 -32 30 -2" fill="none" stroke="#9c8a52" strokeWidth="2" opacity=".7" />
      <path d="M-11 6 L-11 -12 Q0 -22 11 -12 L11 6 Z" fill="#2a1a0a" stroke="#5a3b1c" strokeWidth="2.4" />
      <path d="M-11 -4 H11 M0 -18 V6" stroke="#5a3b1c" strokeWidth="1.6" />
    </g>
  )
}

/** iskele: yapım aşamasındaki boş parsel */
function Scaffold() {
  return (
    <g opacity=".95">
      <polygon points={lotPoly(0.42)} fill="#8a7448" opacity=".55" />
      <path d="M-34 0 v-28 M0 17 v-28 M34 0 v-28 M0 -17 v-28 M-34 -28 L0 -11 L34 -28 L0 -45 Z M-34 -14 L0 3 L34 -14" stroke="#7a5428" strokeWidth="2.4" fill="none" />
      <path d="M-34 0 L0 -11 M0 17 L34 -28" stroke="#5a3a18" strokeWidth="1.4" />
    </g>
  )
}

export function IsoBuilding({ id, lvl }: { id: BuildingId; lvl: number }) {
  if (lvl <= 0) return <Scaffold />
  const s = 1.08 + Math.min(lvl, 20) * 0.012
  const body = (() => {
    switch (id) {
      case 'merkez': return <Merkez />
      case 'kisla': return <Kisla />
      case 'okcu': return <Okcu />
      case 'ahir': return <Ahir />
      case 'atolye': return <Atolye />
      case 'ambar': return <Ambar />
      case 'pazar': return <Pazar />
      case 'sur': return <Sur />
      case 'tasci': return <Tasci />
      case 'demirci': return <Demirci />
      case 'tarla': return <Tarla lvl={lvl} />
      case 'oduncu': return <Oduncu />
      case 'tapinak': return <Tapinak />
      case 'okul': return <Okul />
      case 'degirmen': return <Degirmen />
      case 'siginak': return <Siginak />
    }
  })()
  return id === 'tarla' ? body : <g transform={`scale(${s})`}>{body}</g>
}

/** parsel köşesindeki altın seviye rozeti */
export function LevelBadge({ lvl, x = -70, y = -34 }: { lvl: number; x?: number; y?: number }) {
  return (
    <g transform={`translate(${x} ${y})`} className="lvl-badge">
      <circle r="10" fill="url(#iso-gold)" stroke="#5a3a08" strokeWidth="1.4" />
      <circle r="7.6" fill="none" stroke="rgba(255,250,210,.55)" strokeWidth=".8" />
      <text y="4" textAnchor="middle">{lvl}</text>
    </g>
  )
}

// ---------------- dünya haritası ----------------

/** haritadaki köy: toprak meydan üstünde küçük izometrik bina kümesi */
export function MapVillage({ size }: { size: number }) {
  return (
    <svg viewBox="-100 -104 200 150">
      <ellipse cx="0" cy="22" rx="104" ry="44" fill="#6a5a30" opacity=".35" />
      <ellipse cx="0" cy="18" rx="96" ry="38" fill="#a08a52" opacity=".75" />
      <ellipse cx="-6" cy="14" rx="70" ry="24" fill="#b8a066" opacity=".6" />
      {size >= 2 && <g transform="translate(-56 0) scale(.55)"><Kisla /></g>}
      {size >= 3 && <g transform="translate(56 -2) scale(.55)"><Ambar /></g>}
      <g transform="translate(0 6) scale(.8)"><Merkez /></g>
      {size >= 2 && <g transform="translate(-34 40) scale(.45)"><Ahir /></g>}
      {size >= 3 && <g transform="translate(40 38) scale(.48)"><Pazar /></g>}
    </svg>
  )
}

function HayField() {
  const k = 0.62
  return (
    <g>
      <ellipse cx="2" cy="8" rx={HW * k * 0.62} ry={HH * k * 0.62} fill="rgba(50,40,0,.3)" />
      <ellipse cx="0" cy="4" rx={HW * k * 0.6} ry={HH * k * 0.6} fill="url(#iso-hay)" stroke="#8a6418" strokeWidth="1.2" />
      {[-2, -1, 0, 1, 2].map((n) => (
        <path key={n} d={`M${n * 13 - 22} ${-12 + n * 2} q22 12 44 18`} stroke="#b8862a" strokeWidth="1.3" fill="none" opacity=".7" />
      ))}
      <g transform="translate(-14 -14)">
        <Box a={14} h={12} w={TIMBER} />
        <Hip a={14} h={12} rh={11} c={ROOF_STRAW} />
      </g>
      {[[22, 2], [10, 14]].map(([x, y], i) => (
        <g key={i} transform={`translate(${x} ${y})`}>
          <ellipse cx="2" cy="3" rx="9" ry="3" fill="rgba(0,0,0,.25)" />
          <path d="M-8 2 Q-8 -14 0 -16 Q8 -14 8 2 Z" fill="#dcb256" stroke="#8a6418" strokeWidth=".8" />
        </g>
      ))}
    </g>
  )
}

function Grove() {
  return (
    <g>
      <Leafy x={-30} y={-6} s={0.8} t={1} />
      <Leafy x={8} y={-18} s={0.9} t={2} />
      <Leafy x={34} y={0} s={0.75} t={0} />
      <g transform="translate(-6 14) scale(.8)"><Oduncu /></g>
      <Leafy x={-40} y={22} s={0.65} t={2} />
    </g>
  )
}

/** haritadaki maden: kaya yığını + kulübe, tarla, koru */
export function MapMine({ type }: { type: 'odun' | 'tas' | 'tahil' | 'demir' }) {
  return (
    <svg viewBox="-62 -64 124 96">
      {type === 'tas' && <g transform="scale(1.05)"><Tasci /></g>}
      {type === 'demir' && <g transform="scale(1.05)"><Tasci iron /></g>}
      {type === 'tahil' && <HayField />}
      {type === 'odun' && <Grove />}
    </svg>
  )
}
