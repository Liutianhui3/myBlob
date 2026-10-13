<template>
  <div
    class="relative max-w-screen min-h-screen overflow-clip flex flex-col items-center justify-center bg-white dark:bg-black"
    :class="{ 'rounded-xl gap-4': !isChat }"
  >
    <SnowfallBg
      v-if="!isChat"
      :color="theme == 'light' ? '#514DEF' : '#FCD34D'"
      class="absolute inset-0"
      :min-radius="0.2"
      :max-radius="5"
      :speed="0.5"
    />

    <router-view></router-view>
  </div>
  <DockLayout />
</template>
<script setup>
  import SnowfallBg from '@/components/SnowfallBg.vue'
  import DockLayout from './components/DockLayout.vue'

  import { useGlobalStore } from '@/store'

  const store = useGlobalStore()
  const route = useRoute()
  const isChat = computed(
    () =>
      ['/chat', '/knowledge', '/articleManage', '/roleManage'].includes(route.path) ||
      route.path.startsWith('/article/')
  )
  const theme = computed(() => store.theme)
</script>
