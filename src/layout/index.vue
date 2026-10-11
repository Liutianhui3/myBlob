<template>
  <div
    class="relative max-w-screen min-h-screen rounded-xl overflow-clip flex flex-col items-center justify-center gap-4 bg-white dark:bg-black"
  >
    <SnowfallBg
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
  const theme = computed(() => store.theme)
</script>
