import { useNavigate } from 'react-router-dom'

export default function BookHeader({ step }) {
  const navigate = useNavigate()

  return (
    <header className="book-header">
      <button
        className="book-header__back"
        onClick={() => navigate(-1)}
        aria-label="Kembali"
      >
        ←
      </button>

      <div className="book-header__brand">
        <span>TEMAN</span>
        <span>CUKUR</span>
      </div>

      <span className="book-header__step">{step} / 4</span>
    </header>
  )
}
