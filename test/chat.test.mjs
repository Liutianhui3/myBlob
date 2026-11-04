import { test } from 'node:test'
import assert from 'node:assert/strict'
import { loadClient } from './helpers/client.mjs'

function client(response) {
  const storage = new Map([['myblob_token', 'test-token']])
  const client = loadClient({ storage, response })
  return {
    ...client,
    api: client.load('src/api/chat.ts'),
    cleared: () => !storage.has('myblob_token')
  }
}

function sseResponse(text, chunkSize = 1) {
  const bytes = new TextEncoder().encode(text)
  return new Response(
    new ReadableStream({
      start(controller) {
        for (let i = 0; i < bytes.length; i += chunkSize)
          controller.enqueue(bytes.slice(i, i + chunkSize))
        controller.close()
      }
    }),
    { headers: { 'Content-Type': 'text/event-stream' } }
  )
}

test('image generation event notifies UI without adding status text to message content', async () => {
  const wire =
    'event: image_generation\ndata: {"status":"generating"}\n\nevent: delta\ndata: {"text":"image result"}\n\nevent: done\ndata: {"messageId":"reply"}\n\n'
  const { api } = client(sseResponse(wire))
  const events = []
  await api.streamMessage('conversation', 'draw', {
    signal: new AbortController().signal,
    onStart() {},
    onImageGeneration() {
      events.push('image-generating')
    },
    onDelta(text) {
      events.push(text)
    },
    onDone() {
      events.push('done')
    }
  })
  assert.deepEqual(events, ['image-generating', 'image result', 'done'])
})

const callbacks = overrides => ({
  signal: new AbortController().signal,
  onStart() {},
  onDelta() {},
  onDone() {},
  ...overrides
})

test('model and reasoning effort are sent with each turn; the legacy call remains content-only', async () => {
  const wire = 'event: done\ndata: {"messageId":"reply"}\n\n'
  const configured = client(sseResponse(wire))
  await configured.api.streamMessage('conversation', 'hello', callbacks({}), {
    model: 'chosen-model',
    reasoningEffort: 'high'
  })
  assert.deepEqual(JSON.parse(configured.calls[0][1].body), {
    content: 'hello',
    model: 'chosen-model',
    reasoningEffort: 'high'
  })
  const legacy = client(sseResponse(wire))
  await legacy.api.streamMessage('conversation', 'hello', callbacks({}))
  assert.deepEqual(JSON.parse(legacy.calls[0][1].body), { content: 'hello' })
})

test('SSE handles UTF-8 split inside Chinese characters, CRLF boundaries and heartbeat', async () => {
  const wire =
    ': ping\r\n\r\nevent: start\r\ndata: {"conversationId":"c","userMessageId":"u","messageId":"a"}\r\n\r\nevent: delta\r\ndata: {"text":"你好"}\r\n\r\nevent: delta\r\ndata: {"text":"，世界"}\r\n\r\nevent: done\r\ndata: {"messageId":"a","finishReason":"length"}\r\n\r\n'
  const { api, calls } = client(sseResponse(wire))
  let reply = ''
  let start
  let completion
  await api.streamMessage(
    'c',
    '你好',
    callbacks({
      onStart: data => {
        start = data
      },
      onDelta: text => {
        reply += text
      },
      onDone: data => {
        completion = data
      }
    })
  )
  assert.equal(reply, '你好，世界')
  assert.equal(start.userMessageId, 'u')
  assert.equal(completion.finishReason, 'length')
  assert.equal(calls[0][1].headers.Authorization, 'Bearer test-token')
  assert.deepEqual(JSON.parse(calls[0][1].body), { content: '你好' })
})

test('HTTP authorization failures clear expired session and preserve status', async () => {
  const { api, cleared } = client(
    new Response(JSON.stringify({ message: 'Unauthorized' }), { status: 401 })
  )
  await assert.rejects(api.listConversations(), error => error.status === 401)
  assert.equal(cleared(), true)
})

test('stream error and premature EOF never report success', async () => {
  for (const wire of [
    'event: error\ndata: {"statusCode":503,"message":"模型未配置"}\n\n',
    'event: delta\ndata: {"text":"半句"}\n\n'
  ]) {
    const { api } = client(sseResponse(wire, 3))
    let done = false
    await assert.rejects(
      api.streamMessage(
        'c',
        'test',
        callbacks({
          onDone: () => {
            done = true
          }
        })
      )
    )
    assert.equal(done, false)
  }
})

test('history keeps bigint pagination cursor as an encoded string', async () => {
  const { api, calls } = client(new Response('[]'))
  await api.getMessages('c', '9223372036854775807')
  assert.equal(calls[0][0], '/api/conversations/c/messages?limit=50&before=9223372036854775807')
})

test('generated Office files arrive as structured events without JSON in the reply text', async () => {
  const file = {
    id: 'file-1',
    name: '报告.docx',
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    size: 1024,
    downloadUrl: '/download'
  }
  const wire = `event: file_generation\ndata: {"status":"generating"}\n\nevent: file\ndata: ${JSON.stringify(file)}\n\nevent: done\ndata: {"messageId":"reply"}\n\n`
  const { api } = client(sseResponse(wire))
  const events = []
  await api.streamMessage(
    'conversation',
    '生成 Word',
    callbacks({
      onFileGeneration() {
        events.push('generating')
      },
      onFile(value) {
        events.push(value)
      },
      onDelta() {
        assert.fail('file parameters must not appear in text')
      },
      onDone() {
        events.push('done')
      }
    })
  )
  assert.deepEqual(JSON.parse(JSON.stringify(events)), ['generating', file, 'done'])
})

test('reasoning chunks stay separate from final answer text', async () => {
  const wire =
    'event: reasoning\ndata: {"text":"先分析"}\n\nevent: reasoning\ndata: {"text":"再整理"}\n\nevent: delta\ndata: {"text":"最终回答"}\n\nevent: done\ndata: {"messageId":"reply"}\n\n'
  const { api } = client(sseResponse(wire))
  let reasoning = ''
  let answer = ''
  await api.streamMessage(
    'conversation',
    '问题',
    callbacks({
      onReasoning(text) {
        reasoning += text
      },
      onDelta(text) {
        answer += text
      }
    })
  )
  assert.equal(reasoning, '先分析再整理')
  assert.equal(answer, '最终回答')
})
