import { IconAlert, IconArrowRight, IconBack } from './icons'
import { EXPLAINED_CLASSES, QUALITY, formatEval, isError, toWhite } from './labels'
import { QualityTag } from './Quality'
import type { Classification, Move } from './types'

interface Props {
  move: Move | null // null na posição inicial
  opponent: string
  canPrevError: boolean
  canNextError: boolean
  onPrevError: () => void
  onNextError: () => void
  showingBest: boolean
  onToggleBest: () => void
}

const TITLE: Partial<Record<Classification, string>> = {
  inaccuracy: 'é uma imprecisão',
  mistake: 'é um erro',
  miss: 'é uma chance perdida',
  blunder: 'é um erro grave',
}

// Texto curto, sem IA, para lances que não são erros.
function encouragement(move: Move): string {
  const best = move.best_move ?? 'outro lance'
  switch (move.classification) {
    case 'brilliant':
      return 'Brilhante! Um sacrifício que o Stockfish aprova.'
    case 'great':
      return 'Ótimo lance: era a melhor forma de manter a posição.'
    case 'best':
      return 'Boa! Era o melhor lance.'
    case 'excellent':
      return `Excelente: quase tão bom quanto ${best}.`
    case 'good':
      return `Bom lance. O Stockfish preferia ${best}, mas a diferença é pequena.`
    case 'book':
      return 'Lance de abertura, sem nada a corrigir.'
    case 'forced':
      return 'Lance forçado: era o único legal.'
    default:
      return ''
  }
}

function San({ children }: { children: React.ReactNode }) {
  return <span className="san">{children}</span>
}

export default function ExplanationPanel({
  move,
  opponent,
  canPrevError,
  canNextError,
  onPrevError,
  onNextError,
  showingBest,
  onToggleBest,
}: Props) {
  if (!move) {
    return (
      <section className="card explanation" aria-live="polite">
        <h2 className="h3">Pronto para revisar</h2>
        <p className="body-lg prose">
          Use as setas do teclado ou clique em um lance da lista. Seus erros aparecem marcados no gráfico.
        </p>
        <div className="actions">
          <button className="btn btn-secondary" onClick={onNextError} disabled={!canNextError}>
            Ir ao primeiro erro <IconArrowRight />
          </button>
        </div>
      </section>
    )
  }

  const c = move.classification
  const error = isError(c)
  const explained = move.is_player && EXPLAINED_CLASSES.includes(c)
  const title = error ? `${move.san} ${TITLE[c]}` : `${move.san}: ${QUALITY[c].label.toLowerCase()}`

  let body: React.ReactNode
  if (!move.is_player) {
    body = (
      <p className="body-lg prose muted">
        Lance de {opponent}. As explicações são só para os seus lances.
        {error && move.best_move ? <> O Stockfish preferia <San>{move.best_move}</San>.</> : null}
      </p>
    )
  } else if (explained && move.explanation) {
    body = <p className="body-lg prose">{move.explanation}</p>
  } else if (explained) {
    body = (
      <p className="body-lg prose notice">
        <IconAlert />
        <span>
          A explicação não ficou disponível para este lance. Confira a chave e o modelo do OpenRouter no
          arquivo .env e analise a partida de novo.
        </span>
      </p>
    )
  } else if (error) {
    body = (
      <p className="body-lg prose">
        Perda pequena. O Stockfish preferia <San>{move.best_move}</San>.
      </p>
    )
  } else {
    body = <p className="body-lg prose">{encouragement(move)}</p>
  }

  const before = toWhite(move, move.eval_before)
  const after = toWhite(move, move.eval_after)

  return (
    <section className="card explanation" aria-live="polite">
      <header className="explanation-head">
        <QualityTag quality={c} />
        <h2 className="h3">{title}</h2>
      </header>

      {error && (
        <div className="explanation-meta">
          <span className="chip">
            <span className="caption muted">jogado</span>
            <span className="san-sm">{move.san}</span>
          </span>
          {move.best_move && (
            <span className="chip">
              <span className="caption muted">melhor</span>
              <span className="san-sm">{move.best_move}</span>
            </span>
          )}
          <span
            className="eval-change eval-lg"
            aria-label={`Avaliação de ${formatEval(before)} para ${formatEval(after)}`}
          >
            {formatEval(before)} <span aria-hidden="true">→</span> {formatEval(after)}
          </span>
        </div>
      )}

      {body}

      {error && move.is_player && (
        <div className="actions">
          {move.best_move && (
            <button className="btn btn-secondary" onClick={onToggleBest} aria-pressed={showingBest}>
              {showingBest ? 'Voltar ao lance jogado' : 'Ver melhor lance'}
            </button>
          )}
          <button className="btn btn-ghost" onClick={onPrevError} disabled={!canPrevError}>
            <IconBack /> Erro anterior
          </button>
          <button className="btn btn-ghost" onClick={onNextError} disabled={!canNextError}>
            Próximo erro <IconArrowRight />
          </button>
        </div>
      )}
    </section>
  )
}
