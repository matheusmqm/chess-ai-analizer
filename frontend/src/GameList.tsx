import type { Game } from './types'

interface Props {
  games: Game[]
  onSelect: (game: Game) => void
}

const RESULTS: Record<string, string> = {
  win: 'Vitória',
  checkmated: 'Derrota',
  resigned: 'Derrota',
  timeout: 'Derrota',
  abandoned: 'Derrota',
  lose: 'Derrota',
}

export default function GameList({ games, onSelect }: Props) {
  return (
    <ul className="game-list">
      {games.map((g) => {
        const white = g.user_color === 'white'
        const opponent = white ? g.black : g.white
        const mine = white ? g.white_rating : g.black_rating
        const theirs = white ? g.black_rating : g.white_rating
        const result = RESULTS[g.result] ?? 'Empate'
        return (
          <li key={g.url}>
            <button onClick={() => onSelect(g)}>
              <span className={`result ${result.toLowerCase()}`}>{result}</span>
              <span>
                {white ? '⬜' : '⬛'} vs {opponent} ({theirs ?? '?'})
              </span>
              <span className="meta">
                você {mine ?? '?'} · {g.time_control} ·{' '}
                {new Date(g.end_time * 1000).toLocaleDateString('pt-BR')}
              </span>
            </button>
          </li>
        )
      })}
    </ul>
  )
}
