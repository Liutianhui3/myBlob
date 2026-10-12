<script setup lang="ts">
  import { nextTick, watch, computed, onMounted, onUnmounted, ref } from 'vue'
  import { Icon } from '@iconify/vue'
  import { useGlobalStore } from '@/store'
  import { RequestError } from '@/utils/request'
  import { clearSession } from '@/lib/auth'
  import { useRouter } from 'vue-router'
  import {
    createKnowledgeBase,
    listKnowledgeBases,
    listDocuments,
    uploadDocument,
    getChunks,
    deleteDocument
  } from '@/api/knowledge'
  import type { KnowledgeBase, KnowledgeDocument, ChunkPage } from '@/api/knowledge'

  const modalElement = ref<HTMLElement>()
  const appElement = ref<HTMLElement>()
  let previousFocus: HTMLElement | null = null
  const store = useGlobalStore()
  const router = useRouter()
  const bases = ref<KnowledgeBase[]>([])
  const selectedId = ref('')
  const selected = computed(() => bases.value.find(base => base.id === selectedId.value))
  const documents = ref<KnowledgeDocument[]>([])
  const search = ref('')
  const filtered = computed(() =>
    documents.value.filter(doc => doc.name.toLowerCase().includes(search.value.toLowerCase()))
  )
  const loading = ref(false)
  const error = ref('')
  const notice = ref('')
  const creating = ref(false)
  const createBusy = ref(false)
  const name = ref('')
  const description = ref('')
  const fileInput = ref<HTMLInputElement>()
  const file = ref<File>()
  const chunkSize = ref(500)
  const chunkOverlap = ref(50)
  const uploading = ref(false)
  const progress = ref(0)
  const dragging = ref(false)
  const preview = ref<KnowledgeDocument>()
  const chunks = ref<ChunkPage>()
  const previewLoading = ref(false)
  const deleting = ref<KnowledgeDocument>()
  const deleteBusy = ref(false)
  let uploadController: AbortController | undefined
  let listController: AbortController | undefined
  let previewController: AbortController | undefined
  const lifetime = new AbortController()
  const validParameters = computed(
    () =>
      Number.isInteger(chunkSize.value) &&
      chunkSize.value >= 100 &&
      chunkSize.value <= 2000 &&
      Number.isInteger(chunkOverlap.value) &&
      chunkOverlap.value >= 0 &&
      chunkOverlap.value < chunkSize.value
  )
  function fail(e: unknown) {
    if (e instanceof Error && e.name === 'AbortError') return
    if (e instanceof RequestError && e.status === 401) {
      clearSession()
      router.replace('/login')
      return
    }
    error.value =
      e instanceof RequestError && e.status === 404
        ? '知识库接口尚未启动，请启动更新后的后端服务。'
        : e instanceof Error
          ? e.message
          : '操作失败，请重试。'
  }
  async function refresh() {
    loading.value = true
    error.value = ''
    try {
      bases.value = await listKnowledgeBases(lifetime.signal)
      if (!selectedId.value && bases.value.length) await selectBase(bases.value[0].id)
    } catch (e) {
      fail(e)
    } finally {
      loading.value = false
    }
  }
  async function selectBase(id: string) {
    listController?.abort()
    listController = new AbortController()
    const controller = listController
    selectedId.value = id
    documents.value = []
    search.value = ''
    preview.value = undefined
    chunks.value = undefined
    file.value = undefined
    error.value = ''
    loading.value = true
    previewController?.abort()
    try {
      const result = await listDocuments(id, controller.signal)
      if (!controller.signal.aborted) documents.value = result
    } catch (e) {
      fail(e)
    } finally {
      if (listController === controller) loading.value = false
    }
  }
  async function createBase() {
    if (!name.value.trim() || createBusy.value) return
    createBusy.value = true
    error.value = ''
    try {
      const base = await createKnowledgeBase(name.value.trim(), description.value.trim())
      bases.value.unshift(base)
      creating.value = false
      name.value = ''
      description.value = ''
      await selectBase(base.id)
    } catch (e) {
      fail(e)
    } finally {
      createBusy.value = false
    }
  }
  function chooseFile(files: FileList | null) {
    if (uploading.value || !files?.length) return
    error.value = ''
    notice.value = ''
    if (files.length > 1) {
      error.value = '第一版每次上传一个文档。'
      return
    }
    const candidate = files[0]
    if (!/\.(txt|md)$/i.test(candidate.name) || !candidate.size || candidate.size > 1024 * 1024) {
      error.value = '请选择非空的 TXT / Markdown 文件，最大 1 MB。'
      return
    }
    if (!validParameters.value) {
      error.value = '请先填写有效的切片参数，再选择文件。'
      if (fileInput.value) fileInput.value.value = ''
      return
    }
    file.value = candidate
    if (fileInput.value) fileInput.value.value = ''
    void upload()
  }
  function drop(event: DragEvent) {
    dragging.value = false
    chooseFile(event.dataTransfer?.files ?? null)
  }
  async function upload() {
    if (!file.value || !selectedId.value || !validParameters.value || uploading.value) return
    const baseId = selectedId.value
    uploading.value = true
    progress.value = 0
    error.value = ''
    notice.value = ''
    uploadController = new AbortController()
    try {
      const doc = await uploadDocument(
        baseId,
        file.value,
        chunkSize.value,
        chunkOverlap.value,
        uploadController.signal,
        value => (progress.value = value)
      )
      documents.value.unshift(doc)
      const base = selected.value
      if (base) {
        base.documentCount++
        base.chunkCount += doc.chunkCount
      }
      file.value = undefined
      if (fileInput.value) fileInput.value.value = ''
      notice.value = `文档已保存，共生成 ${doc.chunkCount} 个切片。`
      await showChunks(doc)
    } catch (e) {
      if (e instanceof Error && e.name === 'AbortError')
        notice.value = '已停止等待上传结果，请刷新列表确认文档是否保存。'
      else fail(e)
    } finally {
      uploading.value = false
    }
  }
  async function showChunks(doc: KnowledgeDocument, page = 1) {
    previewController?.abort()
    previewController = new AbortController()
    const controller = previewController
    preview.value = doc
    chunks.value = undefined
    previewLoading.value = true
    try {
      const result = await getChunks(selectedId.value, doc.id, page, controller.signal)
      if (!controller.signal.aborted) chunks.value = result
    } catch (e) {
      fail(e)
    } finally {
      if (controller === previewController) previewLoading.value = false
    }
  }
  async function remove() {
    if (!deleting.value || deleteBusy.value) return
    deleteBusy.value = true
    error.value = ''
    const doc = deleting.value
    try {
      await deleteDocument(selectedId.value, doc.id)
      documents.value = documents.value.filter(item => item.id !== doc.id)
      if (selected.value) {
        selected.value.documentCount--
        selected.value.chunkCount -= doc.chunkCount
      }
      if (preview.value?.id === doc.id) {
        previewController?.abort()
        preview.value = undefined
      }
      deleting.value = undefined
      notice.value = '文档及其切片已删除。'
    } catch (e) {
      fail(e)
    } finally {
      deleteBusy.value = false
    }
  }
  function closePreview() {
    previewController?.abort()
    preview.value = undefined
  }
  function closeModal() {
    if (!createBusy.value && !deleteBusy.value) {
      creating.value = false
      deleting.value = undefined
    }
  }
  function trapFocus(event: KeyboardEvent) {
    if (event.key !== 'Tab') return
    const elements = Array.from(
      modalElement.value?.querySelectorAll<HTMLElement>(
        'button:not(:disabled), input:not(:disabled), textarea:not(:disabled)'
      ) ?? []
    )
    const first = elements[0],
      last = elements[elements.length - 1]
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault()
      last?.focus()
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault()
      first?.focus()
    }
  }
  watch(
    () => creating.value || !!deleting.value,
    async open => {
      if (open) {
        previousFocus = document.activeElement as HTMLElement
        await nextTick()
        modalElement.value?.querySelector<HTMLElement>('input, button')?.focus()
      } else {
        await nextTick()
        previousFocus?.focus()
      }
    }
  )
  function size(bytes: number) {
    return bytes < 1024 ? `${bytes} B` : `${(bytes / 1024).toFixed(1)} KB`
  }
  onMounted(refresh)
  onUnmounted(() => {
    lifetime.abort()
    uploadController?.abort()
    listController?.abort()
    previewController?.abort()
  })
