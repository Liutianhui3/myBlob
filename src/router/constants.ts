import BasicLayout from '@/layout/index.vue'
import Home from '@/views/home/index.vue'

export const constantRoutes: any = [
  {
    path: '/',
    redirect: '/home'
  },
  {
    path: '/basicLayout',
    component: BasicLayout,
    meta: { title: '首页' },
    children: [
      {
        path: '/home',
        component: Home
      }
    ]
  }
]
