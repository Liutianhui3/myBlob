import { test } from 'node:test'
import assert from 'node:assert/strict'
import { loadClient, flushRequests } from './helpers/client.mjs'
import fs from 'node:fs'
import * as vue from 'vue'
import { parse, compileStyle } from '@vue/compiler-sfc'
import postcss from 'postcss'

function client() {
  const storage = new Map([['myblob_token', 'test-token']])
  const currentUser = vue.ref({
    id: 'reader-1',
    username: 'reader',
    name: 'Reader',
    email: 'reader@example.com',
    location: '上海',
    bio: '服务端资料'
  })
  const session = new Map()
  const client = loadClient({
    storage,
    session,
    response: async () => ({
      status: 200,
      json: async () => ({ ...currentUser.value, name: '新昵称', avatar: '' })
    }),
    modules: {
      'src/lib/auth.ts': {
        currentUser,
        setUserInfo: user => {
          currentUser.value = user
          session.set('userInfo', JSON.stringify(user))
        },
        TOKEN_KEY: 'myblob_token',
        clearSession: () => {
          currentUser.value = null
          storage.delete('myblob_token')
          session.delete('userInfo')
        }
      }
    }
  })
  return { ...client, api: client.load('src/lib/profile.ts'), currentUser }
}

test('profile reads server data, PATCHes only editable fields and updates shared account state', async () => {
  const { api, calls, currentUser, session } = client()
  assert.equal(api.userProfile.value.bio, '服务端资料')
  await api.saveUserProfile({
    ...api.userProfile.value,
    name: ' 新昵称 ',
    phone: ' +86 13800138000 ',
    about: ' 关于 ',
    skills: [' Vue ', 'Vue', 'TypeScript'],
    workExperiences: [
      {
        id: 'work-1',
        company: ' Company ',
        position: 'Developer',
        startDate: '2023-05',
        endDate: '',
        description: ' 描述 ',
        ownerId: 'forged'
      }
    ],
    id: 'another-user',
    username: 'forged'
  })
  assert.equal(calls[0][0], '/api/users/me')
  const options = calls[0][1]
  assert.equal(options.method, 'PATCH')
  assert.equal(options.headers.Authorization, 'Bearer test-token')
  assert.equal(options.headers['Content-Type'], 'application/json')
  const payload = JSON.parse(options.body)
  assert.equal(payload.name, '新昵称')
  assert.equal(payload.id, undefined)
  assert.equal(payload.username, undefined)
  assert.equal(payload.phone, '+86 13800138000')
  assert.equal(payload.about, '关于')
  assert.deepEqual(payload.skills, ['Vue', 'TypeScript'])
  assert.equal(payload.workExperiences[0].company, 'Company')
  assert.equal(payload.workExperiences[0].description, '描述')
  assert.equal(payload.workExperiences[0].ownerId, undefined)
  assert.equal(currentUser.value.name, '新昵称')
  assert.equal(JSON.parse(session.get('userInfo')).name, '新昵称')
})

test('nested profile drafts never mutate saved shared data before saving', () => {
  const { api, currentUser } = client()
  currentUser.value.skills = ['Vue']
  currentUser.value.workExperiences = [
    {
      id: 'one',
      company: 'Saved',
      position: 'Developer',
      startDate: '2023-05',
      endDate: '',
      description: ''
    }
  ]
  const draft = api.cloneUserProfile(api.userProfile.value)
  draft.skills.push('React')
  draft.workExperiences[0].company = 'Unsaved'
  assert.deepEqual([...currentUser.value.skills], ['Vue'])
  assert.equal(currentUser.value.workExperiences[0].company, 'Saved')
})

test('conflict and network failures preserve saved data for retry', async () => {
  const { api, currentUser, respond } = client()
  respond(async () => ({ ok: false, status: 409, json: async () => ({ message: '邮箱已被使用' }) }))
  await assert.rejects(
    api.saveUserProfile({ ...api.userProfile.value, name: 'Unsaved' }),
    error => error.status === 409 && /邮箱/.test(error.message)
  )
  assert.equal(currentUser.value.name, 'Reader')
  respond(async () => {
    throw new TypeError('offline')
  })
  await assert.rejects(api.saveUserProfile(api.userProfile.value), /暂时无法连接/)
  assert.equal(currentUser.value.name, 'Reader')
})

test('unauthorized saves clear expired login; unauthenticated saves never send a request', async () => {
  const { api, currentUser, storage, calls, respond } = client()
  respond(async () => ({ ok: false, status: 401 }))
  await assert.rejects(api.saveUserProfile(api.userProfile.value), error => error.status === 401)
  assert.equal(currentUser.value, null)
  assert.equal(storage.has('myblob_token'), false)
  await assert.rejects(api.saveUserProfile(api.userProfile.value), error => error.status === 401)
  assert.equal(calls.length, 1)
})

test('late successful or unauthorized responses never replace or sign out another session', async () => {
  for (const status of [200, 401]) {
    const { api, currentUser, storage, respond } = client()
    let complete
    respond(
      () =>
        new Promise(resolve => {
          complete = resolve
        })
    )
    const pending = api.saveUserProfile(api.userProfile.value)
    currentUser.value = {
      id: 'reader-2',
      username: 'second',
      name: 'Second',
      email: 'second@example.com'
    }
    storage.set('myblob_token', 'new-token')
    await flushRequests()
    complete({
      ok: status === 200,
      status,
      json: async () => ({ id: 'reader-1', name: 'Old response' })
    })
    await assert.rejects(pending)
    assert.equal(currentUser.value.name, 'Second')
    assert.equal(storage.get('myblob_token'), 'new-token')
    assert.equal(api.userProfile.value.bio, '')
  }
})

test('dark mode selectors survive Vue scoped CSS compilation and remain limited to profile UI', () => {
  for (const [file, selector] of [
    ['../src/views/profile/index.vue', '.dark .profile-page'],
    ['../src/components/UserAvatar.vue', '.dark .user-avatar']
  ]) {
    const { descriptor } = parse(fs.readFileSync(new URL(file, import.meta.url), 'utf8'))
    const result = compileStyle({
      source: descriptor.styles[0].content,
      filename: file,
      id: 'data-v-profile-test',
      scoped: true
    })
    assert.equal(result.errors.length, 0)
    const selectors = []
    postcss.parse(result.code).walkRules(rule => selectors.push(rule.selector))
    assert.ok(selectors.includes(selector), `Missing compiled ${selector}`)
    assert.ok(
      !selectors.includes('.dark'),
      'A bare .dark rule would overwrite the entire app theme'
    )
  }
})
