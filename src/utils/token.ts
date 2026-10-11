export const TOKEN_KEY = 'myblob_token'

export function getToken() {
  return localStorage.getItem(TOKEN_KEY)
}
