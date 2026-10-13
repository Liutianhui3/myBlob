import request from '../utils/request'
import type { CurrentUser } from './types'
import type { CaptchaProof } from '../lib/captcha'

export interface LoginPayload {
  username: string
  password: string
}

export interface RegisterPayload extends LoginPayload {
  email: string
}

export interface LoginResult {
  token: string
  user: CurrentUser
}

export const login = (data: LoginPayload & Partial<CaptchaProof>) =>
  request<LoginResult>({ url: '/users/login', method: 'POST', data, authenticated: false })

export const register = (data: RegisterPayload) =>
  request<CurrentUser | null>({
    url: '/users/register',
    method: 'POST',
    data,
    authenticated: false
  })

// Logout uses the captured token after the local session has already been cleared.
export const logout = (token: string | null) =>
  request<void>({
    url: '/users/logout',
    method: 'POST',
    timeout: 5000,
    authenticated: false,
    headers: token ? { Authorization: `Bearer ${token}` } : {}
  })
