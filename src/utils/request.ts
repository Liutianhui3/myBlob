import axios from 'axios'
import type { AxiosRequestConfig, AxiosResponse } from 'axios'
import { getToken } from './token'

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
