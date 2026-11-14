import type { Classification, Move } from './types'

interface Quality {
  label: string
  glyph: string // texto dentro do selo; o livro é desenhado em Quality.tsx
}

// As 11 classes do chess.com, cada uma com cor própria (--quality-<classe> em tokens.css/index.css)
// e símbolo próprio: a cor nunca é o único sinal.
export const QUALITY: Record<Classification, Quality> = {
  brilliant: { label: 'Brilhante', glyph: '!!' },
  great: { label: 'Ótimo lance', glyph: '!' },
  best: { label: 'Melhor lance', glyph: '★' },
  excellent: { label: 'Excelente', glyph: '✓✓' },
  good: { label: 'Bom lance', glyph: '✓' },
  book: { label: 'Livro', glyph: '' },
  forced: { label: 'Forçado', glyph: '→' },
  inaccuracy: { label: 'Imprecisão', glyph: '?!' },
  mistake: { label: 'Erro', glyph: '?' },
  miss: { label: 'Chance perdida', glyph: '✕' },
  blunder: { label: 'Erro grave', glyph: '??' },
}

// Ordem de exibição: do melhor ao pior.
export const QUALITY_ORDER = Object.keys(QUALITY) as Classification[]

export function qualityColor(c: Classification): string {
  return `var(--quality-${c})`
}

// Classes que contam como "erro" (navegação, gráfico). Explicação da IA: todas menos imprecisão.
const ERROR_CLASSES: Classification[] = ['inaccuracy', 'mistake', 'miss', 'blunder']
export const EXPLAINED_CLASSES: Classification[] = ['mistake', 'miss', 'blunder']

export function isError(c: Classification): boolean {
  return ERROR_CLASSES.includes(c)
}

export function isPlayerError(move: Move): boolean {
  return move.is_player && isError(move.classification)
}

// As avaliações guardadas são do ponto de vista de quem jogou; a interface usa o das brancas.
export function toWhite(move: Move, cp: number): number {
  return move.color === 'white' ? cp : -cp
}

// Centipawns -> "+2,4", "-0,6", "M3" (vírgula decimal, sinal explícito; positivo favorece as brancas).
export function formatEval(cp: number): string {
  if (Math.abs(cp) >= 9000) {
    const n = 10000 - Math.abs(cp)
    return `${cp < 0 ? '-' : '+'}M${n}`
  }
  const pawns = Math.abs(cp) / 100
  const text = (pawns >= 10 ? Math.round(pawns).toString() : pawns.toFixed(1)).replace('.', ',')
  if (text === '0,0') return '0,0'
  return `${cp < 0 ? '-' : '+'}${text}`
}

// "600" -> "10 min", "180+2" -> "3+2 min", "1/86400" fica como veio.
export function formatTimeControl(tc: string | null): string {
  if (!tc) return ''
  const plus = tc.match(/^(\d+)\+(\d+)$/)
  if (plus) return `${Number(plus[1]) / 60}+${plus[2]} min`
  if (/^\d+$/.test(tc)) {
    const s = Number(tc)
    return s >= 60 ? `${s / 60} min` : `${s} s`
  }
  return tc
}
