import request from '@/utils/request'

export interface KnowledgeBase {
  id: string
  name: string
  description: string
  documentCount: number
  chunkCount: number
}
export interface KnowledgeDocument {
  id: string
  name: string
  size: number
  chunkSize: number
  chunkOverlap: number
  chunkCount: number
  createdAt: string
  embeddedChunks?: number
}
export interface ChunkPage {
  items: { id: string; position: number; content: string; charCount: number }[]
  total: number
  page: number
}
const basePath = (id: string) => `/knowledge-bases/${encodeURIComponent(id)}`
export const listKnowledgeBases = (signal?: AbortSignal) =>
  request<KnowledgeBase[]>({ url: '/knowledge-bases', signal })
export const createKnowledgeBase = (name: string, description: string) =>
  request<KnowledgeBase>({ url: '/knowledge-bases', method: 'POST', data: { name, description } })
export const listDocuments = (id: string, signal?: AbortSignal) =>
  request<KnowledgeDocument[]>({ url: `${basePath(id)}/documents`, signal })
export const uploadDocument = (
  id: string,
  file: File,
  chunkSize: number,
  chunkOverlap: number,
  signal: AbortSignal,
  onProgress: (value: number) => void
) => {
  const data = new FormData()
  data.append('file', file)
  data.append('chunkSize', String(chunkSize))
  data.append('chunkOverlap', String(chunkOverlap))
  return request<KnowledgeDocument>({
    url: `${basePath(id)}/documents`,
    method: 'POST',
    // XHR reports upload progress without requiring HTTP/2 request streaming.
    adapter: 'xhr',
    data,
    signal,
    timeout: 120000,
    onUploadProgress: event => {
      if (event.total) onProgress(Math.round((event.loaded / event.total) * 100))
    }
  })
}
export const getChunks = (id: string, documentId: string, page: number, signal?: AbortSignal) =>
  request<ChunkPage>({
    url: `${basePath(id)}/documents/${encodeURIComponent(documentId)}/chunks`,
    params: { page },
    signal
  })
export const deleteDocument = (id: string, documentId: string) =>
  request({ url: `${basePath(id)}/documents/${encodeURIComponent(documentId)}`, method: 'DELETE' })

export const embedDocument = (id: string, documentId: string, signal?: AbortSignal) =>
  request<{ documentId: string; model: string; dimensions: number; embeddedChunks: number }>({
    url: `${basePath(id)}/documents/${encodeURIComponent(documentId)}/embeddings`,
    method: 'POST',
    signal,
    timeout: 0
  })
