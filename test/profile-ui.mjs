// Local Chrome regression with simulated account APIs; does not modify real accounts.
import { chromium } from 'playwright'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'

await fs.mkdir('.artifacts/profile', { recursive: true })
const browser = await chromium.launch({ channel: 'chrome', headless: true })
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
const errors = []
page.on('pageerror', error => errors.push(error.message))
let saved = {
  id: '11111111-1111-4111-8111-111111111111',
  username: 'reader',
  name: 'Reader',
  email: 'reader@example.com',
  location: '上海',
  website: '',
  bio: '原来的简介',
  avatar: '',
  phone: '',
  about: '',
  skills: ['HTML'],
  workExperiences: []
}
let conflict = true
let payload
async function settleHome() {
  await page.waitForFunction(() => {
    const copy = document.querySelector('.intro-bio')
    if (!copy?.parentElement) return false
    const style = getComputedStyle(copy.parentElement)
    return Number(style.opacity) > 0.99 && style.filter === 'blur(0px)'
  })
}
await page.addInitScript(() => localStorage.setItem('myblob_token', 'profile-ui-token'))
await page.route('**/api/**', async route => {
  const request = route.request()
  if (new URL(request.url()).pathname !== '/api/users/me') {
    return route.fulfill({ status: 404, json: {} })
  }
  if (request.method() === 'PATCH') {
    payload = request.postDataJSON()
    if (conflict) return route.fulfill({ status: 409, json: { message: '邮箱已被使用' } })
    saved = { ...saved, ...payload }
  }
  return route.fulfill({ json: saved })
})
try {
  await page.goto(`${process.env.PROFILE_UI_BASE || 'http://127.0.0.1:8082'}/profile`)
  await page.locator('#profile-bio').waitFor()
  assert.equal(await page.getByRole('combobox', { name: '所在地省份' }).inputValue(), '上海市')
  await page.getByRole('combobox', { name: '所在地省份' }).selectOption('江苏省')
  await page.getByRole('combobox', { name: '所在地城市或区县' }).selectOption('苏州市')
  await page.getByRole('combobox', { name: '所在地省份' }).selectOption('浙江省')
  assert.equal(await page.getByRole('combobox', { name: '所在地城市或区县' }).inputValue(), '')
  await page.getByRole('combobox', { name: '所在地省份' }).selectOption('江苏省')
  await page.getByRole('combobox', { name: '所在地城市或区县' }).selectOption('苏州市')
  await page.locator('#profile-phone').fill('+86 13800138000')
  await page.locator('#profile-bio').fill('我是前端工程师，喜欢创造与分享。\n这是个人简介第二行。')
  await page.locator('#profile-about').fill('热衷于产品研发和技术探索。\n这是详细介绍。')
  await page.locator('#profile-website').fill('https://example.com')
  await page.locator('#profile-skill').fill('Vue')
  await page.locator('#profile-skill').press('Enter')
  await page.locator('#profile-skill').fill('TypeScript')
  await page.getByRole('button', { name: '添加', exact: true }).click()
  await page.getByRole('button', { name: '＋ 添加工作经历', exact: true }).click()
  const first = page.locator('.experience-editor').first()
  await first.locator('input[id^="work-company"]').fill('测试科技')
  await first.locator('input[id^="work-position"]').fill('前端开发工程师')
  await first.locator('input[id^="work-start"]').fill('2021-03')
  await first.locator('input[id^="work-end"]').fill('2023-04')
  await first
    .locator('textarea')
    .fill(
      '<img src=x onerror=alert(1)> 参与研发与性能优化。\n负责产品页面设计与维护。\n参与交互设计与团队协作。'
    )
  await page.getByRole('button', { name: '＋ 添加工作经历', exact: true }).click()
  const second = page.locator('.experience-editor').nth(1)
  await second.locator('input[id^="work-company"]').fill('新公司')
  await second.locator('input[id^="work-position"]').fill('高级前端工程师')
  await second.locator('input[id^="work-start"]').fill('2023-05')
  await second.locator('textarea').fill('SaaS 产品研发。')
  await page.getByRole('button', { name: '上移经历 2', exact: true }).click()
  assert.equal(await first.locator('input[id^="work-company"]').inputValue(), '新公司')
  assert.equal(await page.locator('.preview-bio').innerText(), '原来的简介')
  await page.locator('#profile-skill').fill('React') // Saving also commits pending tags.
  await page.getByRole('button', { name: '保存资料', exact: true }).click()
  await page.getByText('邮箱已被使用', { exact: true }).waitFor()
  assert.equal(
    await page.locator('#profile-about').inputValue(),
    '热衷于产品研发和技术探索。\n这是详细介绍。'
  )
  assert.equal(saved.bio, '原来的简介')
  conflict = false
  await page.getByRole('button', { name: '保存资料', exact: true }).click()
  await page.getByText('资料已保存', { exact: true }).waitFor()
  assert.deepEqual(payload.skills, ['HTML', 'Vue', 'TypeScript', 'React'])
  assert.equal(payload.location, '江苏省 · 苏州市')
  assert.equal(payload.workExperiences[0].company, '新公司')
  assert.equal(payload.workExperiences[0].endDate, '')
  assert.equal(await page.getByRole('button', { name: '保存资料', exact: true }).isDisabled(), true)
  const cached = await page.evaluate(() => JSON.parse(sessionStorage.getItem('userInfo')))
  assert.deepEqual(cached.workExperiences, saved.workExperiences)
  await page.evaluate(() => window.scrollTo(0, 0))
  await page.screenshot({ path: '.artifacts/profile/editor-light.png', fullPage: true })
  await page.getByRole('link', { name: '返回首页' }).click()
  await page.locator('.intro-bio').waitFor()
  assert.equal(await page.locator('.intro-bio').innerText(), saved.bio)
  assert.equal(await page.locator('#about p').innerText(), saved.about)
  assert.equal(
    await page.getByRole('link', { name: '邮箱', exact: true }).getAttribute('href'),
    'mailto:reader@example.com'
  )
  assert.equal(
    await page.getByRole('link', { name: '手机号码', exact: true }).getAttribute('href'),
    'tel:+8613800138000'
  )
  assert.ok((await page.locator('#work').innerText()).includes('2023.5 - 至今'))
  await settleHome()
  const workButton = page.getByRole('button', { name: /测试科技/ })
  const details = page.locator(`#${await workButton.getAttribute('aria-controls')}`)
  const alignment = await workButton.evaluate(button => {
    const name = button.querySelector('span').getBoundingClientRect()
    const arrow = button.querySelector('svg').getBoundingClientRect()
    return Math.abs(name.y + name.height / 2 - arrow.y - arrow.height / 2)
  })
  assert.ok(alignment < 1, 'Work arrow must be vertically centered with the company name')
  async function sampleToggle() {
    return workButton.evaluate(async button => {
      const details = document.getElementById(button.getAttribute('aria-controls'))
      const samples = []
      button.click()
      const start = performance.now()
      while (performance.now() - start < 500) {
        await new Promise(requestAnimationFrame)
        samples.push({
          height: details.getBoundingClientRect().height,
          full: details.scrollHeight,
          opacity: Number(getComputedStyle(details).opacity),
          arrow: getComputedStyle(button.querySelector('svg')).transform
        })
      }
      return samples
    })
  }
  const opening = await sampleToggle()
  assert.ok(
    opening.some(sample => sample.height > 1 && sample.height < sample.full - 1),
    'Opening must animate through intermediate heights'
  )
  assert.ok(
    opening.some(sample => sample.opacity > 0 && sample.opacity < 1),
    'Opening must fade in'
  )
  assert.ok(
    new Set(opening.map(sample => sample.arrow)).size > 2,
    'Arrow must rotate while opening'
  )
  assert.equal(await details.evaluate(element => element.style.height), 'auto')
  const closing = await sampleToggle()
  assert.ok(
    closing.some(sample => sample.height > 1 && sample.height < sample.full - 1),
    'Closing must animate through intermediate heights'
  )
  assert.equal(closing.at(-1).height, 0)
  assert.equal(await details.getAttribute('aria-hidden'), 'true')
  assert.equal(await details.evaluate(element => element.inert), true)
  await workButton.evaluate(async button => {
    for (let index = 0; index < 3; index++) {
      button.click()
      await new Promise(requestAnimationFrame)
      await new Promise(requestAnimationFrame)
    }
  })
  await page.waitForFunction(
    id => {
      const element = document.getElementById(id)
      return element.style.height === 'auto' && Number(getComputedStyle(element).opacity) === 1
    },
    await workButton.getAttribute('aria-controls')
  )
  assert.equal(await page.locator('#work img').count(), 0)
  assert.ok((await page.locator('#work').innerText()).includes('<img src=x onerror=alert(1)>'))
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await workButton.press('Enter')
  assert.equal(await details.evaluate(element => element.getBoundingClientRect().height), 0)
  await workButton.press('Enter')
  assert.equal(await details.evaluate(element => element.style.height), 'auto')
  assert.equal(await details.evaluate(element => element.inert), false)
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await settleHome()
  await page.screenshot({ path: '.artifacts/profile/home-light.png', fullPage: true })
  await page.reload()
  await page.locator('#skills .skill').first().waitFor()
  assert.equal(await page.locator('#skills .skill').count(), 4)
  await settleHome()
  await page.evaluate(() => document.documentElement.classList.add('dark'))
  await page.screenshot({ path: '.artifacts/profile/home-dark.png', fullPage: true })
  await page.setViewportSize({ width: 390, height: 844 })
  await page.screenshot({ path: '.artifacts/profile/home-mobile.png', fullPage: true })
  assert.equal(
    await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    true
  )
  await page.goto(`${process.env.PROFILE_UI_BASE || 'http://127.0.0.1:8082'}/profile`)
  await page.locator('#profile-bio').waitFor()
  await page.evaluate(() => document.documentElement.classList.add('dark'))
  await page.screenshot({ path: '.artifacts/profile/editor-mobile-dark.png', fullPage: true })
  assert.equal(
    await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    true
  )
  await page
    .locator('.experience-editor')
    .first()
    .locator('input[id^="work-company"]')
    .fill('未保存公司')
  await page.getByRole('button', { name: '移除 Vue', exact: true }).click()
  await page.getByRole('button', { name: '取消修改', exact: true }).click()
  assert.equal(
    await page
      .locator('.experience-editor')
      .first()
      .locator('input[id^="work-company"]')
      .inputValue(),
    '新公司'
  )
  assert.equal(await page.getByRole('button', { name: '移除 Vue', exact: true }).count(), 1)
  while (await page.locator('.experience-editor').count())
    await page.getByRole('button', { name: '删除经历 1', exact: true }).click()
  for (const skill of saved.skills)
    await page.getByRole('button', { name: `移除 ${skill}`, exact: true }).click()
  await page.locator('#profile-bio').fill('')
  await page.locator('#profile-about').fill('')
  await page.locator('#profile-phone').fill('')
  await page.getByRole('combobox', { name: '所在地省份' }).selectOption('')
  await page.getByRole('button', { name: '保存资料', exact: true }).click()
  await page.getByText('资料已保存', { exact: true }).waitFor()
  await page.getByRole('link', { name: '返回首页' }).click()
  await page.getByRole('link', { name: '完善个人简介，让大家了解你。' }).waitFor()
  assert.equal(await page.locator('#about, #skills, #work').count(), 0)
  assert.equal(await page.getByRole('link', { name: '手机号码', exact: true }).count(), 0)
  assert.deepEqual(errors, [])
  console.log(
    'Profile UI passed: selection, edit, order, retry, reset, save, reload, contact links, safe descriptions, arrow alignment, expand/collapse animation, interruption, keyboard/reduced motion, empty fields, desktop/mobile and dark mode.'
  )
} finally {
  await browser.close()
}
