<script setup lang="ts">
  import { createId } from '@/lib/id'
  import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
  import { useRoute, useRouter } from 'vue-router'
  import { Icon, addCollection } from '@iconify/vue'
  import { gsap } from 'gsap'
  import { ScrollToPlugin } from 'gsap/ScrollToPlugin'
  import icons from '@/assets/chat-icons.json'
  import ChatMarkdown from '@/components/ChatMarkdown.vue'
  import ChatImageAttachment from '@/components/ChatImageAttachment.vue'
  import ChatImageGenerating from '@/components/ChatImageGenerating.vue'
  import ChatModelSettings from '@/components/ChatModelSettings.vue'
  import UserAvatar from '@/components/UserAvatar.vue'
  import { userInfo, userDisplayName as userName } from '@/lib/auth'
  import { createMessageReader } from '@/lib/speech'
  import { useGlobalStore } from '@/store'
  import {
    deleteConversation,
    extractChatDocument,
    ChatError,
    createConversation,
    getMessages,
    listConversations,
    streamMessage
  } from '@/api/chat'
  import type { ChatAttachment, ChatMessage, Conversation, GenerationOptions } from '@/api/chat'

  addCollection(icons)
  gsap.registerPlugin(ScrollToPlugin)
  const route = useRoute()
  const router = useRouter()
  const store = useGlobalStore()
  const conversations = ref<Conversation[]>([])
  const menuConversation = ref<Conversation>()
  const menuPosition = ref({ left: '0px', top: '0px' })
  const deletingId = ref('')
  let menuTrigger: HTMLButtonElement | undefined
  function closeConversationMenu() {
    menuConversation.value = undefined
    menuTrigger?.focus()
  }
  async function openConversationMenu(conversation: Conversation, event: MouseEvent) {
    if (menuConversation.value?.id === conversation.id) {
      closeConversationMenu()
      return
    }
    menuTrigger = event.currentTarget as HTMLButtonElement
    const rect = menuTrigger.getBoundingClientRect()
    menuPosition.value = {
      left: `${Math.max(8, Math.min(rect.left, window.innerWidth - 188))}px`,
      top: `${Math.min(rect.bottom + 6, window.innerHeight - 80)}px`
    }
    menuConversation.value = conversation
    await nextTick()
    document.getElementById('delete-conversation-action')?.focus()
  }
  async function removeConversation() {
    const conversation = menuConversation.value
    if (!conversation || deletingId.value || busy.value) return
    closeConversationMenu()
    if (!window.confirm(`删除「${conversation.title}」？该会话及全部消息将被永久删除。`)) return
    deletingId.value = conversation.id
    try {
      await deleteConversation(conversation.id)
      conversations.value = conversations.value.filter(item => item.id !== conversation.id)
      if (activeId.value === conversation.id) await selectConversation('')
      showNotice('会话已删除')
    } catch (cause) {
      error.value = await handleError(cause)
    } finally {
      deletingId.value = ''
    }
  }
  const messages = ref<ChatMessage[]>([])
  const imageGeneratingId = ref('')
  const draft = ref('')
  const attachments = ref<ChatAttachment[]>([])
  const attachmentInput = ref<HTMLInputElement>()
  const readingAttachments = ref(false)
  const draggingFiles = ref(false)
  let dragDepth = 0
  const canDropAttachments = computed(
    () =>
      !busy.value &&
      !historyLoading.value &&
      !readingAttachments.value &&
      attachments.value.length < 4
  )
  function isFileDrag(event: DragEvent) {
    return Array.from(event.dataTransfer?.types ?? []).includes('Files')
  }
  function resetFileDrag() {
    dragDepth = 0
    draggingFiles.value = false
  }
  function enterFileDrag(event: DragEvent) {
    if (!isFileDrag(event)) return
    event.preventDefault()
    dragDepth++
    draggingFiles.value = true
  }
  function overFileDrag(event: DragEvent) {
    if (!isFileDrag(event)) return
    event.preventDefault()
    draggingFiles.value = true
    if (event.dataTransfer)
      event.dataTransfer.dropEffect = canDropAttachments.value ? 'copy' : 'none'
  }
  function leaveFileDrag(event: DragEvent) {
    if (!draggingFiles.value) return
    dragDepth = Math.max(0, dragDepth - 1)
    if (
      !dragDepth ||
      (event.relatedTarget === null &&
        (event.clientX <= 0 ||
          event.clientY <= 0 ||
          event.clientX >= window.innerWidth ||
          event.clientY >= window.innerHeight))
    )
      resetFileDrag()
  }
  async function dropFiles(event: DragEvent) {
    if (!isFileDrag(event)) return
    event.preventDefault() // 防止浏览器跳转打开本地文件。
    resetFileDrag()
    if (!canDropAttachments.value) {
      showNotice('请等待当前操作完成，或移除附件后再添加。')
      return
    }
    await readAttachments(Array.from(event.dataTransfer?.files ?? []))
    await nextTick()
    textarea.value?.focus()
  }
  function cancelFileDrag(event: KeyboardEvent) {
    if (event.key === 'Escape') resetFileDrag()
  }

  async function addAttachments(event: Event) {
    const input = event.target as HTMLInputElement
    const files = Array.from(input.files ?? [])
    input.value = ''
    await readAttachments(files)
  }
  function pasteAttachments(event: ClipboardEvent) {
    const files = Array.from(event.clipboardData?.items ?? [])
      .filter(item => item.kind === 'file')
      .map(item => item.getAsFile())
      .filter((file): file is File => file !== null)
    if (!files.length) return // 普通文字继续使用浏览器默认粘贴行为。
    event.preventDefault()
    void readAttachments(files)
  }
  async function readAttachments(files: File[]) {
    if (busy.value || readingAttachments.value || historyLoading.value || !files.length) return
    const loadingStarted = performance.now()
    readingAttachments.value = true
    error.value = ''
    const sessionId = activeId.value
    try {
      const additions: ChatAttachment[] = []
      if (attachments.value.length + files.length > 4) throw new Error('每条消息最多 4 个附件。')
      for (const file of files) {
        if (file.name.length > 255) throw new Error('文件名称过长。')
        if (['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
          if (!file.size || file.size > 2 * 1024 * 1024) throw new Error('单张图片最大 2 MB。')
          const data = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader()
            reader.onload = () => resolve(String(reader.result))
            reader.onerror = () => reject(new Error('图片读取失败。'))
            reader.readAsDataURL(file)
          })
          additions.push({ name: file.name, type: 'image', mime: file.type, data })
        } else if (/\.(txt|md)$/i.test(file.name)) {
          if (!file.size || file.size > 100000) throw new Error('单个文档最大 100 KB。')
          const text = new TextDecoder('utf-8', { fatal: true }).decode(await file.arrayBuffer())
          if (!text.trim() || text.includes('\0')) throw new Error('请选择非空的 UTF-8 文本文档。')
          additions.push({ name: file.name, type: 'document', mime: 'text/plain', text })
        } else if (/\.(docx|xlsx|pdf|pptx)$/i.test(file.name)) {
          if (!file.size || file.size > 10 * 1024 * 1024) throw new Error('单个文件最大 10 MB。')
          additions.push({ ...(await extractChatDocument(file)), name: file.name })
        } else
          throw new Error(
            '支持 PNG、JPEG、WebP、TXT、Markdown、DOCX、XLSX、PDF、PPTX；旧版 DOC/XLS/PPT 请另存为新版格式。'
          )
      }
      const combined = [...attachments.value, ...additions]
      const bytes = combined.reduce(
        (sum, a) =>
          sum +
          (a.type === 'image'
            ? (a.data!.split(',')[1].length * 3) / 4
            : new TextEncoder().encode(a.text).length),
        0
      )
      if (bytes > 6 * 1024 * 1024) throw new Error('附件总大小最大 6 MB。')
      await new Promise(resolve =>
        setTimeout(resolve, Math.max(0, 350 - (performance.now() - loadingStarted)))
      )
      if (!disposed && sessionId === activeId.value) attachments.value = combined
    } catch (cause) {
      error.value = cause instanceof Error ? cause.message : '附件读取失败。'
    } finally {
      readingAttachments.value = false
    }
  }
  function expandAttachments(element: Element, done: () => void) {
    const el = element as HTMLElement
    gsap.fromTo(
      el,
      { height: 0, opacity: 0 },
      {
        height: el.scrollHeight,
        opacity: 1,
        duration: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 0.24,
        ease: 'power2.out',
        onComplete: () => {
          el.style.height = 'auto'
          done()
        }
      }
    )
  }
  function collapseAttachments(element: Element, done: () => void) {
    const el = element as HTMLElement
    gsap.killTweensOf(el)
    gsap.to(el, {
      height: 0,
      opacity: 0,
      duration: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 0.2,
      ease: 'power2.inOut',
      onComplete: done
    })
  }
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
      (!!draft.value.trim() || attachments.value.length > 0) &&
      !readingAttachments.value &&
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
    resetFileDrag()
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
    attachments.value = []
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
    const sentAttachments = [...attachments.value]
    const content = draft.value.trim() || '请分析附件内容。'
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
      const turnId = createId()
      messages.value.push({
        id: `local-${turnId}`,
        attachments: sentAttachments,
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
      attachments.value = []
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
            imageGeneratingId.value = ''
            reply!.content += text
            void scrollBottom()
          },
          onImageGeneration() {
            imageGeneratingId.value = reply!.id
            void nextTick(() => scrollBottom())
          },
          onDone(payload) {
            imageGeneratingId.value = ''
            reply!.status = 'completed'
            if (payload.finishReason === 'length')
              showNotice('回复达到长度上限，可发送「继续」接着生成。')
          }
        },
        selection,
        sentAttachments
      )
    } catch (cause) {
      if (reply) reply.status = controller.signal.aborted ? 'cancelled' : 'failed'
      if (!disposed && (!id || id === activeId.value)) {
        if (controller.signal.aborted) showNotice('已停止生成')
        else error.value = await handleError(cause)
        if (!started && !controller.signal.aborted) {
          draft.value = content
          attachments.value = sentAttachments
        }
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
      imageGeneratingId.value = ''
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
    window.addEventListener('dragenter', enterFileDrag)
    window.addEventListener('dragover', overFileDrag)
    window.addEventListener('dragleave', leaveFileDrag)
    window.addEventListener('drop', dropFiles)
    window.addEventListener('dragend', resetFileDrag)
    window.addEventListener('blur', resetFileDrag)
    window.addEventListener('keydown', cancelFileDrag)
    document.addEventListener('keydown', sidebarShortcut)
    void refreshList()
    void loadConversation()
    textarea.value?.focus()
  })
  onUnmounted(() => {
    window.removeEventListener('dragenter', enterFileDrag)
    window.removeEventListener('dragover', overFileDrag)
    window.removeEventListener('dragleave', leaveFileDrag)
    window.removeEventListener('drop', dropFiles)
    window.removeEventListener('dragend', resetFileDrag)
    window.removeEventListener('blur', resetFileDrag)
    window.removeEventListener('keydown', cancelFileDrag)
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
        <Transition name="conversation-search">
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
        </Transition>
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
              <div
                v-for="conversation in group.items"
                :key="conversation.id"
                class="history-row"
                :class="{
                  selected: activeId === conversation.id,
                  'menu-open': menuConversation?.id === conversation.id
                }"
              >
                <button
                  class="history-item"
                  :title="conversation.title"
                  :aria-current="activeId === conversation.id ? 'page' : undefined"
                  :disabled="busy || olderLoading || !!deletingId"
                  @click="selectConversation(conversation.id)"
                >
                  <span>{{ conversation.title }}</span>
                </button>
                <button
                  class="conversation-more"
                  :aria-label="`更多操作：${conversation.title}`"
                  aria-haspopup="menu"
                  :aria-expanded="menuConversation?.id === conversation.id"
                  :disabled="busy || olderLoading || !!deletingId"
                  @click.stop="openConversationMenu(conversation, $event)"
                >
                  <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true">
                    <circle cx="4" cy="10" r="1.5" fill="currentColor" />
                    <circle cx="10" cy="10" r="1.5" fill="currentColor" />
                    <circle cx="16" cy="10" r="1.5" fill="currentColor" />
                  </svg>
                </button>
              </div>
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
          <!-- <span class="text-mode">文本会话</span> -->
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
            <div v-if="message.role === 'user'" class="user-content">
              <div v-if="message.attachments?.length" class="attachment-list sent-attachments">
                <template v-for="(attachment, index) in message.attachments" :key="index">
                  <ChatImageAttachment
                    v-if="attachment.type === 'image'"
                    :attachment="attachment"
                  />
                  <div v-else class="attachment-card">
                    <span aria-hidden="true">▤</span>
                    <span>{{ attachment.name }}</span>
                  </div>
                </template>
              </div>
              <div v-if="message.content" class="user-bubble">{{ message.content }}</div>
            </div>
            <template v-else>
              <div class="assistant-label">
                <img src="@/assets/images/claude.svg" alt="" />
                <span>AI 助手</span>
                <span
                  v-if="message.status === 'generating' && busy && imageGeneratingId !== message.id"
                  class="generation-label"
                >
                  正在生成
                </span>
              </div>
              <ChatMarkdown
                v-if="message.content"
                :content="message.content"
                :conversation-id="activeId"
                :message-id="message.id"
              />
              <ChatImageGenerating
                v-if="imageGeneratingId === message.id && message.status === 'generating' && busy"
              />
              <p
                v-else-if="!message.content && message.status === 'generating'"
                class="thinking"
                role="status"
              >
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
          <Transition
            :css="false"
            @enter="expandAttachments"
            @leave="collapseAttachments"
            @enter-cancelled="gsap.killTweensOf($event)"
            @leave-cancelled="gsap.killTweensOf($event)"
          >
            <div v-if="attachments.length || readingAttachments" class="attachment-expansion">
              <div class="attachment-list draft-attachments">
                <div
                  v-if="readingAttachments"
                  class="attachment-card attachment-loading"
                  role="status"
                  aria-live="polite"
                >
                  <span class="attachment-spinner" aria-hidden="true" />
                  <span>正在读取附件…</span>
                </div>
                <template v-for="(attachment, index) in attachments" :key="index">
                  <ChatImageAttachment
                    v-if="attachment.type === 'image'"
                    class="attachment-reveal"
                    :attachment="attachment"
                    removable
                    :disabled="busy"
                    @remove="attachments.splice(index, 1)"
                  />
                  <div v-else class="attachment-card attachment-reveal">
                    <span aria-hidden="true">▤</span>
                    <span>{{ attachment.name }}</span>
                    <button
                      type="button"
                      :aria-label="`移除 ${attachment.name}`"
                      :disabled="busy"
                      @click="attachments.splice(index, 1)"
                    >
                      ×
                    </button>
                  </div>
                </template>
              </div>
            </div>
          </Transition>
          <textarea
            ref="textarea"
            v-model="draft"
            aria-label="输入消息"
            placeholder="向 AI 助手提问，或一起探索一个想法…"
            rows="1"
            :disabled="historyLoading"
            @keydown="onKeydown"
            @paste="pasteAttachments"
          />
          <div class="composer-toolbar">
            <input
              ref="attachmentInput"
              type="file"
              accept="image/png,image/jpeg,image/webp,.txt,.md,.docx,.xlsx,.pdf,.pptx"
              multiple
              hidden
              @change="addAttachments"
            />
            <button
              type="button"
              class="icon-button attach-button"
              aria-label="上传图片或文档"
              title="图片 ≤2MB；DOCX/XLSX/PDF/PPTX ≤10MB；TXT/MD ≤100KB；最多4个"
              :disabled="busy || historyLoading || readingAttachments || attachments.length >= 4"
              @click="attachmentInput?.click()"
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="1.6"
                aria-hidden="true"
              >
                <path d="m8 12 6-6a3 3 0 0 1 4 4l-8 8a5 5 0 0 1-7-7l9-9" />
                <path d="m7 13 7-7" />
              </svg>
            </button>
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
    <template v-if="menuConversation">
      <div class="conversation-menu-backdrop" @click="closeConversationMenu" />
      <div
        class="conversation-menu"
        :style="menuPosition"
        role="menu"
        aria-label="会话操作"
        @keydown.esc.stop.prevent="closeConversationMenu"
        @keydown.tab="closeConversationMenu"
      >
        <button id="delete-conversation-action" role="menuitem" @click="removeConversation">
          <Icon icon="hugeicons:delete-02" />
          <span>删除</span>
        </button>
      </div>
    </template>
    <Transition name="file-drop">
      <div v-if="draggingFiles" class="file-drop-overlay" role="status" aria-live="polite">
        <div class="file-drop-content">
          <div class="file-drop-art" aria-hidden="true">
            <svg class="drop-document" width="64" height="76" viewBox="0 0 64 76" fill="none">
              <rect x="8" y="4" width="48" height="64" rx="9" fill="#8a83ff" />
              <path
                d="M21 23h22M21 33h22M21 43h15"
                stroke="white"
                stroke-width="4"
                stroke-linecap="round"
              />
            </svg>
            <svg class="drop-image" width="72" height="64" viewBox="0 0 72 64" fill="none">
              <rect x="3" y="3" width="66" height="58" rx="14" fill="#6655ef" />
              <circle cx="48" cy="20" r="6" fill="white" />
              <path
                d="m15 46 14-17 12 14 7-8 10 11"
                stroke="white"
                stroke-width="5"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </svg>
          </div>
          <h2>{{ canDropAttachments ? '添加到对话' : '暂时无法添加附件' }}</h2>
          <p>
            {{
              canDropAttachments
                ? '将图片或文档拖放到这里，即可添加到输入框'
                : '请等待当前操作完成，或移除附件后再添加'
            }}
          </p>
          <small>图片 · TXT / Markdown / Word / Excel / PDF / PPTX · 最多 4 个附件</small>
        </div>
      </div>
    </Transition>
  </main>
</template>

<style scoped>
  .file-drop-overlay {
    position: fixed;
    inset: 0;
    z-index: 1000;
    display: flex;
    align-items: center;
    justify-content: center;
    background: color-mix(in srgb, var(--chat-bg) 88%, transparent);
    backdrop-filter: blur(3px);
    pointer-events: none;
  }
  .file-drop-content {
    text-align: center;
    padding: 28px;
  }
  .file-drop-content h2 {
    font-size: 26px;
    font-weight: 600;
    margin: 22px 0 12px;
  }
  .file-drop-content p {
    font-size: 15px;
    margin: 0 0 12px;
  }
  .file-drop-content small {
    font-size: 12px;
    color: var(--chat-muted);
  }
  .file-drop-art {
    position: relative;
    width: 128px;
    height: 100px;
    margin: 0 auto;
  }
  .drop-document {
    position: absolute;
    right: 0;
    top: 0;
    transform: rotate(15deg);
  }
  .drop-image {
    position: absolute;
    left: 8px;
    bottom: 0;
    transform: rotate(-8deg);
    filter: drop-shadow(0 8px 10px #6655ef25);
  }
  .file-drop-enter-active,
  .file-drop-leave-active {
    transition: opacity 0.18s ease;
  }
  .file-drop-enter-active .file-drop-content,
  .file-drop-leave-active .file-drop-content {
    transition: transform 0.18s ease;
  }
  .file-drop-enter-from,
  .file-drop-leave-to {
    opacity: 0;
  }
  .file-drop-enter-from .file-drop-content,
  .file-drop-leave-to .file-drop-content {
    transform: translateY(8px);
  }
  @media (prefers-reduced-motion: reduce) {
    .file-drop-enter-active,
    .file-drop-leave-active,
    .file-drop-enter-active .file-drop-content,
    .file-drop-leave-active .file-drop-content {
      transition: none;
    }
  }

  .attachment-expansion {
    overflow: hidden;
  }
  .attachment-loading {
    min-height: 60px;
    min-width: 170px;
  }
  .attachment-spinner {
    display: block;
    width: 20px;
    height: 20px;
    flex-shrink: 0;
    border: 2px solid var(--chat-border);
    border-top-color: #d97757;
    border-radius: 50%;
    animation: attachment-spin 0.75s linear infinite;
  }
  .attachment-reveal {
    animation: attachment-appear 0.22s ease-out;
  }
  @keyframes attachment-spin {
    to {
      transform: rotate(360deg);
    }
  }
  @keyframes attachment-appear {
    from {
      opacity: 0;
      transform: translateY(5px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .attachment-reveal,
    .attachment-spinner {
      animation: none;
    }
  }
  .attachment-list {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
    margin-bottom: 10px;
  }
  .draft-attachments {
    padding: 8px 6px 4px 0;
  }
  .attachment-card {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 9px;
    max-width: 230px;
    border: 1px solid var(--chat-border);
    border-radius: 10px;
    background: var(--chat-bg);
    font-size: 12px;
  }
  .attachment-card img {
    width: 48px;
    height: 48px;
    object-fit: contain;
    border-radius: 5px;
  }
  .attachment-card > span {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .attachment-card button {
    border: 0;
    background: transparent;
    color: var(--chat-muted);
    padding: 4px;
    font-size: 18px;
  }

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
    transition:
      border-color 160ms ease,
      box-shadow 160ms ease;
  }
  .search-field:focus-within {
    border-color: #d97757;
    box-shadow: 0 0 0 2px rgb(217 119 87 / 14%);
  }
  .conversation-search-enter-active,
  .conversation-search-leave-active {
    overflow: hidden;
    transition:
      opacity 180ms ease,
      transform 180ms ease,
      max-height 180ms ease,
      margin-bottom 180ms ease,
      padding-top 180ms ease,
      padding-bottom 180ms ease;
    max-height: 60px;
    transform-origin: top center;
  }
  .conversation-search-enter-from,
  .conversation-search-leave-to {
    opacity: 0;
    transform: translateY(-6px);
    max-height: 0;
    margin-bottom: 0;
    padding-top: 0;
    padding-bottom: 0;
  }
  @media (prefers-reduced-motion: reduce) {
    .search-field,
    .conversation-search-enter-active,
    .conversation-search-leave-active {
      transition: none;
    }
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
    border: 0;
    box-shadow: none;
  }
  .chat-app .search-field input:focus-visible {
    outline: none;
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
  .history-row {
    display: flex;
    align-items: center;
    border-radius: 8px;
  }
  .history-row:hover,
  .history-row.selected,
  .history-row.menu-open {
    background: var(--chat-hover);
  }
  .history-row .history-item {
    flex: 1;
    min-width: 0;
  }
  .conversation-more {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0;
    opacity: 0;
    flex-shrink: 0;
    width: 32px;
    height: 32px;
    margin-right: 5px;
    border: 0;
    border-radius: 6px;
    background: transparent;
    color: var(--chat-text);
    font-size: 22px !important;
  }
  .history-row:hover .conversation-more,
  .history-row:focus-within .conversation-more,
  .history-row.selected .conversation-more,
  .history-row.menu-open .conversation-more {
    opacity: 1;
  }
  .conversation-more:hover,
  .conversation-more:active {
    background: transparent;
  }
  .conversation-menu-backdrop {
    position: fixed;
    inset: 0;
    z-index: 49;
  }
  .conversation-menu {
    position: fixed;
    z-index: 50;
    width: 180px;
    padding: 7px;
    border: 1px solid var(--chat-border);
    border-radius: 16px;
    background: var(--chat-bg);
    box-shadow: 0 12px 35px #0002;
  }
  .conversation-menu button {
    display: flex;
    align-items: center;
    gap: 12px;
    width: 100%;
    border: 0;
    border-radius: 9px;
    background: transparent;
    color: #e54848;
    padding: 12px;
    font-size: 14px !important;
    text-align: left;
  }
  .conversation-menu button:hover {
    background: var(--chat-hover);
  }
  .conversation-menu .iconify {
    width: 20px;
    height: 20px;
  }
  @media (hover: none) {
    .conversation-more {
      opacity: 1;
    }
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
  .user-content {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    max-width: 100%;
  }
  .sent-attachments {
    justify-content: flex-end;
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

    transition: border-color 0.25s ease-in;
  }
  .composer:focus-within {
    border-color: #d97757;
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
