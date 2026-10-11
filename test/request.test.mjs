import { test } from 'node:test'
import assert from 'node:assert/strict'
import { loadClient, flushRequests } from './helpers/client.mjs'

test('public account APIs omit Bearer tokens and handle 204; protected APIs use the latest token', async () => {
  const client = loadClient({
    storage: new Map([['myblob_token', 'old-token']]),
    response: new Response(null, { status: 204 })
  })
  const auth = client.load('src/api/auth.ts')
  assert.equal(
    await auth.register({ username: 'reader', email: 'r@example.com', password: 'pass' }),
    null
  )
  assert.equal(client.calls[0][1].headers.Authorization, undefined)
  assert.equal(client.calls[0][1].credentials, 'same-origin')
  client.respond(
    new Response('{"token":"new-token"}', { headers: { 'Content-Type': 'application/json' } })
  )
  assert.equal((await auth.login({ username: 'reader', password: 'pass' })).token, 'new-token')
  assert.equal(client.calls[1][1].headers.Authorization, undefined)
  client.storage.set('myblob_token', 'new-token')
  client.respond(new Response('{}'))
  await client.load('src/api/user.ts').getCurrentUser()
  assert.equal(client.calls[2][1].headers.Authorization, 'Bearer new-token')
})

test('JSON and stream HTTP errors preserve status and normalize validation messages', async () => {
  for (const streaming of [false, true]) {
    const client = loadClient({
      response: new Response('{"message":["first","second"]}', { status: 422 })
    })
    const { default: request, requestStream, RequestError } = client.load('src/utils/request.ts')
    await assert.rejects(
      (streaming ? requestStream : request)({ url: '/test' }),
      error =>
        error instanceof RequestError && error.status === 422 && error.message === 'first，second'
    )
  }
  const client = loadClient({ response: new Response('<html>unavailable</html>', { status: 502 }) })
  await assert.rejects(
    client.load('src/utils/request.ts').default({ url: '/test' }),
    error => error.status === 502
  )
})

test('Axios request cancellation and timeout retain the existing error names', async () => {
  const client = loadClient({
    response: request =>
      new Promise((resolve, reject) => {
        request.signal.addEventListener('abort', () => reject(request.signal.reason), {
          once: true
        })
      })
  })
  const { default: request } = client.load('src/utils/request.ts')
  const controller = new AbortController()
  const pending = request({ url: '/test', signal: controller.signal })
  await flushRequests()
  const cancelled = assert.rejects(pending, error => error.name === 'AbortError')
  controller.abort()
  await cancelled
  await assert.rejects(
    request({ url: '/test', timeout: 10 }),
    error => error.name === 'TimeoutError'
  )
})

test('a delayed chat authorization failure does not clear a newer login', async () => {
  let complete
  const client = loadClient({
    storage: new Map([['myblob_token', 'old-token']]),
    response: () =>
      new Promise(resolve => {
        complete = resolve
      })
  })
  const pending = client.load('src/api/chat.ts').listConversations()
  await flushRequests()
  client.storage.set('myblob_token', 'new-token')
  complete(new Response('{}', { status: 401 }))
  await assert.rejects(pending, error => error.status === 401)
  assert.equal(client.storage.get('myblob_token'), 'new-token')
})

test('stopping an active SSE stream cancels its reader and never reports completion', async () => {
  let completed = false
  const client = loadClient({
    response: request =>
      new Response(
        new ReadableStream({
          start(controller) {
            controller.enqueue(
              new TextEncoder().encode('event: delta\ndata: {"text":"partial"}\n\n')
            )
            request.signal.addEventListener(
              'abort',
              () => controller.error(request.signal.reason),
              { once: true }
            )
          }
        }),
        { headers: { 'Content-Type': 'text/event-stream' } }
      )
  })
  const controller = new AbortController()
  const pending = client.load('src/api/chat.ts').streamMessage('c', 'hello', {
    signal: controller.signal,
    onStart() {},
    onDelta() {
      controller.abort()
    },
    onDone() {
      completed = true
    }
  })
  await assert.rejects(pending)
  assert.equal(completed, false)
  // The source errored on abort; Axios still releases the consumer reader in finally.
  assert.equal(client.calls[0][1].signal.aborted, true)
})
