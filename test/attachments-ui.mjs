// 本地浏览器测试：模拟模型 API，不调用付费服务。
import { chromium } from 'playwright'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
const browser = await chromium.launch({ channel: 'chrome', headless: true })
const page = await browser.newPage({ viewport: { width: 1440, height: 950 } })
const errors = []
page.on('pageerror', e => errors.push(e.message))
page.on('requestfailed', r => console.log('failed', r.url(), r.failure()))
page.on('console', m => {
  if (m.type() === 'error') console.log('console', m.text())
})
let submitted
const id = '11111111-1111-4111-8111-111111111111'
await page.addInitScript(() => localStorage.setItem('myblob_token', 'attachment-test'))
await page.route(/^https?:\/\/[^/]+\/api\//, async route => {
  const path = new URL(route.request().url()).pathname
  if (path.endsWith('/users/me'))
    return route.fulfill({
      json: { id: 'test', name: '测试用户', username: 'test', email: 'test@example.com' }
    })
  if (path.endsWith('/models'))
    return route.fulfill({
      json: {
        defaultModel: 'vision',
        models: [
          {
            id: 'vision',
            label: '视觉模型',
            description: '',
            reasoningEfforts: [],
            defaultEffort: 'auto'
          }
        ]
      }
    })
  if (path.endsWith('/stream')) {
    submitted = route.request().postDataJSON()
    return route.fulfill({
      contentType: 'text/event-stream',
      body: `event: start\ndata: ${JSON.stringify({ userMessageId: 'user', messageId: 'reply' })}\n\nevent: delta\ndata: {"text":"已读取图片和文档。"}\n\nevent: done\ndata: {"messageId":"reply"}\n\n`
    })
  }
  if (path === '/api/conversations') {
    if (route.request().method() === 'POST')
      return route.fulfill({
        json: {
          id,
          title: '分析附件',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
      })
    return route.fulfill({ json: [] })
  }
  return route.fulfill({ json: [] })
})
try {
  await page.goto(`${process.env.CHAT_UI_BASE || 'http://127.0.0.1:8082'}/chat`)
  await page.getByRole('button', { name: '上传图片或文档', exact: true }).waitFor()
  // 首次加载会话后，全页监听仍须有效。
  const initialDrag = await page.evaluateHandle(() => {
    const data = new DataTransfer()
    data.items.add(new File(['首次拖入'], 'initial.md', { type: 'text/markdown' }))
    return data
  })
  await page.locator('main.chat-app').dispatchEvent('dragenter', { dataTransfer: initialDrag })
  await page.getByRole('heading', { name: '添加到对话', exact: true }).waitFor()
  await page.locator('main.chat-app').dispatchEvent('drop', { dataTransfer: initialDrag })
  await page.getByRole('button', { name: '移除 initial.md', exact: true }).waitFor()
  await page.getByRole('button', { name: '移除 initial.md', exact: true }).click()
  await initialDrag.dispose()
  const png = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jY2kAAAAASUVORK5CYII=',
    'base64'
  )
  await page.locator('input[type=file]').setInputFiles([
    { name: 'example.png', mimeType: 'image/png', buffer: png },
    {
      name: 'notes.md',
      mimeType: 'text/markdown',
      buffer: Buffer.from('公司服务时间：周一至周五。')
    }
  ])
  await page.getByRole('button', { name: '移除 notes.md', exact: true }).waitFor()
  await page.getByRole('button', { name: '发送消息', exact: true }).click()
  await page.getByText('已读取图片和文档。', { exact: true }).waitFor()
  assert.equal(submitted.attachments.length, 2)
  assert.match(submitted.attachments[0].data, /^data:image\/png;base64,/)
  assert.match(submitted.attachments[1].text, /公司服务时间/)
  assert.equal(await page.locator('.user-bubble img').count(), 1)
  assert.deepEqual(errors, [])
  // ClipboardEvent 使用真实文件数据，兼容 HTTP 局域网，不依赖 clipboard.read 安全上下文。
  await page.getByRole('textbox', { name: '输入消息', exact: true }).evaluate(
    (element, bytes) => {
      const clipboardData = new DataTransfer()
      clipboardData.items.add(
        new File([new Uint8Array(bytes)], 'pasted.png', { type: 'image/png' })
      )
      element.dispatchEvent(
        new ClipboardEvent('paste', { clipboardData, bubbles: true, cancelable: true })
      )
    },
    [...png]
  )
  await page.getByRole('button', { name: '移除 pasted.png', exact: true }).waitFor()
  await page.getByRole('button', { name: '移除 pasted.png', exact: true }).click()
  await page.locator('.draft-attachments img').waitFor({ state: 'detached' })
  assert.equal(await page.locator('.draft-attachments img').count(), 0)
  // 拖入整页任意位置，跨过子元素不应闪烁；放下后进入输入框。
  const dragData = await page.evaluateHandle(() => {
    const data = new DataTransfer()
    data.items.add(new File(['拖放文档内容'], 'dropped.md', { type: 'text/markdown' }))
    return data
  })
  await page.locator('main.chat-app').dispatchEvent('dragenter', { dataTransfer: dragData })
  await page.getByRole('heading', { name: '添加到对话', exact: true }).waitFor()
  await fs.mkdir('output/playwright', { recursive: true })
  await page.screenshot({ path: 'output/playwright/file-drop-light.png' })
  await page.locator('textarea').dispatchEvent('dragenter', { dataTransfer: dragData })
  await page.locator('textarea').dispatchEvent('dragleave', { dataTransfer: dragData, clientX: 500, clientY: 500 })
  assert.equal(await page.locator('.file-drop-overlay').count(), 1)
  await page.locator('main.chat-app').dispatchEvent('drop', { dataTransfer: dragData })
  await page.getByRole('button', { name: '移除 dropped.md', exact: true }).waitFor()
  await page.locator('.file-drop-overlay').waitFor({ state: 'detached' })
  assert.match(await page.locator('.draft-attachments').innerText(), /dropped.md/)
  assert.equal(await page.getByRole('textbox', { name: '输入消息', exact: true }).evaluate(el => el === document.activeElement), true)
  await page.locator('main.chat-app').dispatchEvent('dragenter', { dataTransfer: dragData })
  await page.keyboard.press('Escape')
  await page.locator('.file-drop-overlay').waitFor({ state: 'detached' })
  await dragData.dispose()
  await fs.mkdir('output/playwright', { recursive: true })
  await page.screenshot({ path: 'output/playwright/attachments-light.png' })
  assert.deepEqual(errors, [])
  console.log('File selection/paste/drop, overlay dismissal, preview and SSE passed')
} finally {
  await browser.close()
}
