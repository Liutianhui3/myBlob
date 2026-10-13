import BasicLayout from '@/layout/index.vue'
import Home from '@/views/home/index.vue'
import Article from '@/views/article/index.vue'

export const constantRoutes: any = [
  { path: '/login', component: () => import('@/views/auth/index.vue'), meta: { title: '登录' } },
  { path: '/register', component: () => import('@/views/auth/index.vue'), meta: { title: '注册' } },
  {
    path: '/',
    redirect: '/login'
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
        meta: { title: '文章', public: true }
      },
      {
        path: '/article/:id',
        component: () => import('@/views/article/detail.vue'),
        meta: { title: '阅读文章', public: true }
      },
      {
        path: '/articleManage',
        component: () => import('@/views/articleManage/index.vue'),
        meta: { title: '文章管理', admin: true }
      },
      {
        path: '/roleManage',
        component: () => import('@/views/roleManage/index.vue'),
        meta: { title: '角色管理', admin: true }
      },
      {
        path: '/chat',
        component: () => import('@/views/chat/index.vue'),
        meta: { title: 'AI 工作台' }
      },
      {
        path: '/knowledge',
        component: () => import('@/views/knowledge/index.vue'),
        meta: { title: '知识库' }
      },
      {
        path: '/profile',
        component: () => import('@/views/profile/index.vue'),
        meta: { title: '个人资料' }
      }
    ]
  }
]
