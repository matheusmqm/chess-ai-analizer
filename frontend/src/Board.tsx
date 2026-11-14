import { useEffect, useMemo, useState } from 'react'
import { Chess } from 'chess.js'
import { Chessboard } from 'react-chessboard'
import type { Arrow, PieceDropHandlerArgs, SquareHandlerArgs } from 'react-chessboard'
import { IconFirst, IconFlip, IconLast, IconNext, IconPrev, IconUndo } from './icons'
import { QualityBadge } from './Quality'
import type { Classification } from './types'

export interface LastMove {
  from: string
  to: string
}

export interface BoardBadge {
  square: string
  quality: Classification
}

interface Props {
  fen: string // posição da partida no lance selecionado
  orientation: 'white' | 'black'
  lastMove?: LastMove | null
  arrows?: Arrow[]
  badge?: BoardBadge | null
  canBack: boolean
  canForward: boolean
  onStart: () => void
  onBack: () => void
  onForward: () => void
  onEnd: () => void
  onExploringChange: (exploring: boolean) => void
}

const LAST_MOVE_STYLE = { boxShadow: 'inset 0 0 0 100px var(--board-last-move)' }
const SELECTED_STYLE = { boxShadow: 'inset 0 0 0 100px var(--board-selected)' }
const TARGET_STYLE = { background: 'radial-gradient(circle, rgba(12,18,20,0.34) 20%, transparent 22%)' }
const CHECK_STYLE = { background: 'radial-gradient(circle, rgba(255,90,110,0.95) 28%, transparent 72%)' }

const prefersReducedMotion =
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

function kingSquare(chess: Chess): string | null {
  for (const row of chess.board()) {
    for (const cell of row) {
      if (cell && cell.type === 'k' && cell.color === chess.turn()) return cell.square
    }
  }
  return null
}

function statusText(chess: Chess): string {
  if (chess.isCheckmate()) return 'Xeque-mate'
  if (chess.isStalemate()) return 'Empate por afogamento'
  if (chess.isDraw()) return 'Empate'
  if (chess.isCheck()) return 'Xeque'
  return ''
}

export default function Board({
  fen,
  orientation,
  lastMove,
  arrows,
  badge,
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

  // Marcações da revisão só valem para a posição da partida, não para a variação.
  const showReview = !exploring
  const squareStyles: Record<string, React.CSSProperties> = {}
  if (showReview && lastMove) {
    squareStyles[lastMove.from] = LAST_MOVE_STYLE
    squareStyles[lastMove.to] = LAST_MOVE_STYLE
  }
  if (chess.isCheck() || chess.isCheckmate()) {
    const k = kingSquare(chess)
    if (k) squareStyles[k] = { ...squareStyles[k], ...CHECK_STYLE }
  }
  if (selected) {
    squareStyles[selected] = SELECTED_STYLE
    chess.moves({ square: selected as never, verbose: true }).forEach((m) => {
      squareStyles[m.to] = { ...squareStyles[m.to], ...TARGET_STYLE }
    })
  }

  const status = statusText(chess)
  const side = flipped ? (orientation === 'white' ? 'black' : 'white') : orientation

  return (
    <div className="board">
      <div className="board-frame">
        <Chessboard
          options={{
            position: chess.fen(),
            boardOrientation: side,
            allowDragging: true,
            allowDrawingArrows: false,
            showAnimations: !prefersReducedMotion,
            canDragPiece: ({ piece }) => piece.pieceType[0] === chess.turn(),
            onPieceDrop,
            onSquareClick,
            squareStyles,
            arrows: showReview ? (arrows ?? []) : [],
            lightSquareStyle: { backgroundColor: 'var(--board-light)' },
            darkSquareStyle: { backgroundColor: 'var(--board-dark)' },
            boardStyle: { borderRadius: 'var(--radius-sm)', overflow: 'hidden' },
            // Com squareRenderer próprio a biblioteca não aplica squareStyles: aplico aqui.
            squareRenderer: ({ square, children }) => (
              <div className="square-fill" style={squareStyles[square]}>
                {children}
                {showReview && badge && badge.square === square && (
                  <QualityBadge quality={badge.quality} size="md" className="board-badge" />
                )}
              </div>
            ),
          }}
        />
      </div>

      <div className="board-bar" aria-live="polite">
        <span className="board-status">
          {status && <strong className="board-check">{status}</strong>}
          {exploring && <span className="caption muted">Variação fora da partida</span>}
        </span>
        {exploring && (
          <button className="btn btn-ghost btn-sm" onClick={exitVariation}>
            <IconUndo /> Voltar à partida
          </button>
        )}
      </div>

      <div className="board-controls" role="group" aria-label="Controles do tabuleiro">
        {exploring ? (
          <>
            <button className="btn btn-icon" onClick={() => setIdx(0)} disabled={idx === 0} aria-label="Primeiro lance da variação"><IconFirst /></button>
            <button className="btn btn-icon" onClick={() => setIdx(idx - 1)} disabled={idx === 0} aria-label="Lance anterior da variação"><IconPrev /></button>
            <button className="btn btn-icon" onClick={() => setIdx(idx + 1)} disabled={idx === sans.length} aria-label="Próximo lance da variação"><IconNext /></button>
            <button className="btn btn-icon" onClick={() => setIdx(sans.length)} disabled={idx === sans.length} aria-label="Último lance da variação"><IconLast /></button>
          </>
        ) : (
          <>
            <button className="btn btn-icon" onClick={onStart} disabled={!canBack} aria-label="Primeiro lance"><IconFirst /></button>
            <button className="btn btn-icon" onClick={onBack} disabled={!canBack} aria-label="Lance anterior"><IconPrev /></button>
            <button className="btn btn-icon" onClick={onForward} disabled={!canForward} aria-label="Próximo lance"><IconNext /></button>
            <button className="btn btn-icon" onClick={onEnd} disabled={!canForward} aria-label="Último lance"><IconLast /></button>
          </>
        )}
        <button className="btn btn-icon" onClick={() => setFlipped(!flipped)} aria-label="Virar tabuleiro" title="Virar tabuleiro">
          <IconFlip />
        </button>
      </div>
    </div>
  )
}
