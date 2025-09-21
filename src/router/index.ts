import { createRouter, createWebHistory } from 'vue-router'
import NProgress from 'nprogress' // progress bar
import 'nprogress/nprogress.css'
import { constantRoutes } from './constants'
import { createRouterGuard } from './permission'

NProgress.configure({ showSpinner: false }) // NProgress Configuration

const baseUrl = import.meta.env.VITE_PUBLIC_PATH

const router = createRouter({
  history: createWebHistory(baseUrl),
  routes: constantRoutes
})

createRouterGuard(router)

export default router