</script>

<template>
  <div ref="appElement" class="knowledge-app">
    <aside class="knowledge-sidebar" :inert="creating || deleting ? true : undefined">
      <RouterLink to="/chat" class="brand">
        <span class="brand-symbol">✳</span>
        AI 工作台
      </RouterLink>
      <div class="sidebar-title">
        <span>我的知识库</span>
        <button
          aria-label="创建知识库"
          :disabled="uploading || deleteBusy"
          @click="creating = true"
        >
          ＋
        </button>
      </div>
      <nav aria-label="知识库列表">
        <button
          v-for="base in bases"
          :key="base.id"
          class="base-item"
          :class="{ active: selectedId === base.id }"
          :disabled="uploading || deleteBusy"
          @click="selectBase(base.id)"
        >
          <Icon icon="hugeicons:book-open-01" />
          <span>
            {{ base.name }}
            <small>{{ base.documentCount }} 个文档</small>
          </span>
        </button>
      </nav>
      <p v-if="!bases.length && !loading" class="sidebar-empty">
        创建一个知识库，
        <br />
        开始整理你的文档。
      </p>
      <div class="sidebar-bottom">
        <RouterLink to="/chat">← 返回会话</RouterLink>
        <button
          :aria-label="store.theme === 'dark' ? '切换浅色主题' : '切换深色主题'"
          @click="store.theme = store.theme === 'dark' ? 'light' : 'dark'"
        >
          <Icon :icon="store.theme === 'dark' ? 'hugeicons:sun-03' : 'hugeicons:moon-02'" />
        </button>
      </div>
    </aside>
    <main class="knowledge-main" :inert="creating || deleting ? true : undefined">
      <header class="knowledge-header">
        <span>
          知识库
          <span class="tag">文档管理</span>
        </span>
        <RouterLink to="/chat">返回 AI 助手 ↗</RouterLink>
      </header>
      <div class="knowledge-content">
        <div class="page-heading">
          <div>
            <p class="eyebrow">你的资料，有序归档</p>
            <h1>{{ selected?.name || '知识库' }}</h1>
            <p>{{ selected?.description || '上传文档，查看切片，为后续的知识检索做好准备。' }}</p>
          </div>
          <button class="primary" :disabled="uploading || deleteBusy" @click="creating = true">
            ＋ 新建知识库
          </button>
        </div>
        <div v-if="error" class="alert error" role="alert">
          {{ error }}
          <button :disabled="uploading" @click="selectedId ? selectBase(selectedId) : refresh()">
            刷新
          </button>
        </div>
        <div v-if="notice" class="alert" role="status">{{ notice }}</div>
        <div class="scope-note">
          <span>01 上传文档</span>
          <i>→</i>
          <span>02 自动切片</span>
          <i>→</i>
          <span>03 保存与预览</span>
          <small>当前保存文本切片，尚未接入向量检索。</small>
        </div>
        <template v-if="selected">
          <div class="stats">
            <div>
              <span>文档总数</span>
              <strong>
                {{ selected.documentCount }}
                <small>份</small>
              </strong>
            </div>
            <div>
              <span>文本切片</span>
              <strong>
                {{ selected.chunkCount }}
                <small>片</small>
              </strong>
            </div>
            <div>
              <span>支持格式</span>
              <strong class="format">TXT / Markdown</strong>
            </div>
          </div>
          <section class="upload-card" aria-label="上传文档">
            <div class="section-heading">
              <h2>上传文档</h2>
              <span>UTF-8 编码 · 单文件最大 1 MB</span>
            </div>
            <div class="upload-grid">
              <button
                class="dropzone"
                :class="{ dragging }"
                :disabled="uploading"
                @click="fileInput?.click()"
                @dragover.prevent="dragging = true"
                @dragleave="dragging = false"
                @drop.prevent="drop"
              >
                <Icon icon="hugeicons:upload-04" />
                <strong>{{ file?.name || '点击选择，或拖拽文档到这里' }}</strong>
                <span>
                  {{
                    file
                      ? size(file.size) + ' · 点击重新选择'
                      : '选择后自动上传并切片 · 支持 .txt、.md'
                  }}
                </span>
              </button>
              <input
                ref="fileInput"
                type="file"
                accept=".txt,.md"
                hidden
                @change="chooseFile(($event.target as HTMLInputElement).files)"
              />
              <div class="parameters">
                <h3>
                  切片设置
                  <span>按字符</span>
                </h3>
                <div class="parameter-inputs">
                  <label>
                    切片长度
                    <input
                      v-model.number="chunkSize"
                      type="number"
                      min="100"
                      max="2000"
                      step="1"
                      :disabled="uploading"
                    />
                  </label>
                  <label>
                    重叠长度
                    <input
                      v-model.number="chunkOverlap"
                      type="number"
                      min="0"
                      :max="chunkSize - 1"
                      step="1"
                      :disabled="uploading"
                    />
                  </label>
                </div>
                <p>
                  先设置参数，选择文件后自动上传并切片。相邻切片保留重复内容，长度
                  100–2000，重叠需小于长度。
                </p>
                <p v-if="!validParameters" class="validation">请填写有效的整数切片参数。</p>
                <button
                  v-if="file || uploading"
                  class="primary"
                  :disabled="!file || !validParameters || uploading"
                  @click="upload"
                >
                  {{
                    uploading
                      ? progress < 100
                        ? `上传中 ${progress}%`
                        : '正在切片并保存…'
                      : '重试上传'
                  }}
                </button>
                <button v-if="uploading" class="cancel-upload" @click="uploadController?.abort()">
                  取消等待
                </button>
              </div>
            </div>
            <progress v-if="uploading" :value="progress" max="100" aria-label="文件上传进度" />
          </section>
          <section class="document-section">
            <div class="section-heading">
              <h2>
                文档
                <span class="count">{{ documents.length }}</span>
              </h2>
              <input
                v-model="search"
                class="search"
                placeholder="搜索文档名称"
                aria-label="搜索文档"
              />
            </div>
            <p v-if="loading" class="empty" role="status">正在加载文档…</p>
            <div v-else-if="!filtered.length" class="empty">
              <Icon icon="hugeicons:files-01" />
              <h3>{{ search ? '没有找到匹配的文档' : '还没有文档' }}</h3>
              <p>{{ search ? '试试其他关键词。' : '上传第一份资料，开始查看文档切片。' }}</p>
            </div>
            <div v-else class="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>文档名称</th>
                    <th>状态</th>
                    <th>切片</th>
                    <th>上传时间</th>
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="doc in filtered" :key="doc.id">
                    <td>
                      <div class="document-name">
                        <span class="file-badge">
                          {{ doc.name.endsWith('.md') ? 'MD' : 'TXT' }}
                        </span>
                        <span>
                          {{ doc.name }}
                          <small>
                            {{ size(doc.size) }} · {{ doc.chunkSize }} / {{ doc.chunkOverlap }} 字符
                          </small>
                        </span>
                      </div>
                    </td>
                    <td><span class="status">已切片</span></td>
                    <td>{{ doc.chunkCount }}</td>
                    <td>
                      {{
                        new Date(doc.createdAt).toLocaleDateString('zh-CN', {
                          timeZone: 'Asia/Shanghai'
                        })
                      }}
                    </td>
                    <td>
                      <div class="row-actions">
                        <button :disabled="uploading || deleteBusy" @click="showChunks(doc)">
                          查看切片
                        </button>
                        <button
                          class="delete-action"
                          :disabled="uploading || deleteBusy"
                          :aria-label="`删除 ${doc.name}`"
                          @click="deleting = doc"
                        >
                          删除
                        </button>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>
          <section v-if="preview" class="preview-section" aria-label="切片预览">
            <div class="section-heading">
              <div>
                <h2>切片预览</h2>
                <p>{{ preview.name }} · 重叠 {{ preview.chunkOverlap }} 字符</p>
              </div>
              <button aria-label="关闭切片预览" @click="closePreview">✕</button>
            </div>
            <p v-if="previewLoading" role="status">正在加载切片…</p>
            <div v-for="chunk in chunks?.items" :key="chunk.id" class="chunk">
              <div>
                <strong>片段 {{ String(chunk.position).padStart(2, '0') }}</strong>
                <span>{{ chunk.charCount }} 字符</span>
              </div>
              <pre>{{ chunk.content }}</pre>
            </div>
            <div v-if="chunks" class="pagination">
              <button
                :disabled="chunks.page <= 1 || previewLoading"
                @click="showChunks(preview, chunks.page - 1)"
              >
                上一页
              </button>
              <span>{{ chunks.page }} / {{ Math.max(1, Math.ceil(chunks.total / 20)) }}</span>
              <button
                :disabled="chunks.page * 20 >= chunks.total || previewLoading"
                @click="showChunks(preview, chunks.page + 1)"
              >
                下一页
              </button>
            </div>
          </section>
        </template>
        <div v-else-if="!loading" class="welcome-empty">
          <span class="welcome-symbol">✳</span>
          <h2>给你的知识一个家</h2>
          <p>按主题整理资料，从第一份文档开始。</p>
          <button class="primary" @click="creating = true">创建第一个知识库</button>
        </div>
      </div>
    </main>
    <div
      v-if="creating || deleting"
      ref="modalElement"
      class="modal-overlay"
      @click.self="closeModal"
      @keydown.esc="closeModal"
      @keydown="trapFocus"
    >
      <form
        v-if="creating"
        class="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-title"
        @submit.prevent="createBase"
      >
        <h2 id="create-title">创建知识库</h2>
        <p>把相关资料放在一起，方便日后检索。</p>
        <label>
          名称
          <input
            v-model="name"
            autofocus
            maxlength="80"
            required
            placeholder="例如：产品文档、学习笔记"
            :disabled="createBusy"
          />
        </label>
        <label>
          描述
          <span>选填</span>
          <textarea
            v-model="description"
            maxlength="300"
            rows="3"
            placeholder="这个知识库用来整理什么？"
            :disabled="createBusy"
          />
        </label>
        <p v-if="error" class="validation" role="alert">{{ error }}</p>
        <footer>
          <button type="button" :disabled="createBusy" @click="creating = false">取消</button>
          <button class="primary" :disabled="!name.trim() || createBusy">
            {{ createBusy ? '创建中…' : '创建知识库' }}
          </button>
        </footer>
      </form>
      <div
        v-else-if="deleting"
        class="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-title"
      >
        <h2 id="delete-title">删除文档？</h2>
        <p>「{{ deleting.name }}」及其所有切片将被删除，无法恢复。</p>
        <p v-if="error" class="validation" role="alert">{{ error }}</p>
        <footer>
          <button :disabled="deleteBusy" @click="deleting = undefined">取消</button>
          <button class="primary" :disabled="deleteBusy" @click="remove">
            {{ deleteBusy ? '删除中…' : '确认删除' }}
          </button>
        </footer>
      </div>
    </div>
  </div>
