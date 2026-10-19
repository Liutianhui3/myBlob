export type SpreadsheetCell = string | number | boolean | null
export interface SpreadsheetFile {
  filename: string
  sheets: { name: string; rows: SpreadsheetCell[][] }[]
}

// Model output is data only: never evaluate code or accept formula objects.
export function parseSpreadsheet(source: string): SpreadsheetFile | null {
  if (source.length > 2_000_000) return null
  try {
    const value = JSON.parse(source)
    if (
      !value ||
      typeof value.filename !== 'string' ||
      !Array.isArray(value.sheets) ||
      !value.sheets.length ||
      value.sheets.length > 20
    )
      return null
    let cells = 0
    const names = new Set<string>()
    for (const sheet of value.sheets) {
      if (
        !sheet ||
        typeof sheet.name !== 'string' ||
        !sheet.name.trim() ||
        sheet.name.length > 31 ||
        /[\\/?*\[\]:]/.test(sheet.name) ||
        /^'|'$/.test(sheet.name) ||
        names.has(sheet.name.toLowerCase()) ||
        !Array.isArray(sheet.rows) ||
        sheet.rows.length > 10000
      )
        return null
      names.add(sheet.name.toLowerCase())
      for (const row of sheet.rows) {
        if (!Array.isArray(row) || row.length > 256) return null
        cells += row.length
        if (cells > 100000) return null
        for (const cell of row) {
          if (
            cell !== null &&
            typeof cell !== 'string' &&
            typeof cell !== 'boolean' &&
            !(typeof cell === 'number' && Number.isFinite(cell))
          )
            return null
          if (typeof cell === 'string' && cell.length > 32767) return null
        }
      }
    }
    const filename =
      value.filename
        .replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_')
        .trim()
        .slice(0, 120)
        .replace(/\.xlsx$/i, '') || '表格'
    return { filename: `${filename}.xlsx`, sheets: value.sheets }
  } catch {
    return null
  }
}

export async function createSpreadsheet(file: SpreadsheetFile) {
  const { default: ExcelJS } = await import('exceljs')
  const workbook = new ExcelJS.Workbook()
  for (const data of file.sheets) {
    const sheet = workbook.addWorksheet(data.name)
    sheet.addRows(data.rows)
    if (data.rows.length) {
      sheet.getRow(1).font = { bold: true }
      sheet.views = [{ state: 'frozen', ySplit: 1 }]
      sheet.columns.forEach(column => {
        column.width = 22
      })
    }
  }
  return workbook.xlsx.writeBuffer()
}
