import type { Classification, Move } from './types'

export const CLASS_LABEL: Record<Classification, string> = {
  brilliant: 'Brilhante',
  great: 'Ótimo',
  book: 'Livro',
  best: 'Melhor',
  excellent: 'Excelente',
  good: 'Bom',
  inaccuracy: 'Imprecisão',
  mistake: 'Erro',
  miss: 'Chance perdida',
  blunder: 'Blunder',
}

export const CLASS_SYMBOL: Record<Classification, string> = {
  brilliant: '!!',
  great: '!',
  book: '📖',
  best: '★',
  excellent: '✓',
  good: '○',
  inaccuracy: '?!',
  mistake: '?',
  miss: '✗',
  blunder: '??',
}

export const CLASS_COLOR: Record<Classification, string> = {
  brilliant: '#1baca6',
  great: '#5c8bb0',
  book: '#a88865',
  best: '#96bc4b',
  excellent: '#96bc4b',
  good: '#81b64c',
  inaccuracy: '#f0c040',
  mistake: '#f08a30',
  miss: '#ff7769',
  blunder: '#e5484d',
}

// Classes que contam como "erro" (navegação, gráfico). Explicação do LLM: todas menos imprecisão.
const ERROR_CLASSES: Classification[] = ['inaccuracy', 'mistake', 'miss', 'blunder']
export const EXPLAINED_CLASSES: Classification[] = ['mistake', 'miss', 'blunder']

export function isPlayerError(move: Move): boolean {
  return move.is_player && ERROR_CLASSES.includes(move.classification)
}

// Avaliação em centipawns -> texto (±10000 é mate)
export function formatEval(cp: number): string {
  if (Math.abs(cp) >= 9000) return cp > 0 ? 'mate a favor' : 'mate contra'
  const pawns = (cp / 100).toFixed(2)
  return cp > 0 ? `+${pawns}` : pawns
}
