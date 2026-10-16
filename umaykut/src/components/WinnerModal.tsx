import { allianceOf } from '../game/engine'
import { useG } from '../ctx'

export default function WinnerModal({ onReset }: { onReset: () => void }) {
  const { g } = useG()
  const a = allianceOf(g, g.winner)
  const won = g.winner === g.player.allianceId
  return (
    <div className="win-bg">
      <div className="win winner">
        <div className="win-title"><span>Sezon sona erdi</span></div>
        <div className="win-body">
          <div className="big-emoji">{won ? '👑' : '🏛️'}</div>
          <h3>{won ? 'Zafer! Umaykut senin birliğinle yükseldi!' : `${a?.name ?? 'Bir birlik'} Umaykut’u tamamladı`}</h3>
          <p>
            {won
              ? 'Hun, Göktürk ve Selçuklu tek bayrak altında birleşti. Adın bozkırda destan olarak anılacak.'
              : 'Türk devletlerini birleştiren başka bir birlik oldu. Bu dünya sona erdi; yeni bir dünyada intikam alabilirsin.'}
          </p>
          <button className="btn-gold big" onClick={onReset}>Yeni dünyaya başla</button>
        </div>
      </div>
    </div>
  )
}
