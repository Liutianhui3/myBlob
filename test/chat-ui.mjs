// Run against the local Vite server. All API calls are mocked; no real account or AI requests.
import { chromium } from 'playwright'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'

const base = process.env.CHAT_UI_BASE || 'http://127.0.0.1:8082'
const output = path.resolve('.artifacts/chat')
await fs.mkdir(output, { recursive: true })
const browser = await chromium.launch({
  channel: 'chrome',
  headless: true,
  ignoreDefaultArgs: ['--hide-scrollbars']
})
const context = await browser.newContext({
  viewport: { width: 1578, height: 966 },
  permissions: ['clipboard-read', 'clipboard-write']
})
const page = await context.newPage()
const errors = []
page.on('pageerror', error => errors.push(error.message))
const id = '00000000-0000-4000-8000-000000000001'
const other = '00000000-0000-4000-8000-000000000002'
const now = new Date().toISOString()
let conversations = [
  { id, title: '框架对比与技术选型', createdAt: now, updatedAt: now },
  { id: other, title: '项目周报与下周计划', createdAt: now, updatedAt: now }
]
const content =
  '## Node.js + Express 写法\n\n```javascript\nconst express = require("express");\nconst app = express();\n\napp.get("/chat", (req, res) => {\n  res.json({ message: "Hello AI" });\n});\n\napp.listen(3000);\n```\n\n两段代码完成的是同一件事：创建一个 `/chat` 接口，访问后返回 JSON 数据。\n\n## 2. 那你应该学哪个？\n\n结合你目前是 Vue 前端开发者、想先找到 AI 应用开发工作，我建议：\n\n- **如果招聘岗位明确支持 Node.js**：选择 Node.js + Express，或者进一步学习 NestJS。\n- **如果岗位主要要求 Python、FastAPI、LangChain**：优先学习 Python + FastAPI。\n- **如果目标是 AI 应用开发**：还要学习模型 API、RAG 知识库、向量检索与工具调用。\n\n**最关键的一点：FastAPI 和 Express 的核心用途相似。** 学会路由、请求处理、参数校验和异常处理后，再学另一个框架会容易很多。\n\n如果你现在的策略是先找到工作，先根据目标岗位的要求选定一套，再用项目验证能力。'
