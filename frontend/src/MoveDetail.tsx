import { CLASS_COLOR, CLASS_LABEL, formatEval } from './labels'
import type { Move } from './types'

interface Props {
  move: Move | null // null na posição inicial
  canPrevError: boolean
  canNextError: boolean
  onPrevError: () => void
  onNextError: () => void
}

export default function MoveDetail({
  move,
  canPrevError,
  canNextError,
  onPrevError,
  onNextError,
}: Props) {
  const c = move?.classification ?? null
  const who = move && !move.is_player ? ' (adversário)' : ''
  return (
    <div className="move-detail">
      <div className="error-nav">
        <button onClick={onPrevError} disabled={!canPrevError}>← Erro anterior</button>
        <button onClick={onNextError} disabled={!canNextError}>Próximo erro →</button>
      </div>
      {move && c && (
        <div>
          <strong style={{ color: CLASS_COLOR[c] }}>{CLASS_LABEL[c]}</strong>
          {who}{' · '}lance {move.move_number}: {move.san}
          <ul>
            <li>Melhor lance: {move.best_move ?? '—'}</li>
            <li>
              Avaliação: {formatEval(move.eval_before)} → {formatEval(move.eval_after)}
              {' '}(perda de {move.loss} cp)
            </li>
          </ul>
        </div>
      )}
    </div>
  )
}
