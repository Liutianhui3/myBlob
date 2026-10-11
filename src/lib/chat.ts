import { authHeaders, clearSession } from './auth'

export interface Conversation {
  id: string
  title: string
  createdAt: string
  updatedAt: string
}

export interface ChatMessage {
  id: string
  turnId: string
  sequence: string
  role: 'user' | 'assistant'
  content: string
  status: 'completed' | 'generating' | 'failed' | 'cancelled'
  createdAt: string
  model?: string | null
  reasoningEffort?: string | null
}

export interface GenerationOptions {
  model: string
  reasoningEffort: string
}
export interface ChatModel {
  id: string
  label: string
  description: string
  reasoningEfforts: string[]
  defaultEffort: string
}
export interface ModelCatalog {
  defaultModel: string
  models: ChatModel[]
}
export const effortLabels: Record<string, string> = {
  auto: '自动',
  low: '低',
  medium: '中',
  high: '高',
  xhigh: '极高',
  max: 'Ultra'
}

export class ChatError extends Error {
  constructor(
    message: string,
    public status = 0
  ) {
    super(message)
    this.name = 'ChatError'
  }
}

async function checkResponse(response: Response) {
  if (response.ok) return
  if (response.status === 401) clearSession()
  const data = await response.json().catch(() => ({}))
  throw new ChatError(
    response.status === 401
      ? '登录已过期，请重新登录。'
      : Array.isArray(data.message)
        ? data.message.join('、')
        : data.message || `请求失败（${response.status}），请稍后重试。`,
    response.status
  )
}

async function request<T>(path: string, body?: object, signal?: AbortSignal): Promise<T> {
  const response = await fetch(`/api/conversations${path}`, {
    method: body ? 'POST' : 'GET',
    headers: { ...authHeaders(), ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
    signal: signal
      ? AbortSignal.any([signal, AbortSignal.timeout(15000)])
      : AbortSignal.timeout(15000)
  })
  await checkResponse(response)
  return response.json()
}

export const listConversations = (signal?: AbortSignal) =>
  request<Conversation[]>('', undefined, signal)
export const getChatModels = (signal?: AbortSignal) =>
  request<ModelCatalog>('/models', undefined, signal)
export const createConversation = (title: string, signal?: AbortSignal) =>
  request<Conversation>('', { title }, signal)
export const getMessages = (id: string, before?: string, signal?: AbortSignal) =>
  request<ChatMessage[]>(
    `/${encodeURIComponent(id)}/messages?limit=50${before ? `&before=${encodeURIComponent(before)}` : ''}`,
    undefined,
    signal
  )

interface StreamCallbacks {
  signal: AbortSignal
  onStart: (payload: {
    conversationId: string
    userMessageId: string
    messageId: string
    model?: string
    reasoningEffort?: string
  }) => void
  onDelta: (text: string) => void
  onDone: (payload: { messageId: string; finishReason?: string }) => void
}

// POST SSE preserves Bearer authentication and supports stopping generation.
export async function streamMessage(
  id: string,
  content: string,
  callbacks: StreamCallbacks,
  options?: GenerationOptions
) {
  const response = await fetch(`/api/conversations/${encodeURIComponent(id)}/messages/stream`, {
    method: 'POST',
    headers: { ...authHeaders(), 'Content-Type': 'application/json', Accept: 'text/event-stream' },
    body: JSON.stringify({
      content,
      ...(options ? { model: options.model, reasoningEffort: options.reasoningEffort } : {})
    }),
    signal: AbortSignal.any([callbacks.signal, AbortSignal.timeout(630000)])
  })
  await checkResponse(response)
  if (!response.body || !response.headers.get('content-type')?.includes('text/event-stream'))
    throw new ChatError('服务器未返回流式回复，请重试。')
  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let event = 'message'
  let data: string[] = []
  try {
    while (true) {
      const { value, done } = await reader.read()
      buffer += done ? decoder.decode() : decoder.decode(value, { stream: true })
      while (true) {
        const position = buffer.search(/[\r\n]/)
        if (position === -1) break
        if (!done && buffer[position] === '\r' && position === buffer.length - 1) break
        const line = buffer.slice(0, position)
        const width = buffer.slice(position, position + 2) === '\r\n' ? 2 : 1
        buffer = buffer.slice(position + width)
        if (!line) {
          if (data.length) {
            let payload: any
            try {
              payload = JSON.parse(data.join('\n'))
            } catch {
              throw new ChatError('回复数据异常，请重新加载会话。')
            }
            if (event === 'start') callbacks.onStart(payload)
            if (event === 'delta') {
              if (typeof payload.text !== 'string') throw new ChatError('回复数据异常。')
              callbacks.onDelta(payload.text)
            }
            if (event === 'error')
              throw new ChatError(payload.message || '回复生成失败。', payload.statusCode)
            if (event === 'done') {
              callbacks.onDone(payload)
              return
            }
          }
          event = 'message'
          data = []
        } else if (line.startsWith('event:')) event = line.slice(6).replace(/^ /, '')
        else if (line === 'data' || line.startsWith('data:'))
          data.push(line === 'data' ? '' : line.slice(5).replace(/^ /, ''))
      }
      if (done) throw new ChatError('连接提前结束，请重新加载会话确认回复状态。')
    }
  } finally {
    await reader.cancel().catch(() => {})
    reader.releaseLock()
  }
}
