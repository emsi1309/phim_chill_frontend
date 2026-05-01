import { ref } from 'vue'

export const API_ORIGIN = 'http://localhost:8081'
export const API_BASE = 'http://localhost:8081/api'
export const token = ref(localStorage.getItem('token') || '')
export const currentUser = ref(localStorage.getItem('username') || '')

export function resolveMediaUrl(url?: string) {
  if (!url) return ''
  if (url.startsWith('http://') || url.startsWith('https://')) return url
  if (url.startsWith('/')) return `${API_ORIGIN}${url}`
  return `${API_ORIGIN}/${url}`
}

export function authHeaders() {
  return {
    'Content-Type': 'application/json',
    ...(token.value ? { Authorization: `Bearer ${token.value}` } : {})
  }
}

export function saveAuth(nextToken: string, username: string) {
  token.value = nextToken
  currentUser.value = username
  localStorage.setItem('token', nextToken)
  localStorage.setItem('username', username)
}

export function clearAuth() {
  token.value = ''
  currentUser.value = ''
  localStorage.removeItem('token')
  localStorage.removeItem('username')
}
