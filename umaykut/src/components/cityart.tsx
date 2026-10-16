import type { BuildingId, TribeId } from '../game/data'
import { UNIT_ART } from '../game/data'
import { IsoBuilding } from './isocity'

// Orijinal oyundan kesilmiş görseller (public/orig). Koordinatlar oyun alanına
// (712×495) göredir; oyun alanı 880×630 sahnede (15,15) noktasında durur.

export type Plot = { id: BuildingId | null; x: number; y: number }

/** Hun/Göktürk: çadır obası — merkez otağ ve çevresindeki 9 toprak parsel */
const HUN_PLOTS: Plot[] = [
  { id: 'atolye', x: 187, y: 82 },
  { id: 'kisla', x: 309, y: 101 },
  { id: 'okcu', x: 436, y: 101 },
  { id: 'ahir', x: 553, y: 145 },
  { id: 'tapinak', x: 209, y: 195 },
  { id: 'demirci', x: 509, y: 230 },
  { id: 'oduncu', x: 146, y: 298 },
  { id: 'tarla', x: 535, y: 355 },
  { id: 'tasci', x: 373, y: 372 },
  { id: 'ambar', x: 470, y: 452 },
  { id: 'pazar', x: 250, y: 440 },
  { id: 'okul', x: 80, y: 405 },
  { id: 'degirmen', x: 645, y: 235 },
  { id: 'siginak', x: 560, y: 45 },
]
/** Selçuklu: taş döşeli ızgara — merkez ve 10 parsel */
const SEL_PLOTS: Plot[] = [
  { id: 'kisla', x: 350, y: 125 },
  { id: 'okcu', x: 430, y: 165 },
  { id: 'ahir', x: 520, y: 215 },
  { id: 'atolye', x: 233, y: 188 },
  { id: 'tapinak', x: 119, y: 254 },
  { id: 'demirci', x: 579, y: 257 },
  { id: 'oduncu', x: 196, y: 298 },
  { id: 'tarla', x: 465, y: 323 },
  { id: 'tasci', x: 276, y: 344 },
  { id: 'siginak', x: 352, y: 388 },
  { id: 'ambar', x: 130, y: 390 },
  { id: 'pazar', x: 590, y: 390 },
  { id: 'okul', x: 60, y: 180 },
  { id: 'degirmen', x: 230, y: 445 },
]

/** Hun: gelişmiş oba (Merkez 5+ ve sur) — çitle çevrili halka, orijinal ekran görüntüsünden */
const HUN2_PLOTS: Plot[] = [
  { id: 'tasci', x: 210, y: 101 },
  { id: 'okcu', x: 383, y: 76 },
  { id: 'tapinak', x: 554, y: 88 },
  { id: 'oduncu', x: 127, y: 187 },
  { id: 'kisla', x: 612, y: 168 },
  { id: 'tarla', x: 597, y: 265 },
  { id: 'demirci', x: 95, y: 289 },
  { id: 'ahir', x: 318, y: 385 },
  { id: 'atolye', x: 473, y: 366 },
  { id: 'ambar', x: 230, y: 300 },
  { id: 'pazar', x: 520, y: 250 },
  { id: 'okul', x: 290, y: 170 },
  { id: 'degirmen', x: 480, y: 150 },
  { id: 'siginak', x: 215, y: 400 },
]

export type Layout = { bg: string; plots: Plot[]; merkez: { x: number; y: number }; wall?: string; surLabel: { x: number; y: number } }

export function cityLayout(t: TribeId, merkez = 1, sur = 0): Layout {
  if (t === 'selcuklu')
    return { bg: '/orig/city-sel.jpg', plots: SEL_PLOTS, merkez: { x: 351, y: 259 }, wall: sur > 0 ? '/orig/b/s_sur.png' : undefined, surLabel: { x: 70, y: 300 } }
  if (merkez >= 5 && sur > 0) return { bg: '/orig/city-hun2.jpg', plots: HUN2_PLOTS, merkez: { x: 371, y: 233 }, surLabel: { x: 50, y: 392 } }
  return { bg: '/orig/city-hun.jpg', plots: HUN_PLOTS, merkez: { x: 355, y: 215 }, surLabel: { x: 600, y: 440 } }
}

type Sprite = { src: string; w: number; h: number; dx?: number; dy?: number }
const H = (n: string, w: number, h: number, dy = -0.55): Sprite => ({ src: `/orig/b/h_${n}.png`, w, h, dy: Math.round(h * dy) })
const HUN: Partial<Record<BuildingId, Sprite>> = {
  kisla: H('kisla', 96, 66),
  okcu: H('okcu', 94, 66),
  ahir: H('ahir', 80, 60),
  atolye: H('atolye', 95, 65),
  tapinak: H('tapinak', 97, 72, -0.6),
  demirci: H('demirci', 49, 38),
  oduncu: H('keresteci', 76, 52),
  tarla: H('tarla', 84, 50, -0.5),
  tasci: H('degirmen', 76, 52),
  degirmen: H('degirmen', 76, 52),
}

/** bina görseli; parsel merkezine göre sol-üst kayması ile */
export function spriteFor(t: TribeId, id: BuildingId, lvl: number): Sprite | null {
  if (id === 'merkez') {
    if (t === 'selcuklu') return { src: '/orig/b/s_merkez.png', w: 142, h: 124, dx: -61, dy: -94 }
    return lvl >= 5 ? H('merkez', 137, 80, -0.6) : { src: '/orig/b/h_merkez1.png', w: 115, h: 122, dy: -68 }
  }
  if (t === 'selcuklu' && id === 'kisla') return { src: '/orig/b/s_kisla.png', w: 85, h: 67, dx: -40, dy: -42 }
  return HUN[id] ?? null
}

/** pencere başlıklarındaki küçük bina resmi */
export function BuildingPic({ tribe, id, lvl }: { tribe: TribeId; id: BuildingId; lvl: number }) {
  const s = spriteFor(tribe, id, lvl)
  if (s) return <img className="bpic" src={s.src} width={s.w} height={s.h} alt="" draggable={false} />
  return (
    <svg className="bpic" viewBox="-95 -118 190 145" aria-hidden>
      <IsoBuilding id={id} lvl={Math.max(1, lvl)} />
    </svg>
  )
}

export function UnitArt({ tribe, i }: { tribe: TribeId; i: number }) {
  return <img src={`/orig/u/${tribe}-${UNIT_ART[i]}.jpg`} width={50} height={50} alt="" draggable={false} />
}
