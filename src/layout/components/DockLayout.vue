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
        <DockIcon class="flex justify-center" style="margin: 0 4px">
          <button
            type="button"
            class="dock-action"
            aria-label="文章"
            @click="jumpRoute('/article')"
          >
            <Icon :icon="menuIcon" class="size-6" />
          </button>
        </DockIcon>

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

        <DockIcon
          v-if="currentUser?.isAdmin === true"
          class="flex justify-center"
          style="margin: 0 4px"
        >
          <button
            type="button"
            class="dock-action"
            aria-label="文章管理"
            title="文章管理"
            :aria-current="route.path === '/articleManage' ? 'page' : undefined"
            @click="jumpRoute('/articleManage')"
          >
            <Icon :icon="articleManageIcon" class="size-6" />
          </button>
        </DockIcon>

        <DockIcon
          v-if="currentUser?.isAdmin === true"
          class="flex justify-center"
          style="margin: 0 4px"
        >
          <button
            type="button"
            class="dock-action"
            aria-label="角色管理"
            title="角色管理"
            :aria-current="route.path === '/roleManage' ? 'page' : undefined"
            @click="jumpRoute('/roleManage')"
          >
            <Icon :icon="roleManageIcon" class="size-6" />
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
          <button
            type="button"
            class="dock-action"
            :aria-label="theme === 'dark' ? '切换浅色主题' : '切换深色主题'"
            @click="changeTheme"
          >
            <Icon :icon="theme === 'dark' ? sunIcon : moonIcon" class="size-6" />
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
            ref="logoutButtonRef"
            @click="requestLogout"
          >
            <Icon :icon="logoutIcon" class="size-6" />
          </button>
        </DockIcon>
      </Dock>
    </nav>
  </div>
  <Teleport to="body">
    <dialog
      ref="logoutDialogRef"
      class="logout-dialog"
      :class="{ 'is-dark': theme === 'dark' }"
      aria-labelledby="logout-dialog-title"
      aria-describedby="logout-dialog-description"
      @cancel="cancelLogout"
      @close="restoreLogoutFocus"
      @click="dismissLogoutBackdrop"
    >
      <div class="logout-dialog-icon"><Icon :icon="logoutIcon" /></div>
      <h2 id="logout-dialog-title">确认退出系统？</h2>
      <p id="logout-dialog-description">退出后需要重新登录才能继续使用你的账户。</p>
      <div class="logout-dialog-actions">
        <button
          type="button"
          class="logout-cancel"
          autofocus
          :disabled="loggingOut"
          @click="cancelLogout"
        >
          取消
        </button>
        <button type="button" class="logout-confirm" :disabled="loggingOut" @click="logout">
          {{ loggingOut ? '正在退出…' : '确认退出' }}
        </button>
      </div>
    </dialog>
  </Teleport>
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
  const logoutDialogRef = ref(null)
  const logoutButtonRef = ref(null)
  const requestLogout = () => {
    if (loggingOut.value || logoutDialogRef.value?.open) return
    cancelHide()
    logoutDialogRef.value?.showModal()
  }
  const cancelLogout = event => {
    event?.preventDefault()
    if (!loggingOut.value) logoutDialogRef.value?.close()
  }
  const restoreLogoutFocus = () => {
    if (loggingOut.value) return
    showDock()
    nextTick(() => logoutButtonRef.value?.focus())
  }
  const dismissLogoutBackdrop = event => {
    if (event.target !== logoutDialogRef.value) return
    const bounds = logoutDialogRef.value.getBoundingClientRect()
    if (
      event.clientX < bounds.left ||
      event.clientX > bounds.right ||
      event.clientY < bounds.top ||
      event.clientY > bounds.bottom
    )
      cancelLogout(event)
  }
  const logout = async () => {
    if (loggingOut.value) return
    loggingOut.value = true
    try {
      logoutDialogRef.value?.close()
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
    if (logoutDialogRef.value?.open) return
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

  const articleManageIcon = {
    width: 24,
    height: 24,
    body: '<rect x="3" y="2.5" width="14" height="19" rx="3" fill="#A6B3FF"/><path d="M6.5 7h7M6.5 10.5h4" stroke="white" stroke-width="1.8" stroke-linecap="round"/><path d="m11.5 16 7.6-7.6a1.8 1.8 0 0 1 2.5 2.5L14 18.5l-3.5 1z" fill="#514DEF" stroke="white" stroke-width="1.2" stroke-linejoin="round"/><path d="m17.8 9.7 2.5 2.5" stroke="white" stroke-width="1.2"/>'
  }
  const roleManageIcon = {
    width: 24,
    height: 24,
    body: '<circle cx="9" cy="7" r="4" fill="#514DEF"/><path d="M2 19a7 7 0 0 1 14 0v1H4a2 2 0 0 1-2-2z" fill="#A6B3FF"/><circle cx="17.5" cy="8" r="3" fill="#A6B3FF"/><path d="m17.5 12 5 2v3.1c0 2.5-2.2 4.2-5 5.4-2.8-1.2-5-2.9-5-5.4V14z" fill="#514DEF" stroke="white" stroke-width="1.2" stroke-linejoin="round"/><path d="m15.4 17.2 1.5 1.5 2.9-3" fill="none" stroke="white" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>'
  }

  const moonIcon = {
    width: 24,
    height: 24,
    body: '<path d="M20.9 14.2A9 9 0 0 1 9.8 3.1a9.2 9.2 0 1 0 11.1 11.1" fill="#A6B3FF"/><path d="M20.9 14.2a9 9 0 0 1-11.1-11.1" fill="none" stroke="#514DEF" stroke-width="1.8" stroke-linecap="round"/><path d="m17 2 .8 2.2L20 5l-2.2.8L17 8l-.8-2.2L14 5l2.2-.8z" fill="#514DEF"/>'
  }
  const sunIcon = {
    width: 24,
    height: 24,
    body: '<circle cx="12" cy="12" r="5" fill="#A6B3FF"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" stroke="#514DEF" stroke-width="2" stroke-linecap="round"/><path d="M12 7a5 5 0 0 1 5 5" fill="none" stroke="#514DEF" stroke-width="1.8" stroke-linecap="round"/>'
  }
  const logoutIcon = {
    width: 24,
    height: 24,
    body: '<rect x="3" y="2.5" width="14" height="19" rx="3" fill="#A6B3FF"/><path d="M14 12h7m-3-3 3 3-3 3" fill="none" stroke="white" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/><path d="M10 12h11m-3-3 3 3-3 3" fill="none" stroke="#514DEF" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>'
  }

  const openGitHub = () => {
    window.open('https://github.com/Liutianhui3', '_blank')
  }

  const changeTheme = () => {
    store.theme = store.theme === 'dark' ? 'light' : 'dark'
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
  .logout-dialog {
    position: fixed;
    inset: 0;
    margin: auto;
    width: min(400px, calc(100vw - 40px));
    padding: 32px;
    border: 1px solid #eeedf7;
    border-radius: 24px;
    background: #fff;
    color: #272638;
    box-shadow: 0 24px 80px #211a5326;
    text-align: center;
  }
  .logout-dialog::backdrop {
    background: #17132f55;
    backdrop-filter: blur(6px);
  }
  .logout-dialog[open] {
    animation: logout-dialog-enter 260ms cubic-bezier(0.22, 1, 0.36, 1) both;
  }
  .logout-dialog[open]::backdrop {
    animation: logout-backdrop-enter 220ms ease-out both;
  }
  @keyframes logout-dialog-enter {
    from {
      opacity: 0;
      transform: translateY(14px) scale(0.96);
    }
    to {
      opacity: 1;
      transform: translateY(0) scale(1);
    }
  }
  @keyframes logout-backdrop-enter {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .logout-dialog[open],
    .logout-dialog[open]::backdrop {
      animation: none;
    }
  }
  .logout-dialog-icon {
    display: grid;
    place-items: center;
    width: 64px;
    height: 64px;
    margin: 0 auto 20px;
    border-radius: 20px;
    background: #f1f0ff;
  }
  .logout-dialog-icon svg {
    width: 32px;
    height: 32px;
  }
  .logout-dialog h2 {
    font-size: 21px;
    font-weight: 650;
    margin: 0 0 12px;
  }
  .logout-dialog p {
    font-size: 14px;
    line-height: 1.7;
    color: #78758a;
    margin: 0;
  }
  .logout-dialog-actions {
    display: flex;
    gap: 12px;
    margin-top: 28px;
  }
  .logout-dialog-actions button {
    flex: 1;
    padding: 12px;
    border-radius: 12px;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
  }
  .logout-cancel {
    background: #f6f5fa;
    border: 1px solid #eae8f2;
    color: #5d596f;
  }
  .logout-confirm {
    background: #514def;
    border: 1px solid #514def;
    color: white;
  }
  .logout-cancel:hover {
    background: #eeedf7;
  }
  .logout-confirm:hover {
    background: #4540d9;
  }
  .logout-dialog-actions button:focus-visible {
    outline: 2px solid #8b85ff;
    outline-offset: 3px;
  }
  .logout-dialog-actions button:disabled {
    opacity: 0.6;
    cursor: wait;
  }
  .logout-dialog.is-dark {
    background: #22212c;
    border-color: #393644;
    color: #f1efff;
  }
  .logout-dialog.is-dark .logout-dialog-icon {
    background: #35304e;
  }
  .logout-dialog.is-dark p {
    color: #b5afc6;
  }
  .logout-dialog.is-dark .logout-cancel {
    background: #302d3c;
    border-color: #454052;
    color: #ddd8eb;
  }
</style>
