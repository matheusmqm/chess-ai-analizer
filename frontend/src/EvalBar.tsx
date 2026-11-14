import { formatEval } from './labels'

interface Props {
  cp: number // avaliação do ponto de vista das brancas
  orientation: 'white' | 'black'
}

// Fração do lado branco: curva suave, 50% em 0 e quase 100% perto de um mate.
function whiteShare(cp: number): number {
  return 50 + 50 * Math.tanh(cp / 500)
}

function shortEval(cp: number): string {
  // "+12" em vez de "+12,4" para caber na barra
  return formatEval(cp)
}

export default function EvalBar({ cp, orientation }: Props) {
  const white = whiteShare(cp)
  const whiteOnBottom = orientation === 'white'
  const favorsWhite = cp >= 0
  return (
    <div
      className={`eval-bar ${whiteOnBottom ? '' : 'flipped'}`}
      role="img"
      aria-label={`Avaliação do Stockfish: ${formatEval(cp)}`}
    >
      <div className="eval-bar-black" style={{ flexBasis: `${100 - white}%` }} />
      <div className="eval-bar-white" style={{ flexBasis: `${white}%` }} />
      <span className={`eval eval-bar-value ${favorsWhite ? 'on-white' : 'on-black'} ${
        favorsWhite === whiteOnBottom ? 'at-bottom' : 'at-top'
      }`}>
        {shortEval(cp)}
      </span>
    </div>
  )
}
