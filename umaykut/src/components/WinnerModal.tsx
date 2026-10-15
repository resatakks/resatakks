import { allianceOf } from '../game/engine'
import { useG } from '../ctx'

export default function WinnerModal({ onReset }: { onReset: () => void }) {
  const { g } = useG()
  const a = allianceOf(g, g.winner)
  const won = g.winner === g.player.allianceId
  return (
    <div className="modal-bg">
      <div className="modal panel winner">
        <div className="big-emoji">{won ? '👑' : '🏛️'}</div>
        <h2>{won ? 'Zafer! Umaykut senin boyunla yükseldi!' : `${a?.name ?? 'Bir boy'} Umaykut’u tamamladı`}</h2>
        <p>
          {won
            ? 'Hun, Göktürk ve Selçuklu boyları tek bayrak altında birleşti. Adın bozkırda destan olarak anılacak.'
            : 'Türk halklarını birleştiren başka bir boy oldu. Bu dünya sona erdi; yeni bir dünyada intikam alabilirsin.'}
        </p>
        <button className="primary big" onClick={onReset}>Yeni dünyaya başla</button>
      </div>
    </div>
  )
}
