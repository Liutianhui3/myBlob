import type { CurrentUser } from '../api/types'

// Configure page access here. Role IDs come from the server, never from role names/isAdmin.
export const ROLE_IDS = { administrator: '1', editor: '3' } as const
export const PAGE_ACCESS = {
  articleManage: [ROLE_IDS.administrator, ROLE_IDS.editor],
  roleManage: [ROLE_IDS.administrator]
} satisfies Record<string, readonly string[]>
export type PagePermission = keyof typeof PAGE_ACCESS

export function canAccessPage(user: CurrentUser | null | undefined, permission: unknown): boolean {
  if (typeof permission !== 'string' || !Object.hasOwn(PAGE_ACCESS, permission)) return false
  const allowed: readonly string[] = PAGE_ACCESS[permission as PagePermission]
  return !!user?.roles?.some(role => allowed.includes(String(role.id)))
}
