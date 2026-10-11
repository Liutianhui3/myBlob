import { computed, ref } from 'vue'

export interface WorkExperience {
  id: string
  company: string
  position: string
  startDate: string
  endDate: string
  description: string
}

export interface CurrentUser {
  id: string
  username: string | null
  name: string
  email: string
  location?: string
  website?: string
  bio?: string
  avatar?: string
  phone?: string
  about?: string
  skills?: string[]
  workExperiences?: WorkExperience[]
  createdAt?: string
  updatedAt?: string
}
export const TOKEN_KEY = 'myblob_token'
export const USER_INFO_KEY = 'userInfo'

function publicUserInfo(value: unknown): CurrentUser | null {
  if (!value || typeof value !== 'object') return null
  const user = value as Record<string, unknown>
  if (
    typeof user.id !== 'string' ||
    !user.id ||
    (typeof user.username !== 'string' && user.username !== null) ||
    typeof user.name !== 'string' ||
    typeof user.email !== 'string'
  )
    return null
  const result: CurrentUser = {
    id: user.id,
    username: user.username,
    name: user.name,
    email: user.email
  }
  for (const key of [
    'location',
    'website',
    'bio',
    'avatar',
    'phone',
    'about',
    'createdAt',
    'updatedAt'
  ] as const) {
    if (typeof user[key] === 'string') result[key] = user[key]
  }
  if (Array.isArray(user.skills)) {
    result.skills = user.skills.filter((skill): skill is string => typeof skill === 'string')
  }
  if (Array.isArray(user.workExperiences)) {
    const fields = ['id', 'company', 'position', 'startDate', 'endDate', 'description'] as const
    result.workExperiences = user.workExperiences
      .filter(item => item && fields.every(key => typeof item[key] === 'string'))
      .map(
        item => Object.fromEntries(fields.map(key => [key, item[key]])) as unknown as WorkExperience
      )
  }
  return result
}

function restoreUserInfo(): CurrentUser | null {
  try {
    const user = localStorage.getItem(TOKEN_KEY)
      ? publicUserInfo(JSON.parse(sessionStorage.getItem(USER_INFO_KEY) || 'null'))
      : null
    if (!user) sessionStorage.removeItem(USER_INFO_KEY)
    return user
  } catch {
    try {
      sessionStorage.removeItem(USER_INFO_KEY)
    } catch {
      /* Storage can be disabled. */
    }
    return null
  }
}

// Components use this reactive view of sessionStorage.userInfo so edits update immediately.
export const userInfo = ref<CurrentUser | null>(restoreUserInfo())
export const currentUser = userInfo
export const userDisplayName = computed(
  () => userInfo.value?.name.trim() || userInfo.value?.username || '我的账户'
)

export function setUserInfo(user: CurrentUser | null) {
  userInfo.value = publicUserInfo(user)
  try {
    if (userInfo.value) sessionStorage.setItem(USER_INFO_KEY, JSON.stringify(userInfo.value))
    else sessionStorage.removeItem(USER_INFO_KEY)
  } catch {
    // Cache failures must not turn a successful login or database save into a failure.
    try {
      sessionStorage.removeItem(USER_INFO_KEY)
    } catch {
      /* Storage can be disabled. */
    }
  }
}

export function authHeaders(): Record<string, string> {
  const token = localStorage.getItem(TOKEN_KEY)
  return token ? { Authorization: `Bearer ${token}` } : {}
}

export function saveSession(token: string, user: CurrentUser) {
  localStorage.setItem(TOKEN_KEY, token)
  setUserInfo(user)
}

export function clearSession() {
  localStorage.removeItem(TOKEN_KEY)
  setUserInfo(null)
}

// 每次进入系统都向后端确认会话，过期或注销后不可继续进入。
export async function checkSession() {
  const token = localStorage.getItem(TOKEN_KEY)
  if (!token) {
    setUserInfo(null)
    return null
  }
  try {
    const response = await fetch('/api/users/me', {
      headers: authHeaders(),
      signal: AbortSignal.timeout(10000)
    })
    const user = response.ok ? await response.json() : null
    if (localStorage.getItem(TOKEN_KEY) !== token) return null
    if (response.status === 401) clearSession()
    else setUserInfo(user)
  } catch {
    if (localStorage.getItem(TOKEN_KEY) !== token) return null
    setUserInfo(null)
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
