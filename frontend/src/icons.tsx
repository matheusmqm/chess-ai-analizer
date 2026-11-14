import type { ReactNode } from 'react'

// Ícones de contorno: 20px, traço 1.75, pontas redondas, cor herdada (currentColor).
function Icon({ children, size = 20 }: { children: ReactNode; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  )
}

export const IconFirst = () => (
  <Icon>
    <path d="m11 17-5-5 5-5" />
    <path d="m18 17-5-5 5-5" />
  </Icon>
)
export const IconPrev = () => (
  <Icon>
    <path d="m15 18-6-6 6-6" />
  </Icon>
)
export const IconNext = () => (
  <Icon>
    <path d="m9 18 6-6-6-6" />
  </Icon>
)
export const IconLast = () => (
  <Icon>
    <path d="m6 17 5-5-5-5" />
    <path d="m13 17 5-5-5-5" />
  </Icon>
)
export const IconFlip = () => (
  <Icon>
    <path d="m21 16-4 4-4-4" />
    <path d="M17 20V4" />
    <path d="m3 8 4-4 4 4" />
    <path d="M7 4v16" />
  </Icon>
)
export const IconAlert = () => (
  <Icon>
    <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
    <path d="M12 9v4M12 17h.01" />
  </Icon>
)
export const IconUndo = () => (
  <Icon>
    <path d="M9 14 4 9l5-5" />
    <path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11" />
  </Icon>
)
export const IconBack = () => (
  <Icon>
    <path d="m12 19-7-7 7-7" />
    <path d="M19 12H5" />
  </Icon>
)
export const IconSearch = () => (
  <Icon>
    <circle cx="11" cy="11" r="7" />
    <path d="m21 21-4.3-4.3" />
  </Icon>
)
export const IconArrowRight = () => (
  <Icon>
    <path d="M5 12h14" />
    <path d="m12 5 7 7-7 7" />
  </Icon>
)
