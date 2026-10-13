import request, { RequestError } from '@/utils/request'
import { clearSession } from '@/lib/auth'
import { getToken } from '@/utils/token'
export interface RoleUser {
  id: string
  username: string | null
  name: string
  email: string
  isAdmin: boolean
  createdAt: string
}
export interface RolePage {
  items: RoleUser[]
  total: number
  page: number
  limit: number
}
async function send<T>(config: Parameters<typeof request>[0]) {
  const token = getToken()
  try {
    return await request<T>(config)
  } catch (e) {
    if (e instanceof RequestError && e.status === 401 && token === getToken()) clearSession()
    throw e
  }
}
export const listRoleUsers = (
  params: { page: number; q: string; role: string },
  signal?: AbortSignal
) => send<RolePage>({ url: '/admin/users', params, signal })
export const setUserRole = (id: string, isAdmin: boolean) =>
  send<RoleUser>({
    url: `/admin/users/${encodeURIComponent(id)}/role`,
    method: 'PATCH',
    data: { isAdmin }
  })
