import BasicLayout from '@/layout/index.vue'
import Home from '@/views/home/index.vue'
import Article from '@/views/article/index.vue'

export const constantRoutes: any = [
  {
    path: '/',
    redirect: '/home'
  },
  {
    path: '/basicLayout',
    component: BasicLayout,

    children: [
      {
        path: '/home',
        component: Home,
        meta: { title: '首页' }
      },
      {
        path: '/article',
        component: Article,
        meta: { title: '文章' }
      }
    ]
  }
]
