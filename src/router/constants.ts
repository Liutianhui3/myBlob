import BasicLayout from '@/layout/index.vue'
import Home from '@/views/home/index.vue'

export const constantRoutes: any = [
  {
    path: '/',
    redirect: '/home'
  },
  {
    path: '/home',
    component: BasicLayout,
    meta: { title: 'Home' },
    children:[
      {  
         path: '/demo',
          component: Home,
  }
    ]
  }
]
