import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'
import axios from 'axios'
import * as vue from 'vue'

const root = fileURLToPath(new URL('../../', import.meta.url))

// Exercise the actual Axios fetch adapter while isolating browser storage and the network.
export function loadClient({
  storage = new Map(),
  session = new Map(),
  response,
  modules = {}
} = {}) {
  const calls = []
  const cache = new Map()
  let responder = response
  const storageAPI = values => ({
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: key => values.delete(key)
  })
  class BrowserRequest extends Request {
    constructor(input, init) {
      super(typeof input === 'string' ? new URL(input, 'http://localhost') : input, init)
    }
  }
  const testAxios = {
    ...axios,
    create: config => axios.create({ ...config, env: { ...config.env, Request: BrowserRequest } })
  }
  const globals = {
    AbortSignal,
    DOMException,
    Response,
    TextDecoder,
    localStorage: storageAPI(storage),
    sessionStorage: storageAPI(session),
    fetch: async request => {
      const url = new URL(request.url)
      const headers = Object.fromEntries(request.headers)
      for (const key of ['Authorization', 'Content-Type', 'Accept']) {
        if (request.headers.has(key)) headers[key] = request.headers.get(key)
      }
      const body = request.body ? await request.text() : undefined
      const options = {
        method: request.method,
        headers,
        body,
        signal: request.signal,
        credentials: request.credentials
      }
      calls.push([url.pathname + url.search, options])
      const result = typeof responder === 'function' ? await responder(request) : responder
      if (result instanceof Error) throw result
      if (result instanceof Response) return result
      const data = result?.json ? await result.json() : null
      return new Response(result?.status === 204 ? null : JSON.stringify(data), {
        status: result?.status || 200,
        headers: { 'Content-Type': 'application/json' }
      })
    }
  }
  function load(relative) {
    const filename = path.resolve(root, relative)
    const key = path.relative(root, filename).replaceAll('\\', '/')
    if (modules[key]) return modules[key]
    if (cache.has(filename)) return cache.get(filename)
    const exports = {}
    cache.set(filename, exports)
    const context = {
      ...globals,
      exports,
      require: name => {
        if (name === 'vue') return vue
        if (name === 'axios') return testAxios
        if (name.startsWith('.')) return load(path.resolve(path.dirname(filename), `${name}.ts`))
        throw new Error(`Unexpected module ${name}`)
      }
    }
    vm.runInNewContext(
      ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
        compilerOptions: {
          module: ts.ModuleKind.CommonJS,
          target: ts.ScriptTarget.ES2022,
          esModuleInterop: true
        }
      }).outputText,
      context
    )
    return exports
  }
  return {
    load,
    calls,
    storage,
    session,
    respond: value => {
      responder = value
    }
  }
}

export const flushRequests = () => new Promise(resolve => setImmediate(resolve))
