// Isolated browser checks: all APIs mocked, no real login, CAPTCHA or database writes.
import { chromium } from 'playwright'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
const output = 'output/playwright/articles'
await fs.mkdir(output, { recursive: true })
const browser = await chromium.launch({ channel: 'chrome', headless: true })
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } })
const page = await context.newPage()
const errors = []
page.on('pageerror', e => errors.push(e.message))
page.on('console', msg => {
  if (msg.type() === 'error') console.error('Browser console:', msg.text())
})
page.on('requestfailed', req =>
  console.error('Request failed:', new URL(req.url()).pathname, req.failure()?.errorText)
)
const now = new Date().toISOString()
let articles = Array.from({ length: 7 }, (_, i) => ({
  id: `00000000-0000-4000-8000-${String(i + 1).padStart(12, '0')}`,
  authorId: 'test-user',
  authorName: 'Henery Liu',
  title: [
    'Vue 组件设计：从复用到表达',
    '把灵感写进日常',
    '一次关于阅读的探索',
    '构建更清晰的接口',
    '设计与代码之间',
    '小步迭代，持续记录',
    '第七篇文章'
  ][i],
  summary: '记录开发过程中的思考与实践，让每一个想法都有自己的位置。',
  category: '前端开发',
  tags: ['Vue', '思考'],
  coverUrl: '',
  status: 'published',
  version: 1,
  content: '<h2>文章正文</h2><p>记录思考，分享经验。</p>',
  createdAt: now,
  updatedAt: now,
  publishedAt: now
}))
let counter = 20
let failSave = false
let failList = false
const requests = []
await context.addInitScript(() => localStorage.setItem('myblob_token', 'test-article-session'))
await page.route(/^https?:\/\/[^/]+\/api\//, async route => {
  const req = route.request()
  const url = new URL(req.url())
  const pathname = url.pathname
  const body = req.postDataJSON()
  requests.push({ path: pathname, method: req.method(), body })
  if (pathname === '/api/users/me')
    return route.fulfill({
      json: {
        id: 'test-user',
        username: 'reader',
        name: 'Henery Liu',
        email: 'test@example.com',
        isAdmin: true
      }
    })
  if (!pathname.startsWith('/api/articles'))
    return route.fulfill({ status: 404, json: { message: 'Not found' } })
  const manage = pathname.includes('/manage')
  const id = pathname.split('/').at(-1)
  if (
    req.method() === 'GET' &&
    (pathname === '/api/articles' || pathname === '/api/articles/manage')
  ) {
    if (failList) return route.fulfill({ status: 503, json: { message: '文章加载暂不可用' } })
    const q = url.searchParams.get('q') || ''
    const status = url.searchParams.get('status') || ''
    const filtered = articles.filter(
      a =>
        (manage || a.status === 'published') &&
        (!status || a.status === status) &&
        (!q || a.title.includes(q) || a.summary.includes(q))
    )
    const page = Number(url.searchParams.get('page') || 1)
    const limit = Number(url.searchParams.get('limit') || 12)
    return route.fulfill({
      json: {
        items: filtered.slice((page - 1) * limit, page * limit),
        total: filtered.length,
        page,
        limit
      }
    })
  }
  if (req.method() === 'GET') {
    const a = articles.find(a => a.id === id && (manage || a.status === 'published'))
    return a
      ? route.fulfill({ json: a })
      : route.fulfill({ status: 404, json: { message: '文章不存在' } })
  }
  if (req.method() === 'POST' || req.method() === 'PATCH') {
    if (failSave) return route.fulfill({ status: 503, json: { message: '保存暂不可用，请重试' } })
    const previous = articles.find(a => a.id === id)
    const saved = {
      ...(previous || articles[0]),
      ...body,
      id: previous?.id || `00000000-0000-4000-8000-${String(counter++).padStart(12, '0')}`,
      version: (previous?.version || 0) + 1,
      publishedAt: body.status === 'published' ? now : null,
      updatedAt: now
    }
    articles = [saved, ...articles.filter(a => a.id !== saved.id)]
    return route.fulfill({ status: previous ? 200 : 201, json: saved })
  }
  if (req.method() === 'DELETE') {
    articles = articles.filter(a => a.id !== id)
    return route.fulfill({ status: 204 })
  }
})
try {
  await page.goto((process.env.ARTICLE_UI_BASE || 'http://127.0.0.1:8082') + '/article')
  await page.getByRole('link', { name: '阅读：Vue 组件设计：从复用到表达' }).waitFor()
  assert.equal(await page.locator('.bento-article-link').count(), 6)
  assert.equal(await page.getByRole('button', { name: '上一页文章' }).count(), 0)
  await page.waitForFunction(
    () => document.querySelector('.bento-article-link')?.closest('.bento-grid')?.parentElement?.style.opacity === '1'
  )
  assert.equal(await page.getByRole('link', { name: '管理文章', exact: true }).count(), 0)
  await page.getByRole('button', { name: '显示导航栏' }).click()
  await page.getByRole('button', { name: '文章管理', exact: true }).waitFor()
  for (const [width, height] of [
    [1440, 1000],
    [1280, 720],
    [390, 844],
    [844, 390]
  ]) {
    await page.setViewportSize({ width, height })
    assert.ok(
      await page.evaluate(
        () =>
          document.documentElement.scrollHeight <= innerHeight &&
          document.documentElement.scrollWidth <= innerWidth
      ),
      `Article overflow at ${width}x${height}`
    )
    for (const card of await page.locator('.bento-article-link').all()) {
      const box = await card.boundingBox()
      assert.ok(box.y >= 0 && box.y + box.height <= height, 'Cards must fit in viewport')
    }
  }
  await page.setViewportSize({ width: 1440, height: 1000 })
  const nextBox = await page.getByRole('button', { name: '下一页文章' }).boundingBox()
  assert.ok(nextBox.x > 1300 && Math.abs(nextBox.y + nextBox.height / 2 - 500) < 2)
  assert.equal(await page.getByRole('button', { name: '下一页文章' }).locator('svg').count(), 1)
  await page.locator('#nprogress').waitFor({ state: 'hidden' })
  await page.screenshot({ path: output + '/bento-list.png' })
  await page.getByRole('button', { name: '下一页文章' }).click()
  await page.getByRole('link', { name: '阅读：第七篇文章' }).waitFor()
  assert.equal(await page.locator('.bento-article-link').count(), 1)
  await page.waitForFunction(
    () => document.querySelector('.bento-article-link')?.closest('.bento-grid')?.parentElement?.style.opacity === '1'
  )
  const singleBox = await page.locator('.bento-article-link').boundingBox()
  assert.ok(Math.abs(singleBox.x + singleBox.width / 2 - 720) < 2)
  assert.ok(Math.abs(singleBox.y + singleBox.height / 2 - 500) < 2)
  await page.screenshot({ path: output + '/bento-last-page.png' })
  assert.equal(await page.getByRole('button', { name: '下一页文章' }).count(), 0)
  await page.getByRole('button', { name: '上一页文章' }).click()
  await page.getByRole('link', { name: '阅读：Vue 组件设计：从复用到表达' }).click()
  await page.getByRole('heading', { name: '文章正文' }).waitFor()
  await page.getByRole('link', { name: '文章管理', exact: true }).click()
  await page.getByRole('button', { name: /Vue 组件设计/ }).waitFor()
  await page.getByRole('button', { name: /Vue 组件设计/ }).click()
  await page.waitForFunction(
    () => document.getElementById('article-title')?.value === 'Vue 组件设计：从复用到表达'
  )
  await page.screenshot({ path: output + '/manage-desktop.png' })
  await page.getByRole('button', { name: '新建文章', exact: true }).click()
  const title = page.getByRole('textbox', { name: '文章标题', exact: true })
  await title.fill('浏览器验证文章')
  const editor = page.getByRole('textbox', { name: '文章正文' })
  await editor.fill('新的正文内容')
  await editor.press('ControlOrMeta+a')
  await page.getByRole('button', { name: '粗体', exact: true }).click()
  await page.getByRole('button', { name: '预览', exact: true }).click()
  assert.equal(await page.locator('.writing-preview strong').textContent(), '新的正文内容')
  await page.getByRole('button', { name: '编辑', exact: true }).click()
  failSave = true
  await page.getByRole('button', { name: '保存草稿', exact: true }).click()
  await page.getByRole('alert').filter({ hasText: '保存暂不可用' }).waitFor()
  assert.equal(await title.inputValue(), '浏览器验证文章')
  failSave = false
  await page.getByRole('button', { name: '保存草稿', exact: true }).click()
  await page.getByRole('status').filter({ hasText: '草稿已保存' }).waitFor()
  const createdId = articles[0].id
  assert.match(articles[0].content, /<strong>新的正文内容<\/strong>/)
  await title.fill('浏览器验证文章（已修改）')
  await page.getByRole('button', { name: '发布文章', exact: true }).click()
  await page.getByRole('status').filter({ hasText: '文章已发布' }).waitFor()
  assert.equal(articles.find(a => a.id === createdId).version, 2)
  await page.reload()
  await page.getByRole('button', { name: /浏览器验证文章（已修改）/ }).click()
  await page.waitForFunction(
    () => document.getElementById('article-title')?.value === '浏览器验证文章（已修改）'
  )
  await page.getByRole('button', { name: '预览', exact: true }).click()
  await page.screenshot({ path: output + '/preview.png' })
  await page.getByRole('button', { name: '编辑', exact: true }).click()
  await page.locator('html').evaluate(el => el.classList.add('dark'))
  await page.screenshot({ path: output + '/manage-dark.png' })
  await page.setViewportSize({ width: 390, height: 844 })
  await page.screenshot({ path: output + '/manage-mobile.png', fullPage: true })
  assert.equal(await page.locator('body').evaluate(el => el.scrollWidth > innerWidth), false)
  await page.getByRole('button', { name: '删除文章', exact: true }).click()
  await page.getByRole('button', { name: '保留文章', exact: true }).click()
  assert.equal(
    articles.some(a => a.id === createdId),
    true
  )
  await page.getByRole('button', { name: '删除文章', exact: true }).click()
  await page.getByRole('button', { name: '确认删除', exact: true }).click()
  await page.getByRole('status').filter({ hasText: '文章已删除' }).waitFor()
  assert.equal(
    articles.some(a => a.id === createdId),
    false
  )
  await page.getByRole('textbox', { name: '搜索全部文章' }).fill('第七篇')
  await page.getByRole('button', { name: '执行文章搜索' }).click()
  await page.getByRole('button', { name: /第七篇文章/ }).waitFor()
  assert.equal(await page.locator('.library-item').count(), 1)
  await page.getByRole('button', { name: '草稿', exact: true }).click()
  await page.getByText('没有匹配的文章。', { exact: true }).waitFor()
  failList = true
  await page.getByRole('button', { name: '全部', exact: true }).click()
  await page.getByRole('alert').filter({ hasText: '文章加载暂不可用' }).waitFor()
  failList = false
  await page.getByRole('button', { name: '重试', exact: true }).click()
  await page.getByRole('button', { name: /第七篇文章/ }).waitFor()
  assert.ok(requests.some(r => r.method === 'PATCH' && r.body.version === 1))
  assert.deepEqual(errors, [])
  console.log(
    'Passed: original Bento cards, pagination, rich text, preview, draft/create/edit/publish/delete, persistence, search/filter, API errors, dark theme and mobile. Page errors: 0.'
  )
} catch (e) {
  await page.screenshot({ path: output + '/failure.png', fullPage: true })
  console.error(errors)
  throw e
} finally {
  await browser.close()
}
