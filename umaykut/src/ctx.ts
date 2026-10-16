import { createContext, useContext } from 'react'
import type { BuildingId } from './game/data'
import type { Game, MissionType } from './game/engine'

export type WinState =
  | { w: 'bina'; b: BuildingId }
  | { w: 'rapor'; id?: number }
  | { w: 'siralama' }
  | { w: 'birlik' }
  | { w: 'mesaj'; id?: number }
  | { w: 'hareket'; tab?: 'giden' | 'gelen' }
  | { w: 'sefer'; bot: number; ci: number; type: MissionType }
  | { w: 'oyuncu'; id: number }
  | { w: 'yardim' }
  | { w: 'ayar' }
  | { w: 'ara' }
  | { w: 'mini' }
  | { w: 'elmas' }

export type View = 'harita' | 'sehir'

export interface Ctx {
  g: Game
  now: number
  /** oyun durumunu değiştirir; fonksiyon metin dönerse uyarı penceresi açılır */
  act: (fn: (g: Game, now: number) => string | null | void) => string | null
  cityId: number
  setCity: (id: number) => void
  view: View
  setView: (v: View) => void
  open: (w: WinState) => void
  close: () => void
  notify: (text: string) => void
  goto: (x: number, y: number) => void
  toggleSide: () => void
  reset: () => void
}

export const GameCtx = createContext<Ctx | null>(null)
export const useG = () => useContext(GameCtx)!
