const STORAGE_KEY = 'tc_admin_auth'

export function isAdminAuthenticated() {
  return localStorage.getItem(STORAGE_KEY) === '1'
}

export function setAdminAuthenticated() {
  localStorage.setItem(STORAGE_KEY, '1')
}

export function clearAdminAuth() {
  localStorage.removeItem(STORAGE_KEY)
}

export const ADMIN_LOGIN_PASSWORD = 'temancukur2026'
