import { IconBack } from './icons'

interface Props {
  onBack?: () => void // só na tela de revisão
}

export default function Header({ onBack }: Props) {
  return (
    <header className="topbar">
      <div className="topbar-inner">
        <a className="brand" href="/" aria-label="Chess AI Analyzer">
          <img className="logo" src="/brand/logo-horizontal.svg" alt="" height={32} />
        </a>
        <div className="topbar-actions">
          {onBack && (
            <button className="btn btn-ghost" onClick={onBack} aria-label="Voltar para outras partidas">
              <IconBack /> <span className="back-label">Outras partidas</span>
            </button>
          )}
        </div>
      </div>
    </header>
  )
}
