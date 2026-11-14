import { useEffect, useMemo, useState } from 'react'
import { Chess } from 'chess.js'
import { Chessboard } from 'react-chessboard'
import type { PieceDropHandlerArgs, SquareHandlerArgs } from 'react-chessboard'

interface Props {
  fen: string // posição da partida no lance selecionado
  orientation: 'white' | 'black'
  canBack: boolean
  canForward: boolean
  onStart: () => void
  onBack: () => void
  onForward: () => void
  onEnd: () => void
  onExploringChange: (exploring: boolean) => void
}

const SELECTED_STYLE = { background: 'rgba(255, 215, 0, 0.5)' }
const TARGET_STYLE = { background: 'radial-gradient(circle, rgba(0,0,0,0.3) 22%, transparent 24%)' }
const CHECK_STYLE = { background: 'radial-gradient(circle, rgba(229,72,77,0.9) 30%, transparent 75%)' }

function kingSquare(chess: Chess): string | null {
  for (const row of chess.board()) {
    for (const cell of row) {
      if (cell && cell.type === 'k' && cell.color === chess.turn()) return cell.square
    }
  }
  return null
}

function statusText(chess: Chess): string {
  if (chess.isCheckmate()) return 'Xeque-mate!'
  if (chess.isStalemate()) return 'Empate por afogamento'
  if (chess.isDraw()) return 'Empate'
  if (chess.isCheck()) return 'Xeque!'
  return ''
}

export default function Board({
  fen,
  orientation,
  canBack,
  canForward,
  onStart,
  onBack,
  onForward,
  onEnd,
  onExploringChange,
}: Props) {
  // Variação: lances jogados por mim a partir da posição da partida.
  const [sans, setSans] = useState<string[]>([])
  const [idx, setIdx] = useState(0) // quantos lances da variação estão aplicados
  const [selected, setSelected] = useState<string | null>(null)
  const [flipped, setFlipped] = useState(false)

  const exploring = sans.length > 0

  // Trocou de lance na partida: descarta a variação.
  useEffect(() => {
    setSans([])
    setIdx(0)
    setSelected(null)
  }, [fen])

  useEffect(() => {
    onExploringChange(exploring)
  }, [exploring, onExploringChange])

  const chess = useMemo(() => {
    const c = new Chess(fen)
    sans.slice(0, idx).forEach((san) => c.move(san))
    return c
  }, [fen, sans, idx])

  function exitVariation() {
    setSans([])
    setIdx(0)
    setSelected(null)
  }

  // Setas e Esc controlam a variação enquanto ela existe.
  useEffect(() => {
    if (!exploring) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'ArrowLeft') setIdx((i) => Math.max(0, i - 1))
      if (e.key === 'ArrowRight') setIdx((i) => Math.min(sans.length, i + 1))
      if (e.key === 'Escape') exitVariation()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [exploring, sans.length])

  function tryMove(from: string, to: string): boolean {
    const test = new Chess(chess.fen())
    let move
    try {
      move = test.move({ from, to, promotion: 'q' }) // promoção sempre em dama
    } catch {
      return false
    }
    setSans([...sans.slice(0, idx), move.san])
    setIdx(idx + 1)
    setSelected(null)
    return true
  }

  function onPieceDrop({ sourceSquare, targetSquare }: PieceDropHandlerArgs): boolean {
    if (!targetSquare) return false
    return tryMove(sourceSquare, targetSquare)
  }

  function onSquareClick({ piece, square }: SquareHandlerArgs) {
    if (selected && selected !== square && tryMove(selected, square)) return
    const mine = piece && piece.pieceType[0] === chess.turn()
    setSelected(mine && selected !== square ? square : null)
  }

  const squareStyles: Record<string, React.CSSProperties> = {}
  if (chess.isCheck() || chess.isCheckmate()) {
    const k = kingSquare(chess)
    if (k) squareStyles[k] = CHECK_STYLE
  }
  if (selected) {
    squareStyles[selected] = SELECTED_STYLE
    chess.moves({ square: selected as never, verbose: true }).forEach((m) => {
      squareStyles[m.to] = TARGET_STYLE
    })
  }

  const status = statusText(chess)
  const side = orientation === 'white' ? 'white' : 'black'

  return (
    <div className="board">
      <Chessboard
        options={{
          position: chess.fen(),
          boardOrientation: flipped ? (side === 'white' ? 'black' : 'white') : side,
          allowDragging: true,
          canDragPiece: ({ piece }) => piece.pieceType[0] === chess.turn(),
          onPieceDrop,
          onSquareClick,
          squareStyles,
        }}
      />
      <div className="board-status">
        {status && <strong>{status}</strong>}
        {exploring && <span className="variation-tag">Variação (fora da partida)</span>}
      </div>
      <div className="board-controls">
        {exploring ? (
          <>
            <button onClick={() => setIdx(0)} disabled={idx === 0}>⏮</button>
            <button onClick={() => setIdx(idx - 1)} disabled={idx === 0}>◀</button>
            <button onClick={() => setIdx(idx + 1)} disabled={idx === sans.length}>▶</button>
            <button onClick={() => setIdx(sans.length)} disabled={idx === sans.length}>⏭</button>
            <button onClick={exitVariation}>↩ Voltar à partida</button>
          </>
        ) : (
          <>
            <button onClick={onStart} disabled={!canBack}>⏮</button>
            <button onClick={onBack} disabled={!canBack}>◀</button>
            <button onClick={onForward} disabled={!canForward}>▶</button>
            <button onClick={onEnd} disabled={!canForward}>⏭</button>
          </>
        )}
        <button onClick={() => setFlipped(!flipped)} title="Virar tabuleiro">⇅</button>
      </div>
    </div>
  )
}
