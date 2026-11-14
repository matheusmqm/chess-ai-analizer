import { useCallback, useEffect, useMemo, useState } from 'react'
import { Chess } from 'chess.js'
import type { Arrow } from 'react-chessboard'
import Board from './Board'
import type { BoardBadge, LastMove } from './Board'
import EvalBar from './EvalBar'
import EvalChart from './EvalChart'
import ExplanationPanel from './ExplanationPanel'
import GameList from './GameList'
import Header from './Header'
import MoveList from './MoveList'
import MoveSummary from './MoveSummary'
import { IconAlert, IconSearch } from './icons'
import { isError, isPlayerError, toWhite } from './labels'
import type { Analysis, Classification, Game, Move } from './types'

// Cores das setas (as mesmas do tema do tabuleiro): verde-água = motor, coral = lance jogado.
const ARROW_BEST = '#19e0bf'
const ARROW_PLAYED = '#ff6b5e'
// Em quais lances mostrar a seta do melhor lance (quando ele difere do jogado).
const SHOW_BEST_ARROW = ['excellent', 'good', 'inaccuracy', 'mistake', 'miss', 'blunder']

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  let res: Response
  try {
    res = await fetch(url, init)
  } catch {
    throw new Error('Não foi possível conectar ao backend. Confira se ele está rodando em localhost:8000.')
  }
  if (!res.ok) {
    const body = await res.json().catch(() => null)
    throw new Error(body?.detail ?? `O servidor respondeu com o erro ${res.status}.`)
  }
  return res.json()
}

function finalFen(analysis: Analysis): string {
  const last = analysis.moves[analysis.moves.length - 1]
  const chess = new Chess(last.fen_before)
  chess.move(last.san)
  return chess.fen()
}

interface Squares {
  played: LastMove
  best: LastMove | null
}

// Casas de origem e destino do lance jogado e do melhor lance (ambos a partir da posição anterior).
function moveSquares(move: Move): Squares | null {
  try {
    const played = new Chess(move.fen_before).move(move.san)
    let best: LastMove | null = null
    if (move.best_move) {
      try {
        const b = new Chess(move.fen_before).move(move.best_move)
        best = { from: b.from, to: b.to }
      } catch {
        best = null
      }
    }
    return { played: { from: played.from, to: played.to }, best }
  } catch {
    return null
  }
}

interface ErrorState {
  title: string
  message: string
  retry?: () => void
}

function ErrorCallout({ error }: { error: ErrorState }) {
  return (
    <div className="callout callout-danger" role="alert">
      <span className="callout-icon"><IconAlert /></span>
      <div className="callout-body">
        <h2 className="h3">{error.title}</h2>
        <p className="body">{error.message}</p>
        {error.retry && (
          <button className="btn btn-secondary" onClick={error.retry}>Tentar de novo</button>
        )}
      </div>
    </div>
  )
}

