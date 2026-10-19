import { chromium } from 'playwright'
import ExcelJS from 'exceljs'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'

const browser = await chromium.launch({ channel: 'chrome', headless: true })
try {
  const page = await browser.newPage()
  const errors = []
  page.on('pageerror', e => errors.push(e.message))
  await page.addInitScript(() => localStorage.setItem('myblob_token', 'test'))
  const id = '00000000-0000-4000-8000-000000000001'
  const image = {
    name: 'image.png',
    type: 'image',
    mime: 'image/png',
    data: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aRZkAAAAASUVORK5CYII='
  }
  const payload = JSON.stringify({
    filename: '测试.xlsx',
    sheets: [
      {
        name: '统计',
        rows: [
          ['姓名', '金额'],
          ['张三', 123]
        ]
      }
    ]
  })
  const content =
    '表格已准备好。\n\n```xlsx\n' + payload + '\n```\n\n![AI 生成的图片](<https://pub-test.r2.dev/test.png>)\n\n'
  let submitted
  let imageDownloads = 0
  await page.route('https://pub-test.r2.dev/test.png', route => route.fulfill({ contentType: 'image/png', body: Buffer.from(image.data.split(',')[1], 'base64') }))
  await page.route(/^https?:\/\/[^/]+\/api\//, route => {
    const path = new URL(route.request().url()).pathname
    if (path.endsWith('/images/download')) {
      imageDownloads++
      assert.equal(route.request().headers().authorization, 'Bearer test')
      assert.equal(route.request().postDataJSON().url, 'https://pub-test.r2.dev/test.png')
      return route.fulfill({ contentType: 'image/png', body: Buffer.from(image.data.split(',')[1], 'base64') })
    }
    if (path.endsWith('/attachments/extract'))
      return route.fulfill({
        json: {
          name: 'incorrect-name.xlsx',
          type: 'document',
          mime: 'text/plain',
          text: '提取的文档内容'
        }
      })
    if (path.endsWith('/messages/stream')) {
      submitted = route.request().postDataJSON()
      return route.fulfill({
        contentType: 'text/event-stream',
        body:
          'event: start\ndata: {"conversationId":"' +
          id +
          '","userMessageId":"u2","messageId":"a2"}\n\nevent: delta\ndata: {"text":"已收到文档"}\n\nevent: done\ndata: {"messageId":"a2"}\n\n'
      })
    }
    const conversation = {
      id,
      title: '表格下载',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
    const json = path.endsWith('/users/me')
      ? { id: 'test', username: 'test', name: 'Test', email: 'test@example.com' }
      : path.endsWith('/models')
        ? {
            defaultModel: 'test',
            models: [
              { id: 'test', label: 'Test', reasoningEfforts: ['auto'], defaultEffort: 'auto' }
            ]
          }
        : path.endsWith('/messages')
          ? [
              {
                id: 'user',
                turnId: 'turn',
                sequence: '0',
                role: 'user',
                content: '生成表格',
                attachments: [image],
                status: 'completed'
              },
              {
                id: 'reply',
                turnId: 'turn',
                sequence: '1',
                role: 'assistant',
                content,
                status: 'completed'
              }
            ]
          : [conversation]
    return route.fulfill({ json })
  })
  await page.goto((process.env.CHAT_UI_BASE || 'http://127.0.0.1:8083') + '/chat?c=' + id)
  const button = page.getByRole('button', { name: '下载 Excel', exact: true })
  await button.waitFor({ timeout: 10000 }).catch(async e => {
    console.log(page.url(), errors, await page.locator('body').innerText())
    throw e
  })
  assert.equal(await page.locator('.code-block').count(), 0)
  const generated = page.locator('.generated-image')
  await generated.locator('img').first().waitFor()
  assert.equal(
    await generated
      .locator('img')
      .first()
      .evaluate(img => img.complete && img.naturalWidth > 0),
    true
  )
  await generated.getByRole('button', { name: '预览图片 AI 生成的图片' }).click()
  await page.getByRole('dialog', { name: '图片预览' }).waitFor()
  await page.keyboard.press('Escape')
  const imageDownloading = page.waitForEvent('download')
  await generated.getByRole('button', { name: '下载图片' }).click()
  assert.equal((await imageDownloading).suggestedFilename(), 'AI-image.png')
  assert.equal(imageDownloads, 1)
  const thumbnail = page.getByRole('button', { name: '预览图片 image.png', exact: true })
  await thumbnail.click()
  await page.getByRole('dialog', { name: '图片预览' }).waitFor()
  await page.keyboard.press('Escape')
  assert.equal(await page.locator('dialog[open]').count(), 0)
  await page.locator('input[type=file]').setInputFiles({
    name: 'image.png',
    mimeType: 'image/png',
    buffer: Buffer.from(image.data.split(',')[1], 'base64')
  })
  await page.locator('.draft-attachments .image-thumbnail').waitFor()
  assert.equal((await page.locator('.draft-attachments').innerText()).trim(), '')
  await page.locator('.draft-attachments .image-thumbnail').click()
  await page.getByRole('button', { name: '关闭图片预览' }).last().click()
  await page.getByRole('button', { name: '移除 image.png' }).click()
  await page.locator('.draft-attachments .image-thumbnail').waitFor({ state: 'detached' })
  await button.hover()
  await fs.mkdir('.artifacts/spreadsheet', { recursive: true })
  await page.screenshot({ path: '.artifacts/spreadsheet/desktop.png', fullPage: true })
  const downloading = page.waitForEvent('download')
  await button.click()
  const download = await downloading
  assert.equal(download.suggestedFilename(), '测试.xlsx')
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.readFile(await download.path())
  assert.equal(workbook.getWorksheet('统计').getCell('B2').value, 123)
  for (const extension of ['docx', 'xlsx', 'pdf', 'pptx']) {
    await page.locator('input[type=file]').setInputFiles({
      name: `中文附件.${extension}`,
      mimeType: 'application/octet-stream',
      buffer: Buffer.from('fixture')
    })
    await page
      .locator('.draft-attachments')
      .getByText(`中文附件.${extension}`, { exact: true })
      .waitFor()
  }
  await page.getByRole('button', { name: '发送消息', exact: true }).click()
  await page.getByText('已收到文档', { exact: true }).waitFor()
  assert.equal(submitted.attachments.length, 4)
  assert.equal(submitted.attachments[1].name, '中文附件.xlsx')
  assert.ok(submitted.attachments.every(a => a.text === '提取的文档内容'))
  await page.setViewportSize({ width: 390, height: 844 })
  await fs.mkdir('.artifacts/spreadsheet', { recursive: true })
  await page.screenshot({ path: '.artifacts/spreadsheet/mobile.png', fullPage: true })
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false)
  assert.deepEqual(errors, [])
  console.log(
    'Passed: history renders file card, browser downloads valid XLSX, mobile has no horizontal overflow, no page errors.'
  )
} finally {
  await browser.close()
}
