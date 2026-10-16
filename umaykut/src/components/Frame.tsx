import { CITY_TP, MAX_CITIES, RES_INFO, RES_KEYS, SERVERS, STORED, TRIBES, UNITS, UNIT_ORDER, type BuildingId } from '../game/data'
import { assigned, cap, cityById, idleFolk, playerPop, rates, tp } from '../game/engine'
import { useG } from '../ctx'
import { fmt, fmtDur, fmtTime } from '../format'
import type { Channel } from './ChatPanel'

// Orijinal çerçeve (/orig/frame.png, 880×630) üzerine canlı yazılar ve tıklama alanları.
// Tüm koordinatlar sahne pikselidir.

const RES_Y = [157, 179, 201, 223, 245, 267]
const EV = [
  [767, 563], [808, 563], [850, 563],
  [767, 604], [808, 604], [850, 604],
] as const

export function Hud({ hover, chat, setChat }: { hover: { x: number; y: number } | null; chat: Channel | null; setChat: (c: Channel | null) => void }) {
  const { g, now, view, setView, open, cityId, setCity, goto } = useG()
  const p = g.player
  const c = cityById(g, cityId)
  const r = rates(g)
  const capacity = cap(g)
  const onMap = view === 'harita'
  const pos = hover ?? { x: c.x, y: c.y }
  const incoming = g.incoming.filter((i) => i.launch <= now).length
  const unreadAtk = g.reports.filter((x) => !x.read && x.time <= now && x.kind !== 'savunma').length
  const unreadDef = g.reports.filter((x) => !x.read && x.time <= now && x.kind === 'savunma').length
  const dm = g.dms.reduce((s, t) => s + t.unread, 0)
  const n = p.cities.length
  const nextTp = CITY_TP[Math.min(n, CITY_TP.length - 1)]
  const server = SERVERS.find((s) => s.id === g.server)
  const units = UNITS[p.tribe]

  const ev = [
    { t: 'Gelen saldırılar', on: () => open({ w: 'hareket', tab: 'gelen' }), b: incoming, red: true },
    { t: 'Giden seferler', on: () => open({ w: 'hareket', tab: 'giden' }), b: g.out.length },
    { t: 'Birlik', on: () => open({ w: 'birlik' }), b: 0 },
    { t: 'Savunma raporları', on: () => open({ w: 'rapor' }), b: unreadDef },
    { t: 'Saldırı ve casus raporları', on: () => open({ w: 'rapor' }), b: unreadAtk },
    { t: 'Mesajlar', on: () => open({ w: 'mesaj' }), b: dm },
  ]

  return (
    <div className="hud">
      {/* üst sekme */}
      <div className="h-tab">{onMap ? <>X <b>{pos.x}</b> · Y <b>{pos.y}</b></> : c.name}</div>
      <button className="h-hot h-knob" style={{ left: 645, top: 16 }} onClick={() => open({ w: 'yardim' })} title="Yardım" />
      <button
        className={`h-hot h-knob ${onMap ? '' : 'off'}`}
        style={{ left: 695, top: 16 }}
        onClick={() => onMap && setView('sehir')}
        title={onMap ? 'Şehre dön' : ''}
      />

      {/* nüfus hapı ve madalyonlar */}
      <button className="h-hot h-pill" onClick={() => open({ w: 'oyuncu', id: -1 })} title={`Nüfus · Tecrübe Puanı ${fmt(tp(p))} / ${fmt(nextTp)}`}>
        <b>{fmt(playerPop(p))}</b>
      </button>
      <button className={`h-hot h-medal ${incoming ? 'alarm' : ''}`} style={{ top: 90 }} onClick={() => open({ w: 'hareket', tab: incoming ? 'gelen' : 'giden' })} title="Asker hareketleri">
        {incoming > 0 ? <b className="badge red">{incoming}</b> : g.out.length > 0 && <b className="badge">{g.out.length}</b>}
      </button>
      <button className={`h-hot h-medal ${onMap ? 'on' : ''}`} style={{ top: 145 }} onClick={() => setView(onMap ? 'sehir' : 'harita')} title={onMap ? 'Şehre dön' : 'Harita · kaynaklar'} />
      <button className="h-hot h-medal" style={{ top: 200 }} onClick={() => open({ w: 'bina', b: 'pazar' as BuildingId })} title="Pazar · ticaret" />
      <button className="h-hot h-medal" style={{ top: 255 }} onClick={() => open({ w: 'birlik' })} title="Birlik" />

      {!onMap && (idleFolk(c) > 0 || assigned(c) === 0) && (
        <button className="h-idle" onClick={() => setView('harita')} title="Haritada kaynağa tıklayıp işçi gönder">
          {assigned(c) === 0 ? 'Kaynaklarda hiç işçi çalışmıyor.İşçi gönderin' : `Komutanım boşta ${fmt(idleFolk(c))} işçimiz var`}
        </button>
      )}
      {p.protectionUntil > now && <div className="h-prot">Acemi koruması {fmtDur(p.protectionUntil - now)}</div>}
      {onMap && (
        <>
          <button className="h-tp" onClick={() => open({ w: 'oyuncu', id: -1 })} title={`Sonraki köy: ${fmt(nextTp)} TP`}>
            Tecrübe Puanı<b>{fmt(tp(p))}</b>
          </button>
          <div className="h-tpbar"><i style={{ width: `${Math.min(100, (tp(p) / Math.max(1, nextTp)) * 100)}%` }} /></div>
          <div className="h-mbox" style={{ left: 440 }}>{pos.x} | {pos.y}</div>
          <div className="h-mbox" style={{ left: 560 }}>{fmtTime(now)}</div>
          <button className="h-gsbtn" onClick={() => open({ w: 'hareket', tab: 'giden' })}>Giden Saldırılar{g.out.length ? ` (${g.out.length})` : ''}</button>
        </>
      )}
      {onMap && (
        <div className="h-mapbtns">
          <button onClick={() => open({ w: 'ara' })}>Ara</button>
          <button onClick={() => open({ w: 'mini' })}>Mini harita</button>
          <button onClick={() => goto(c.x, c.y)}>Şehrim</button>
        </div>
      )}

      {/* sağ kenar sekmeleri */}
      <button className={`h-hot h-side ${chat === 'alliance' ? 'on' : ''}`} style={{ top: 70, height: 117 }} onClick={() => setChat(chat === 'alliance' ? null : p.allianceId ? 'alliance' : 'world')} title="Birlik mesajı" />
      <button className={`h-hot h-side ${chat === 'world' || chat === 'feed' ? 'on' : ''}`} style={{ top: 195, height: 87 }} onClick={() => setChat(chat === 'world' ? null : 'world')} title="Sohbet" />

      {/* yan panel */}
      <button className="h-hot h-logo" onClick={() => open({ w: 'siralama' })} title="Sıralama" />
      <div className="h-who">
        <div><i>Han&gt;</i> <button className="link" onClick={() => open({ w: 'oyuncu', id: -1 })}>{p.name}</button></div>
        <div><i>Devlet&gt;</i> {TRIBES[p.tribe].name}</div>
      </div>
      {RES_KEYS.map((k, i) => {
        const full = STORED.includes(k) && p.res[k] >= capacity * 0.98
        return (
          <div
            key={k}
            className={`h-res ${k} ${full ? 'full' : ''}`}
            style={{ top: RES_Y[i] - 9 }}
            title={`${RES_INFO[k].name}: ${r[k] >= 0 ? '+' : ''}${fmt(r[k] * 60)} / saat${STORED.includes(k) ? ` · ambar ${fmt(capacity)}` : ''}`}
          >
            {RES_INFO[k].name} - <b>{fmt(p.res[k])}</b>
          </div>
        )
      })}
      <div className="h-res elmas" style={{ top: 281 }}>
        Elmas - <b>{fmt(p.elmas)}</b>
      </div>
      <button className="h-hot h-plus" onClick={() => open({ w: 'elmas' })} title="Elmas al" />

      <div className="h-cities">
        {p.cities.map((x) => (
          <div key={x.id} className={`h-city ${x.id === cityId ? 'on' : ''}`}>
            <button onClick={() => { setCity(x.id); setView('sehir') }} title={`${x.x}|${x.y}`}>
              {x.name}
              {x.queue.length > 0 && <small> · {fmtDur(x.queue[0].end - now)}</small>}
            </button>
            <button className="h-goto" title="Haritada göster" onClick={() => goto(x.x, x.y)}>⌖</button>
          </div>
        ))}
        {n < MAX_CITIES && (
          <p className="h-hint">
            Yeni köy: {fmt(CITY_TP[n])} TP
            {tp(p) >= CITY_TP[n] ? ' — haritada boş araziye tıkla' : ` (${fmt(Math.max(0, CITY_TP[n] - tp(p)))} kaldı)`}
          </p>
        )}
        <p className="h-foot">
          {fmtTime(now)} · {server?.name ?? g.server} ×{g.speed} · {fmt(g.online)} çevrimiçi{' '}
          <button className="link" onClick={() => open({ w: 'ayar' })}>Ayarlar</button>
        </p>
      </div>

      {EV.map(([x, y], i) => (
        <button key={i} className={`h-hot h-ev ${ev[i].red && ev[i].b ? 'alarm' : ''}`} style={{ left: x - 18, top: y - 18 }} onClick={ev[i].on} title={ev[i].t}>
          {ev[i].b > 0 && <b className={`badge ${ev[i].red ? 'red' : ''}`}>{ev[i].b}</b>}
        </button>
      ))}

      {/* asker çubuğu (haritada yok — orijinalde harita alta kadar uzanır) */}
      {!onMap && UNIT_ORDER.map((ui, k) => (
        <button
          key={ui}
          className={`h-unit ${c.army[ui] ? '' : 'zero'}`}
          style={{ left: Math.round(33.5 + 68.3 * k) - 1 }}
          title={`${units[ui].name} — ${fmt(c.army[ui])}\nSaldırı ${units[ui].atk} · Yayaya savunma ${units[ui].defInf} · Atlıya savunma ${units[ui].defCav}`}
          onClick={() => open({ w: 'bina', b: units[ui].building })}
        >
          <img src={`/orig/u/${p.tribe}-${k}.jpg`} width={50} height={50} alt="" draggable={false} />
          <b>{fmt(c.army[ui])}</b>
        </button>
      ))}
    </div>
  )
}
