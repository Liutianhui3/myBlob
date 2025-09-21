import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import '@/assets/styles/tailwind.css'
import '@/assets/styles/main.less'
import VueVirtualScroller from 'vue-virtual-scroller'
import store from './store'

const app = createApp(App)

app.use(store)
app.use(router)
app.use(VueVirtualScroller).mount('#app')
