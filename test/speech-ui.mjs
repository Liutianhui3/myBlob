// Run against Vite with mocked APIs and speech. No real account, model or audio requests.
import { chromium } from 'playwright'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'

const base = process.env.CHAT_UI_BASE || 'http://127.0.0.1:8082'
const output = path.resolve('.artifacts/speech')
await fs.mkdir(output, { recursive: true })
const browser = await chromium.launch({ channel: 'chrome', headless: true })
const context = await browser.newContext({ viewport: { width: 1280, height: 900 } })
const page = await context.newPage()
const errors = []
page.on('pageerror', error => errors.push(error.message))
const firstId = '00000000-0000-4000-8000-000000000001'
const secondId = '00000000-0000-4000-8000-000000000002'
const now = new Date().toISOString()
const content =
  '## 最后一个关键建议\n\n**NestJS 作为 Node.js 主框架**，Express 只了解基础概念。\n\n' +
  '对于 AI 应用开发岗位，还要掌握 RAG、模型调用、工具集成与数据处理。'.repeat(12)

await context.addInitScript(() => {
  localStorage.setItem('myblob_token', 'speech-test-token')
  window.__speech = { utterances: [], cancellations: 0 }
  Object.defineProperty(window, 'speechSynthesis', {
    configurable: true,
    value: {
      getVoices: () => [{ lang: 'zh-CN', name: '测试中文语音' }],
      resume() {},
      speak(utterance) {
        window.__speech.utterances.push(utterance)
      },
      cancel() {
        window.__speech.cancellations++
      }
    }
  })
  window.SpeechSynthesisUtterance = class {
    constructor(text) {
      this.text = text
    }
  }
})

await page.route(/^https?:\/\/[^/]+\/api\//, route => {
  const pathname = new URL(route.request().url()).pathname
  if (pathname === '/api/users/me')
    return route.fulfill({
      json: { id: 'test', username: '朗读测试', name: '朗读测试', email: 'speech@example.com' }
    })
  if (pathname === '/api/conversations/models')
    return route.fulfill({
      json: {
        defaultModel: 'test-model',
        models: [
          { id: 'test-model', label: '测试模型', reasoningEfforts: [], defaultEffort: 'auto' }
        ]
      }
    })
  if (pathname === '/api/conversations')
    return route.fulfill({
      json: [
        { id: firstId, title: '技术选型', createdAt: now, updatedAt: now },
        { id: secondId, title: '另一个会话', createdAt: now, updatedAt: now }
      ]
    })
  if (pathname.endsWith('/messages'))
    return route.fulfill({
      json: [content, '另一条简短回复。'].map((text, index) => ({
        id: `reply-${index}`,
        turnId: `turn-${index}`,
        sequence: String(index + 1),
        role: 'assistant',
        content: text,
        status: 'completed',
        createdAt: now
      }))
    })
  return route.fulfill({ status: 404, json: { message: '不存在' } })
})

const readButtons = page.locator('.read-aloud-button')
const waitReading = async () => {
  await page.getByRole('button', { name: '停止朗读', exact: true }).waitFor()
  assert.equal(await page.locator('.read-aloud-button[aria-pressed="true"]').count(), 1)
}

try {
  await page.goto(`${base}/chat?c=${firstId}`)
  await page.getByRole('heading', { name: '最后一个关键建议' }).waitFor()
  assert.equal(await readButtons.count(), 2)
  await readButtons.first().click()
  await waitReading()
  const spoken = await page.evaluate(() => window.__speech.utterances[0].text)
  assert.match(spoken, /NestJS 作为 Node.js 主框架/)
  assert.doesNotMatch(spoken, /##|\*\*/)
  await page.screenshot({ path: path.join(output, 'reading-light.png') })

  // The same focused button remains usable by keyboard after its label changes.
  await page.getByRole('button', { name: '停止朗读', exact: true }).press('Enter')
  assert.equal(await page.getByRole('button', { name: '朗读', exact: true }).count(), 2)
  assert.equal(await page.evaluate(() => window.__speech.cancellations), 1)

  await readButtons.first().click()
  await page.evaluate(() => {
    window.__lateEnd = window.__speech.utterances.at(-1).onend
  })
  await readButtons.last().click()
  await page.evaluate(() => window.__lateEnd())
  await waitReading()
  assert.equal(await readButtons.last().getAttribute('aria-label'), '停止朗读')
  await page.evaluate(() => window.__speech.utterances.at(-1).onend())
  assert.equal(await page.getByRole('button', { name: '停止朗读', exact: true }).count(), 0)

  // Long replies advance through each chunk and return to idle on completion.
  await readButtons.first().click()
  const before = await page.evaluate(() => window.__speech.utterances.length)
  await page.evaluate(() => {
    let index = window.__speech.utterances.length - 1
    while (index < window.__speech.utterances.length) window.__speech.utterances[index++].onend?.()
  })
  assert.ok((await page.evaluate(() => window.__speech.utterances.length)) > before)
  assert.equal(await page.getByRole('button', { name: '停止朗读', exact: true }).count(), 0)

  await readButtons.first().click()
  await page.getByRole('button', { name: '切换深色主题' }).click()
  await page.screenshot({ path: path.join(output, 'reading-dark.png') })
  const cancellations = await page.evaluate(() => window.__speech.cancellations)
  await page.getByRole('button', { name: '另一个会话', exact: true }).click()
  await page.waitForURL(`**/chat?c=${secondId}`)
  await page.getByRole('heading', { name: '最后一个关键建议' }).waitFor()
  assert.equal(await page.evaluate(() => window.__speech.cancellations), cancellations + 1)
  assert.equal(await page.getByRole('button', { name: '停止朗读', exact: true }).count(), 0)

  await readButtons.last().click()
  await page.evaluate(() => window.__speech.utterances.at(-1).onerror({ error: 'not-allowed' }))
  await page.getByText('朗读失败，请检查浏览器的语音设置后重试。', { exact: true }).waitFor()
  assert.equal(await readButtons.last().getAttribute('aria-label'), '朗读')

  await page.setViewportSize({ width: 390, height: 844 })
  await page.getByRole('button', { name: '收起侧栏', exact: true }).click()
  await readButtons.last().click()
  await waitReading()
  assert.equal(await page.locator('body').evaluate(el => el.scrollWidth > innerWidth), false)
  await page.screenshot({ path: path.join(output, 'reading-mobile.png') })
  const beforeLeaving = await page.evaluate(() => window.__speech.cancellations)
  await page.evaluate(() => {
    // Use the existing Vue router link to test component teardown without reloading the page.
    document.querySelector('.brand-link').click()
  })
  await page.waitForURL('**/home')
  assert.equal(await page.evaluate(() => window.__speech.cancellations), beforeLeaving + 1)
  assert.deepEqual(errors, [])
  console.log(
    'Passed: read/stop, keyboard, reply replacement, long replies, completion, conversation switching, errors, dark/mobile layout and page teardown. Page errors: 0.'
  )
} catch (error) {
  await page.screenshot({ path: path.join(output, 'failure.png') })
  throw error
} finally {
  await browser.close()
}
