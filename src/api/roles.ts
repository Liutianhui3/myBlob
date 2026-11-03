import request from '@/utils/request'

export interface Role {
  id: number
  name: string
  nameCn: string
}
export interface RoleUser {
  id: string
  username: string | null
  name: string
  email: string
  roles: Role[]
  createdAt: string
}
export interface RolePage {
  items: RoleUser[]
  total: number
  page: number
  limit: number
}
export const listRoles = () => request<Role[]>({ url: '/admin/roles' })
export const listRoleUsers = (
  params: { page: number; q: string; role: string },
  signal?: AbortSignal
) => request<RolePage>({ url: '/admin/users', params, signal })
export const setUserRole = (id: string, roleIds: number[]) =>
  request<RoleUser>({
    url: `/admin/users/${encodeURIComponent(id)}/role`,
    method: 'PATCH',
    data: { roleIds }
  })
