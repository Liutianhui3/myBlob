import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'
import * as vue from 'vue'
import { parse, compileScript } from '@vue/compiler-sfc'

const catalog = {
  defaultModel: 'model-a',
  models: [
    {
      id: 'model-a',
      label: 'GPT-Model A',
      description: '',
      reasoningEfforts: ['low', 'medium', 'high', 'xhigh', 'max'],
      defaultEffort: 'auto'
    },
    {
      id: 'model-b',
      label: 'Model B',
      description: '',
      reasoningEfforts: [],
      defaultEffort: 'auto'
    }
  ]
}

function settings(t, saved = undefined) {
  const storage = new Map(saved ? [['myblob_chat_settings:one', JSON.stringify(saved)]] : [])
  const currentUser = vue.ref({ id: 'one' })
  const emitted = []
  const props = vue.reactive({ disabled: false })
  let getModels = async () => catalog
  const file = new URL('../src/components/ChatModelSettings.vue', import.meta.url)
  const { descriptor } = parse(fs.readFileSync(file, 'utf8'))
  const script = compileScript(descriptor, { id: 'model-settings-test' })
  const context = {
    exports: {},
    AbortController,
    document: { addEventListener() {}, removeEventListener() {} },
    sessionStorage: {
      getItem: key => storage.get(key) ?? null,
      setItem: (key, value) => storage.set(key, value)
    },
    require: name => {
      if (name === 'vue') return { ...vue, onMounted() {}, onUnmounted() {} }
      if (name === '@iconify/vue') return { Icon: {} }
      if (name === '@/lib/auth') return { currentUser }
      if (name === '@/api/chat') return { getChatModels: () => getModels() }
      if (name === '@/lib/chat')
        return {
          effortLabels: {
            auto: '自动',
            low: '低',
            medium: '中',
            high: '高',
            xhigh: '极高',
            max: 'Ultra'
          }
        }
      throw new Error(`Unexpected module ${name}`)
    }
  }
  vm.runInNewContext(
    ts.transpileModule(script.content, {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
    }).outputText,
    context
  )
  const scope = vue.effectScope()
  const component = scope.run(() =>
    context.exports.default.setup(props, { emit: (...args) => emitted.push(args), expose() {} })
  )
  t.after(() => scope.stop())
  return {
    component,
    emitted,
    storage,
    currentUser,
    props,
    respond: handler => {
      getModels = handler
    }
  }
}

test('model preferences restore per account, discard unavailable values and reset unsupported effort on model switch', async t => {
  const { component, emitted, storage, currentUser } = settings(t, {
    model: 'model-a',
    reasoningEffort: 'high'
  })
  await component.load()
  assert.equal(component.effort.value, 'high')
  assert.equal(emitted.at(-1)[1].model, 'model-a')
  component.chooseModel(catalog.models[1])
  assert.equal(component.effort.value, 'auto')
  assert.equal(JSON.parse(storage.get('myblob_chat_settings:one')).model, 'model-b')
  currentUser.value = { id: 'two' }
  await vue.nextTick()
  assert.equal(component.selectedId.value, 'model-a')
  assert.equal(component.effort.value, 'auto')
  currentUser.value = { id: 'one' }
  await vue.nextTick()
  assert.equal(component.selectedId.value, 'model-b')
  const stale = settings(t, { model: 'removed-model', reasoningEffort: 'max' })
  await stale.component.load()
  assert.equal(stale.component.selectedId.value, 'model-a')
  assert.equal(stale.component.effort.value, 'auto')
})

test('model load failure blocks selection, retry recovers, and generation closes open settings', async t => {
  const { component, emitted, props, respond } = settings(t)
  respond(async () => {
    throw new Error('unavailable')
  })
  await component.load()
  assert.equal(component.failed.value, true)
  assert.ok(emitted.some(([event, value]) => event === 'change' && value === null))
  respond(async () => catalog)
  await component.load()
  assert.equal(component.failed.value, false)
  component.changeEffort({ target: { value: '3' } })
  assert.equal(emitted.at(-1)[1].reasoningEffort, 'high')
  component.resetEffort()
  assert.equal(component.effort.value, 'auto')
  component.open.value = 'effort'
  props.disabled = true
  await vue.nextTick()
  assert.equal(component.open.value, null)
})

test('two-stage selector keeps Ultra in session, returns to strength after model selection and supports default selection', async t => {
  const { component, emitted, storage } = settings(t)
  await component.load()
  assert.equal(component.selectedChoice.value, '$default')
  assert.equal(component.selectedLabel.value, 'Model A')
  await component.toggle('effort')
  assert.equal(component.open.value, 'effort')
  component.changeEffort({ target: { value: '5' } })
  assert.equal(component.isUltra.value, true)
  assert.equal(emitted.at(-1)[1].reasoningEffort, 'max')
  const restored = settings(t, JSON.parse(storage.get('myblob_chat_settings:one')))
  await restored.component.load()
  assert.equal(restored.component.isUltra.value, true)
  assert.equal(restored.component.selectedChoice.value, '$default')
  await component.toggle('model')
  assert.equal(component.open.value, 'model')
  // Removing the focused model-name button must not immediately close its menu.
  component.focusOut({ relatedTarget: null })
  assert.equal(component.open.value, 'model')
  await component.escape()
  assert.equal(component.open.value, 'effort')
  await component.toggle('model')
  component.chooseModel(catalog.models[1])
  assert.equal(component.open.value, 'effort')
  assert.equal(component.selectedLabel.value, 'Model B')
  assert.equal(component.selectedChoice.value, 'model-b')
  assert.equal(component.effort.value, 'auto')
  await component.toggle('model')
  await component.moveModel({ key: 'Home', preventDefault() {} })
  assert.equal(component.selectedChoice.value, '$default')
  assert.equal(emitted.at(-1)[1].model, catalog.defaultModel)
  assert.equal(JSON.parse(storage.get('myblob_chat_settings:one')).useDefaultModel, true)
  await component.escape()
  await component.escape()
  assert.equal(component.open.value, null)
  await component.toggle('effort')
  component.shell.value = { contains: target => target === 'inside' }
  component.focusOut({ relatedTarget: 'inside' })
  assert.equal(component.open.value, 'effort')
  component.focusOut({ relatedTarget: 'outside' })
  assert.equal(component.open.value, null)
})
