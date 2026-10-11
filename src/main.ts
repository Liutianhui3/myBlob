import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import '@/assets/styles/tailwind.css'
import '@/assets/styles/main.less'
import VueVirtualScroller from 'vue-virtual-scroller'
import store from './store'
import { TOKEN_KEY, clearSession } from '@/lib/auth'

const app = createApp(App)

app.use(store)
app.use(router)
app.use(VueVirtualScroller).mount('#app')

window.addEventListener('storage', event => {
  if ((event.key === TOKEN_KEY && !event.newValue) || event.key === null) {
    clearSession()
    router.replace('/login')
  }
})
