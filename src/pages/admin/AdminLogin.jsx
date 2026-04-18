import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import {
  ADMIN_LOGIN_PASSWORD,
  isAdminAuthenticated,
  setAdminAuthenticated,
} from '../../admin/auth'
import '../../admin/admin.css'

export default function AdminLogin() {
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  if (isAdminAuthenticated()) {
    return <Navigate to="/admin/dashboard" replace />
  }

  const submit = (e) => {
    e.preventDefault()
    setError('')
    if (password !== ADMIN_LOGIN_PASSWORD) {
      setError('Kata sandi salah. Coba lagi.')
      return
    }
    setBusy(true)
    setAdminAuthenticated()
    navigate('/admin/dashboard', { replace: true })
    setBusy(false)
  }

  return (
    <div className="adm adm-login">
      <div className="adm-login__panel">
        <p className="adm-login__brand">
          <span className="adm-login__brand-sans">teman</span>{' '}
          <span className="adm-login__brand-serif">cukur</span>
        </p>
        <form className="adm-login__form" onSubmit={submit} autoComplete="off">
          <label className="adm-login__label" htmlFor="adm-pw">
            Kata sandi
          </label>
          <input
            id="adm-pw"
            className="adm-login__input"
            type="password"
            name="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
          />
          {error ? (
            <p className="adm-login__err" role="alert">
              {error}
            </p>
          ) : null}
          <button className="adm-login__btn" type="submit" disabled={busy}>
            Masuk
          </button>
        </form>
      </div>
    </div>
  )
}
