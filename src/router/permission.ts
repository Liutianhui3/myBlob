import { constantRoutes } from './constants'
import NProgress from 'nprogress' // progress bar
const whitePaths = ['/home', '/article']

export const createRouterGuard = function (router: any) {
  // 路由守卫
  router.beforeEach((to: any, from: any, next: any) => {
    NProgress.start() //开启进度条
    if (whitePaths.includes(to.path)) {
      document.title = `${to.meta.title} | 个人博客` || '个人博客'
      next()
    } else {
    }
  })

  router.afterEach(() => {
    NProgress.done() //完成进度条
  })
}
