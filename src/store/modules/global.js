import { defineStore } from 'pinia'

const useGlobalStore = defineStore('global', {
  state: () => ({
    theme: 'light'
  }),
  getters: {},
  actions: {
    // 页面状态
    setTheme(val) {
      this.theme = val
    }
  },
  persist: {
    key: 'Theme', //设置存储的key
    storage: localStorage, //表示存储在localStorage
    paths: ['theme']
  }
})

export default useGlobalStore
