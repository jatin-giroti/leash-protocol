import { useMemo, useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { usd } from '@/lib/utils'

const W = 640, H = 270, L = 56, R = 16, T = 16, B = 34
const HOUR = 36e5, POINTS = 25

// Monotone cubic path so the curve never dips below the data (Fritsch-Carlson)
function monotone(p) {
  const n = p.length
  if (n < 2) return ''
  const dx = [], m = []
  for (let i = 0; i < n - 1; i++) { dx[i] = p[i + 1][0] - p[i][0]; m[i] = (p[i + 1][1] - p[i][1]) / dx[i] }
  const t = [m[0]]
  for (let i = 1; i < n - 1; i++) t[i] = m[i - 1] * m[i] <= 0 ? 0 : (m[i - 1] + m[i]) / 2
  t[n - 1] = m[n - 2]
  for (let i = 0; i < n - 1; i++) {
    if (m[i] === 0) { t[i] = 0; t[i + 1] = 0; continue }
    const a = t[i] / m[i], b = t[i + 1] / m[i], s = a * a + b * b
    if (s > 9) { const k = 3 / Math.sqrt(s); t[i] = k * a * m[i]; t[i + 1] = k * b * m[i] }
  }
  let d = `M${p[0][0]},${p[0][1]}`
  for (let i = 0; i < n - 1; i++) {
    const h = dx[i]
    d += ` C${p[i][0] + h / 3},${p[i][1] + (t[i] * h) / 3} ${p[i + 1][0] - h / 3},${p[i + 1][1] - (t[i + 1] * h) / 3} ${p[i + 1][0]},${p[i + 1][1]}`
  }
  return d
}

function scale(max) {
  const step = [1000, 2000, 2500, 5000, 10000, 20000, 25000, 50000, 100000, 250000, 500000, 1000000].find((s) => Math.ceil(max / s) <= 5) || 1000000
  return { step, top: Math.max(1, Math.ceil(max / step)) * step }
}

export default function StatisticsChartCard({ trades, cap, signedIn, loading }) {
  const [hover, setHover] = useState(null)

  const series = useMemo(() => {
    const now = Date.now()
    const ok = (trades || []).filter((t) => t.status === 'verified').map((t) => ({ at: new Date(t.created_at).getTime(), amt: t.amount_usdc }))
    return Array.from({ length: POINTS }, (_, i) => {
      const at = now - (POINTS - 1 - i) * HOUR
      return { at, v: ok.filter((t) => t.at <= at && t.at > at - 24 * HOUR).reduce((s, t) => s + t.amt, 0) }
    })
  }, [trades])

  const peak = Math.max(...series.map((p) => p.v), cap * 1.05 || 0)
  const { step, top } = scale(peak)
  const x = (i) => L + (i / (POINTS - 1)) * (W - L - R)
  const y = (v) => T + (1 - v / top) * (H - T - B)
  const pts = series.map((p, i) => [x(i), y(p.v)])
  const line = monotone(pts)
  const area = `${line} L${x(POINTS - 1)},${y(0)} L${x(0)},${y(0)} Z`
  const ticks = Array.from({ length: top / step + 1 }, (_, i) => i * step)
  const hh = (at) => new Date(at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  const cur = hover === null ? null : series[hover]

  function onMove(e) {
    const r = e.currentTarget.getBoundingClientRect()
    setHover(Math.max(0, Math.min(POINTS - 1, Math.round(((e.clientX - r.left) / r.width) * (POINTS - 1)))))
  }

  return (
    <Card className="flex flex-col">
      <CardContent className="flex flex-1 flex-col gap-3 p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-bold">Statistics</h2>
            <p className="text-sm text-muted-foreground">Rolling 24h spend over the last day</p>
          </div>
          {signedIn && <p className="tnum text-sm text-muted-foreground">Cap <strong className="text-foreground">{usd(cap)}</strong></p>}
        </div>

        {loading ? (
          <div className="h-64 animate-pulse rounded-xl bg-secondary" aria-hidden="true" />
        ) : (
          <figure className="m-0">
            <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={signedIn ? `Rolling 24 hour spend chart. Current spend ${usd(series[POINTS - 1].v)} against a cap of ${usd(cap)}.` : 'Spend chart. Sign in to load your data.'}>
              <defs>
                <linearGradient id="spendFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#635BFF" stopOpacity="0.28" />
                  <stop offset="100%" stopColor="#635BFF" stopOpacity="0.02" />
                </linearGradient>
              </defs>
              {ticks.map((v) => (
                <g key={v}>
                  <line x1={L} x2={W - R} y1={y(v)} y2={y(v)} stroke="#E4E7F1" strokeWidth="1" />
                  <text x={L - 8} y={y(v) + 4} textAnchor="end" fontSize="11" fill="#475569" className="tnum">{v >= 1000 ? `${v / 1000}k` : v}</text>
                </g>
              ))}
              {[0, 6, 12, 18, 24].map((i) => (
                <text key={i} x={x(i)} y={H - 10} textAnchor={i === 0 ? 'start' : i === 24 ? 'end' : 'middle'} fontSize="11" fill="#475569">{new Date(series[i].at).toLocaleTimeString('en-US', { hour: 'numeric' })}</text>
              ))}
              {signedIn && cap <= top && (
                <g>
                  <line x1={L} x2={W - R} y1={y(cap)} y2={y(cap)} stroke="#F43F5E" strokeWidth="1.5" strokeDasharray="5 5" />
                  <text x={W - R} y={y(cap) - 6} textAnchor="end" fontSize="11" fontWeight="600" fill="#BE123C">Secret cap</text>
                </g>
              )}
              {signedIn && <path d={area} fill="url(#spendFill)" />}
              {signedIn && <path d={line} fill="none" stroke="#635BFF" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />}
              {signedIn && cur && (
                <g>
                  <line x1={x(hover)} x2={x(hover)} y1={T} y2={H - B} stroke="#94A3B8" strokeWidth="1" strokeDasharray="4 4" />
                  <circle cx={x(hover)} cy={y(cur.v)} r="5" fill="#fff" stroke="#635BFF" strokeWidth="2.5" />
                  <g transform={`translate(${Math.min(Math.max(x(hover) - 62, L), W - R - 124)},${Math.max(y(cur.v) - 52, 2)})`}>
                    <rect width="124" height="42" rx="10" fill="#0F172A" />
                    <text x="10" y="17" fontSize="11" fill="#CBD5E1">{hh(cur.at)}</text>
                    <text x="10" y="34" fontSize="13" fontWeight="700" fill="#fff" className="tnum">{usd(cur.v)}</text>
                  </g>
                </g>
              )}
              {signedIn && <rect x={L} y={T} width={W - L - R} height={H - T - B} fill="transparent" onPointerMove={onMove} onPointerLeave={() => setHover(null)} />}
            </svg>
            {!signedIn && <figcaption className="-mt-2 text-center text-sm text-muted-foreground">Sign in to see your rolling spend curve.</figcaption>}
          </figure>
        )}
      </CardContent>
    </Card>
  )
}
