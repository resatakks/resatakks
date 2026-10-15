import { useCallback, useEffect, useState } from 'react'
import { Game, tick } from './game/engine'
import { clearSave, loadGame, saveGame } from './game/world'
import { GameCtx, Tab, type Ctx } from './ctx'
import Setup from './components/Setup'
import TopBar from './components/TopBar'
import Village from './components/Village'
import Army from './components/Army'
import MapView from './components/MapView'
import Rankings from './components/Rankings'
import AllianceView from './components/AllianceView'
import Reports from './components/Reports'
import ChatPanel from './components/ChatPanel'
import BotModal from './components/BotModal'
import WinnerModal from './components/WinnerModal'

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'koy', label: 'Köy', icon: '⛺' },
  { id: 'ordu', label: 'Ordu', icon: '⚔️' },
  { id: 'harita', label: 'Harita', icon: '🗺️' },
  { id: 'siralama', label: 'Sıralama', icon: '🏆' },
  { id: 'boy', label: 'Boy', icon: '🐺' },
  { id: 'raporlar', label: 'Raporlar', icon: '📜' },
]

function initial(): Game | null {
  const g = loadGame()
  if (g) tick(g, Date.now())
  return g
}

export default function App() {
  const [game, setGame] = useState<Game | null>(initial)
  const [, setVersion] = useState(0)
  const [tab, setTab] = useState<Tab>('koy')
  const [botId, setBotId] = useState<number | null>(null)
  const [mapFocus, setMapFocus] = useState<{ x: number; y: number } | null>(null)
  const [attackTarget, setAttackTarget] = useState<number | null>(null)
  const refresh = useCallback(() => setVersion((v) => v + 1), [])

  useEffect(() => {
    if (!game) return
    const id = setInterval(() => {
      tick(game, Date.now())
      refresh()
    }, 1000)
    const sid = setInterval(() => saveGame(game), 5000)
    const onHide = () => saveGame(game)
    window.addEventListener('beforeunload', onHide)
    document.addEventListener('visibilitychange', onHide)
    return () => {
      clearInterval(id)
      clearInterval(sid)
      window.removeEventListener('beforeunload', onHide)
      document.removeEventListener('visibilitychange', onHide)
    }
  }, [game, refresh])

  const ctx: Ctx | null = game && {
      g: game,
      now: Date.now(),
      act: (fn) => {
        const now = Date.now()
        tick(game, now)
        fn(game, now)
        saveGame(game)
        refresh()
      },
      openBot: (id) => setBotId(id),
      showOnMap: (x, y) => {
        setMapFocus({ x, y })
        setTab('harita')
        setBotId(null)
      },
      attack: (id) => {
        setAttackTarget(id)
        setTab('ordu')
        setBotId(null)
      },
      setTab,
    }

  if (!game || !ctx) {
    return (
      <Setup
        onStart={(g) => {
          saveGame(g)
          setGame(g)
          window.scrollTo(0, 0)
        }}
      />
    )
  }

  const unread = game.reports.filter((r) => !r.read && r.time <= ctx.now).length

  const reset = () => {
    if (!confirm('Dünyayı silip baştan başlamak istediğine emin misin?')) return
    clearSave()
    setGame(null)
    setTab('koy')
  }

  return (
    <GameCtx.Provider value={ctx}>
      <div className="app">
        <TopBar onReset={reset} />
        <nav className="tabs">
          {TABS.map((t) => (
            <button key={t.id} className={tab === t.id ? 'active' : ''} onClick={() => setTab(t.id)}>
              <span>{t.icon}</span> {t.label}
              {t.id === 'raporlar' && unread > 0 && <b className="badge">{unread}</b>}
              {t.id === 'ordu' && game.incoming.some((i) => i.launch <= ctx.now) && <b className="badge red">!</b>}
            </button>
          ))}
        </nav>
        <div className="layout">
          <main className="main">
            {tab === 'koy' && <Village />}
            {tab === 'ordu' && <Army target={attackTarget} clearTarget={() => setAttackTarget(null)} />}
            {tab === 'harita' && <MapView focus={mapFocus} />}
            {tab === 'siralama' && <Rankings />}
            {tab === 'boy' && <AllianceView />}
            {tab === 'raporlar' && <Reports />}
          </main>
          <aside className="side">
            <ChatPanel />
          </aside>
        </div>
        {botId !== null && <BotModal id={botId} onClose={() => setBotId(null)} />}
        {game.winner && <WinnerModal onReset={reset} />}
      </div>
    </GameCtx.Provider>
  )
}
