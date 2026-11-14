import { CLASS_COLOR, CLASS_LABEL, EXPLAINED_CLASSES } from './labels'
import type { Move } from './types'

interface Props {
  move: Move | null // null na posição inicial
}

export default function ExplanationPanel({ move }: Props) {
  const c = move?.classification ?? null

  let content: string
  if (!move) content = 'Selecione um lance para ver a análise.'
  else if (!move.is_player) content = 'Lance do adversário: sem explicação detalhada.'
  else if (!EXPLAINED_CLASSES.includes(c!)) {
    content = c === 'inaccuracy' ? 'Imprecisões não têm explicação detalhada.' : 'Bom lance, sem erro a explicar.'
  } else if (!move.explanation) content = 'Explicação indisponível.'
  else content = move.explanation

  return (
    <div className="explanation">
      {c && (
        <strong style={{ color: CLASS_COLOR[c] }}>
          {CLASS_LABEL[c]} · lance {move!.move_number}: {move!.san}
        </strong>
      )}
      <p>{content}</p>
    </div>
  )
}
