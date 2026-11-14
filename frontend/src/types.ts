export type Classification =
  | 'brilliant'
  | 'great'
  | 'book'
  | 'forced'
  | 'best'
  | 'excellent'
  | 'good'
  | 'inaccuracy'
  | 'mistake'
  | 'miss'
  | 'blunder'

export interface Game {
  url: string
  white: string
  black: string
  white_rating: number | null
  black_rating: number | null
  result: string
  time_control: string | null
  end_time: number
  user_color: 'white' | 'black'
}

export interface Move {
  move_number: number
  color: 'white' | 'black'
  phase: string
  fen_before: string
  san: string
  eval_before: number
  eval_after: number
  best_move: string | null
  main_line: string[]
  loss: number
  classification: Classification
  is_player: boolean // lance do jogador analisado (o adversário também é classificado)
  explanation?: string // só em erros/blunders do jogador; vazio se o LLM falhou
}

export interface Analysis {
  game: Game
  moves: Move[]
  warnings?: string[]
}
