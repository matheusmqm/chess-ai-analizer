import { QUALITY, qualityColor } from './labels'
import type { Classification } from './types'

interface BadgeProps {
  quality: Classification
  size?: 'sm' | 'md' // 16px na lista, 22px no tabuleiro e nos títulos
  className?: string
}

// Livrinho aberto, desenhado com traços simples (o design system não usa emoji).
function BookGlyph() {
  return (
    <svg viewBox="0 0 16 16" width="68%" height="68%" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M8 3.6C6.6 2.7 4.6 2.5 2.4 2.8v9.2c2.2-.3 4.2-.1 5.6.8 1.4-.9 3.4-1.1 5.6-.8V2.8C11.4 2.5 9.4 2.7 8 3.6Z" />
      <path d="M8 3.6v9.2" />
    </svg>
  )
}

// Círculo preenchido com o símbolo da classe. Todas as classes têm selo.
export function QualityBadge({ quality, size = 'sm', className = '' }: BadgeProps) {
  const q = QUALITY[quality]
  const long = q.glyph.length > 1
  return (
    <span
      className={`badge badge-${size} ${long ? 'badge-long' : ''} ${className}`}
      style={{ '--q': qualityColor(quality) } as React.CSSProperties}
      role="img"
      aria-label={q.label}
    >
      {quality === 'book' ? <BookGlyph /> : q.glyph}
    </span>
  )
}

// Fora da lista, a qualidade vira uma etiqueta: selo + rótulo em português.
export function QualityTag({ quality }: { quality: Classification }) {
  return (
    <span className="tag">
      <QualityBadge quality={quality} size="md" />
      <span className="label">{QUALITY[quality].label}</span>
    </span>
  )
}
