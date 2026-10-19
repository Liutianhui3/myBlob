import { chromium } from 'playwright'
import { createServer } from 'node:http'
import { once } from 'node:events'
import fs from 'node:fs/promises'
import assert from 'node:assert/strict'

let finish
const pixel =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aRZkAAAAASUVORK5CYII='
const server = createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Headers', 'authorization,content-type,accept')
  if (req.method === 'OPTIONS') return res.writeHead(204).end()
  res.writeHead(200, { 'Content-Type': 'text/event-stream' })
  res.write(
    'event: start\ndata: {"conversationId":"00000000-0000-4000-8000-000000000001","userMessageId":"u","messageId":"a"}\n\nevent: image_generation\ndata: {"status":"generating"}\n\n'
  )
  finish = () =>
    res.end(
      `event: delta\ndata: ${JSON.stringify({ text: `![AI 生成的图片](<${pixel}>)` })}\n\nevent: done\ndata: {"messageId":"a"}\n\n`
    )
})
server.listen(0, '127.0.0.1')
await once(server, 'listening')
const browser = await chromium.launch({ channel: 'chrome', headless: true })
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } })
  const errors = []
  page.on('pageerror', e => errors.push(e.message))
  await page.addInitScript(() => localStorage.setItem('myblob_token', 'test'))
  await page.route(/^https?:\/\/[^/]+\/api\//, route => {
    const path = new URL(route.request().url()).pathname
    if (path.endsWith('/messages/stream'))
      return route.continue({ url: `http://127.0.0.1:${server.address().port}/stream` })
    const conversation = {
      id: '00000000-0000-4000-8000-000000000001',
      title: 'Image test',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
    return route.fulfill({
      json: path.endsWith('/users/me')
        ? { id: 'test', username: 'test', name: 'Test', email: 'test@example.com' }
        : path.endsWith('/models')
          ? {
              defaultModel: 'test',
              models: [{ id: 'test', label: 'Test', reasoningEfforts: [], defaultEffort: 'auto' }]
            }
          : path.endsWith('/messages')
            ? []
            : route.request().method() === 'POST'
              ? conversation
              : [conversation]
    })
  })
  await page.goto((process.env.CHAT_UI_BASE || 'http://127.0.0.1:8083') + '/chat')
  await page.getByRole('textbox', { name: '输入消息' }).fill('draw a cat')
  await page.getByRole('button', { name: '发送消息', exact: true }).click()
  const pending = page.locator('.image-generating')
  await pending.waitFor()
  assert.equal(await pending.locator('.image-generating-title').innerText(), '正在创建图像')
  assert.equal(await page.locator('.thinking').count(), 0)
  await fs.mkdir('.artifacts/image-generation', { recursive: true })
  await pending.screenshot({ path: '.artifacts/image-generation/progress-light.png' })
  await page.clock.install()
  await page.clock.fastForward(300000)
  const progress = Number(
    (await pending.locator('.image-generating-progress').innerText()).replace('%', '')
  )
  assert.ok(progress >= 10 && progress < 95)
  await page.evaluate(() => document.documentElement.classList.add('dark'))
  await page.setViewportSize({ width: 390, height: 844 })
  const sidebarBackdrop = page.getByRole('button', { name: '关闭会话侧栏' })
  if (await sidebarBackdrop.isVisible()) await sidebarBackdrop.click()
  await pending.screenshot({ path: '.artifacts/image-generation/progress-dark-mobile.png' })
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false)
  finish()
  await pending.waitFor({ state: 'detached' })
  await page.locator('.generated-image').waitFor()
  await page.clock.resume()
  await page.getByRole('textbox', { name: '输入消息' }).fill('draw another cat')
  await page.getByRole('button', { name: '发送消息', exact: true }).click()
  await pending.waitFor()
  await page.getByRole('button', { name: '停止生成' }).click()
  await pending.waitFor({ state: 'detached' })
  assert.deepEqual(errors, [])
  console.log(
    'Passed: streamed image status shows placeholder, simulated progress stays below 95%, completion replaces it, stop removes it, mobile fits, no page errors.'
  )
} finally {
  await browser.close()
  server.close()
  server.closeAllConnections()
}
