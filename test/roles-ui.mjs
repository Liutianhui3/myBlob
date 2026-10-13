import { chromium } from 'playwright'
import assert from 'node:assert/strict'
const browser = await chromium.launch({ channel: 'chrome', headless: true })
const base = process.env.ARTICLE_UI_BASE || 'http://127.0.0.1:8083'
try {
  for (const role of ['admin', 'user', 'guest']) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } })
    if (role !== 'guest')
      await context.addInitScript(() => localStorage.setItem('myblob_token', 'mock-session'))
    const page = await context.newPage()
    let targetAdmin = false
    let writes = 0
    const user = {
      id: 'actor',
      username: 'actor',
      name: 'Actor',
      email: 'actor@example.com',
      isAdmin: role === 'admin'
    }
    await page.route(/^https?:\/\/[^/]+\/api\//, async route => {
      const path = new URL(route.request().url()).pathname
      if (path === '/api/users/me') return route.fulfill({ json: user })
      if (path === '/api/articles')
        return route.fulfill({ json: { items: [], total: 0, page: 1, limit: 6 } })
      if (path.endsWith('/role')) {
        targetAdmin = route.request().postDataJSON().isAdmin
        writes++
        return route.fulfill({
          json: {
            id: 'target',
            username: 'target',
            name: 'Target',
            email: 'target@example.com',
            isAdmin: targetAdmin
          }
        })
      }
      if (path === '/api/admin/users')
        return route.fulfill({
          json: {
            items: [
              {
                id: 'target',
                username: 'target',
                name: 'Target',
                email: 'target@example.com',
                isAdmin: targetAdmin,
                createdAt: new Date().toISOString()
              }
            ],
            total: 1,
            page: 1,
            limit: 20
          }
        })
      return route.fulfill({ status: 404, json: { message: 'Not found' } })
    })
    await page.goto(base + '/article')
    await page.waitForLoadState('networkidle')
    assert.equal(await page.getByRole('link', { name: '管理文章', exact: true }).count(), 0)
    assert.equal(
      await page
        .getByRole('button', { name: '角色管理', exact: true, includeHidden: true })
        .count(),
      role === 'admin' ? 1 : 0
    )
    assert.equal(
      await page
        .getByRole('button', { name: '文章管理', exact: true, includeHidden: true })
        .count(),
      role === 'admin' ? 1 : 0
    )
    assert.equal(await page.getByText('1 / 1', { exact: true }).count(), 0)
    if (role === 'admin') {
      await page.getByRole('button', { name: '显示导航栏' }).click()
      await page
        .locator('#navigation-dock')
        .screenshot({ path: 'output/playwright/articles/admin-dock.png' })
      await page.getByRole('button', { name: '文章管理', exact: true }).click()
      await page.waitForURL('**/articleManage')
    }
    await page.goto(base + '/roleManage')
    if (role === 'admin') {
      await page.getByRole('button', { name: '设置target的管理员权限' }).click()
      await page.getByRole('dialog').getByRole('button', { name: /确认/ }).click()
      await page.getByRole('button', { name: '取消target的管理员权限' }).waitFor()
      assert.equal(writes, 1)
      await page.screenshot({
        path: 'output/playwright/articles/roles-desktop.png',
        fullPage: true
      })
      await page.setViewportSize({ width: 390, height: 844 })
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
      await page.screenshot({ path: 'output/playwright/articles/roles-mobile.png', fullPage: true })
    } else {
      await page.waitForURL(role === 'guest' ? '**/login?**' : '**/article')
      await page.goto(base + '/articleManage')
      await page.waitForURL(role === 'guest' ? '**/login?**' : '**/article')
      assert.equal(writes, 0)
    }
    await context.close()
  }
  console.log(
    'Passed: admin role grant UI, public articles, hidden management entries, denied management routes, responsive roles page.'
  )
} finally {
  await browser.close()
}
