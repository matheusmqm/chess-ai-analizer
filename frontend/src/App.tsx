import { useCallback, useEffect, useState } from 'react'
import { Chess } from 'chess.js'
import Board from './Board'
import EvalChart from './EvalChart'
import ExplanationPanel from './ExplanationPanel'
import GameList from './GameList'
import MoveDetail from './MoveDetail'
import MoveList from './MoveList'
import { isPlayerError } from './labels'
import type { Analysis, Game } from './types'
import './index.css'

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  let res: Response
  try {
    res = await fetch(url, init)
  } catch {
    throw new Error('Não foi possível conectar ao backend. Ele está rodando em localhost:8000?')
  }
  if (!res.ok) {
    const body = await res.json().catch(() => null)
    throw new Error(body?.detail ?? `Erro ${res.status}`)
  }
  return res.json()
}

function finalFen(analysis: Analysis): string {
  const last = analysis.moves[analysis.moves.length - 1]
  const chess = new Chess(last.fen_before)
  chess.move(last.san)
  return chess.fen()
}

export default function App() {
  const [username, setUsername] = useState('')
  const [games, setGames] = useState<Game[]>([])
  const [loadingGames, setLoadingGames] = useState(false)
  const [analyzing, setAnalyzing] = useState(false)
  const [error, setError] = useState('')
  const [analysis, setAnalysis] = useState<Analysis | null>(null)
  const [ply, setPly] = useState(0)
  const [exploring, setExploring] = useState(false) // jogando variação no tabuleiro
  const onExploringChange = useCallback((v: boolean) => setExploring(v), [])

  async function searchGames(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setAnalysis(null)
    setLoadingGames(true)
    try {
      const nick = encodeURIComponent(username.trim())
      setGames(await fetchJson<Game[]>(`/api/games?username=${nick}`))
    } catch (err) {
      setGames([])
      setError((err as Error).message)
    } finally {
      setLoadingGames(false)
    }
  }

  async function analyze(game: Game) {
    setError('')
    setAnalyzing(true)
    try {
      const result = await fetchJson<Analysis>('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ game_url: game.url, username: username.trim() }),
      })
      setAnalysis(result)
      setPly(0)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setAnalyzing(false)
    }
  }

  const total = analysis?.moves.length ?? 0

  useEffect(() => {
    if (!analysis || exploring) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'ArrowLeft') setPly((p) => Math.max(0, p - 1))
      if (e.key === 'ArrowRight') setPly((p) => Math.min(total, p + 1))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [analysis, total, exploring])

  if (analysis) {
    const fen = ply < total ? analysis.moves[ply].fen_before : finalFen(analysis)
    // posições (ply) em que o lance recém-jogado é um erro do jogador
    const errorPlies = analysis.moves.flatMap((m, i) => (isPlayerError(m) ? [i + 1] : []))
    const prevError = errorPlies.filter((p) => p < ply).pop()
    const nextError = errorPlies.find((p) => p > ply)
    return (
      <main>
        <button className="link" onClick={() => setAnalysis(null)}>
          ← Voltar às partidas
        </button>
        {analysis.warnings?.map((w) => (
          <p className="warning" key={w}>⚠ {w}</p>
        ))}
        <div className="review">
          <div>
          <Board
            fen={fen}
            orientation={analysis.game.user_color}
            canBack={ply > 0}
            canForward={ply < total}
            onStart={() => setPly(0)}
            onBack={() => setPly(ply - 1)}
            onForward={() => setPly(ply + 1)}
            onEnd={() => setPly(total)}
            onExploringChange={onExploringChange}
          />
          <MoveDetail
            move={ply > 0 ? analysis.moves[ply - 1] : null}
            canPrevError={prevError !== undefined}
            canNextError={nextError !== undefined}
            onPrevError={() => setPly(prevError!)}
            onNextError={() => setPly(nextError!)}
          />
          <ExplanationPanel move={ply > 0 ? analysis.moves[ply - 1] : null} />
          </div>
          <MoveList moves={analysis.moves} ply={ply} onSelect={setPly} />
        </div>
        <EvalChart moves={analysis.moves} ply={ply} onSelect={setPly} />
      </main>
    )
  }

  return (
    <main>
      <h1>ChessReview</h1>
      <form onSubmit={searchGames}>
        <input
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="Seu nick do chess.com"
        />
        <button disabled={!username.trim() || loadingGames || analyzing}>
          Buscar partidas
        </button>
      </form>
      {error && <p className="error">{error}</p>}
      {loadingGames && <p>Buscando partidas…</p>}
      {analyzing && <p>Analisando a partida com o Stockfish… depois o LLM explica os erros. Isso pode levar alguns minutos.</p>}
      {!analyzing && <GameList games={games} onSelect={analyze} />}
    </main>
  )
}