export default function App() {
  const [username, setUsername] = useState('')
  const [games, setGames] = useState<Game[]>([])
  const [loadingGames, setLoadingGames] = useState(false)
  const [analyzing, setAnalyzing] = useState<Game | null>(null)
  const [error, setError] = useState<ErrorState | null>(null)
  const [analysis, setAnalysis] = useState<Analysis | null>(null)
  const [ply, setPly] = useState(0)
  const [exploring, setExploring] = useState(false) // jogando uma variação no tabuleiro
  const [bestFor, setBestFor] = useState<number | null>(null) // lance em que "Ver melhor lance" está ligado
  const onExploringChange = useCallback((v: boolean) => setExploring(v), [])

  const searchGames = useCallback(async (nick: string) => {
    setError(null)
    setAnalysis(null)
    setLoadingGames(true)
    try {
      setGames(await fetchJson<Game[]>(`/api/games?username=${encodeURIComponent(nick)}`))
    } catch (err) {
      setGames([])
      setError({
        title: 'Não consegui buscar as partidas',
        message: (err as Error).message,
        retry: () => searchGames(nick),
      })
    } finally {
      setLoadingGames(false)
    }
  }, [])

  const analyze = useCallback(async (game: Game, nick: string) => {
    setError(null)
    setAnalyzing(game)
    try {
      const result = await fetchJson<Analysis>('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ game_url: game.url, username: nick }),
      })
      setAnalysis(result)
      setPly(0)
      setBestFor(null)
    } catch (err) {
      setError({
        title: 'A análise não terminou',
        message: (err as Error).message,
        retry: () => analyze(game, nick),
      })
    } finally {
      setAnalyzing(null)
    }
  }, [])

  const total = analysis?.moves.length ?? 0

  useEffect(() => {
    if (!analysis || exploring) return
    function onKey(e: KeyboardEvent) {
      const t = e.target as HTMLElement | null
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return
      if (e.key === 'ArrowLeft') setPly((p) => Math.max(0, p - 1))
      if (e.key === 'ArrowRight') setPly((p) => Math.min(total, p + 1))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [analysis, total, exploring])

  const current = analysis && ply > 0 ? analysis.moves[ply - 1] : null
  const squares = useMemo(() => (current ? moveSquares(current) : null), [current])

  if (analysis) {
    const showingBest = current !== null && bestFor === ply
    const fen = showingBest
      ? current.fen_before
      : ply < total
        ? analysis.moves[ply].fen_before
        : finalFen(analysis)

    // Avaliação mostrada na barra: do ponto de vista das brancas.
    const evalCp = showingBest
      ? toWhite(current, current.eval_before)
      : current
        ? toWhite(current, current.eval_after)
        : toWhite(analysis.moves[0], analysis.moves[0].eval_before)

    const arrows: Arrow[] = []
    let lastMove: LastMove | null = null
    let badge: BoardBadge | null = null
    if (current && squares) {
      if (showingBest) {
        if (squares.best) arrows.push({ startSquare: squares.best.from, endSquare: squares.best.to, color: ARROW_BEST })
      } else {
        const differs =
          squares.best && (squares.best.from !== squares.played.from || squares.best.to !== squares.played.to)
        if (squares.best && differs && SHOW_BEST_ARROW.includes(current.classification)) {
          arrows.push({ startSquare: squares.best.from, endSquare: squares.best.to, color: ARROW_BEST })
        }
        if (isError(current.classification)) {
          arrows.push({ startSquare: squares.played.from, endSquare: squares.played.to, color: ARROW_PLAYED })
        }
        lastMove = squares.played
        badge = { square: squares.played.to, quality: current.classification }
      }
    }

    // posições (ply) em que o lance recém-jogado é um erro do jogador
    const errorPlies = analysis.moves.flatMap((m, i) => (isPlayerError(m) ? [i + 1] : []))
    const prevError = errorPlies.filter((p) => p < ply).pop()
    const nextError = errorPlies.find((p) => p > ply)
    const orientation = analysis.game.user_color
    const opponent = orientation === 'white' ? analysis.game.black : analysis.game.white
    const goTo = (p: number) => {
      setPly(p)
      setBestFor(null)
    }
    // Próximo lance (a partir do atual, voltando ao início se preciso) de uma classe.
    const jumpToClass = (q: Classification) => {
      const plies = analysis.moves.flatMap((m, i) => (m.classification === q ? [i + 1] : []))
      const next = plies.find((p) => p > ply) ?? plies[0]
      if (next !== undefined) goTo(next)
    }

    return (
      <>
        <Header onBack={() => setAnalysis(null)} />
        <main className="screen">
          {analysis.warnings?.map((w) => (
            <div className="callout callout-warning" role="status" key={w}>
              <span className="callout-icon"><IconAlert /></span>
              <p className="body">{w}</p>
            </div>
          ))}
          <div className="review">
            <div className="left">
            <div className="board-area">
              <EvalBar cp={evalCp} orientation={orientation} />
              <Board
                fen={fen}
                orientation={orientation}
                lastMove={lastMove}
                arrows={arrows}
                badge={badge}
                canBack={ply > 0}
                canForward={ply < total}
                onStart={() => goTo(0)}
                onBack={() => goTo(ply - 1)}
                onForward={() => goTo(ply + 1)}
                onEnd={() => goTo(total)}
                onExploringChange={onExploringChange}
              />
            </div>
              <MoveSummary moves={analysis.moves} onJump={jumpToClass} />
            </div>
            <aside className="side">
              <section className="panel">
                <h2 className="h3 panel-title">Avaliação</h2>
                <EvalChart moves={analysis.moves} ply={ply} onSelect={goTo} />
              </section>
              <section className="panel panel-grow">
                <h2 className="h3 panel-title">Lances</h2>
                <MoveList moves={analysis.moves} ply={ply} onSelect={goTo} />
              </section>
            </aside>
          </div>
          <ExplanationPanel
            move={current}
            opponent={opponent}
            canPrevError={prevError !== undefined}
            canNextError={nextError !== undefined}
            onPrevError={() => prevError !== undefined && goTo(prevError)}
            onNextError={() => nextError !== undefined && goTo(nextError)}
            showingBest={showingBest}
            onToggleBest={() => setBestFor(showingBest ? null : ply)}
          />
        </main>
      </>
    )
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    const nick = username.trim()
    if (nick) searchGames(nick)
  }

  const busy = loadingGames || analyzing !== null
  const empty = games.length === 0 && !loadingGames && !analyzing && !error

  const form = (
    <form className="search" onSubmit={onSubmit}>
      <div className="field">
        <label className="label" htmlFor="nick">Nick do chess.com</label>
        <input
          id="nick"
          className="input input-lg"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="ex.: hikaru"
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
        />
      </div>
      <button className="btn btn-primary btn-lg" disabled={!username.trim() || busy}>
        <IconSearch /> {loadingGames ? 'Buscando…' : 'Buscar partidas'}
      </button>
    </form>
  )

  return (
    <>
      <Header />
      <main className="screen">
        {empty ? (
          <section className="card empty">
            <img className="empty-mark" src="/brand/mark.svg" alt="" width={56} />
            <h1 className="h2">Nenhuma partida ainda</h1>
            <p className="body prose muted">
              Digite seu nick do chess.com para ver as partidas recentes. Você escolhe uma, o Stockfish
              analisa e a IA explica cada erro.
            </p>
            {form}
          </section>
        ) : (
          <>
            <div className="toolbar">
              <h1 className="h1">Partidas recentes</h1>
              {form}
            </div>
            {error && <ErrorCallout error={error} />}
            {loadingGames && (
              <div className="card loading" role="status">
                <p className="body">Buscando partidas no chess.com…</p>
                <div className="progress" aria-hidden="true"><span className="progress-bar indeterminate" /></div>
              </div>
            )}
            {analyzing && (
              <div className="card loading" role="status">
                <h2 className="h2">Analisando a partida</h2>
                <p className="body">
                  Stockfish analisando… depois a IA explica seus erros em português.
                </p>
                <div className="progress" aria-hidden="true"><span className="progress-bar indeterminate" /></div>
                <p className="caption muted">Isso pode levar um minuto ou mais. Deixe esta aba aberta.</p>
              </div>
            )}
            {!analyzing && !loadingGames && (
              <GameList games={games} onSelect={(g) => analyze(g, username.trim())} disabled={busy} />
            )}
          </>
        )}
      </main>
    </>
  )
}
