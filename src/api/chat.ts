import { clearSession } from '../lib/auth'
import request, { RequestError, requestStream } from '../utils/request'
import { getToken } from '../utils/token'

export interface Conversation {
  id: string
  title: string
  createdAt: string
  updatedAt: string
}

export interface ChatAttachment {
  name: string
  type: 'image' | 'document'
  mime: string
  data?: string
  text?: string
}
export interface ChatMessage {
  attachments?: ChatAttachment[]
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
export class ChatError extends Error {
  constructor(
    message: string,
    public status = 0
  ) {
    super(message)
    this.name = 'ChatError'
  }
}

async function withChatErrors<T>(send: () => Promise<T>): Promise<T> {
  const token = getToken()
  try {
    return await send()
  } catch (error) {
    if (error instanceof RequestError) {
      if (error.status === 401 && token === getToken()) clearSession()
      throw new ChatError(error.message, error.status)
    }
    throw error
  }
}

export const listConversations = (signal?: AbortSignal) =>
  withChatErrors(() => request<Conversation[]>({ url: '/conversations', signal }))
export const deleteConversation = (id: string) =>
  withChatErrors(() =>
    request<{ id: string }>({
      url: `/conversations/${encodeURIComponent(id)}`,
      method: 'DELETE'
    })
  )
export const getChatModels = (signal?: AbortSignal) =>
  withChatErrors(() => request<ModelCatalog>({ url: '/conversations/models', signal }))
export const createConversation = (title: string, signal?: AbortSignal) =>
  withChatErrors(() =>
    request<Conversation>({ url: '/conversations', method: 'POST', data: { title }, signal })
  )
export const getMessages = (id: string, before?: string, signal?: AbortSignal) =>
  withChatErrors(() =>
    request<ChatMessage[]>({
      url: `/conversations/${encodeURIComponent(id)}/messages`,
      params: { limit: 50, ...(before ? { before } : {}) },
      signal
    })
  )

export interface StreamCallbacks {
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
  options?: GenerationOptions,
  attachments?: ChatAttachment[]
) {
  const response = await withChatErrors(() =>
    requestStream({
      url: `/conversations/${encodeURIComponent(id)}/messages/stream`,
      method: 'POST',
      headers: { Accept: 'text/event-stream' },
      data: {
        content,
        ...(attachments?.length ? { attachments } : {}),
        ...(options ? { model: options.model, reasoningEffort: options.reasoningEffort } : {})
      },
      signal: callbacks.signal,
      timeout: 630000
    })
  )
  if (!response.data || !String(response.headers['content-type']).includes('text/event-stream')) {
    await response.data?.cancel().catch(() => {})
    throw new ChatError('服务器未返回流式回复，请重试。')
  }
  const reader = response.data.getReader()
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
