// Admin session token issued by the backend (POST /api/admin/login): '<expiry-unix>.<signature>'.
// The password and signing secret live only on the server.
const STORAGE_KEY = 'tc_admin_token'

export function getAdminToken() {
  try {
    return localStorage.getItem(STORAGE_KEY) || ''
  } catch {
    return ''
  }
}

export function isAdminAuthenticated() {
  const exp = Number(getAdminToken().split('.')[0])
  return Number.isFinite(exp) && exp * 1000 > Date.now()
}

export function setAdminToken(token) {
  localStorage.setItem(STORAGE_KEY, token)
}

export function clearAdminAuth() {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    /* storage blocked: nothing to clear */
  }
}
