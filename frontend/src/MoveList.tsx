import { CLASS_COLOR, CLASS_SYMBOL } from './labels'
import type { Move } from './types'

interface Props {
  moves: Move[]
  ply: number // posição atual: 0 = inicial, i = depois do lance i-1
  onSelect: (ply: number) => void
}

function MoveButton({ move, index, ply, onSelect }: {
  move: Move
  index: number
  ply: number
  onSelect: (ply: number) => void
}) {
  const c = move.classification
  return (
    <button
      className={`move ${ply === index + 1 ? 'selected' : ''}`}
      style={{ color: CLASS_COLOR[c], fontWeight: 'bold' }}
      onClick={() => onSelect(index + 1)}
    >
      {move.san}
      {` ${CLASS_SYMBOL[c]}`}
    </button>
  )
}

export default function MoveList({ moves, ply, onSelect }: Props) {
  const rows: number[] = []
  for (let i = 0; i < moves.length; i += 2) rows.push(i)

  return (
    <div className="move-list">
      {rows.map((i) => (
        <div className="move-row" key={i}>
          <span className="move-number">{moves[i].move_number}.</span>
          <MoveButton move={moves[i]} index={i} ply={ply} onSelect={onSelect} />
          {moves[i + 1] && (
            <MoveButton move={moves[i + 1]} index={i + 1} ply={ply} onSelect={onSelect} />
          )}
        </div>
      ))}
    </div>
  )
}
