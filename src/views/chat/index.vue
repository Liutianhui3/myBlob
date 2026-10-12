<script setup lang="ts">
  import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
  import { useRoute, useRouter } from 'vue-router'
  import { Icon, addCollection } from '@iconify/vue'
  import { gsap } from 'gsap'
  import { ScrollToPlugin } from 'gsap/ScrollToPlugin'
  import icons from '@/assets/chat-icons.json'
  import ChatMarkdown from '@/components/ChatMarkdown.vue'
  import ChatModelSettings from '@/components/ChatModelSettings.vue'
  import UserAvatar from '@/components/UserAvatar.vue'
  import { userInfo, userDisplayName as userName } from '@/lib/auth'
  import { createMessageReader } from '@/lib/speech'
  import { useGlobalStore } from '@/store'
  import {
    ChatError,
    createConversation,
    getMessages,
    listConversations,
    streamMessage
  } from '@/api/chat'
  import type { ChatMessage, Conversation, GenerationOptions } from '@/api/chat'

  addCollection(icons)
  gsap.registerPlugin(ScrollToPlugin)
  const route = useRoute()
  const router = useRouter()
  const store = useGlobalStore()
  const conversations = ref<Conversation[]>([])
  const messages = ref<ChatMessage[]>([])
  const draft = ref('')
  const search = ref('')
  const showSearch = ref(false)
  const sidebarOpen = ref(window.innerWidth > 800)
  const sidebar = ref<HTMLElement>()
  const railToggle = ref<HTMLButtonElement>()
  const sidebarToggle = ref<HTMLButtonElement>()
  const searchInput = ref<HTMLInputElement>()
  let sidebarMotion: gsap.Context | undefined
  let sidebarMedia: gsap.MatchMedia | undefined
  const listLoading = ref(false)
  const historyLoading = ref(false)
  const olderLoading = ref(false)
  const hasOlder = ref(false)
  const busy = ref(false)
  const error = ref('')
  const listError = ref('')
  const notice = ref('')
  const copied = ref('')
  const readingMessageId = ref('')
  const messageReader = createMessageReader({
    onChange(id) {
      readingMessageId.value = id
    },
    onError: showNotice
  })
  const scroller = ref<HTMLElement>()
  let scrollMotion: gsap.Context | undefined
  let scrollTween: gsap.core.Tween | undefined
  const textarea = ref<HTMLTextAreaElement>()
  const atBottom = ref(true)
  const generationSettings = ref<GenerationOptions | null>(null)
  const modelError = ref(false)
  function updateGenerationSettings(value: GenerationOptions | null) {
    generationSettings.value = value
    if (value && modelError.value) {
      error.value = ''
      modelError.value = false
    }
  }
  async function handleModelError(cause: unknown) {
    modelError.value = true
    error.value = await handleError(cause)
  }
  const activeId = computed(() => (typeof route.query.c === 'string' ? route.query.c : ''))
  const activeConversation = computed(() => conversations.value.find(c => c.id === activeId.value))
  const remaining = computed(() => 16000 - draft.value.length)
  const canSend = computed(
    () =>
      !!draft.value.trim() &&
      !!generationSettings.value &&
      remaining.value >= 0 &&
      !busy.value &&
      !historyLoading.value &&
      !olderLoading.value
  )
  let generation: AbortController | undefined
  let history: AbortController | undefined
  let disposed = false
  let creatingRoute = false
  let toastTimer: ReturnType<typeof setTimeout> | undefined
  async function openSearch() {
    sidebarOpen.value = true
    showSearch.value = true
    await nextTick()
    searchInput.value?.focus()
  }
  function sidebarShortcut(event: KeyboardEvent) {
    if (
      (event.ctrlKey || event.metaKey) &&
      event.shiftKey &&
      event.code === 'KeyS' &&
      !event.repeat
    ) {
      event.preventDefault()
      sidebarOpen.value = !sidebarOpen.value
    }
  }
  function sidebarWidth() {
    return sidebarOpen.value
      ? parseFloat(getComputedStyle(sidebar.value!).getPropertyValue('--sidebar-expanded-width'))
      : 52
  }
  watch(sidebarOpen, async open => {
    const focusedInside = sidebar.value?.contains(document.activeElement)
    sidebarMotion?.add(() => {
      gsap.to(sidebar.value!, {
        width: sidebarWidth(),
        duration: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 0.32,
        ease: 'power3.inOut',
        overwrite: true
      })
    })
    if (focusedInside) {
      await nextTick()
      const target = open
        ? showSearch.value
          ? searchInput.value
          : sidebarToggle.value
        : railToggle.value
      target?.focus({ preventScroll: true })
    }
  })
  const prompts = [
    {
      icon: 'document-validation',
      title: '写作与总结',
      description: '把复杂信息变成清晰表达',
      prompt: '请帮我整理一份项目周报，包含本周进展、风险和下周计划。请先询问你需要的信息。'
    },
    {
      icon: 'code',
      title: '代码与开发',
      description: '理解代码，找到更好的解法',
      prompt: '请作为资深工程师，帮我审查代码的可读性、性能和潜在问题。请先询问我的技术栈和代码。'
    },
    {
      icon: 'bulb',
      title: '思路与方案',
      description: '从一个想法开始深入探索',
      prompt: '我想梳理一个新项目的实施方案，请帮我从目标、需求、资源和风险四个方面逐步分析。'
    }
  ]
  const groups = computed(() => {
    const result: { label: string; items: Conversation[] }[] = []
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    for (const conversation of conversations.value.filter(c =>
      c.title.toLowerCase().includes(search.value.toLowerCase())
    )) {
      const date = new Date(conversation.updatedAt).getTime()
      const label =
        date >= today.getTime()
          ? '今天'
          : date >= today.getTime() - 7 * 86400000
            ? '最近 7 天'
            : '更早'
      let group = result.find(g => g.label === label)
      if (!group) {
        group = { label, items: [] }
        result.push(group)
      }
      group.items.push(conversation)
    }
    return result
  })
  function showNotice(text: string) {
    notice.value = text
    clearTimeout(toastTimer)
    toastTimer = setTimeout(() => {
      notice.value = ''
    }, 3200)
  }
  async function handleError(cause: unknown) {
    if (cause instanceof ChatError && cause.status === 401) {
      await router.replace({ path: '/login', query: { redirect: route.fullPath } })
      return ''
    }
    return cause instanceof TypeError
      ? '暂时无法连接服务，请检查网络后重试。'
      : cause instanceof Error
        ? cause.message
        : '操作失败，请重试。'
  }
  async function refreshList() {
    listLoading.value = true
    listError.value = ''
    try {
      const result = await listConversations()
      if (!disposed) conversations.value = result
    } catch (cause) {
      if (!disposed) listError.value = await handleError(cause)
    } finally {
      listLoading.value = false
    }
  }
  function stopScrollAnimation() {
    scrollTween?.kill()
    scrollTween = undefined
    trackScroll()
  }
  function interruptScrollKey(event: KeyboardEvent) {
    if (['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', ' '].includes(event.key))
      stopScrollAnimation()
  }
  async function scrollBottom(force = false, smooth = false) {
    await nextTick()
    const element = scroller.value
    if (disposed || !element || (!force && !atBottom.value)) return
    // Streaming updates must not interrupt a user-initiated scroll animation.
    if (!force && scrollTween?.isActive()) return
    stopScrollAnimation()
    if (!smooth || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      element.scrollTop = element.scrollHeight
      trackScroll()
      return
    }
    const distance = element.scrollHeight - element.clientHeight - element.scrollTop
    scrollMotion?.add(() => {
      scrollTween = gsap.to(element, {
        scrollTo: { y: 'max', autoKill: true, onAutoKill: stopScrollAnimation },
        duration: Math.min(0.8, Math.max(0.4, distance / 8000)),
        ease: 'power2.inOut',
        overwrite: 'auto',
        onComplete() {
          scrollTween = undefined
          // Include any new output received during the transition.
          element.scrollTop = element.scrollHeight
          trackScroll()
        }
      })
    })
  }
  function trackScroll() {
    const el = scroller.value
    if (el) atBottom.value = el.scrollHeight - el.scrollTop - el.clientHeight < 100
  }
  async function loadConversation(id = activeId.value) {
    messageReader.stop()
    stopScrollAnimation()
    history?.abort()
    const controller = new AbortController()
    history = controller
    messages.value = []
    error.value = ''
    hasOlder.value = false
    if (!id) {
      historyLoading.value = false
      return
    }
    historyLoading.value = true
    try {
      const result = await getMessages(id, undefined, controller.signal)
      if (controller.signal.aborted || disposed) return
      messages.value = result
      hasOlder.value = result.length === 50
      atBottom.value = true
      historyLoading.value = false
      await scrollBottom(true)
    } catch (cause) {
      if (!controller.signal.aborted && !disposed) error.value = await handleError(cause)
    } finally {
      if (history === controller) historyLoading.value = false
    }
  }
  async function loadOlder() {
    if (!messages.value.length || olderLoading.value || busy.value) return
    const id = activeId.value
    const controller = history
    olderLoading.value = true
    const previousHeight = scroller.value?.scrollHeight || 0
    try {
      const result = await getMessages(id, messages.value[0].sequence, controller?.signal)
      if (id !== activeId.value || controller?.signal.aborted || disposed) return
      messages.value = [...result, ...messages.value]
      hasOlder.value = result.length === 50
      await nextTick()
      if (scroller.value) scroller.value.scrollTop += scroller.value.scrollHeight - previousHeight
    } catch (cause) {
      if (id === activeId.value && !controller?.signal.aborted)
        error.value = await handleError(cause)
    } finally {
      olderLoading.value = false
    }
  }
  async function selectConversation(id: string) {
    if (busy.value || olderLoading.value) return
    if (window.innerWidth <= 800) sidebarOpen.value = false
    draft.value = ''
    error.value = ''
    notice.value = ''
    await router.replace({ path: '/chat', query: id ? { c: id } : {} })
    await nextTick()
    textarea.value?.focus()
  }
  function resizeInput() {
    if (!textarea.value) return
    textarea.value.style.height = 'auto'
    textarea.value.style.height = `${Math.min(textarea.value.scrollHeight, 180)}px`
  }
  function onKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter' && !event.shiftKey && !event.isComposing && event.keyCode !== 229) {
      event.preventDefault()
      void send()
    }
  }
  function usePrompt(prompt: string) {
    draft.value = prompt
    void nextTick(() => {
      resizeInput()
      textarea.value?.focus()
    })
  }
  async function send() {
    if (!canSend.value) return
    const content = draft.value.trim()
    const selection = { ...generationSettings.value! }
    const controller = new AbortController()
    generation = controller
    busy.value = true
    error.value = ''
    notice.value = ''
    let id = activeId.value
    let started = false
    let userMessage: ChatMessage | undefined
    let reply: ChatMessage | undefined
    try {
      if (!id) {
        const conversation = await createConversation(content.slice(0, 100), controller.signal)
        id = conversation.id
        conversations.value.unshift(conversation)
        creatingRoute = true
        try {
          await router.replace({ path: '/chat', query: { c: id } })
          await nextTick()
        } finally {
          creatingRoute = false
        }
        // The route watcher is suppressed while creating the first turn.
      }
      controller.signal.throwIfAborted()
      const now = new Date().toISOString()
      const turnId = crypto.randomUUID()
      messages.value.push({
        id: `local-${turnId}`,
        turnId,
        sequence: '',
        role: 'user',
        content,
        status: 'completed',
        createdAt: now
      })
      messages.value.push({
        id: `reply-${turnId}`,
        turnId,
        sequence: '',
        role: 'assistant',
        model: selection.model,
        reasoningEffort: selection.reasoningEffort,
        content: '',
        status: 'generating',
        createdAt: now
      })
      userMessage = messages.value[messages.value.length - 2]
      reply = messages.value[messages.value.length - 1]
      draft.value = ''
      await nextTick()
      resizeInput()
      atBottom.value = true
      await scrollBottom(true)
      await streamMessage(
        id,
        content,
        {
          signal: controller.signal,
          onStart(payload) {
            started = true
            userMessage!.id = payload.userMessageId
            reply!.id = payload.messageId
            if (payload.model) reply!.model = payload.model
            if (payload.reasoningEffort) reply!.reasoningEffort = payload.reasoningEffort
          },
          onDelta(text) {
            reply!.content += text
            void scrollBottom()
          },
          onDone(payload) {
            reply!.status = 'completed'
            if (payload.finishReason === 'length')
              showNotice('回复达到长度上限，可发送「继续」接着生成。')
          }
        },
        selection
      )
    } catch (cause) {
      if (reply) reply.status = controller.signal.aborted ? 'cancelled' : 'failed'
      if (!disposed && (!id || id === activeId.value)) {
        if (controller.signal.aborted) showNotice('已停止生成')
        else error.value = await handleError(cause)
        if (!started && !controller.signal.aborted) draft.value = content
        // Upstream failure can persist a user turn before start; reconcile with history.
        if (id) {
          try {
            const saved = await getMessages(id)
            if (!disposed && id === activeId.value && saved.length) {
              const savedReply = saved.find(m => m.id === reply?.id)
              if (savedReply?.status === 'generating' && reply) {
                if (!savedReply.content) savedReply.content = reply.content
                savedReply.status = reply.status
              }
              messages.value = saved
              hasOlder.value = saved.length === 50
            } else if (!disposed && id === activeId.value && !started && userMessage) {
              messages.value = messages.value.filter(m => m !== userMessage && m !== reply)
              if (!controller.signal.aborted) draft.value = content
            }
          } catch {
            /* Preserve visible partial reply and explain the request failure. */
          }
        } else draft.value = content
      }
    } finally {
      if (generation === controller) {
        generation = undefined
        busy.value = false
      }
      if (!disposed) {
        void refreshList()
        await nextTick()
        resizeInput()
        textarea.value?.focus()
        void scrollBottom()
      }
    }
  }
  async function copyMessage(message: ChatMessage) {
    try {
      await navigator.clipboard.writeText(message.content)
      copied.value = message.id
      showNotice('回复已复制')
    } catch {
      showNotice('复制失败，请手动选择文本复制。')
    }
  }
  function exportConversation() {
    if (!messages.value.length || busy.value) return
    const title = activeConversation.value?.title || 'AI 会话'
    const content = `# ${title}\n\n${messages.value.map(m => `## ${m.role === 'user' ? '我' : 'AI 助手'}\n\n${m.content}\n${m.status !== 'completed' ? `\n> 状态：${m.status}\n` : ''}`).join('\n')}`
    const url = URL.createObjectURL(new Blob([content], { type: 'text/markdown;charset=utf-8' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `${title.replace(/[\\/:*?"<>|]/g, '-').slice(0, 80)}.md`
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
    showNotice('会话已导出为 Markdown')
  }
  watch(activeId, () => {
    if (creatingRoute) return
    generation?.abort()
    void loadConversation()
  })
  watch(draft, () => {
    void nextTick(resizeInput)
  })
  onMounted(() => {
    scrollMotion = gsap.context(() => {}, scroller.value)
    sidebarMotion = gsap.context(() => {}, sidebar.value)
    sidebarMedia = gsap.matchMedia()
    sidebarMedia.add(
      {
        wide: '(min-width: 1500px)',
        regular: '(min-width: 801px) and (max-width: 1499px)',
        mobile: '(max-width: 800px)',
        reduced: '(prefers-reduced-motion: reduce)'
      },
      () => {
        gsap.killTweensOf(sidebar.value!)
        gsap.set(sidebar.value!, { width: sidebarWidth() })
      }
    )
    document.addEventListener('keydown', sidebarShortcut)
    void refreshList()
    void loadConversation()
    textarea.value?.focus()
  })
  onUnmounted(() => {
    messageReader.stop()
    stopScrollAnimation()
    scrollMotion?.revert()
    document.removeEventListener('keydown', sidebarShortcut)
    sidebarMedia?.revert()
    sidebarMotion?.revert()
    disposed = true
    generation?.abort()
    history?.abort()
    clearTimeout(toastTimer)
  })
</script>

<template>
  <main
    class="chat-app"
    :class="{ 'sidebar-open': sidebarOpen }"
    @keydown.esc="sidebarOpen = false"
  >
    <button
      v-if="sidebarOpen"
      class="sidebar-backdrop"
      aria-label="关闭会话侧栏"
      @click="sidebarOpen = false"
    />
    <aside ref="sidebar" class="chat-sidebar" aria-label="会话导航">
      <nav
        class="sidebar-rail"
        :inert="sidebarOpen"
        :aria-hidden="sidebarOpen"
        aria-label="快捷导航"
      >
        <button
          ref="railToggle"
          type="button"
          class="icon-button rail-toggle"
          aria-label="展开侧栏"
          aria-controls="sidebar-content"
          :aria-expanded="sidebarOpen"
          title="展开侧栏 (Ctrl+Shift+S)"
          @click="sidebarOpen = true"
        >
          <img class="rail-logo" src="@/assets/images/claude.svg" alt="" />
          <Icon class="rail-expand-icon" icon="hugeicons:sidebar-left" />
        </button>
        <button
          type="button"
          class="icon-button"
          aria-label="新对话"
          title="新对话"
          :disabled="busy || olderLoading"
          @click="selectConversation('')"
        >
          <Icon icon="hugeicons:edit-02" />
        </button>
        <button
          type="button"
          class="icon-button"
          aria-label="搜索会话"
          title="搜索会话"
          @click="openSearch"
        >
          <Icon icon="hugeicons:search-01" />
        </button>
        <button
          type="button"
          class="rail-account"
          :aria-label="`${userName} · 展开侧栏`"
          :title="userName"
          @click="sidebarOpen = true"
        >
          <UserAvatar class="account-avatar" :src="userInfo?.avatar" />
        </button>
      </nav>
      <div
        id="sidebar-content"
        class="sidebar-content"
        :inert="!sidebarOpen"
        :aria-hidden="!sidebarOpen"
      >
        <div class="sidebar-brand">
          <RouterLink to="/home" class="brand-link">
            <img src="@/assets/images/claude.svg" alt="" />
            <strong>AI 工作台</strong>
          </RouterLink>
          <button
            class="icon-button"
            aria-label="搜索会话"
            :aria-expanded="showSearch"
            @click="showSearch ? (showSearch = false) : openSearch()"
          >
            <Icon icon="hugeicons:search-01" />
          </button>
          <button
            ref="sidebarToggle"
            class="icon-button"
            aria-label="收起侧栏"
            title="收起侧栏 (Ctrl+Shift+S)"
            aria-controls="sidebar-content"
            :aria-expanded="sidebarOpen"
            @click="sidebarOpen = false"
          >
            <Icon icon="hugeicons:sidebar-left" />
          </button>
        </div>
        <button class="new-chat" :disabled="busy" @click="selectConversation('')">
          <Icon icon="hugeicons:edit-02" />
          <span>新对话</span>
          <span class="new-chat-plus">开始</span>
        </button>
        <label v-if="showSearch" class="search-field">
          <Icon icon="hugeicons:search-01" />
          <input
            ref="searchInput"
            v-model="search"
            aria-label="搜索会话标题"
            placeholder="搜索会话…"
          />
          <button v-if="search" class="icon-button" aria-label="清空搜索" @click="search = ''">
            <Icon icon="hugeicons:cancel-01" />
          </button>
        </label>
        <div class="history-list">
          <div v-if="listLoading && !conversations.length" class="sidebar-empty" role="status">
            正在加载会话…
          </div>
          <div v-else-if="listError" class="sidebar-empty" role="alert">
            <p>{{ listError }}</p>
            <button class="text-button" @click="refreshList">重新加载</button>
          </div>
          <template v-else-if="groups.length">
            <section v-for="group in groups" :key="group.label" class="history-group">
              <h2>{{ group.label }}</h2>
              <button
                v-for="conversation in group.items"
                :key="conversation.id"
                class="history-item"
                :class="{ selected: activeId === conversation.id }"
                :title="conversation.title"
                :aria-current="activeId === conversation.id ? 'page' : undefined"
                :disabled="busy || olderLoading"
                @click="selectConversation(conversation.id)"
              >
                <span>{{ conversation.title }}</span>
              </button>
            </section>
            <p class="history-limit">显示最近 {{ conversations.length }} 个会话</p>
          </template>
          <div v-else class="sidebar-empty">
            <Icon icon="hugeicons:edit-02" />
            <p>{{ search ? '没有找到相关会话' : '你的想法，从这里开始' }}</p>
            <span>{{ search ? '试试其他关键词' : '开始对话后，记录会保存在这里' }}</span>
          </div>
        </div>
        <div class="sidebar-footer">
          <div class="account-row">
            <UserAvatar class="account-avatar" :src="userInfo?.avatar" />
            <div>
              <strong>{{ userName }}</strong>
              <span>个人工作空间</span>
            </div>
            <button
              class="icon-button"
              :aria-label="store.theme === 'dark' ? '切换浅色主题' : '切换深色主题'"
              @click="store.theme = store.theme === 'dark' ? 'light' : 'dark'"
            >
              <Icon :icon="store.theme === 'dark' ? 'hugeicons:sun-03' : 'hugeicons:moon-02'" />
            </button>
          </div>
          <!-- <RouterLink to="/home" class="back-home">
            <Icon icon="hugeicons:arrow-left-02" />
            返回系统
          </RouterLink> -->
        </div>
      </div>
    </aside>

    <section class="chat-main" aria-label="AI 会话">
      <header class="chat-header">
        <div class="header-left">
          <div class="header-title">
            AI 助手
            <span class="workspace-tag">工作空间</span>
          </div>
        </div>
        <div class="header-actions">
          <RouterLink to="/knowledge" class="export-button knowledge-link">
            <Icon icon="hugeicons:book-open-01" />
            <span>知识库</span>
          </RouterLink>
          <span class="text-mode">文本会话</span>
          <button
            class="export-button"
            :disabled="!messages.length || busy || historyLoading"
            @click="exportConversation"
          >
            <Icon icon="hugeicons:download-01" />
            <span>导出会话</span>
          </button>
        </div>
      </header>
      <div
        ref="scroller"
        class="chat-scroll"
        tabindex="0"
        aria-label="会话消息"
        @scroll="trackScroll"
        @wheel.passive="stopScrollAnimation"
        @touchstart.passive="stopScrollAnimation"
        @pointerdown="stopScrollAnimation"
        @keydown="interruptScrollKey"
      >
        <div v-if="historyLoading" class="loading-state" role="status">
          <span class="loading-dot" />
          正在加载会话…
        </div>
        <div v-else-if="!messages.length" class="welcome-state">
          <img class="welcome-logo" src="@/assets/images/claude.svg" alt="Claude" />
          <p class="welcome-eyebrow">你的日常 AI 工作伙伴</p>
          <h1>今天，有什么可以帮你，{{ userName }}？</h1>
          <p class="welcome-description">整理思路、探索方案，或解决一个棘手的问题。</p>
          <div class="prompt-grid">
            <button
              v-for="prompt in prompts"
              :key="prompt.title"
              :disabled="busy"
              @click="usePrompt(prompt.prompt)"
            >
              <Icon :icon="`hugeicons:${prompt.icon}`" />
              <strong>{{ prompt.title }}</strong>
              <span>{{ prompt.description }}</span>
            </button>
          </div>
        </div>
        <div v-else class="message-list">
          <button
            v-if="hasOlder"
            class="load-older"
            :disabled="olderLoading || busy"
            @click="loadOlder"
          >
            {{ olderLoading ? '正在加载…' : '加载更早的消息' }}
          </button>
          <article
            v-for="message in messages"
            :key="message.id"
            class="message"
            :class="message.role"
            :aria-label="message.role === 'user' ? '你的消息' : 'AI 回复'"
          >
            <div v-if="message.role === 'user'" class="user-bubble">{{ message.content }}</div>
            <template v-else>
              <div class="assistant-label">
                <img src="@/assets/images/claude.svg" alt="" />
                <span>AI 助手</span>
                <span v-if="message.status === 'generating' && busy" class="generation-label">
                  正在生成
                </span>
              </div>
              <ChatMarkdown v-if="message.content" :content="message.content" />
              <p v-else-if="message.status === 'generating'" class="thinking" role="status">
                <span class="loading-dot" />
                {{ busy ? '正在思考…' : '回复正在生成，稍后重新加载可查看状态。' }}
              </p>
              <button
                v-if="message.status === 'generating' && !busy"
                class="text-button"
                @click="loadConversation()"
              >
                更新回复状态
              </button>
              <p v-if="message.status === 'cancelled'" class="message-status">已停止生成</p>
              <p v-else-if="message.status === 'failed'" class="message-status failure">
                回复未完成，请重新提问。
              </p>
              <div v-if="message.status !== 'generating'" class="message-actions">
                <button
                  v-if="message.content"
                  class="icon-button"
                  :aria-label="copied === message.id ? '回复已复制' : '复制回复'"
                  :title="copied === message.id ? '已复制' : '复制回复'"
                  @click="copyMessage(message)"
                >
                  <Icon :icon="copied === message.id ? 'hugeicons:tick-02' : 'hugeicons:copy-01'" />
                </button>
                <button
                  v-if="message.content"
                  type="button"
                  class="icon-button read-aloud-button"
                  :class="{ 'is-reading': readingMessageId === message.id }"
                  :aria-label="readingMessageId === message.id ? '停止朗读' : '朗读'"
                  :title="readingMessageId === message.id ? '停止朗读' : '朗读'"
                  :aria-pressed="readingMessageId === message.id"
                  @click="messageReader.toggle(message.id, message.content)"
                >
                  <Icon
                    :icon="
                      readingMessageId === message.id
                        ? 'hugeicons:stop-circle'
                        : 'hugeicons:volume-high'
                    "
                  />
                </button>
              </div>
            </template>
          </article>
        </div>
      </div>
      <div class="composer-zone">
        <button
          v-if="!atBottom && messages.length"
          class="scroll-bottom icon-button"
          aria-label="滚动到最新消息"
          @click="scrollBottom(true, true)"
        >
          <Icon icon="hugeicons:arrow-down-02" />
        </button>
        <div v-if="error" class="error-banner" role="alert">
          <span>{{ error }}</span>
          <button v-if="activeId && !busy" class="text-button" @click="loadConversation()">
            重新加载
          </button>
          <button class="icon-button" aria-label="关闭错误提示" @click="error = ''">
            <Icon icon="hugeicons:cancel-01" />
          </button>
        </div>
        <p v-if="notice" class="notice" role="status">{{ notice }}</p>
        <form class="composer" @submit.prevent="send">
          <textarea
            ref="textarea"
            v-model="draft"
            aria-label="输入消息"
            placeholder="向 AI 助手提问，或一起探索一个想法…"
            rows="1"
            :disabled="historyLoading"
            @keydown="onKeydown"
          />
          <div class="composer-toolbar">
            <span class="composer-toolbar-spacer"></span>
            <span
              v-if="draft.length > 15000"
              class="character-limit"
              :class="{ exceeded: remaining < 0 }"
            >
              {{ draft.length }} / 16000
            </span>
            <ChatModelSettings
              :disabled="busy"
              @change="updateGenerationSettings"
              @error="handleModelError"
            />
            <button
              v-if="busy"
              type="button"
              class="send-button"
              aria-label="停止生成"
              title="停止生成"
              @click="generation?.abort()"
            >
              <Icon icon="hugeicons:stop" />
            </button>
            <button
              v-else
              class="send-button"
              type="submit"
              aria-label="发送消息"
              :disabled="!canSend"
            >
              <Icon icon="hugeicons:arrow-up-02" />
            </button>
          </div>
        </form>
        <p class="composer-disclaimer">AI 的回答可能存在偏差，请核实重要信息。</p>
      </div>
    </section>
  </main>
</template>

<style scoped>
  .chat-app {
    --chat-bg: #fcfcfc;
    --chat-sidebar: #f8f8f8;
    --chat-text: #202020;
    --chat-muted: #7b7b7b;
    --chat-border: #e6e6e6;
    --chat-hover: #eee;
    --chat-code: #ececec;
    --chat-link: #5366ab;
    --chat-input: #fff;
    width: 100%;
    height: 100dvh;
    display: flex;
    background: var(--chat-bg);
    color: var(--chat-text);
    position: relative;
    overflow: hidden;
  }
  :global(.dark .chat-app) {
    --chat-bg: #212121;
    --chat-sidebar: #181818;
    --chat-text: #ececec;
    --chat-muted: #a4a4a4;
    --chat-border: #363636;
    --chat-hover: #303030;
    --chat-code: #2f2f2f;
    --chat-link: #a2b8ff;
    --chat-input: #303030;
  }
  .chat-app button {
    cursor: pointer;
    color: inherit;
    font: inherit;
  }
  .chat-app button:disabled {
    cursor: not-allowed;
    opacity: 0.45;
  }
  .chat-app button:focus-visible,
  .chat-app a:focus-visible,
  .chat-app input:focus-visible {
    outline: 2px solid #d97757;
    outline-offset: 3px;
  }
  .chat-app .iconify {
    width: 20px;
    height: 20px;
    flex-shrink: 0;
  }
  .icon-button {
    width: 32px;
    height: 32px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border: 0;
    background: transparent;
    border-radius: 8px;
    flex-shrink: 0;
  }
  .icon-button:hover {
    background: var(--chat-hover);
  }
  .chat-sidebar {
    --sidebar-expanded-width: 280px;
    width: 52px;
    position: relative;
    overflow: hidden;
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    background: var(--chat-sidebar);
    border-right: 1px solid var(--chat-border);
    height: 100%;
  }
  .sidebar-open .chat-sidebar {
    width: var(--sidebar-expanded-width);
  }
  .sidebar-content {
    display: flex;
    flex-direction: column;
    width: var(--sidebar-expanded-width);
    height: 100%;
    opacity: 0;
    visibility: hidden;
    transform: translateX(-6px);
    transition:
      opacity 140ms ease,
      transform 220ms ease,
      visibility 0s 140ms;
  }
  .sidebar-open .sidebar-content {
    opacity: 1;
    visibility: visible;
    transform: translateX(0);
    transition-delay: 90ms, 0s, 0s;
  }
  .sidebar-rail {
    position: absolute;
    inset: 0 auto 0 0;
    width: 51px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 5px;
    padding: 10px 0 16px;
    opacity: 1;
    visibility: visible;
    transition:
      opacity 140ms ease 100ms,
      visibility 0s 100ms;
  }
  .sidebar-open .sidebar-rail {
    opacity: 0;
    visibility: hidden;
    transition-delay: 0s, 140ms;
  }
  .sidebar-rail > .icon-button {
    width: 36px;
    height: 36px;
  }
  .sidebar-rail > .rail-toggle {
    margin-bottom: 11px;
    position: relative;
  }
  .rail-logo {
    width: 22px;
    height: 22px;
    transition: opacity 120ms ease;
  }
  .rail-toggle .rail-expand-icon {
    position: absolute;
    opacity: 0;
    transition: opacity 120ms ease;
  }
  .rail-toggle:hover .rail-logo,
  .rail-toggle:focus-visible .rail-logo {
    opacity: 0;
  }
  .rail-toggle:hover .rail-expand-icon,
  .rail-toggle:focus-visible .rail-expand-icon {
    opacity: 1;
  }
  .rail-account {
    margin-top: auto;
    padding: 6px;
    border: 0;
    border-radius: 50%;
    background: transparent;
  }
  .rail-account .account-avatar {
    width: 25px;
    height: 25px;
    font-size: 8px;
  }
  .rail-account:hover {
    background: var(--chat-hover);
  }
  .sidebar-brand {
    display: flex;
    align-items: center;
    padding: 18px 12px 18px 18px;
    gap: 2px;
  }
  .brand-link {
    display: flex;
    align-items: center;
    gap: 9px;
    text-decoration: none;
    color: inherit;
    flex: 1;
    white-space: nowrap;
  }
  .brand-link img {
    width: 23px;
    height: 23px;
  }
  .brand-link strong {
    font-size: 16px;
    font-weight: 650;
    letter-spacing: -0.3px;
  }
  .sidebar-brand .icon-button {
    color: var(--chat-muted);
  }
  .new-chat {
    display: flex;
    align-items: center;
    gap: 10px;
    margin: 0 12px 14px;
    padding: 11px 12px;
    border: 0;
    border-radius: 9px;
    background: var(--chat-hover);
    text-align: left;
    font-size: 14px !important;
  }
  .new-chat-plus {
    margin-left: auto;
    color: var(--chat-muted);
    font-size: 11px;
  }
  .search-field {
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 0 12px 8px;
    border: 1px solid var(--chat-border);
    border-radius: 9px;
    padding: 3px 8px;
    background: var(--chat-input);
  }
  .search-field .iconify {
    width: 16px;
  }
  .search-field input {
    width: 100%;
    min-width: 0;
    padding: 8px 0;
    background: transparent;
    color: inherit;
    font-size: 12px;
  }
  .history-list {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    padding: 6px 10px 16px;
  }
  .history-group h2 {
    color: var(--chat-muted);
    font-size: 11px;
    font-weight: 400;
    padding: 15px 10px 8px;
  }
  .history-item {
    display: block;
    width: 100%;
    border: 0;
    background: transparent;
    text-align: left;
    border-radius: 8px;
    padding: 10px;
    font-size: 14px !important;
  }
  .history-item span {
    display: block;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .history-item:hover,
  .history-item.selected {
    background: var(--chat-hover);
  }
  .history-limit {
    font-size: 10px;
    color: var(--chat-muted);
    padding: 20px 10px 0;
  }
  .sidebar-empty {
    color: var(--chat-muted);
    font-size: 12px;
    line-height: 1.8;
    padding: 45px 10px;
    text-align: center;
  }
  .sidebar-empty > .iconify {
    width: 25px;
    height: 25px;
    margin: 0 auto 14px;
    opacity: 0.5;
  }
  .sidebar-empty span {
    font-size: 11px;
  }
  .text-button {
    border: 0;
    background: transparent;
    text-decoration: underline;
    text-underline-offset: 4px;
    padding: 4px 0;
    font-size: 12px !important;
    white-space: nowrap;
  }
  .sidebar-footer {
    border-top: 1px solid var(--chat-border);
    padding: 13px 14px 16px;
  }
  .account-row {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 2px 2px;
  }
  .account-avatar {
    width: 31px;
    height: 31px;
    flex-shrink: 0;
  }
  .account-row > div {
    flex: 1;
    min-width: 0;
  }
  .account-row strong {
    display: block;
    font-size: 12px;
    font-weight: 500;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .account-row div span {
    display: block;
    color: var(--chat-muted);
    font-size: 10px;
    padding-top: 3px;
  }
  .back-home {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 7px;
    border: 1px solid var(--chat-border);
    border-radius: 18px;
    height: 33px;
    color: inherit;
    text-decoration: none;
    font-size: 11px;
  }
  .back-home:hover {
    background: var(--chat-hover);
  }
  .back-home .iconify {
    width: 15px;
    height: 15px;
  }
  .chat-main {
    min-width: 0;
    flex: 1;
    height: 100%;
    display: flex;
    flex-direction: column;
    position: relative;
  }
  .chat-header {
    height: 64px;
    flex-shrink: 0;
    padding: 0 28px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
  }
  .header-left,
  .header-actions {
    display: flex;
    align-items: center;
    gap: 12px;
  }
  .header-title {
    font-size: 16px;
    font-weight: 550;
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .workspace-tag {
    padding: 3px 7px;
    border: 1px solid var(--chat-border);
    color: var(--chat-muted);
    font-size: 10px;
    border-radius: 5px;
    font-weight: 400;
  }
  .text-mode {
    color: var(--chat-muted);
    font-size: 11px;
  }
  .export-button {
    display: flex;
    align-items: center;
    gap: 7px;
    padding: 7px 10px;
    background: transparent;
    border: 0;
    border-radius: 8px;
    font-size: 12px !important;
  }
  .knowledge-link {
    color: var(--chat-muted);
    text-decoration: none;
  }
  .export-button:hover {
    background: var(--chat-hover);
  }
  .export-button .iconify {
    width: 17px;
    height: 17px;
  }
  .chat-scroll {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    overscroll-behavior: contain;
  }
  .chat-scroll:focus-visible {
    outline: 2px solid #d97757;
    outline-offset: -2px;
  }
  .chat-scroll,
  .history-list,
  .composer textarea {
    --scrollbar-thumb: #d4d4d4;
    --scrollbar-hover: #b7b7b7;
    scrollbar-width: thin;
    scrollbar-color: var(--scrollbar-thumb) transparent;
  }
  :global(.dark .chat-scroll),
  :global(.dark .history-list),
  :global(.dark .composer textarea) {
    --scrollbar-thumb: #555;
    --scrollbar-hover: #737373;
  }
  @supports selector(::-webkit-scrollbar) {
    .chat-scroll,
    .history-list,
    .composer textarea {
      scrollbar-width: auto;
      scrollbar-color: auto;
    }
  }
  .chat-scroll::-webkit-scrollbar,
  .history-list::-webkit-scrollbar,
  .composer textarea::-webkit-scrollbar {
    width: 8px;
    height: 8px;
  }
  .chat-scroll::-webkit-scrollbar-track,
  .history-list::-webkit-scrollbar-track,
  .composer textarea::-webkit-scrollbar-track {
    background: transparent;
  }
  .chat-scroll::-webkit-scrollbar-thumb,
  .history-list::-webkit-scrollbar-thumb,
  .composer textarea::-webkit-scrollbar-thumb {
    border: 1px solid transparent;
    border-radius: 999px;
    background: var(--scrollbar-thumb);
    background-clip: padding-box;
    min-height: 32px;
  }
  .chat-scroll::-webkit-scrollbar-thumb:hover,
  .history-list::-webkit-scrollbar-thumb:hover,
  .composer textarea::-webkit-scrollbar-thumb:hover {
    background-color: var(--scrollbar-hover);
  }
  .chat-scroll::-webkit-scrollbar-button,
  .history-list::-webkit-scrollbar-button,
  .composer textarea::-webkit-scrollbar-button {
    display: none;
    width: 0;
    height: 0;
  }
  .chat-scroll::-webkit-scrollbar-corner,
  .history-list::-webkit-scrollbar-corner,
  .composer textarea::-webkit-scrollbar-corner {
    background: transparent;
  }
  .welcome-state {
    max-width: 760px;
    margin: 0 auto;
    padding: clamp(50px, 12vh, 135px) 24px 40px;
    text-align: center;
  }
  .welcome-logo {
    width: 43px;
    height: 43px;
    margin: 0 auto 22px;
  }
  .welcome-eyebrow {
    color: var(--chat-muted);
    font-size: 12px;
    margin-bottom: 13px;
  }
  .welcome-state h1 {
    font-size: clamp(24px, 2.6vw, 32px);
    letter-spacing: -1px;
    font-weight: 550;
    margin-bottom: 14px;
  }
  .welcome-description {
    color: var(--chat-muted);
    font-size: 13px;
    line-height: 1.7;
  }
  .prompt-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 12px;
    margin-top: 40px;
  }
  .prompt-grid button {
    border: 1px solid var(--chat-border);
    border-radius: 13px;
    background: transparent;
    padding: 19px 17px;
    text-align: left;
    transition: background 0.15s;
  }
  .prompt-grid button:hover {
    background: var(--chat-hover);
  }
  .prompt-grid .iconify {
    color: #bc745b;
    margin-bottom: 18px;
  }
  .prompt-grid strong {
    display: block;
    font-size: 12px;
    font-weight: 500;
    margin-bottom: 7px;
  }
  .prompt-grid span {
    display: block;
    font-size: 10px;
    color: var(--chat-muted);
    line-height: 1.6;
  }
  .message-list {
    max-width: 816px;
    margin: 0 auto;
    padding: 25px 24px 40px;
  }
  .message {
    margin-bottom: 32px;
  }
  .message.user {
    display: flex;
    justify-content: flex-end;
    padding-left: 10%;
  }
  .user-bubble {
    background: var(--chat-hover);
    padding: 12px 20px;
    border-radius: 22px;
    font-size: 14px;
    line-height: 1.8;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
    max-width: 100%;
  }
  .assistant-label {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 12px;
    margin-bottom: 17px;
    font-weight: 500;
  }
  .assistant-label img {
    width: 21px;
    height: 21px;
  }
  .generation-label {
    color: var(--chat-muted);
    font-weight: 400;
    font-size: 10px;
    margin-left: 3px;
  }
  .thinking {
    display: flex;
    align-items: center;
    gap: 10px;
    color: var(--chat-muted);
    font-size: 13px;
    padding: 5px 0 20px;
  }
  .message-actions {
    display: flex;
    gap: 4px;
    margin-top: 6px;
    color: var(--chat-muted);
  }
  .message-actions .icon-button {
    width: 28px;
    height: 28px;
  }
  .message-actions .iconify {
    width: 16px;
    height: 16px;
  }
  .read-aloud-button.is-reading {
    color: var(--chat-text);
    background: var(--chat-hover);
  }
  .message-status {
    color: var(--chat-muted);
    font-size: 12px;
    margin-top: 14px;
  }
  .message-status.failure {
    color: #b65042;
  }
  .loading-state {
    display: flex;
    gap: 10px;
    align-items: center;
    justify-content: center;
    height: 200px;
    color: var(--chat-muted);
    font-size: 13px;
  }
  .loading-dot {
    display: inline-block;
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: #d97757;
    animation: breathe 1.2s ease-in-out infinite alternate;
  }
  @keyframes breathe {
    to {
      opacity: 0.3;
    }
  }
  .load-older {
    display: block;
    margin: 0 auto 28px;
    font-size: 12px !important;
    color: var(--chat-muted) !important;
    border: 1px solid var(--chat-border);
    border-radius: 20px;
    background: transparent;
    padding: 7px 16px;
  }
  .composer-zone {
    position: relative;
    flex-shrink: 0;
    width: min(816px, 100%);
    padding: 0 24px 14px;
    margin: 0 auto;
  }
  .composer {
    border: 1px solid var(--chat-border);
    border-radius: 25px;
    background: var(--chat-input);
    padding: 16px 16px 10px 20px;
    box-shadow: 0 2px 12px #00000004;
  }
  .composer:focus-within {
    border-color: #bcb5b0;
  }
  .composer textarea {
    display: block;
    width: 100%;
    resize: none;
    min-height: 28px;
    max-height: 180px;
    background: transparent;
    color: inherit;
    border: 0;
    outline: none;
    font-size: 14px;
    line-height: 1.7;
    padding: 0 4px 6px 0;
  }
  .composer textarea::placeholder {
    color: var(--chat-muted);
  }
  .composer-toolbar {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-top: 7px;
  }
  .composer-toolbar-spacer {
    flex: 1;
  }
  .composer-hint {
    display: flex;
    align-items: center;
    gap: 7px;
    color: var(--chat-muted);
    font-size: 10px;
    flex: 1;
  }
  .composer-hint .iconify {
    width: 16px;
    height: 16px;
  }
  .send-button {
    border: 0;
    border-radius: 50%;
    width: 34px;
    height: 34px;
    background: var(--chat-text);
    color: var(--chat-bg) !important;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }
  .send-button:disabled {
    background: var(--chat-hover);
    color: var(--chat-muted) !important;
    opacity: 1 !important;
  }
  .character-limit {
    font-size: 10px;
    color: var(--chat-muted);
  }
  .character-limit.exceeded {
    color: #b65042;
  }
  .composer-disclaimer {
    text-align: center;
    font-size: 10px;
    color: var(--chat-muted);
    padding-top: 10px;
  }
  .error-banner {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px 12px;
    margin-bottom: 12px;
    border: 1px solid #cc827c55;
    background: var(--chat-input);
    border-radius: 12px;
    font-size: 12px;
    line-height: 1.6;
    color: #b65042;
  }
  .error-banner > span {
    flex: 1;
  }
  .notice {
    font-size: 12px;
    color: var(--chat-muted);
    text-align: center;
    margin: 0 0 10px;
  }
  .scroll-bottom {
    position: absolute;
    left: calc(50% - 16px);
    top: -44px;
    background: var(--chat-input);
    border: 1px solid var(--chat-border);
    border-radius: 50%;
    box-shadow: 0 2px 8px #00000008;
  }
  .sidebar-backdrop {
    display: none;
  }
  @media (min-width: 1500px) {
    .chat-sidebar {
      --sidebar-expanded-width: 320px;
    }
  }
  @media (max-width: 800px) {
    .chat-sidebar {
      position: absolute;
      left: 0;
      top: 0;
      z-index: 20;
    }
    .chat-main {
      margin-left: 52px;
    }
    .sidebar-backdrop {
      display: block;
      position: absolute;
      inset: 0;
      left: 280px;
      z-index: 19;
      border: 0;
      background: #0006;
    }
    .chat-header {
      padding: 0 16px;
      height: 58px;
    }
    .text-mode {
      display: none;
    }
    .welcome-state {
      padding-top: 65px;
    }
    .message-list {
      padding: 24px 20px;
    }
    .composer-zone {
      padding: 0 16px max(14px, env(safe-area-inset-bottom));
    }
  }
  @media (max-width: 480px) {
    .workspace-tag {
      display: none;
    }
    .header-title {
      font-size: 14px;
    }
    .export-button span {
      display: none;
    }
    .welcome-state {
      padding: 50px 20px 24px;
    }
    .welcome-description {
      font-size: 12px;
    }
    .prompt-grid {
      grid-template-columns: 1fr;
      margin-top: 25px;
      gap: 8px;
    }
    .prompt-grid button {
      padding: 13px 14px;
      display: grid;
      grid-template-columns: 22px 1fr;
      column-gap: 12px;
      align-items: center;
    }
    .prompt-grid .iconify {
      grid-row: span 2;
      margin: 0;
    }
    .prompt-grid strong {
      margin: 0 0 3px;
    }
    .composer-hint {
      font-size: 9px;
    }
    .composer textarea {
      font-size: 16px;
    }
    .welcome-logo {
      width: 35px;
      height: 35px;
      margin-bottom: 18px;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .sidebar-content,
    .sidebar-rail,
    .rail-logo,
    .rail-toggle .rail-expand-icon {
      transition: none;
    }
    .loading-dot {
      animation: none;
    }
    .prompt-grid button {
      transition: none;
    }
  }
</style>
