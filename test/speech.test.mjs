import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import { createRequire } from 'node:module'
import ts from 'typescript'

const source = ts.transpileModule(
  fs.readFileSync(new URL('../src/lib/speech.ts', import.meta.url), 'utf8'),
  {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true
    }
  }
).outputText

function setup({ supported = true, voices = [] } = {}) {
  const spoken = []
  const changes = []
  const errors = []
  let cancellations = 0
  let resumes = 0
  const synthesis = {
    getVoices: () => voices,
    speak: utterance => spoken.push(utterance),
    cancel: () => cancellations++,
    resume: () => resumes++
  }
  class Utterance {
    constructor(text) {
      this.text = text
    }
  }
  const context = {
    exports: {},
    require: createRequire(import.meta.url),
    window: supported ? { speechSynthesis: synthesis, SpeechSynthesisUtterance: Utterance } : {}
  }
  vm.runInNewContext(source, context)
  const reader = context.exports.createMessageReader({
    onChange: id => changes.push(id),
    onError: message => errors.push(message)
  })
  return {
    api: context.exports,
    reader,
    synthesis,
    spoken,
    changes,
    errors,
    cancellations: () => cancellations,
    resumes: () => resumes
  }
}

test('speech keeps readable Markdown content and removes formatting and link URLs', () => {
  const { api } = setup()
  const text = api.markdownToSpeechText(
    '# 建议\n\n**选择 NestJS**，参考 [文档](https://example.com)。\n\n- 使用 `Node.js`\n- 支持 &amp; 符号\n\n```js\nconst answer = 42\n```'
  )
  assert.equal(text, '建议\n选择 NestJS，参考 文档。\n使用 Node.js\n支持 & 符号\nconst answer = 42')
  assert.equal(api.markdownToSpeechText('---\n\n** **'), '')
  assert.equal(api.markdownToSpeechText('---'), '')
})

test('long text splits without losing content or breaking Unicode characters', () => {
  const { api } = setup()
  const text = '你好😀世界。'.repeat(90)
  const chunks = api.splitSpeechText(text)
  assert.ok(chunks.length > 1)
  assert.ok(chunks.every(chunk => Array.from(chunk).length <= 160))
  assert.equal(chunks.join(''), text)
  assert.ok(chunks.every(chunk => !/^[\uDC00-\uDFFF]|[\uD800-\uDBFF]$/.test(chunk)))
})

test('clicking the reading message stops immediately and stale events cannot resume it', () => {
  const run = setup()
  run.reader.toggle('a', '这是可以中途停止的回复。'.repeat(50))
  const first = run.spoken[0]
  const lateEnd = first.onend
  const lateError = first.onerror
  assert.deepEqual(run.changes, ['a'])
  assert.equal(run.resumes(), 1)
  run.reader.toggle('a', '这段内容不应重新朗读')
  assert.equal(run.cancellations(), 1)
  assert.equal(first.onend, null)
  assert.equal(first.onerror, null)
  lateEnd()
  lateError({ error: 'interrupted' })
  assert.equal(run.spoken.length, 1)
  assert.deepEqual(run.changes, ['a', ''])
  assert.deepEqual(run.errors, [])
  run.reader.stop()
  assert.equal(run.cancellations(), 1)
})

test('starting another reply replaces the current one and ignores its late events', () => {
  const run = setup()
  run.reader.toggle('a', '第一条回复')
  const lateEnd = run.spoken[0].onend
  run.reader.toggle('b', '第二条回复')
  lateEnd()
  assert.equal(run.cancellations(), 1)
  assert.equal(run.spoken.length, 2)
  assert.equal(run.spoken[1].text, '第二条回复')
  assert.deepEqual(run.changes, ['a', '', 'b'])
  run.spoken[1].onend()
  assert.deepEqual(run.changes, ['a', '', 'b', ''])
})

test('natural completion reads every chunk before clearing the active message', () => {
  const run = setup()
  const content = '这是一条较长的中文回复。'.repeat(50)
  run.reader.toggle('long', content)
  let index = 0
  while (index < run.spoken.length) {
    assert.deepEqual(run.changes, ['long'])
    run.spoken[index++].onend()
  }
  assert.ok(run.spoken.length > 1)
  assert.equal(run.spoken.map(utterance => utterance.text).join(''), content)
  assert.deepEqual(run.changes, ['long', ''])
  assert.equal(run.cancellations(), 0)
})

test('speech selects Chinese and English voices and can start before voices are loaded', () => {
  const chinese = { lang: 'zh-CN', name: 'Chinese' }
  const english = { lang: 'en-US', name: 'English' }
  const run = setup({ voices: [english, chinese] })
  run.reader.toggle('cn', '你好，世界')
  assert.equal(run.spoken[0].voice, chinese)
  assert.equal(run.spoken[0].lang, 'zh-CN')
  run.reader.toggle('en', 'Hello world')
  assert.equal(run.spoken[1].voice, english)
  assert.equal(run.spoken[1].lang, 'en-US')
  const loading = setup()
  loading.reader.toggle('cn', '你好')
  assert.equal(loading.spoken[0].lang, 'zh-CN')
  assert.equal(loading.spoken[0].voice, undefined)
})

test('unsupported browsers, empty content and speech failures give recoverable feedback', () => {
  const unsupported = setup({ supported: false })
  unsupported.reader.toggle('a', '你好')
  assert.match(unsupported.errors[0], /不支持朗读/)
  const run = setup()
  run.reader.toggle('empty', '---')
  assert.match(run.errors[0], /没有可朗读/)
  run.reader.toggle('a', '你好')
  run.spoken[0].onerror({ error: 'not-allowed' })
  assert.deepEqual(run.changes, ['a', ''])
  assert.match(run.errors[1], /朗读失败/)
  run.reader.toggle('retry', '重试成功')
  assert.equal(run.spoken.length, 2)
  assert.equal(run.changes.at(-1), 'retry')
})

test('an exception while starting a later chunk clears the reading state', () => {
  const run = setup()
  run.reader.toggle('a', '长回复内容。'.repeat(80))
  run.synthesis.speak = () => {
    throw new Error('Speech engine unavailable')
  }
  run.spoken[0].onend()
  assert.deepEqual(run.changes, ['a', ''])
  assert.match(run.errors[0], /朗读失败/)
})
