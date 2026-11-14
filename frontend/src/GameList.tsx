import { IconArrowRight } from './icons'
import { formatTimeControl } from './labels'
import type { Game } from './types'

interface Props {
  games: Game[]
  onSelect: (game: Game) => void
  disabled?: boolean
}

type Outcome = 'win' | 'loss' | 'draw'

const OUTCOME: Record<string, Outcome> = {
  win: 'win',
  checkmated: 'loss',
  resigned: 'loss',
  timeout: 'loss',
  abandoned: 'loss',
  lose: 'loss',
}

const OUTCOME_LABEL: Record<Outcome, string> = { win: 'Vitória', loss: 'Derrota', draw: 'Empate' }

export default function GameList({ games, onSelect, disabled }: Props) {
  return (
    <ul className="game-list">
      {games.map((g) => {
        const white = g.user_color === 'white'
        const opponent = white ? g.black : g.white
        const theirs = white ? g.black_rating : g.white_rating
        const mine = white ? g.white_rating : g.black_rating
        const outcome = OUTCOME[g.result] ?? 'draw'
        const date = new Date(g.end_time * 1000).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
        return (
          <li key={g.url}>
            <button className="game-row" onClick={() => onSelect(g)} disabled={disabled}>
              <span className={`outcome outcome-${outcome} label`}>{OUTCOME_LABEL[outcome]}</span>
              <span className="game-main">
                <span className="game-opponent">
                  <span
                    className={`side-dot ${white ? 'is-white' : 'is-black'}`}
                    role="img"
                    aria-label={white ? 'Você jogou de brancas' : 'Você jogou de pretas'}
                  />
                  <span className="body">contra <strong>{opponent}</strong></span>
                  <span className="san-sm muted">{theirs ?? '?'}</span>
                </span>
                <span className="caption muted">
                  você {mine ?? '?'} · {formatTimeControl(g.time_control)} · {date}
                </span>
              </span>
              <span className="game-action label">
                Analisar partida <IconArrowRight />
              </span>
            </button>
          </li>
        )
      })}
    </ul>
  )
}
