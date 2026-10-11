import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'

function loadAuth() {
  const storage = new Map()
  const calls = []
  let response = { ok: true, status: 200, json: async () => ({ id: '1', username: 'reader' }) }
  const source = fs.readFileSync(new URL('../src/lib/auth.ts', import.meta.url), 'utf8').replace("import { ref } from 'vue'", 'const ref = value => ({ value })')
  const context = {
    exports: {}, AbortSignal,
    localStorage: { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) },
    fetch: async (...args) => { calls.push(args); if (response instanceof Error) throw response; return response }
  }
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, context)
  return { auth: context.exports, calls, storage, respond: value => { response = value } }
}

test('no token blocks entry; saved token restores user; expired token is cleared', async () => {
  const { auth, calls, storage, respond } = loadAuth()
  assert.equal(await auth.checkSession(), null)
  assert.equal(calls.length, 0)
  auth.saveSession('test-token', { id: '1', username: 'reader' })
  assert.equal(storage.get(auth.TOKEN_KEY), 'test-token')
  assert.equal((await auth.checkSession()).username, 'reader')
  assert.equal(calls[0][1].headers.Authorization, 'Bearer test-token')
  respond({ status: 401, ok: false })
  assert.equal(await auth.checkSession(), null)
  assert.equal(storage.has(auth.TOKEN_KEY), false)
})

test('logout immediately clears local token even if backend is unavailable', async () => {
  const { auth, calls, storage, respond } = loadAuth()
  auth.saveSession('test-token', { id: '1', username: 'reader' })
  respond(new TypeError('offline'))
  const request = auth.signOut()
  assert.equal(storage.has(auth.TOKEN_KEY), false)
  assert.equal(auth.currentUser.value, null)
  assert.equal(await request, false)
  assert.equal(calls[0][1].headers.Authorization, 'Bearer test-token')
})

test('route guard redirects guests and allows authenticated home', async () => {
  const source = fs.readFileSync(new URL('../src/router/permission.ts', import.meta.url), 'utf8').replace(/^import .*$/gm, '')
  let user = null
  let beforeEach
  const context = { exports: {}, checkSession: async () => user, NProgress: { start() {}, done() {} }, document: {} }
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, context)
  context.exports.createRouterGuard({ beforeEach: callback => { beforeEach = callback }, afterEach() {}, onError() {} })
  const target = { path: '/home', fullPath: '/home', meta: { title: '首页' } }
  assert.equal((await beforeEach(target)).path, '/login')
  assert.equal(await beforeEach({ path: '/register', meta: {} }), true)
  user = { id: '1' }
  assert.equal(await beforeEach(target), true)
  assert.equal((await beforeEach({ path: '/login', meta: {} })).path, '/home')
  user = null
  assert.equal((await beforeEach({ path: '/article', fullPath: '/article', meta: {} })).query.redirect, '/article')
})
