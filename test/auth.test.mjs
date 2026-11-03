import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'
import { loadClient, flushRequests } from './helpers/client.mjs'

function loadAuth(storage = new Map(), session = new Map()) {
  const client = loadClient({
    storage,
    session,
    response: {
      status: 200,
      json: async () => ({
        id: '1',
        username: 'reader',
        name: 'Reader',
        email: 'reader@example.com'
      })
    }
  })
  return { ...client, auth: client.load('src/lib/auth.ts') }
}

test('no token blocks entry; login data is reused without another request', async () => {
  const { auth, calls, storage, respond } = loadAuth()
  assert.equal(await auth.checkSession(), null)
  assert.equal(calls.length, 0)
  auth.saveSession('test-token', {
    id: '1',
    username: 'reader',
    name: 'Reader',
    email: 'reader@example.com'
  })
  assert.equal(storage.get(auth.TOKEN_KEY), 'test-token')
  assert.equal((await auth.checkSession()).username, 'reader')
  assert.equal(calls.length, 0)
  assert.equal((await auth.checkSession()).username, 'reader')
  assert.equal(calls.length, 0)
})

test('logout immediately clears local token even if backend is unavailable', async () => {
  const { auth, calls, storage, session, respond } = loadAuth()
  auth.saveSession('test-token', {
    id: '1',
    username: 'reader',
    name: 'Reader',
    email: 'reader@example.com'
  })
  respond(new TypeError('offline'))
  const request = auth.signOut()
  assert.equal(storage.has(auth.TOKEN_KEY), false)
  assert.equal(auth.currentUser.value, null)
  assert.equal(session.has(auth.USER_INFO_KEY), false)
  assert.equal(await request, false)
  assert.equal(calls[0][1].headers.Authorization, 'Bearer test-token')
})

test('login caches public userInfo, restores it after reload and shares reactive display data', async () => {
  const { auth, storage, session } = loadAuth()
  const user = {
    id: '1',
    username: 'reader',
    name: '真实昵称',
    email: 'reader@example.com',
    avatar: 'data:image/png;base64,test',
    bio: 'hello',
    phone: '+86 13800138000',
    about: '关于我',
    skills: ['Vue', 'TypeScript'],
    workExperiences: [
      {
        id: 'work-1',
        company: 'Company',
        position: 'Developer',
        startDate: '2023-05',
        endDate: '',
        description: '研发',
        password_hash: 'must-not-cache'
      }
    ],
    password_hash: 'must-not-cache',
    token: 'must-not-cache'
  }
  auth.saveSession('test-token', user)
  const cached = JSON.parse(session.get('userInfo'))
  assert.equal(cached.name, '真实昵称')
  assert.equal(cached.avatar, user.avatar)
  assert.equal(cached.phone, user.phone)
  assert.equal(cached.about, user.about)
  assert.deepEqual(cached.skills, user.skills)
  assert.equal(cached.workExperiences[0].company, 'Company')
  assert.equal(cached.workExperiences[0].password_hash, undefined)
  assert.equal(cached.password_hash, undefined)
  assert.equal(cached.token, undefined)
  assert.equal(auth.userInfo, auth.currentUser)
  assert.equal(auth.userDisplayName.value, '真实昵称')
  const reloaded = loadAuth(storage, session)
  const restored = reloaded.auth
  assert.equal(restored.userInfo.value.avatar, user.avatar)
  assert.equal(restored.userInfo.value.workExperiences[0].description, '研发')
  assert.equal(restored.userInfo.value.skills[1], 'TypeScript')
  assert.equal(restored.userDisplayName.value, '真实昵称')
  reloaded.respond({
    ok: true,
    status: 200,
    json: async () => ({ ...user, name: '更新后的昵称', avatar: '' })
  })
  await restored.checkSession()
  assert.equal(restored.userDisplayName.value, '更新后的昵称')
  assert.equal(JSON.parse(session.get('userInfo')).avatar, '')
  auth.setUserInfo({ ...user, name: ' ' })
  assert.equal(auth.userDisplayName.value, 'reader')
})

