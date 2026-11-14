import { QualityBadge } from './Quality'
import { QUALITY, QUALITY_ORDER } from './labels'
import type { Classification, Move } from './types'

interface Props {
  moves: Move[]
  onJump: (quality: Classification) => void // vai ao próximo lance dessa classe
}

// Quadro com todas as classes do chess.com e quantos lances você e o adversário tiveram de cada.
export default function MoveSummary({ moves, onJump }: Props) {
  const counts = new Map<Classification, { you: number; opponent: number }>()
  for (const q of QUALITY_ORDER) counts.set(q, { you: 0, opponent: 0 })
  for (const m of moves) {
    const c = counts.get(m.classification)!
    if (m.is_player) c.you += 1
    else c.opponent += 1
  }

  return (
    <section className="panel">
      <div className="summary-head">
        <h2 className="h3">Classificação dos lances</h2>
        <span className="caption muted">você · adversário</span>
      </div>
      <ul className="summary-grid">
        {QUALITY_ORDER.map((q) => {
          const { you, opponent } = counts.get(q)!
          const empty = you + opponent === 0
          return (
            <li key={q}>
              <button
                className={`summary-item ${empty ? 'is-empty' : ''}`}
                onClick={() => onJump(q)}
                disabled={empty}
                aria-label={`${QUALITY[q].label}: ${you} seus, ${opponent} do adversário`}
              >
                <QualityBadge quality={q} />
                <span className="body summary-label">{QUALITY[q].label}</span>
                <span className="san-sm summary-count">
                  {you} · {opponent}
                </span>
              </button>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
