import { useEffect, useRef } from 'react'
import { QualityBadge } from './Quality'
import { QUALITY } from './labels'
import type { Move } from './types'

interface Props {
  moves: Move[]
  ply: number // posição atual: 0 = inicial, i = depois do lance i-1
  onSelect: (ply: number) => void
}

function MoveCell({ move, index, ply, onSelect }: {
  move: Move
  index: number
  ply: number
  onSelect: (ply: number) => void
}) {
  const selected = ply === index + 1
  const ref = useRef<HTMLButtonElement>(null)

  // Mantém o lance selecionado visível quando se navega pelo teclado.
  useEffect(() => {
    if (selected) ref.current?.scrollIntoView({ block: 'nearest' })
  }, [selected])

  return (
    <button
      ref={ref}
      className={`move-cell ${selected ? 'selected' : ''}`}
      onClick={() => onSelect(index + 1)}
      aria-current={selected ? 'true' : undefined}
      aria-label={`${move.san}, ${QUALITY[move.classification].label}`}
    >
      <span className="san">{move.san}</span>
      <QualityBadge quality={move.classification} />
    </button>
  )
}

export default function MoveList({ moves, ply, onSelect }: Props) {
  const rows: number[] = []
  for (let i = 0; i < moves.length; i += 2) rows.push(i)

  return (
    <div className="move-list" role="list" aria-label="Lances da partida">
      {rows.map((i) => (
        <div className="move-row" role="listitem" key={i}>
          <span className="move-number san-sm">{moves[i].move_number}</span>
          <MoveCell move={moves[i]} index={i} ply={ply} onSelect={onSelect} />
          {moves[i + 1] ? (
            <MoveCell move={moves[i + 1]} index={i + 1} ply={ply} onSelect={onSelect} />
          ) : (
            <span />
          )}
        </div>
      ))}
    </div>
  )
}
