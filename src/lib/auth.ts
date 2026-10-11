import { ref } from 'vue'

export interface CurrentUser {
  id: string
  username: string
  name: string
  email: string
}
export const currentUser = ref<CurrentUser | null>(null)
export const TOKEN_KEY = 'myblob_token'

export function authHeaders(): Record<string, string> {
  const token = localStorage.getItem(TOKEN_KEY)
  return token ? { Authorization: `Bearer ${token}` } : {}
}

export function saveSession(token: string, user: CurrentUser) {
  localStorage.setItem(TOKEN_KEY, token)
  currentUser.value = user
}

export function clearSession() {
  localStorage.removeItem(TOKEN_KEY)
  currentUser.value = null
}

// 每次进入系统都向后端确认会话，过期或注销后不可继续进入。
export async function checkSession() {
  if (!localStorage.getItem(TOKEN_KEY)) {
    currentUser.value = null
    return null
  }
  try {
    const response = await fetch('/api/users/me', {
      headers: authHeaders(),
      signal: AbortSignal.timeout(10000)
    })
    if (response.status === 401) clearSession()
    currentUser.value = response.ok ? await response.json() : null
  } catch {
    currentUser.value = null
  }
  return currentUser.value
}

export async function signOut() {
  const headers = authHeaders()
  // 先清理本地登录状态，网络异常也不会阻止退出系统。
  clearSession()
  try {
    const response = await fetch('/api/users/logout', {
      method: 'POST',
      headers,
      signal: AbortSignal.timeout(5000)
    })
    return response.ok
  } catch {
    return false
  }
}
