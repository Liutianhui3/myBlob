<template>
  <div
    ref="dockShellRef"
    class="dock-shell"
    @pointerenter="cancelHide"
    @pointerleave="scheduleHide"
    @focusin="showDock"
    @focusout="scheduleHide"
    @keydown.esc.stop.prevent="hideDock"
  >
    <button
      class="dock-trigger"
      type="button"
      aria-label="显示导航栏"
      aria-controls="navigation-dock"
      :aria-expanded="isDockVisible"
      @pointerenter="revealOnPointer"
      @click="showDock"
    />
    <nav
      id="navigation-dock"
      ref="dockPanelRef"
      class="dock-panel"
      :class="{ 'is-visible': isDockVisible, 'is-dark': theme === 'dark' }"
      aria-label="主导航"
      :aria-hidden="!isDockVisible"
      :inert="isDockVisible ? undefined : ''"
    >
      <Dock class="menu-dock" :magnification="14">
        <DockIcon class="flex justify-center" style="margin: 0 4px">
          <button type="button" class="dock-action" aria-label="首页" @click="jumpRoute('/home')">
            <Icon :icon="homeIcon" class="size-6" />
          </button>
        </DockIcon>
        <!-- <DockIcon class="flex justify-center" style="margin: 0 4px">
          <button
            type="button"
            class="dock-action"
            aria-label="文章"
            @click="jumpRoute('/article')"
          >
            <Icon :icon="menuIcon" class="size-6" />
          </button>
        </DockIcon> -->

        <DockIcon class="flex justify-center" style="margin: 0 4px">
          <button
            type="button"
            class="dock-action"
            aria-label="Claude · AI 工作台"
            title="AI 工作台"
            :aria-current="route.path === '/chat' ? 'page' : undefined"
            @click="jumpRoute('/chat')"
          >
            <img src="@/assets/images/claude.svg" alt="" class="size-6" />
          </button>
        </DockIcon>

        <DockSeparator style="margin: 0 4px" />

        <DockIcon style="margin: 0 8px">
          <Tippy
            class="flex size-full items-center justify-center"
            content="GitHub"
            :options="{
              arrow: false,
              appendTo: () => dockPanelRef,
              offset: [0, 18]
            }"
          >
            <button type="button" class="dock-action" aria-label="GitHub" @click="openGitHub">
              <Icon icon="mdi:github" class="size-6" />
            </button>
          </Tippy>
        </DockIcon>
        <DockSeparator style="margin: 0 4px" />
        <DockIcon class="flex justify-center" style="margin: 0 8px">
          <button type="button" class="dock-action" aria-label="切换主题" @click="changeTheme">
            <Icon
              icon="mynaui:sun"
              class="size-6 text-black dark:text-white"
              v-if="theme == 'light'"
            />
            <Icon icon="material-symbols:dark-mode" class="size-6" v-else />
          </button>
        </DockIcon>

        <DockSeparator style="margin: 0 4px" />

        <DockIcon class="flex justify-center" style="margin: 0 4px">
          <button
            type="button"
            class="dock-action dock-profile"
            aria-label="个人资料"
            title="个人资料"
            :aria-current="route.path === '/profile' ? 'page' : undefined"
            @click="jumpRoute('/profile')"
          >
            <UserAvatar :src="userProfile.avatar" class="dock-avatar" />
          </button>
        </DockIcon>

        <DockIcon class="flex justify-center" style="margin: 0 4px">
          <button
            type="button"
            :disabled="loggingOut"
            aria-label="退出系统"
            :title="currentUser?.username ? `${currentUser.username} · 退出系统` : '退出系统'"
            class="dock-action"
            @click="logout"
          >
            <Icon :icon="logoutIcon" class="size-6" />
          </button>
        </DockIcon>
      </Dock>
    </nav>
  </div>
