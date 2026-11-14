import {
  Line,
  LineChart,
  ReferenceDot,
  ReferenceLine,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from 'recharts'
import { isPlayerError, qualityColor, toWhite } from './labels'
import type { Move } from './types'

interface Props {
  moves: Move[]
  ply: number
  onSelect: (ply: number) => void
}

const LIMIT = 1000

interface Point {
  ply: number
  eval: number
  color: string | null // cor do ponto se for erro do jogador
}

function buildPoints(moves: Move[]): Point[] {
  const clamp = (cp: number) => Math.max(-LIMIT, Math.min(LIMIT, cp))
  const points: Point[] = [{ ply: 0, eval: clamp(toWhite(moves[0], moves[0].eval_before)), color: null }]
  moves.forEach((m, i) => {
    points.push({
      ply: i + 1,
      eval: clamp(toWhite(m, m.eval_after)),
      color: isPlayerError(m) ? qualityColor(m.classification) : null,
    })
  })
  return points
}

export default function EvalChart({ moves, ply, onSelect }: Props) {
  if (moves.length === 0) return null
  const data = buildPoints(moves)

  return (
    <div className="eval-chart" role="img" aria-label="Gráfico de avaliação da partida. Clique para ir a um lance.">
      <ResponsiveContainer width="100%" height={168}>
        <LineChart
          data={data}
          margin={{ top: 12, right: 12, bottom: 8, left: 0 }}
          onClick={(state) => {
            const i = Number(state?.activeTooltipIndex)
            if (Number.isFinite(i)) onSelect(i)
          }}
        >
          <XAxis dataKey="ply" hide />
          <YAxis
            domain={[-LIMIT, LIMIT]}
            ticks={[-500, 0, 500]}
            tickFormatter={(v: number) => (v > 0 ? `+${v / 100}` : String(v / 100))}
            width={36}
            axisLine={false}
            tickLine={false}
            tick={{ style: { fontFamily: 'var(--font-mono)', fontSize: 12, fill: 'var(--ink-subtle)' } }}
          />
          <ReferenceLine y={0} stroke="var(--border-strong)" strokeDasharray="4 4" />
          <Line
            type="monotone"
            dataKey="eval"
            stroke="var(--accent-edge)"
            strokeWidth={2}
            dot={(props) => {
              const { cx, cy, payload, index } = props
              if (!payload.color) return <g key={index} />
              return (
                <circle
                  key={index}
                  cx={cx}
                  cy={cy}
                  r={4}
                  style={{ fill: payload.color, stroke: 'var(--surface)', strokeWidth: 1.5 }}
                />
              )
            }}
            activeDot={false}
            isAnimationActive={false}
          />
          <ReferenceDot
            x={ply}
            y={data[ply].eval}
            r={6}
            style={{ fill: 'var(--accent)', stroke: 'var(--accent-edge)', strokeWidth: 2 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