const message = (role, content, sequence, status = 'completed', turnId = 'turn-1') => ({
  id: `m-${sequence}`,
  turnId,
  sequence: String(sequence),
  role,
  content,
  status,
  createdAt: now
})
const histories = new Map([
  [
    id,
    [
      message('user', '我会 Vue，应该学习 FastAPI 还是 Express？', 1),
      message('assistant', content, 2)
    ]
  ],
  [
    other,
    [
      message('user', '帮我整理项目周报', 3),
      message(
        'assistant',
        '## 本周进展\n\n完成登录与会话模块。\n\n## 下周计划\n\n- 完成接口联调\n- 核对发布清单',
        4
      )
    ]
  ]
])
let slow = false
let streamFailure = false
let unauthorized = false
const requests = []
await context.addInitScript(() => {
  localStorage.setItem('myblob_token', 'ui-test-token')
})
await page.route(/^https?:\/\/[^/]+\/api\//, async route => {
  const request = route.request()
  const url = new URL(request.url())
  requests.push({ path: url.pathname, method: request.method(), body: request.postDataJSON() })
  assert.equal(request.headers().authorization, 'Bearer ui-test-token')
  if (url.pathname.endsWith('/users/me'))
    return route.fulfill({
      json: { id: 'test', username: 'Henery Liu', name: 'Henery Liu', email: 'test@example.com' }
    })
  if (url.pathname === '/api/conversations/models')
    return route.fulfill({
      json: {
        defaultModel: 'test-model',
        models: [
          {
            id: 'test-model',
            label: '测试模型',
            description: '',
            reasoningEfforts: ['low', 'medium', 'high'],
            defaultEffort: 'auto'
          }
        ]
      }
    })
  if (unauthorized) return route.fulfill({ status: 401, json: { message: 'Unauthorized' } })
  if (url.pathname === '/api/conversations') {
    if (request.method() === 'POST') {
      const c = {
        id: '00000000-0000-4000-8000-000000000003',
        title: request.postDataJSON().title,
        createdAt: now,
        updatedAt: now
      }
      conversations.unshift(c)
      histories.set(c.id, [])
      return route.fulfill({ status: 201, json: c })
    }
    return route.fulfill({ json: conversations })
  }
  const c = url.pathname.split('/')[3]
  if (url.pathname.endsWith('/messages'))
    return route.fulfill({ json: url.searchParams.has('before') ? [] : histories.get(c) || [] })
  if (url.pathname.endsWith('/messages/stream')) {
    if (streamFailure) return route.fulfill({ status: 503, json: { message: '模型未配置' } })
    const saved = histories.get(c) || []
    const sequence = saved.length + 10
    const turnId = `turn-${sequence}`
    const u = message('user', request.postDataJSON().content, sequence, 'completed', turnId)
    const a = message(
      'assistant',
      '你好，流式回复已完成。\n\n**第二轮上下文**也已接入。',
      sequence + 1,
      'completed',
      turnId
    )
    if (slow) {
      await new Promise(resolve => setTimeout(resolve, 1800))
      a.status = 'cancelled'
      a.content = ''
    }
    histories.set(c, [...saved, u, a])
    const body = `event: start\ndata: ${JSON.stringify({ conversationId: c, userMessageId: u.id, messageId: a.id })}\n\nevent: delta\ndata: ${JSON.stringify({ text: a.content })}\n\nevent: done\ndata: ${JSON.stringify({ messageId: a.id, finishReason: 'stop' })}\n\n`
    return route.fulfill({ contentType: 'text/event-stream', body }).catch(() => {})
  }
  return route.fulfill({ status: 404, json: { message: '不存在' } })
})
try {
  await page.goto(`${base}/chat?c=${id}`)
  await page.getByRole('heading', { name: '2. 那你应该学哪个？' }).waitFor()
  const sidebarWidth = () =>
    page.locator('.chat-sidebar').evaluate(el => el.getBoundingClientRect().width)
  const waitSidebarWidth = width =>
    page.waitForFunction(
      expected =>
        Math.abs(document.querySelector('.chat-sidebar').getBoundingClientRect().width - expected) <
        1,
      width
    )
  await page.getByRole('button', { name: '收起侧栏', exact: true }).click()
  await page.waitForFunction(() => {
    const width = document.querySelector('.chat-sidebar').getBoundingClientRect().width
    return width > 52 && width < 320
  })
  const intermediateWidth = await sidebarWidth()
  assert.ok(
    intermediateWidth > 52 && intermediateWidth < 320,
    `Expected animated intermediate width, received ${intermediateWidth}`
  )
  await waitSidebarWidth(52)
  await page.getByRole('button', { name: '展开侧栏', exact: true }).waitFor()
  assert.equal(await page.getByRole('button', { name: '新对话', exact: true }).isVisible(), true)
  assert.equal(await page.getByRole('button', { name: '搜索会话', exact: true }).isVisible(), true)
  assert.equal(
    await page.getByRole('button', { name: '框架对比与技术选型', exact: true }).count(),
    0
  )
  await page.screenshot({ path: path.join(output, 'sidebar-collapsed-desktop.png') })
  await page.getByRole('button', { name: '搜索会话', exact: true }).click()
  await waitSidebarWidth(320)
  await page.getByRole('textbox', { name: '搜索会话标题' }).waitFor()
  assert.equal(
    await page
      .getByRole('textbox', { name: '搜索会话标题' })
      .evaluate(el => el === document.activeElement),
    true
  )
  await page.getByRole('button', { name: '搜索会话', exact: true }).click()
  await page.keyboard.press('Control+Shift+S')
  await waitSidebarWidth(52)
  await page.keyboard.press('Control+Shift+S')
  await waitSidebarWidth(320)
  await page.getByRole('button', { name: '收起侧栏', exact: true }).click()
  await page.getByRole('button', { name: '展开侧栏', exact: true }).click()
  await page.getByRole('button', { name: '收起侧栏', exact: true }).click()
  await waitSidebarWidth(52)
  await page.getByRole('button', { name: 'Henery Liu · 展开侧栏', exact: true }).click()
  await waitSidebarWidth(320)
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.getByRole('button', { name: '收起侧栏', exact: true }).click()
  assert.equal(Math.round(await sidebarWidth()), 52)
  await page.getByRole('button', { name: '展开侧栏', exact: true }).click()
  assert.equal(Math.round(await sidebarWidth()), 320)
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await page.locator('#nprogress').waitFor({ state: 'hidden' })
  await page.screenshot({ path: path.join(output, 'desktop-conversation.png') })
  assert.equal(await page.locator('body').evaluate(el => el.scrollWidth > innerWidth), false)
  await page.getByRole('button', { name: '复制代码', exact: true }).click()
  assert.match(await page.evaluate(() => navigator.clipboard.readText()), /app.listen\(3000\)/)
  await page.getByRole('button', { name: '复制回复', exact: true }).click()
  assert.match(await page.evaluate(() => navigator.clipboard.readText()), /FastAPI/)
  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: '导出会话' }).click()
  assert.match((await download).suggestedFilename(), /\.md$/)
  await page.getByRole('button', { name: '搜索会话', exact: true }).click()
  await page.getByRole('textbox', { name: '搜索会话标题' }).fill('周报')
  assert.equal(await page.locator('.history-item').count(), 1)
  await page.getByRole('button', { name: '项目周报与下周计划', exact: true }).click()
  await page.getByRole('heading', { name: '本周进展' }).waitFor()
  await page.getByRole('button', { name: '清空搜索' }).click()
  await page.getByRole('button', { name: /新对话/ }).click()
  await page.getByRole('heading', { name: /今天，有什么可以帮你/ }).waitFor()
  await page.locator('#nprogress').waitFor({ state: 'hidden' })
  await page.screenshot({ path: path.join(output, 'desktop-welcome.png') })
  await page.getByRole('button', { name: /代码与开发/ }).click()
  assert.match(await page.getByRole('textbox', { name: '输入消息' }).inputValue(), /资深工程师/)
  const input = page.getByRole('textbox', { name: '输入消息' })
  await input.fill('中文输入确认')
  await input.evaluate(el =>
    el.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'Enter',
        isComposing: true,
        bubbles: true,
        cancelable: true
      })
    )
  )
  assert.equal(requests.filter(r => r.path.endsWith('/stream')).length, 0)
  await input.fill('a'.repeat(16001))
  assert.equal(await page.getByRole('button', { name: '发送消息', exact: true }).isDisabled(), true)
  await input.fill('第一轮')
  await input.press('Enter')
  await page.getByText('你好，流式回复已完成。', { exact: false }).waitFor()
  await page.getByRole('button', { name: '发送消息', exact: true }).waitFor()
  await input.fill('第二轮')
  await input.press('Shift+Enter')
  assert.equal(await input.inputValue(), '第二轮\n')
  await input.press('Enter')
  await page.waitForFunction(
    () =>
      document.querySelectorAll('.assistant-label').length === 2 &&
      !document.querySelector('[aria-label="停止生成"]')
  )
  assert.equal(requests.filter(r => r.path.endsWith('/stream')).length, 2)
  await page.getByRole('button', { name: '切换深色主题' }).click()
  await page.screenshot({ path: path.join(output, 'desktop-dark.png') })
  await page.reload()
  await page.getByRole('button', { name: '切换浅色主题' }).waitFor()
  slow = true
  await input.fill('停止测试')
  await input.press('Enter')
  await page.getByRole('button', { name: '停止生成', exact: true }).click()
  await page.getByText('已停止生成', { exact: true }).first().waitFor()
  slow = false
  streamFailure = true
  await input.fill('错误测试')
  await input.press('Enter')
  await page.getByRole('alert').filter({ hasText: '模型未配置' }).waitFor()
  assert.equal(await input.inputValue(), '错误测试')
  streamFailure = false
  await page.setViewportSize({ width: 390, height: 844 })
  await page.getByRole('button', { name: '收起侧栏' }).click()
  await page.getByRole('button', { name: '展开侧栏', exact: true }).waitFor()
  await waitSidebarWidth(52)
  await page.screenshot({ path: path.join(output, 'mobile-dark.png') })
  assert.equal(await page.locator('body').evaluate(el => el.scrollWidth > innerWidth), false)
  await page.getByRole('button', { name: '展开侧栏', exact: true }).click()
  await page.getByRole('button', { name: '切换浅色主题' }).click()
  await page.getByRole('button', { name: '关闭会话侧栏' }).click()
  await waitSidebarWidth(52)
  await page.screenshot({ path: path.join(output, 'mobile-light.png') })
  const box = await input.boundingBox()
  assert.ok(box.y + box.height < 844)
  await page.setViewportSize({ width: 1578, height: 966 })
  await page.getByRole('button', { name: '展开侧栏', exact: true }).click()
  histories.set(
    id,
    Array.from({ length: 50 }, (_, index) =>
      message(index % 2 ? 'assistant' : 'user', `历史消息 ${index + 1}`, index + 100)
    )
  )
  await page.getByRole('button', { name: '框架对比与技术选型', exact: true }).click()
  await page.getByRole('button', { name: '加载更早的消息', exact: true }).click()
  await page
    .getByRole('button', { name: '加载更早的消息', exact: true })
    .waitFor({ state: 'hidden' })
  assert.ok(requests.some(r => r.path.endsWith('/messages')))
  const chatScroll = page.locator('.chat-scroll')
  const latestButton = page.getByRole('button', { name: '滚动到最新消息', exact: true })
  await chatScroll.evaluate(el => {
    el.scrollTop = 0
  })
  await latestButton.waitFor()
  const scrollbar = await chatScroll.evaluate(el => ({
    width: getComputedStyle(el, '::-webkit-scrollbar').width,
    track: getComputedStyle(el, '::-webkit-scrollbar-track').backgroundColor,
    thumb: getComputedStyle(el, '::-webkit-scrollbar-thumb').backgroundColor,
    radius: getComputedStyle(el, '::-webkit-scrollbar-thumb').borderRadius
  }))
  assert.equal(scrollbar.width, '8px')
  assert.equal(scrollbar.track, 'rgba(0, 0, 0, 0)')
  assert.ok(['rgb(212, 212, 212)', 'rgb(183, 183, 183)'].includes(scrollbar.thumb))
  assert.equal(scrollbar.radius, '999px')
  await page.screenshot({ path: path.join(output, 'scrollbar-long-conversation.png') })
  await latestButton.click()
  await page.waitForFunction(() => {
    const el = document.querySelector('.chat-scroll')
    return el.scrollTop > 0 && el.scrollTop < el.scrollHeight - el.clientHeight - 5
  })
  await page.waitForFunction(() => {
    const el = document.querySelector('.chat-scroll')
    return el.scrollHeight - el.clientHeight - el.scrollTop < 2
  })
  await latestButton.waitFor({ state: 'hidden' })
  await chatScroll.evaluate(el => {
    el.scrollTop = 0
  })
  await latestButton.click()
  await page.waitForFunction(() => document.querySelector('.chat-scroll').scrollTop > 100)
  await chatScroll.dispatchEvent('wheel', { deltaY: -150 })
  const stoppedAt = await chatScroll.evaluate(el => el.scrollTop)
  await page.waitForTimeout(850)
  assert.ok(Math.abs((await chatScroll.evaluate(el => el.scrollTop)) - stoppedAt) < 2)
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await chatScroll.evaluate(el => {
    el.scrollTop = 0
  })
  await latestButton.click()
  assert.ok(await chatScroll.evaluate(el => el.scrollHeight - el.clientHeight - el.scrollTop < 2))
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await page.getByRole('button', { name: '切换深色主题' }).click()
  assert.ok(
    ['rgb(85, 85, 85)', 'rgb(115, 115, 115)'].includes(
      await chatScroll.evaluate(
        el => getComputedStyle(el, '::-webkit-scrollbar-thumb').backgroundColor
      )
    )
  )
  await page.screenshot({ path: path.join(output, 'scrollbar-dark-conversation.png') })
  await page.getByRole('button', { name: '切换浅色主题' }).click()
  await page.getByRole('button', { name: '项目周报与下周计划', exact: true }).click()
  await page.getByRole('heading', { name: '本周进展' }).waitFor()
  await page.getByRole('button', { name: '收起侧栏' }).click()
  await page.getByRole('button', { name: '展开侧栏', exact: true }).click()
  await page.getByRole('button', { name: '显示导航栏', exact: true }).focus()
  await page.getByRole('button', { name: '显示导航栏', exact: true }).press('Enter')
  await page.getByRole('button', { name: '首页', exact: true }).click()
  await page.waitForURL('**/home')
  await page.getByRole('button', { name: '显示导航栏', exact: true }).focus()
  await page.getByRole('button', { name: '显示导航栏', exact: true }).press('Enter')
  await page.getByRole('button', { name: 'Claude · AI 工作台', exact: true }).click()
  await page.getByRole('heading', { name: /今天，有什么可以帮你/ }).waitFor()
  unauthorized = true
  await page.getByRole('button', { name: '框架对比与技术选型', exact: true }).click()
  await page.waitForURL('**/login?redirect=**')
  assert.equal(await page.evaluate(() => localStorage.getItem('myblob_token')), null)
  assert.deepEqual(errors, [])
  console.log(
    'Passed: layout, markdown/code copying, export, search, history, first/second turns, keyboard input, theme persistence, stop, HTTP errors, mobile, Dock, expired session. Console errors: 0.'
  )
} catch (error) {
  await page.screenshot({ path: path.join(output, 'failure.png') })
  console.error(
    'URL:',
    page.url(),
    'page errors:',
    errors,
    'Dock:',
    await page.locator('.dock-shell').evaluate(el => el.outerHTML)
  )
  throw error
} finally {
  await browser.close()
}
