import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'
function load(result) {
  let destroyed = 0
  const exports = {}
  const window = {
    setTimeout,
    clearTimeout,
    TencentCaptcha: class {
      constructor(id, callback) {
        this.callback = callback
      }
      show() {
        queueMicrotask(() => this.callback(result))
      }
      destroy() {
        destroyed++
      }
    }
  }
  vm.runInNewContext(
    ts.transpileModule(fs.readFileSync('src/lib/captcha.ts', 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS }
    }).outputText,
    { exports, window, DOMException }
  )
  return { ...exports, destroyed: () => destroyed }
}
test('captcha returns server proof only for a successful non-fallback ticket', async () => {
  const sdk = load({ ret: 0, ticket: 'ticket', randstr: 'random' })
  const proof = await sdk.verifyHuman('123', new AbortController().signal)
  assert.equal(proof.captchaTicket, 'ticket')
  assert.equal(proof.captchaRandstr, 'random')
  assert.equal(sdk.destroyed(), 1)
})
test('cancelled, malformed, fallback and unconfigured verification rejects', async () => {
  for (const result of [
    { ret: 2 },
    { ret: 1 },
    { ret: 0 },
    { ret: 0, ticket: 'fallback', randstr: 'r', errorCode: 1001 }
  ]) {
    const sdk = load(result)
    await assert.rejects(sdk.verifyHuman('123', new AbortController().signal))
    assert.equal(sdk.destroyed(), 1)
  }
  await assert.rejects(load({}).verifyHuman('', new AbortController().signal), /尚未配置/)
})
test('aborted verification cannot start a challenge', async () => {
  const controller = new AbortController()
  controller.abort()
  const sdk = load({ ret: 0, ticket: 't', randstr: 'r' })
  await assert.rejects(sdk.verifyHuman('123', controller.signal), { name: 'AbortError' })
  assert.equal(sdk.destroyed(), 0)
})
