import { useCallback, useEffect, useState } from 'react'
import { type Game, tick } from './game/engine'
import { clearSave, loadGame, saveGame } from './game/world'
import { GameCtx, type Ctx, type View, type WinState } from './ctx'
import Setup from './components/Setup'
import MapView from './components/MapView'
import CityView from './components/CityView'
import BuildingWin from './components/BuildingWin'
import Rankings from './components/Rankings'
import AllianceView from './components/AllianceView'
import Reports from './components/Reports'
import ChatPanel, { type Channel } from './components/ChatPanel'
import WinnerModal from './components/WinnerModal'
import Messages from './components/Messages'
import { Hud, Sidebar } from './components/Frame'
import { ElmasWin, HelpWin, MiniMap, Movements, PlayerWin, SearchWin, SendWin, SettingsWin } from './components/Windows'

function initial(): Game | null {
  const g = loadGame()
  if (g) tick(g, Date.now())
  return g
}

function WinSwitch({ w }: { w: WinState }) {
  switch (w.w) {
    case 'bina': return <BuildingWin key={w.b} id={w.b} />
    case 'rapor': return <Reports id={w.id} />
    case 'siralama': return <Rankings />
    case 'birlik': return <AllianceView />
    case 'mesaj': return <Messages key={w.id} openId={w.id} />
    case 'hareket': return <Movements key={w.tab} tab={w.tab} />
    case 'sefer': return <SendWin key={`${w.bot}-${w.ci}`} bot={w.bot} ci={w.ci} type={w.type} />
    case 'oyuncu': return <PlayerWin key={w.id} id={w.id} />
    case 'yardim': return <HelpWin />
    case 'ayar': return <SettingsWin />
    case 'ara': return <SearchWin />
    case 'mini': return <MiniMap />
    case 'elmas': return <ElmasWin />
  }
}

export default function App() {
  const [game, setGame] = useState<Game | null>(initial)
  const [, setVersion] = useState(0)
  const [view, setView] = useState<View>('sehir')
  const [cityId, setCity] = useState(() => game?.player.cities[0].id ?? 1)
  const [win, setWin] = useState<WinState | null>(null)
  const [notes, setNotes] = useState<string[]>([])
  const [focus, setFocus] = useState(() => ({ x: game?.player.x ?? 0, y: game?.player.y ?? 0, n: 0 }))
  const [chat, setChat] = useState<Channel | null>(null)
  const [side, setSide] = useState(false)
  const [hover, setHover] = useState<{ x: number; y: number } | null>(null)
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

  if (!game) {
    return (
      <Setup
        onStart={(g) => {
          saveGame(g)
          setGame(g)
          setCity(g.player.cities[0].id)
          setFocus({ x: g.player.x, y: g.player.y, n: 1 })
          setView('sehir')
        }}
      />
    )
  }

  const notify = (text: string) => setNotes((n) => [...n, text])
  const reset = () => {
    if (!confirm('Dünyayı silip baştan başlamak istediğine emin misin?')) return
    clearSave()
    setWin(null)
    setGame(null)
  }

  const ctx: Ctx = {
    g: game,
    now: Date.now(),
    act: (fn) => {
      const now = Date.now()
      tick(game, now)
      const r = fn(game, now)
      const msg = typeof r === 'string' ? r : null
      saveGame(game)
      refresh()
      if (msg) notify(msg)
      return msg
    },
    cityId,
    setCity: (id) => {
      setCity(id)
      setWin(null)
    },
    view,
    setView: (v) => {
      setView(v)
      if (v === 'harita') {
        const c = game.player.cities.find((x) => x.id === cityId) ?? game.player.cities[0]
        setFocus((f) => ({ x: c.x, y: c.y, n: f.n + 1 }))
      }
    },
    open: setWin,
    close: () => setWin(null),
    notify,
    goto: (x, y) => {
      setFocus((f) => ({ x, y, n: f.n + 1 }))
      setView('harita')
      setWin(null)
    },
    toggleSide: () => setSide((s) => !s),
    reset,
  }

  return (
    <GameCtx.Provider value={ctx}>
      <div className={`frame ${side ? 'side-open' : ''}`}>
        <div className="stage">
          {view === 'harita' ? <MapView focus={focus} onHover={setHover} /> : <CityView />}
          <Hud hover={hover} />
          <div className="edge-tabs">
            <button className={chat === 'alliance' ? 'active' : ''} onClick={() => setChat(chat === 'alliance' ? null : game.player.allianceId ? 'alliance' : 'world')}>BİRLİK MESAJI</button>
            <button className={chat === 'world' || chat === 'feed' ? 'active' : ''} onClick={() => setChat(chat === 'world' ? null : 'world')}>SOHBET</button>
          </div>
          {chat && <ChatPanel ch={chat} setCh={setChat} onClose={() => setChat(null)} />}
        </div>
        <Sidebar onTab={() => setSide(false)} />
        {side && <div className="side-scrim" onClick={() => setSide(false)} />}
        {win && <WinSwitch w={win} />}
        {notes[0] && (
          <div className="win-bg notice-bg">
            <div className="notice">
              <p>{notes[0]}</p>
              <button className="btn-gold" onClick={() => setNotes((n) => n.slice(1))}>Tamam</button>
            </div>
          </div>
        )}
        {game.winner && <WinnerModal onReset={reset} />}
      </div>
    </GameCtx.Provider>
  )
}
