export const TOKEN_KEY = 'myblob_token'
export const TOKEN_EXPIRE_KEY = 'myblob_token_expire'

// Token 过期时间(毫秒) - 30秒用于测试,生产环境建议设置为 7 * 24 * 60 * 60 * 1000 (7天)
export const TOKEN_EXPIRE_TIME = 7 * 24 * 60 * 60 * 1000 // 30秒

export function getToken() {
  return localStorage.getItem(TOKEN_KEY)
}

export function setToken(token: string) {
  const expireTime = Date.now() + TOKEN_EXPIRE_TIME
  localStorage.setItem(TOKEN_KEY, token)
  localStorage.setItem(TOKEN_EXPIRE_KEY, expireTime.toString())
}

export function removeToken() {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(TOKEN_EXPIRE_KEY)
}

export function isTokenExpired(): boolean {
  const token = getToken()
  if (!token) return true

  const expireTime = localStorage.getItem(TOKEN_EXPIRE_KEY)
  if (!expireTime) return false

  return Date.now() > parseInt(expireTime)
}
