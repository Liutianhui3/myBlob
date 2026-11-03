import axios from 'axios'
import type { AxiosRequestConfig, AxiosResponse } from 'axios'
import { getToken, isTokenExpired, removeToken } from './token'
import { message as showMessage } from './message'

// 防止重复触发登出
let isHandlingExpired = false

function handleTokenExpired() {
  if (isHandlingExpired) return
  isHandlingExpired = true

  // 清除 token
  removeToken()

  // 显示友好的提示消息
  showMessage.warning('登录已过期，请重新登录', 3000)

  // 延迟跳转，让用户看到提示
  setTimeout(() => {
    const currentPath = window.location.pathname
    const redirectQuery = currentPath !== '/login' && currentPath !== '/register'
      ? `?redirect=${encodeURIComponent(window.location.pathname + window.location.search)}`
      : ''

    window.location.href = `/login${redirectQuery}`

    // 重置标志
    setTimeout(() => {
      isHandlingExpired = false
    }, 1000)
  }, 500)
}

export interface RequestConfig extends AxiosRequestConfig {
  authenticated?: boolean
}

export class RequestError extends Error {
  constructor(
    message: string,
    public status = 0
  ) {
    super(message)
    this.name = 'RequestError'
  }
}

// The fetch adapter also exposes a ReadableStream for browser SSE requests.
const client = axios.create({
  baseURL: '/api',
  timeout: 15000,
  adapter: 'fetch',
  env: { fetch: (input, init) => fetch(input, init) },
  fetchOptions: { credentials: 'same-origin' }
})

client.interceptors.request.use(
  config => {
    if ((config as RequestConfig).authenticated !== false && !config.headers.has('Authorization')) {
      const token = getToken()

      // 检查本地 token 是否过期
      if (token && isTokenExpired()) {
        // Token 已过期,阻止请求并触发登出
        handleTokenExpired()
        return Promise.reject(new RequestError('登录已过期,请重新登录。', 401))
      }

      if (token) config.headers.set('Authorization', `Bearer ${token}`)
    }
    return config
  },
  undefined,
  { synchronous: true }
)

client.interceptors.response.use(
  response => response,
  async error => {
    if (axios.isCancel(error)) throw new DOMException('请求已取消。', 'AbortError')
    if (!axios.isAxiosError(error)) throw error
    if (['ETIMEDOUT', 'ECONNABORTED'].includes(error.code || ''))
      throw new DOMException('请求超时，请稍后重试。', 'TimeoutError')
    if (!error.response) throw new TypeError('暂时无法连接服务，请检查网络后重试。')

    const status = error.response.status
    let data = error.response.data
    // Failed SSE requests can carry a JSON error body instead of event data.
    if (data && typeof data.getReader === 'function') {
      data = await new Response(data).json().catch(() => null)
    }

    // 处理 401 未授权错误
    if (status === 401) {
      handleTokenExpired()
    }

    const message = Array.isArray(data?.message) ? data.message.join('，') : data?.message
    throw new RequestError(
      status === 401
        ? '登录已过期，请重新登录。'
        : typeof message === 'string' && message
          ? message
          : `请求失败（${status}），请稍后重试。`,
      status
    )
  }
)

export default async function request<T>(config: RequestConfig): Promise<T> {
  const response = await client.request<T>(config)
  return response.status === 204 ? (null as T) : response.data
}

export function requestStream(config: RequestConfig) {
  return client.request<ReadableStream<Uint8Array>, AxiosResponse<ReadableStream<Uint8Array>>>({
    ...config,
    responseType: 'stream'
  })
}
