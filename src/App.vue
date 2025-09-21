<template>
  <router-view />
</template>

<script setup>
  import { watchEffect } from 'vue'
  import { useGlobalStore } from '@/store'

  const globalStore = useGlobalStore()

  watchEffect(() => {
    // 根据 isDarkMode 的值来添加或移除 'dark' 类
    if (globalStore.theme == 'dark') {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  })
</script>