</template>
<script setup>
  import Dock from '@/components/Dock/Dock.vue'
  import { Icon } from '@iconify/vue'
  import Tippy from '@/components/Tippy.vue'
  import { useGlobalStore } from '@/store'
  import { currentUser, signOut } from '@/lib/auth'
  import { userProfile } from '@/lib/profile'
  import UserAvatar from '@/components/UserAvatar.vue'

  const store = useGlobalStore()
  const theme = computed(() => store.theme)
  const route = useRoute()
  const router = useRouter()

  const dockRef = ref()
  const loggingOut = ref(false)
  const logout = async () => {
    loggingOut.value = true
    try {
      const revocation = signOut()
      await router.replace('/login')
      await revocation
    } finally {
      loggingOut.value = false
    }
  }
  const dockShellRef = ref(null)
  const dockPanelRef = ref(null)
  const isDockVisible = ref(false)
  let hideTimer

  const cancelHide = () => {
    window.clearTimeout(hideTimer)
  }

  const showDock = () => {
    cancelHide()
    isDockVisible.value = true
  }

  const hideDock = () => {
    cancelHide()
    const activeElement = document.activeElement
    if (dockShellRef.value?.contains(activeElement)) {
      activeElement?.blur()
    }
    isDockVisible.value = false
  }

  const scheduleHide = () => {
    cancelHide()
    hideTimer = window.setTimeout(() => {
      // Keep keyboard navigation available until focus leaves the Dock.
      const activeElement = document.activeElement
      if (dockShellRef.value?.contains(activeElement) && activeElement?.matches(':focus-visible')) {
        return
      }
      hideDock()
    }, 280)
  }

  const revealOnPointer = event => {
    if (event.pointerType !== 'touch') showDock()
  }

  const dismissOnOutsidePress = event => {
    if (!dockShellRef.value?.contains(event.target)) hideDock()
  }

  watch(() => route.path, hideDock)

  onMounted(() => {
    document.addEventListener('pointerdown', dismissOnOutsidePress)
    window.addEventListener('blur', hideDock)
  })

  onUnmounted(() => {
    cancelHide()
    document.removeEventListener('pointerdown', dismissOnOutsidePress)
    window.removeEventListener('blur', hideDock)
  })

  const homeIcon = {
    body: '<g fill="none"><path fill="url(#SVGkm4eqcHj)" d="M6 9h4v5H6z" /><path fill="url(#SVG4sqiUdhg)" d="M8.687 2.273a1 1 0 0 0-1.374 0l-4.844 4.58A1.5 1.5 0 0 0 2 7.943v4.569a1.5 1.5 0 0 0 1.5 1.5h3v-4a.5.5 0 0 1 .5-.5h2a.5.5 0 0 1 .5.5v4h3a1.5 1.5 0 0 0 1.5-1.5v-4.57a1.5 1.5 0 0 0-.47-1.09z" /><path fill="url(#SVGbhYexcuE)" fill-rule="evenodd" d="m8.004 2.636l5.731 5.41a.75.75 0 1 0 1.03-1.091L8.86 1.382a1.25 1.25 0 0 0-1.724.007L1.23 7.059a.75.75 0 0 0 1.038 1.082z" clip-rule="evenodd" /><defs><linearGradient id="SVGkm4eqcHj" x1="8" x2="4.796" y1="9" y2="14.698" gradientUnits="userSpaceOnUse"><stop stop-color="#fff" /><stop offset="1" stop-color="#fff" /></linearGradient><linearGradient id="SVG4sqiUdhg" x1="3.145" x2="14.93" y1="1.413" y2="10.981" gradientUnits="userSpaceOnUse"><stop stop-color="#A6B3FF" /><stop offset="1" stop-color="#A6B3FF" /></linearGradient><linearGradient id="SVGbhYexcuE" x1="10.262" x2="6.945" y1="-.696" y2="7.895" gradientUnits="userSpaceOnUse"><stop stop-color="#514DEF" /><stop offset="1" stop-color="#514DEF" /></linearGradient></defs></g>'
  }
  const menuIcon = {
    width: 24,
    height: 24,
    body: '<path fill="#514DEF" fill-rule="evenodd" d="M6 3a3 3 0 0 0-3 3v12a3 3 0 0 0 3 3h12a3 3 0 0 0 3-3V6a3 3 0 0 0-3-3zm4 5a1 1 0 0 1 1-1h6a1 1 0 1 1 0 2h-6a1 1 0 0 1-1-1m0 4a1 1 0 0 1 1-1h6a1 1 0 1 1 0 2h-6a1 1 0 0 1-1-1m0 4a1 1 0 0 1 1-1h6a1 1 0 1 1 0 2h-6a1 1 0 0 1-1-1M7 7a1 1 0 0 0 0 2h.001a1 1 0 0 0 0-2zm-1 5a1 1 0 0 1 1-1h.001a1 1 0 1 1 0 2H7a1 1 0 0 1-1-1m1 3a1 1 0 1 0 0 2h.001a1 1 0 1 0 0-2z" clip-rule="evenodd" />'
  }

  const logoutIcon = {
    body: '<svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 14 14"><path d="M0 0h14v14H0z" fill="none" /><g fill="none" fill-rule="evenodd" clip-rule="evenodd"> <path fill="#A6B3FF" d="M1.5 0A1.5 1.5 0 0 0 0 1.5v11A1.5 1.5 0 0 0 1.5 14h7a1.5 1.5 0 0 0 1.5-1.5v-1.939a2 2 0 0 1-.734-1.311H5.75a2.25 2.25 0 0 1 0-4.5h3.516A2 2 0 0 1 10 3.439V1.5A1.5 1.5 0 0 0 8.5 0z" /> <path fill="#514DEF" d="M10.5 5a.75.75 0 0 1 1.28-.53l2 2a.75.75 0 0 1 0 1.06l-2 2A.75.75 0 0 1 10.5 9V8H5.75a1 1 0 1 1 0-2h4.75z" /></g></svg>'
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

  const jumpRoute = path => {
    if (route.path != path) {
      router.push({
        path: path
      })
    }
  }
</script>
<style scoped>
  .dock-shell {
    position: fixed;
    z-index: 50;
    bottom: 0;
    left: 50%;
    width: max-content;
    transform: translateX(-50%);
    pointer-events: none;
  }

  .dock-trigger {
    position: absolute;
    bottom: 0;
    left: 0;
    width: 100%;
    height: 4px;
    padding: 0;
    border: 0;
    background: transparent;
    pointer-events: auto;
    cursor: pointer;
  }

  .dock-trigger:focus-visible {
    outline: 2px solid #514def;
    outline-offset: -2px;
  }

  .dock-panel {
    padding-bottom: calc(20px + env(safe-area-inset-bottom, 0px));
    visibility: hidden;
    transform: translateY(100%);
    pointer-events: none;
    transition:
      transform 600ms cubic-bezier(0.25, 0.1, 0.25, 1),
      visibility 0s 600ms;
  }

  .dock-panel.is-visible {
    visibility: visible;
    transform: translateY(0);
    pointer-events: auto;
    transition-delay: 0s;
  }

  .dock-panel :deep(.menu-dock) {
    margin: 0 !important;
    border: 1px solid rgba(255, 255, 255, 0.42);
    border-radius: 20px;
    background-color: rgba(255, 255, 255, 0.28);
    background-image: linear-gradient(180deg, rgba(255, 255, 255, 0.1), rgba(255, 255, 255, 0.02));
    -webkit-backdrop-filter: blur(10px) saturate(140%);
    backdrop-filter: blur(10px) saturate(140%);
    box-shadow:
      0 6px 24px rgba(0, 0, 0, 0.08),
      inset 0 1px 0 rgba(255, 255, 255, 0.38);
  }

  .dock-panel.is-dark :deep(.menu-dock) {
    border-color: rgba(255, 255, 255, 0.2);
    background-color: rgba(255, 255, 255, 0.14);
    background-image: linear-gradient(
      180deg,
      rgba(255, 255, 255, 0.035),
      rgba(255, 255, 255, 0.01)
    );
    box-shadow:
      0 6px 24px rgba(0, 0, 0, 0.18),
      inset 0 1px 0 rgba(255, 255, 255, 0.09);
  }

  .dock-action {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 100%;
    padding: 0;
    border: 0;
    border-radius: 50%;
    background: transparent;
    cursor: pointer;
  }

  .dock-action:focus-visible {
    outline: 2px solid #514def;
    outline-offset: 2px;
  }

  .dock-avatar {
    width: 30px;
    height: 30px;
  }
  .dock-profile[aria-current='page'] .dock-avatar {
    outline: 2px solid #514def;
    outline-offset: 3px;
  }

  @media (max-width: 480px) {
    .dock-panel :deep(.menu-dock) {
      max-width: calc(100vw - 16px);
      padding: 6px;
    }
    .dock-panel :deep(.menu-dock > div) {
      flex-shrink: 1;
      min-width: 0;
      margin-inline: 2px !important;
    }
  }

  @media (hover: none) {
    .dock-trigger {
      height: calc(16px + env(safe-area-inset-bottom, 0px));
    }

    .dock-trigger::after {
      content: '';
      position: absolute;
      top: 6px;
      left: 50%;
      width: 36px;
      height: 3px;
      border-radius: 999px;
      background: #85858e;
      transform: translateX(-50%);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .dock-panel {
      transition: none;
    }
  }
</style>
