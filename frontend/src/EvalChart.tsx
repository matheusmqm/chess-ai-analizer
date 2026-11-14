import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceDot,
  ReferenceLine,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from 'recharts'
import { CLASS_COLOR, isPlayerError } from './labels'
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

function toWhite(move: Move, cp: number): number {
  return move.color === 'white' ? cp : -cp
}

function buildPoints(moves: Move[]): Point[] {
  const clamp = (cp: number) => Math.max(-LIMIT, Math.min(LIMIT, cp))
  const points: Point[] = [{ ply: 0, eval: clamp(toWhite(moves[0], moves[0].eval_before)), color: null }]
  moves.forEach((m, i) => {
    points.push({
      ply: i + 1,
      eval: clamp(toWhite(m, m.eval_after)),
      color: isPlayerError(m) ? CLASS_COLOR[m.classification] : null,
    })
  })
  return points
}

export default function EvalChart({ moves, ply, onSelect }: Props) {
  if (moves.length === 0) return null
  const data = buildPoints(moves)

  return (
    <div className="eval-chart">
      <ResponsiveContainer width="100%" height={180}>
        <LineChart
          data={data}
          onClick={(state) => {
            const i = Number(state?.activeTooltipIndex)
            if (Number.isFinite(i)) onSelect(i)
          }}
        >
          <CartesianGrid stroke="#333" />
          <XAxis dataKey="ply" hide />
          <YAxis domain={[-LIMIT, LIMIT]} width={40} stroke="#999" />
          <ReferenceLine y={0} stroke="#888" />
          <Line
            type="monotone"
            dataKey="eval"
            stroke="#8ab4f8"
            dot={(props) => {
              const { cx, cy, payload, index } = props
              if (!payload.color) return <g key={index} />
              return <circle key={index} cx={cx} cy={cy} r={4} fill={payload.color} />
            }}
            isAnimationActive={false}
          />
          <ReferenceDot x={ply} y={data[ply].eval} r={6} fill="#fff" stroke="#3d5a80" />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
