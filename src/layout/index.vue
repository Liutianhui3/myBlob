<template>
  <div
    class="relative w-screen h-screen rounded-xl overflow-clip flex flex-col items-center justify-center gap-4 bg-white dark:bg-black"
  >
    <SnowfallBg
      :color="theme == 'light' ? '#514DEF' : '#FCD34D'"
      class="absolute inset-0"
      :min-radius="0.2"
      :max-radius="5"
      :speed="0.5"
    />

    <Dock class="mb-6 menu-dock" :magnification="14" ref="dockRef">
      <DockIcon class="flex justify-center" style="margin: 0 4px">
        <Icon :icon="homeIcon" class="size-6" />
      </DockIcon>
      <DockIcon class="flex justify-center" style="margin: 0 4px">
        <Icon :icon="menuIcon" class="size-6" />
      </DockIcon>

      <DockSeparator style="margin: 0 4px" />

      <DockIcon style="margin: 0 8px" @click="openGitHub">
        <Tippy
          content="GitHub"
          :options="{
            arrow: false,
            appendTo: dockRef,
            offset: [0, 18]
          }"
        >
          <Icon icon="mdi:github" class="size-6" />
        </Tippy>
      </DockIcon>
      <DockSeparator style="margin: 0 4px" />
      <DockIcon class="flex justify-center" style="margin: 0 8px" @click="changeTheme">
        <Icon icon="mynaui:sun" class="size-6 text-black dark:text-white" v-if="theme == 'light'" />
        <Icon icon="material-symbols:dark-mode" class="size-6" v-else />
      </DockIcon>
    </Dock>
  </div>
</template>
<script setup>
  import SnowfallBg from '@/components/SnowfallBg.vue'
  import Dock from '@/components/Dock/Dock.vue'
  import { Icon } from '@iconify/vue'
  import Tippy from '@/components/Tippy.vue'
  import { useGlobalStore } from '@/store'

  const store = useGlobalStore()
  const theme = computed(() => store.theme)

  const dockRef = ref()
  const homeIcon = {
    body: '<g fill="none"><path fill="url(#SVGkm4eqcHj)" d="M6 9h4v5H6z" /><path fill="url(#SVG4sqiUdhg)" d="M8.687 2.273a1 1 0 0 0-1.374 0l-4.844 4.58A1.5 1.5 0 0 0 2 7.943v4.569a1.5 1.5 0 0 0 1.5 1.5h3v-4a.5.5 0 0 1 .5-.5h2a.5.5 0 0 1 .5.5v4h3a1.5 1.5 0 0 0 1.5-1.5v-4.57a1.5 1.5 0 0 0-.47-1.09z" /><path fill="url(#SVGbhYexcuE)" fill-rule="evenodd" d="m8.004 2.636l5.731 5.41a.75.75 0 1 0 1.03-1.091L8.86 1.382a1.25 1.25 0 0 0-1.724.007L1.23 7.059a.75.75 0 0 0 1.038 1.082z" clip-rule="evenodd" /><defs><linearGradient id="SVGkm4eqcHj" x1="8" x2="4.796" y1="9" y2="14.698" gradientUnits="userSpaceOnUse"><stop stop-color="#fff" /><stop offset="1" stop-color="#fff" /></linearGradient><linearGradient id="SVG4sqiUdhg" x1="3.145" x2="14.93" y1="1.413" y2="10.981" gradientUnits="userSpaceOnUse"><stop stop-color="#A6B3FF" /><stop offset="1" stop-color="#A6B3FF" /></linearGradient><linearGradient id="SVGbhYexcuE" x1="10.262" x2="6.945" y1="-.696" y2="7.895" gradientUnits="userSpaceOnUse"><stop stop-color="#514DEF" /><stop offset="1" stop-color="#514DEF" /></linearGradient></defs></g>'
  }

  const menuIcon = {
    width: 24,
    height: 24,
    body: '<path fill="#514DEF" fill-rule="evenodd" d="M6 3a3 3 0 0 0-3 3v12a3 3 0 0 0 3 3h12a3 3 0 0 0 3-3V6a3 3 0 0 0-3-3zm4 5a1 1 0 0 1 1-1h6a1 1 0 1 1 0 2h-6a1 1 0 0 1-1-1m0 4a1 1 0 0 1 1-1h6a1 1 0 1 1 0 2h-6a1 1 0 0 1-1-1m0 4a1 1 0 0 1 1-1h6a1 1 0 1 1 0 2h-6a1 1 0 0 1-1-1M7 7a1 1 0 0 0 0 2h.001a1 1 0 0 0 0-2zm-1 5a1 1 0 0 1 1-1h.001a1 1 0 1 1 0 2H7a1 1 0 0 1-1-1m1 3a1 1 0 1 0 0 2h.001a1 1 0 1 0 0-2z" clip-rule="evenodd" />'
  }

  const openGitHub = () => {
    window.open('https://github.com/Liutianhui3', '_blank')
  }

  const changeTheme = () => {
    if (store.theme == 'light') {
      store.setTheme('dark')
    } else {
      store.setTheme('light')
    }
  }
</script>
<style scoped>
  .menu-dock {
    position: absolute;
    bottom: 0px;
  }
</style>