test('expired, offline, malformed and tokenless sessions never retain stale userInfo', async () => {
  const user = { id: '1', username: 'reader', name: 'Reader', email: 'reader@example.com' }
  for (const response of [{ ok: false, status: 401 }, new TypeError('offline')]) {
    const initial = loadAuth()
    initial.auth.saveSession('token', user)
    const { auth, session, respond } = loadAuth(initial.storage, initial.session)
    respond(response)
    assert.equal(await auth.checkSession(), null)
    assert.equal(session.has('userInfo'), false)
  }
  for (const value of ['{broken', '[]', JSON.stringify({ id: 'fake' })]) {
    const session = new Map([['userInfo', value]])
    assert.equal(loadAuth(new Map([['myblob_token', 'token']]), session).auth.userInfo.value, null)
    assert.equal(session.has('userInfo'), false)
  }
  const session = new Map([['userInfo', JSON.stringify(user)]])
  assert.equal(loadAuth(new Map(), session).auth.userInfo.value, null)
  assert.equal(session.has('userInfo'), false)
})

test('delayed session checks cannot resurrect a logged-out user or overwrite a newer login', async () => {
  const user = { id: '1', username: 'reader', name: 'Reader', email: 'reader@example.com' }
  for (const newLogin of [false, true]) {
    const initial = loadAuth()
    initial.auth.saveSession('old-token', user)
    const { auth, session, respond } = loadAuth(initial.storage, initial.session)
    let complete
    respond(
      () =>
        new Promise(resolve => {
          complete = resolve
        })
    )
    const pending = auth.checkSession()
    auth.clearSession()
    if (newLogin) auth.saveSession('new-token', { ...user, id: '2', name: 'New account' })
    await flushRequests()
    complete({ ok: true, status: 200, json: async () => user })
    assert.equal(await pending, null)
    assert.equal(auth.userInfo.value?.name ?? null, newLogin ? 'New account' : null)
    assert.equal(session.has('userInfo'), newLogin)
  }
})

test('route guard redirects guests and allows authenticated home', async () => {
  const source = fs
    .readFileSync(new URL('../src/router/permission.ts', import.meta.url), 'utf8')
    .replace(/^import .*$/gm, '')
  let user = null
  let beforeEach
  const checks = []
  const context = {
    exports: {},
    canAccessPage: loadClient().load('src/config/access.ts').canAccessPage,
    checkSession: async options => {
      checks.push(options.refresh)
      return user
    },
    NProgress: { start() {}, done() {} },
    document: {}
  }
  vm.runInNewContext(
    ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText,
    context
  )
  context.exports.createRouterGuard({
    beforeEach: callback => {
      beforeEach = callback
    },
    afterEach() {},
    onError() {}
  })
  const target = { path: '/home', fullPath: '/home', meta: { title: '首页' } }
  assert.equal((await beforeEach(target)).path, '/login')
  assert.equal(await beforeEach({ path: '/register', meta: {} }), true)
  user = { id: '1' }
  assert.equal(await beforeEach(target), true)
  assert.equal(checks.at(-1), true)
  assert.equal((await beforeEach({ path: '/login', meta: {} })).path, '/home')
  assert.equal(checks.at(-1), false)
  assert.equal(await beforeEach({ path: '/profile', meta: {} }), true)
  assert.equal(checks.at(-1), false)
  for (const permission of ['articleManage', 'roleManage']) {
    const target = { path: '/' + permission, meta: { permission } }
    user = { id: '1', isAdmin: true, roles: [{ id: 2 }] }
    assert.equal((await beforeEach(target)).path, '/article')
    user = { id: '1', roles: [{ id: 1 }] }
    assert.equal(await beforeEach(target), true)
  }
  user = null
  assert.equal(
    (await beforeEach({ path: '/article', fullPath: '/article', meta: {} })).query.redirect,
    '/article'
  )
})
