import { test } from 'node:test'
import assert from 'node:assert/strict'
import { loadClient } from './helpers/client.mjs'

const user = { id: '7', username: 'reader', name: 'Reader', email: 'reader@example.com' }

test('page permissions use role IDs, deny missing roles and ignore legacy isAdmin', () => {
  const { canAccessPage, PAGE_ACCESS } = loadClient().load('src/config/access.ts')
  for (const permission of ['articleManage', 'roleManage']) {
    for (const id of [1, '1'])
      assert.equal(canAccessPage({ ...user, roles: [{ id }] }, permission), true)
    for (const roles of [undefined, [], [{ id: 2, name: '管理员' }]]) {
      assert.equal(canAccessPage({ ...user, isAdmin: true, roles }, permission), false)
    }
    assert.equal(canAccessPage(null, permission), false)
  }
  assert.equal(canAccessPage({ ...user, roles: [{ id: 1 }] }, 'unknown'), false)
  PAGE_ACCESS.articleManage = ['2']
  assert.equal(canAccessPage({ ...user, roles: [{ id: 2 }] }, 'articleManage'), true)
  assert.equal(canAccessPage({ ...user, roles: [{ id: 2 }] }, 'roleManage'), false)
})

test('login roles are sanitized, cached and restored; me refresh replaces stale roles', async () => {
  const storage = new Map()
  const session = new Map()
  const client = loadClient({ storage, session })
  const auth = client.load('src/lib/auth.ts')
  const roles = [{ id: 1, name: '管理员', privateField: 'not cached' }, null, { name: 'bad' }]
  auth.saveSession('token', { ...user, roles })
  assert.deepEqual(JSON.parse(session.get('userInfo')).roles, [{ id: 1, name: '管理员' }])
  roles[0].id = 2
  assert.equal(auth.currentUser.value.roles[0].id, 1)
  const reloaded = loadClient({
    storage,
    session,
    response: new Response(JSON.stringify({ ...user, roles: [{ id: '2', name: '编辑' }] }))
  })
  const restored = reloaded.load('src/lib/auth.ts')
  assert.equal(restored.currentUser.value.roles[0].id, 1)
  await restored.checkSession()
  assert.deepEqual(JSON.parse(session.get('userInfo')).roles, [{ id: '2', name: '编辑' }])
  restored.clearSession()
  assert.equal(session.has('userInfo'), false)
})


test('article editors can manage articles but cannot manage user roles', () => {
  const { canAccessPage } = loadClient().load('src/config/access.ts')
  for (const id of [3, '3']) {
    assert.equal(canAccessPage({ ...user, roles: [{ id }] }, 'articleManage'), true)
    assert.equal(canAccessPage({ ...user, roles: [{ id }] }, 'roleManage'), false)
  }
})
