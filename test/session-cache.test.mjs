import { test } from 'node:test'
import assert from 'node:assert/strict'
import { loadClient, flushRequests } from './helpers/client.mjs'

const user = { id: '1', username: 'reader', name: 'Reader', email: 'reader@example.com' }
function setup() {
  const client = loadClient({ response: new Response(JSON.stringify(user)) })
  return { ...client, auth: client.load('src/lib/auth.ts') }
}

test('login and normal navigation reuse login data; reload validates once', async () => {
  const initial = setup()
  initial.auth.saveSession('token', user)
  await initial.auth.checkSession()
  await initial.auth.checkSession()
  assert.equal(initial.calls.length, 0)
  const reloaded = loadClient({
    storage: initial.storage, session: initial.session,
    response: new Response(JSON.stringify({ ...user, name: 'Updated' }))
  })
  const auth = reloaded.load('src/lib/auth.ts')
  assert.equal((await auth.checkSession()).name, 'Updated')
  await auth.checkSession()
  await auth.checkSession()
  assert.equal(reloaded.calls.length, 1)
})

test('concurrent navigation shares a check; a late response cannot overwrite a new login', async () => {
  const initial = setup()
  initial.auth.saveSession('old-token', user)
  let finish
  const client = loadClient({
    storage: initial.storage, session: initial.session,
    response: () => new Promise(resolve => { finish = resolve })
  })
  const auth = client.load('src/lib/auth.ts')
  const first = auth.checkSession()
  const second = auth.checkSession()
  await flushRequests()
  assert.equal(client.calls.length, 1)
  auth.saveSession('new-token', { ...user, id: '2', name: 'New account' })
  finish(new Response(JSON.stringify(user)))
  assert.equal(await first, null)
  assert.equal(await second, null)
  assert.equal((await auth.checkSession()).name, 'New account')
  assert.equal(client.calls.length, 1)
})

test('logout or external token removal invalidates the cached session', async () => {
  const { auth, storage, calls } = setup()
  auth.saveSession('token', user)
  storage.delete('myblob_token')
  assert.equal(await auth.checkSession(), null)
  assert.equal(auth.currentUser.value, null)
  assert.equal(calls.length, 0)
  auth.saveSession('next-token', user)
  auth.clearSession()
  assert.equal(await auth.checkSession(), null)
})


test('homepage refresh fetches edited profile on every entry; other pages reuse it', async () => {
  const { auth, calls, respond, session } = setup()
  auth.saveSession('token', user)
  respond(new Response(JSON.stringify({ ...user, name: 'Edited profile', about: 'New bio' })))
  const first = auth.checkSession({ refresh: true })
  const concurrent = auth.checkSession({ refresh: true })
  assert.equal((await first).name, 'Edited profile')
  assert.equal((await concurrent).name, 'Edited profile')
  assert.equal(calls.length, 1)
  assert.equal(JSON.parse(session.get('userInfo')).about, 'New bio')
  await auth.checkSession()
  assert.equal(calls.length, 1)
  respond(new Response(JSON.stringify({ ...user, name: 'Edited again' })))
  assert.equal((await auth.checkSession({ refresh: true })).name, 'Edited again')
  assert.equal(calls.length, 2)
})
