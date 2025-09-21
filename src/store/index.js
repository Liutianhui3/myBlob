import { createPinia } from 'pinia'
import piniaPluginPersistedstate from 'pinia-plugin-persistedstate'
import useGlobalStore from './modules/global'

const pinia = createPinia()
pinia.use(piniaPluginPersistedstate)

export {
  useGlobalStore //系统配置
}
export default pinia
