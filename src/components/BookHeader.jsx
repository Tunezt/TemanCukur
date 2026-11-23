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
        <span>PADDY&apos;S</span>
        <span>BARBERSHOP</span>
      </div>

      <span className="book-header__step">{step} / 5</span>
    </header>
  )
}
