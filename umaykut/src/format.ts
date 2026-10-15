export const fmt = (n: number) => Math.floor(n).toLocaleString('tr-TR')

export function fmtDur(ms: number) {
  const s = Math.max(0, Math.ceil(ms / 1000))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  const pad = (x: number) => String(x).padStart(2, '0')
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${pad(m)}:${pad(sec)}`
}

export function fmtClock(t: number) {
  return new Date(t).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })
}

export function fmtAgo(t: number, now: number) {
  const s = Math.floor((now - t) / 1000)
  if (s < 60) return 'az önce'
  if (s < 3600) return `${Math.floor(s / 60)} dk önce`
  if (s < 86400) return `${Math.floor(s / 3600)} sa önce`
  return `${Math.floor(s / 86400)} gün önce`
}
