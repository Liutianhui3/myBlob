import test from 'node:test'
import assert from 'node:assert/strict'
import { loadClient } from './helpers/client.mjs'
const { parseDiagram } = loadClient().load('src/lib/diagram.ts')
test('diagram accepts text-only steps and parallel alternatives', () => {
  const source = {
    steps: [
      { title: '前端', connector: 'both' },
      { title: '后端', tone: 'accent', items: [{ title: 'NestJS' }, { title: 'FastAPI' }] }
    ]
  }
  assert.equal(JSON.stringify(parseDiagram(JSON.stringify(source))), JSON.stringify(source))
  assert.equal(
    parseDiagram('{"steps":[{"title":"<script>alert(1)</script>"}]}').steps[0].title,
    '<script>alert(1)</script>'
  )
})
test('diagram rejects malformed, oversized and invalid nested data', () => {
  for (const value of [
    'null',
    '{',
    '{}',
    '{"steps":[]}',
    '{"steps":[null]}',
    '{"steps":[{"title":"a","items":[null]}]}',
    '{"steps":[{"title":"a","tone":"url(x)"}]}',
    JSON.stringify({ steps: [{ title: 'a'.repeat(1001) }] }),
    JSON.stringify({ steps: Array.from({ length: 13 }, () => ({ title: 'a' })) })
  ])
    assert.equal(parseDiagram(value), null)
})
