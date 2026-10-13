import NProgress from 'nprogress' // progress bar
import type { Router } from 'vue-router'
import { checkSession } from '@/lib/auth'

export const createRouterGuard = function (router: Router) {
  // 路由守卫
  router.beforeEach(async to => {
    NProgress.start() //开启进度条
    const authPage = ['/login', '/register'].includes(to.path)
    const publicPage = authPage || to.meta.public === true
    const user = await checkSession()
    if (!publicPage && !user)
      return { path: '/login', query: { redirect: to.fullPath }, replace: true }
    if (to.meta.admin === true && user?.isAdmin !== true) return { path: '/article', replace: true }
    if (authPage && user) return { path: '/home', replace: true }
    document.title = to.meta.title ? `${to.meta.title} | 个人博客` : '个人博客'
    return true
  })

  router.afterEach(() => {
    NProgress.done() //完成进度条
  })
  router.onError(() => NProgress.done())
}