</template>

<style scoped>
  .knowledge-app {
    --kb-bg: #fdfdfc;
    --kb-panel: #f7f7f6;
    --kb-text: #292928;
    --kb-muted: #868681;
    --kb-border: #e7e7e3;
    --kb-accent: #cf7153;
    --kb-hover: #efefed;
    display: flex;
    width: 100%;
    height: 100dvh;
    background: var(--kb-bg);
    color: var(--kb-text);
    font-size: 14px;
    overflow: hidden;
  }
  :global(.dark .knowledge-app) {
    --kb-bg: #20201f;
    --kb-panel: #191918;
    --kb-text: #e9e9e5;
    --kb-muted: #a1a19a;
    --kb-border: #363632;
    --kb-accent: #e59072;
    --kb-hover: #30302d;
    color-scheme: dark;
  }
  button,
  input,
  textarea {
    font: inherit;
    color: inherit;
  }
  button,
  a,
  input,
  textarea {
    outline-offset: 4px;
  }
  button {
    cursor: pointer;
    background: none;
    border: 0;
    border-radius: 8px;
  }
  button:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }
  a {
    color: inherit;
    text-decoration: none;
  }
  button:hover:not(:disabled) {
    background: var(--kb-hover);
  }
  .knowledge-sidebar {
    width: 260px;
    flex-shrink: 0;
    background: var(--kb-panel);
    border-right: 1px solid var(--kb-border);
    padding: 28px 18px;
    display: flex;
    flex-direction: column;
  }
  .brand {
    display: flex;
    align-items: center;
    gap: 10px;
    font-weight: 600;
    font-size: 18px;
    padding: 0 8px 32px;
  }
  .brand-symbol {
    font-size: 34px;
    color: var(--kb-accent);
  }
  .sidebar-title {
    display: flex;
    align-items: center;
    justify-content: space-between;
    color: var(--kb-muted);
    font-size: 12px;
    padding: 0 10px 12px;
  }
  .sidebar-title button {
    font-size: 24px;
    padding: 0 6px;
  }
  .base-item {
    width: 100%;
    text-align: left;
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 13px 12px;
    margin-bottom: 5px;
  }
  .base-item.active {
    background: var(--kb-hover);
  }
  .base-item .iconify {
    font-size: 21px;
    color: var(--kb-accent);
  }
  .base-item span {
    min-width: 0;
    overflow-wrap: anywhere;
  }
  .base-item small,
  .document-name small {
    display: block;
    margin-top: 5px;
    color: var(--kb-muted);
    font-size: 11px;
  }
  .sidebar-empty {
    color: var(--kb-muted);
    padding: 15px 10px;
    line-height: 1.8;
  }
  .sidebar-bottom {
    margin-top: auto;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 20px 8px 0;
    color: var(--kb-muted);
    border-top: 1px solid var(--kb-border);
  }
  .sidebar-bottom button {
    padding: 6px;
    font-size: 22px;
  }
  .knowledge-main {
    flex: 1;
    min-width: 0;
    overflow: auto;
  }
  .knowledge-header {
    height: 76px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 36px;
    border-bottom: 1px solid var(--kb-border);
    font-weight: 600;
  }
  .knowledge-header a {
    font-size: 12px;
    font-weight: 400;
    color: var(--kb-muted);
  }
  .tag {
    display: inline-block;
    margin-left: 10px;
    font-size: 10px;
    border: 1px solid var(--kb-border);
    border-radius: 5px;
    padding: 4px 7px;
    font-weight: 400;
    color: var(--kb-muted);
  }
  .knowledge-content {
    max-width: 1180px;
    padding: 42px 48px 100px;
    margin: auto;
  }
  .page-heading {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 20px;
    margin-bottom: 28px;
  }
  .eyebrow {
    font-size: 11px;
    color: var(--kb-accent) !important;
    letter-spacing: 2px;
    margin: 0 0 10px;
  }
  h1 {
    font-size: 30px;
    line-height: 1.3;
    margin: 0 0 12px;
    font-weight: 600;
    overflow-wrap: anywhere;
  }
  p {
    line-height: 1.7;
    color: var(--kb-muted);
    margin: 8px 0;
  }
  h2 {
    font-size: 16px;
    font-weight: 600;
    margin: 0;
  }
  h3 {
    font-size: 13px;
    margin: 0 0 14px;
  }
  .primary {
    background: var(--kb-accent);
    color: #fff;
    padding: 11px 17px;
    white-space: nowrap;
    font-size: 13px;
  }
  .primary:hover:not(:disabled) {
    background: #b85f44;
  }
  .scope-note {
    display: flex;
    align-items: center;
    gap: 14px;
    font-size: 11px;
    color: var(--kb-muted);
    padding: 14px 0;
    border-top: 1px solid var(--kb-border);
    border-bottom: 1px solid var(--kb-border);
    margin-bottom: 24px;
    flex-wrap: wrap;
  }
  .scope-note i {
    font-style: normal;
  }
  .scope-note small {
    margin-left: auto;
  }
  .stats {
    display: grid;
    grid-template-columns: 1fr 1fr 1.3fr;
    gap: 18px;
    margin-bottom: 28px;
  }
  .stats > div {
    border: 1px solid var(--kb-border);
    border-radius: 12px;
    padding: 19px 22px;
  }
  .stats span {
    color: var(--kb-muted);
    font-size: 12px;
  }
  .stats strong {
    display: block;
    font-size: 29px;
    font-weight: 500;
    margin-top: 12px;
  }
  .stats strong small {
    font-size: 11px;
    color: var(--kb-muted);
    margin-left: 8px;
  }
  .stats .format {
    font-size: 19px;
    margin-top: 18px;
  }
  .upload-card,
  .preview-section {
    border: 1px solid var(--kb-border);
    border-radius: 14px;
    padding: 24px;
    margin-bottom: 30px;
  }
  .section-heading {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    margin-bottom: 20px;
  }
  .section-heading > span {
    font-size: 11px;
    color: var(--kb-muted);
  }
  .upload-grid {
    display: grid;
    grid-template-columns: 1.3fr 1fr;
    gap: 30px;
  }
  .dropzone {
    border: 1px dashed var(--kb-border);
    background: var(--kb-panel);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 12px;
    padding: 30px 20px;
    min-height: 210px;
    min-width: 0;
  }
  .dropzone.dragging {
    border-color: var(--kb-accent);
  }
  .dropzone .iconify {
    font-size: 28px;
    color: var(--kb-accent);
  }
  .dropzone strong {
    font-weight: 500;
    font-size: 13px;
    overflow-wrap: anywhere;
    max-width: 100%;
  }
  .dropzone span {
    font-size: 11px;
    color: var(--kb-muted);
  }
  .parameters h3 span {
    font-weight: 400;
    color: var(--kb-muted);
    font-size: 11px;
    margin-left: 8px;
  }
  .parameter-inputs {
    display: flex;
    gap: 14px;
  }
  label {
    display: block;
    font-size: 12px;
  }
  input,
  textarea {
    display: block;
    width: 100%;
    box-sizing: border-box;
    border: 1px solid var(--kb-border);
    border-radius: 7px;
    background: var(--kb-bg);
    padding: 9px 11px;
    margin-top: 8px;
  }
  input:focus,
  textarea:focus {
    outline: 1px solid var(--kb-accent);
  }
  .parameters p {
    font-size: 11px;
    margin: 12px 0;
  }
  .parameters .primary {
    width: 100%;
  }
  .cancel-upload {
    margin-top: 8px;
    color: var(--kb-muted);
    font-size: 12px;
  }
  .validation {
    color: #c85748 !important;
    font-size: 12px;
  }
  progress {
    width: 100%;
    height: 5px;
    margin-top: 18px;
    accent-color: var(--kb-accent);
  }
  .search {
    width: 220px;
    margin: 0;
    font-size: 12px;
  }
  .count {
    font-size: 11px;
    color: var(--kb-muted);
    margin-left: 8px;
  }
  .table-scroll {
    overflow: auto;
  }
  table {
    width: 100%;
    border-collapse: collapse;
    text-align: left;
    font-size: 12px;
  }
  th {
    font-weight: 400;
    color: var(--kb-muted);
    padding: 13px 12px;
    background: var(--kb-panel);
    white-space: nowrap;
  }
  td {
    padding: 18px 12px;
    border-bottom: 1px solid var(--kb-border);
  }
  .document-name {
    display: flex;
    gap: 12px;
    align-items: center;
    min-width: 200px;
    overflow-wrap: anywhere;
  }
  .file-badge {
    font-size: 10px;
    flex-shrink: 0;
    color: var(--kb-accent);
    padding: 12px 7px;
    border: 1px solid var(--kb-border);
    border-radius: 7px;
  }
  .status {
    white-space: nowrap;
    color: #638572;
    background: rgba(99, 133, 114, 0.09);
    padding: 5px 8px;
    border-radius: 5px;
  }
  .row-actions {
    display: flex;
    gap: 10px;
    white-space: nowrap;
  }
  .row-actions button {
    padding: 5px;
    color: var(--kb-accent);
    font-size: 11px;
  }
  .row-actions .delete-action {
    color: var(--kb-muted);
  }
  .empty {
    text-align: center;
    padding: 48px 20px;
    color: var(--kb-muted);
    border: 1px solid var(--kb-border);
    border-radius: 12px;
  }
  .empty .iconify {
    font-size: 32px;
    margin-bottom: 14px;
  }
  .empty h3 {
    margin: 0;
  }
  .empty p {
    font-size: 12px;
  }
  .preview-section {
    margin-top: 28px;
  }
  .preview-section .section-heading p {
    font-size: 12px;
  }
  .chunk {
    border-top: 1px solid var(--kb-border);
    padding: 18px 0;
  }
  .chunk > div {
    display: flex;
    justify-content: space-between;
    font-size: 11px;
    color: var(--kb-muted);
  }
  .chunk strong {
    color: var(--kb-accent);
    font-weight: 500;
  }
  .chunk pre {
    white-space: pre-wrap;
    overflow-wrap: anywhere;
    font: 13px/1.8 inherit;
    margin: 12px 0 0;
    font-family: inherit;
    line-height: 1.8;
  }
  .pagination {
    display: flex;
    justify-content: center;
    gap: 20px;
    align-items: center;
    font-size: 12px;
  }
  .pagination button {
    padding: 8px;
  }
  .alert {
    padding: 12px 16px;
    background: var(--kb-panel);
    border: 1px solid var(--kb-border);
    border-radius: 8px;
    margin-bottom: 20px;
    font-size: 12px;
  }
  .alert.error {
    color: #c85748;
  }
  .alert button {
    float: right;
    text-decoration: underline;
  }
  .welcome-empty {
    text-align: center;
    padding: 70px 20px;
  }
  .welcome-symbol {
    font-size: 65px;
    color: var(--kb-accent);
  }
  .welcome-empty h2 {
    font-size: 24px;
    margin: 18px 0 10px;
  }
  .welcome-empty .primary {
    margin-top: 20px;
  }
  .modal-overlay {
    position: fixed;
    inset: 0;
    z-index: 100;
    background: #0006;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 20px;
  }
  .modal {
    background: var(--kb-bg);
    border: 1px solid var(--kb-border);
    border-radius: 16px;
    padding: 28px;
    width: 420px;
    max-width: 100%;
    box-shadow: 0 16px 70px #0003;
  }
  .modal h2 {
    font-size: 21px;
  }
  .modal > p {
    font-size: 12px;
    margin-bottom: 20px;
  }
  .modal label {
    margin-top: 18px;
  }
  .modal label span {
    color: var(--kb-muted);
    margin-left: 5px;
  }
  .modal footer {
    display: flex;
    justify-content: flex-end;
    gap: 12px;
    margin-top: 24px;
  }
  .modal footer > button {
    padding: 10px 18px;
  }
  @media (max-width: 1000px) {
    .knowledge-sidebar {
      width: 210px;
    }
    .knowledge-content {
      padding: 30px 24px 100px;
    }
    .upload-grid {
      gap: 20px;
    }
    .stats > div {
      padding: 16px;
    }
    .scope-note small {
      width: 100%;
      margin: 0;
    }
  }
  @media (max-width: 700px) {
    .knowledge-app {
      flex-direction: column;
    }
    .knowledge-sidebar {
      width: auto;
      padding: 12px 16px;
      border-right: 0;
      border-bottom: 1px solid var(--kb-border);
    }
    .brand,
    .sidebar-empty {
      display: none;
    }
    .sidebar-title {
      padding: 0 0 6px;
    }
    .knowledge-sidebar nav {
      display: flex;
      gap: 8px;
      overflow: auto;
    }
    .base-item {
      width: auto;
      flex-shrink: 0;
      padding: 8px;
    }
    .base-item small {
      display: none;
    }
    .sidebar-bottom {
      padding: 8px 0 0;
      border: 0;
      font-size: 12px;
    }
    .knowledge-header {
      height: 54px;
      padding: 0 20px;
    }
    .knowledge-content {
      padding: 26px 18px 100px;
    }
    .page-heading {
      align-items: flex-start;
    }
    h1 {
      font-size: 24px;
    }
    .page-heading p {
      font-size: 12px;
    }
    .stats {
      gap: 8px;
    }
    .stats > div {
      padding: 12px;
    }
    .stats strong {
      font-size: 24px;
    }
    .stats .format {
      font-size: 13px;
    }
    .stats span {
      font-size: 10px;
    }
    .upload-grid {
      grid-template-columns: 1fr;
    }
    .upload-card {
      padding: 18px;
    }
    .dropzone {
      min-height: 150px;
    }
    .section-heading > span {
      font-size: 10px;
    }
    .search {
      width: 160px;
    }
    .scope-note {
      gap: 8px;
    }
    .modal {
      padding: 22px;
    }
  }
</style>
