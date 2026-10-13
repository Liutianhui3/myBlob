import request from '@/utils/request'
import { RequestError } from '@/utils/request'
import { clearSession } from '@/lib/auth'
import { getToken } from '@/utils/token'
export interface Article {
  id: string
  authorId: string
  authorName: string
  title: string
  summary: string
  category: string
  tags: string[]
  coverUrl: string
  status: 'draft' | 'published'
  version: number
  content?: string
  createdAt: string
  updatedAt: string
  publishedAt: string | null
}
export interface ArticleInput {
  title: string
  summary: string
  content: string
  category: string
  tags: string[]
  coverUrl: string
  status: 'draft' | 'published'
  version?: number
}
export interface ArticlePage {
  items: Article[]
  total: number
  page: number
  limit: number
}
export interface ArticleQuery {
  page?: number
  limit?: number
  q?: string
  status?: string
  category?: string
}
async function send<T>(config: Parameters<typeof request>[0]) {
  const token = getToken()
  try {
    return await request<T>(config)
  } catch (error) {
    if (error instanceof RequestError && error.status === 401 && token === getToken())
      clearSession()
    throw error
  }
}
export const listArticles = (params: ArticleQuery, manage = false, signal?: AbortSignal) =>
  send<ArticlePage>({ url: manage ? '/articles/manage' : '/articles', params, signal })
export const getArticle = (id: string, manage = false, signal?: AbortSignal) =>
  send<Article>({ url: `/articles/${manage ? 'manage/' : ''}${encodeURIComponent(id)}`, signal })
export const createArticle = (data: ArticleInput) =>
  send<Article>({ url: '/articles', method: 'POST', data })
export const updateArticle = (id: string, data: ArticleInput) =>
  send<Article>({ url: `/articles/${encodeURIComponent(id)}`, method: 'PATCH', data })
export const deleteArticle = (id: string) =>
  send<void>({ url: `/articles/${encodeURIComponent(id)}`, method: 'DELETE' })
export const articleDate = (value: string | null) =>
  value
    ? new Intl.DateTimeFormat('zh-CN', { dateStyle: 'medium', timeZone: 'Asia/Shanghai' }).format(
        new Date(value)
      )
    : '未发布'
