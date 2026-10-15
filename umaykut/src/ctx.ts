import { createContext, useContext } from 'react'
import type { Game } from './game/engine'

export type Tab = 'koy' | 'ordu' | 'harita' | 'siralama' | 'boy' | 'raporlar'

export interface Ctx {
  g: Game
  now: number
  /** oyun durumunu değiştirir ve yeniden çizer */
  act: (fn: (g: Game, now: number) => void) => void
  openBot: (id: number) => void
  showOnMap: (x: number, y: number) => void
  attack: (id: number) => void
  setTab: (t: Tab) => void
}

export const GameCtx = createContext<Ctx | null>(null)
export const useG = () => useContext(GameCtx)!
