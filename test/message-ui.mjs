// Real-browser toast lifecycle regression; uses only local UI, no account APIs.
import { chromium } from 'playwright'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'

await fs.mkdir('output/playwright', { recursive: true })
const browser = await chromium.launch({ channel: 'chrome', headless: true })
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } })
const errors = []
page.on('pageerror', error => errors.push(error.message))
const show = options =>
  page.evaluate(async options => {
    const { showMessage } = await import('/src/utils/message.ts')
    showMessage(options)
  }, options)
const scale = () =>
  page
    .locator('.message-water')
    .evaluate(el => Number(getComputedStyle(el).transform.slice(7, -1).split(',')[5]))
try {
  await page.goto('http://127.0.0.1:8082/login')
  await show({ message: '服务器内部错误，请稍后重试', type: 'error', duration: 3000 })
  await page.locator('.message-card').waitFor()
  assert.equal(await page.locator('.message-countdown').count(), 0)
  await page.waitForTimeout(300)
  const shrinking = await scale()
  assert.ok(shrinking > 0 && shrinking < 65, `water displacement: ${shrinking}`)
  await page.locator('.message-card').hover()
  const paused = await scale()
  await page.waitForTimeout(250)
  assert.ok(Math.abs((await scale()) - paused) < 2)
  await page.getByRole('button', { name: '关闭提示' }).focus()
  await page.mouse.move(0, 400)
  await page.waitForTimeout(250)
  assert.ok(Math.abs((await scale()) - paused) < 2, 'focus keeps the timer paused after hover ends')
  await page.evaluate(() => {
    window.toastZero = false
    new MutationObserver(() => {
      const fill = document.querySelector('.message-water')
      if (fill?.style.transform === 'translateY(calc(100% + 20px))') window.toastZero = true
    }).observe(document.body, { subtree: true, attributes: true, attributeFilter: ['style'] })
    document.activeElement.blur()
  })
  await page.locator('.message-card').waitFor({ state: 'detached', timeout: 5000 })
  assert.equal(await page.evaluate(() => window.toastZero), true, 'water drains before dismissal')

  await show({ message: '服务器内部错误，请稍后重试', type: 'error', duration: 10000 })
  await page.waitForTimeout(300)
  await page.waitForTimeout(3500)
  await page.screenshot({ path: 'output/playwright/message-light.png' })
  await page.setViewportSize({ width: 375, height: 812 })
  await page.evaluate(() => document.documentElement.classList.add('dark'))
  await show({
    message: '暂时无法连接服务，请检查网络连接后重试。这里是一条较长的错误提示。',
    type: 'error',
    duration: 10000
  })
  await page.waitForTimeout(300)
  const box = await page.locator('.message-card').boundingBox()
  assert.ok(box.x >= 0 && box.x + box.width <= 375)
  assert.equal(
    await page.locator('.message-card').evaluate(el => getComputedStyle(el).backgroundColor),
    'rgb(30, 41, 59)'
  )
  await page.waitForTimeout(3500)
  await page.screenshot({ path: 'output/playwright/message-mobile-dark.png' })
  await page.getByRole('button', { name: '关闭提示' }).click()
  await page.locator('.message-card').waitFor({ state: 'detached' })

  await page.emulateMedia({ reducedMotion: 'reduce' })
  await show({ message: '保存成功', type: 'success', duration: 0 })
  assert.equal(await page.locator('.message-water').count(), 0)
  assert.equal(await page.locator('.message-countdown').count(), 0)
  await page.getByRole('button', { name: '关闭提示' }).click()
  await page.locator('.message-card').waitFor({ state: 'detached' })
  assert.deepEqual(errors, [])
  console.log(
    'Toast UI passed: draining water, waves, pause/focus, empty before exit, mobile/dark, manual close, persistent and reduced motion.'
  )
} finally {
  await browser.close()
}
