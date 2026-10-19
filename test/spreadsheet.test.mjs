import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import ts from 'typescript'
import ExcelJS from 'exceljs'

const source = fs.readFileSync(new URL('../src/lib/spreadsheet.ts', import.meta.url), 'utf8')
const code = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 }
}).outputText
const { parseSpreadsheet, createSpreadsheet } = await import(
  `data:text/javascript;base64,${Buffer.from(code.replace("import('exceljs')", 'Promise.resolve(globalThis.__testExcelJS)')).toString('base64')}`
)

test('Excel round trip preserves typed values and treats formulas as literal strings', async () => {
  globalThis.__testExcelJS = { default: ExcelJS }
  const rows = [
    ['姓名', '金额', '有效', '空值'],
    ['张三', 123.5, true, null],
    ['=HYPERLINK("https://example.com")']
  ]
  const file = parseSpreadsheet(
    JSON.stringify({ filename: '../报表.xlsx', sheets: [{ name: '统计', rows }] })
  )
  assert.equal(file.filename, '.._报表.xlsx')
  const buffer = await createSpreadsheet(file)
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.load(buffer)
  const sheet = workbook.getWorksheet('统计')
  assert.equal(sheet.getCell('A2').value, '张三')
  assert.equal(sheet.getCell('B2').value, 123.5)
  assert.equal(sheet.getCell('C2').value, true)
  assert.equal(sheet.getCell('A3').type, ExcelJS.ValueType.String)
  assert.equal(sheet.getCell('A3').value, rows[2][0])
  delete globalThis.__testExcelJS
})

test('rejects malformed payloads, formula objects, invalid names and excessive data', () => {
  for (const value of ['{', 'null', '{}', JSON.stringify({ filename: 'a', sheets: [] })])
    assert.equal(parseSpreadsheet(value), null)
  for (const sheets of [
    [{ name: 'a/b', rows: [] }],
    [
      { name: 'A', rows: [] },
      { name: 'a', rows: [] }
    ],
    [{ name: 'a', rows: [[{ formula: '1+1' }]] }],
    [{ name: 'a', rows: [['a'.repeat(32768)]] }],
    [{ name: 'a', rows: [Array(257).fill(1)] }],
    [{ name: 'a', rows: Array(10001).fill([]) }]
  ])
    assert.equal(parseSpreadsheet(JSON.stringify({ filename: 'a', sheets })), null)
})
