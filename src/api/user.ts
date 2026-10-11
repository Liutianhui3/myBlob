import request from '../utils/request'
import type { CurrentUser, UserProfile } from './types'

export const getCurrentUser = () => request<CurrentUser>({ url: '/users/me', timeout: 10000 })

export const updateUserProfile = (data: UserProfile) =>
  request<CurrentUser>({ url: '/users/me', method: 'PATCH', data })
