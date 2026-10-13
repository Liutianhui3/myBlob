<script setup lang="ts">
  import { computed, nextTick, onMounted, onUnmounted, reactive, ref, watch } from 'vue'
  import { onBeforeRouteLeave } from 'vue-router'
  import { Icon } from '@iconify/vue'
  import {
    listArticles,
    getArticle,
    createArticle,
    updateArticle,
    deleteArticle,
    articleDate,
    type Article,
    type ArticleInput
  } from '@/api/articles'
  import ArticleEditor from '@/components/ArticleEditor.vue'
  import ArticleContent from '@/components/ArticleContent.vue'
  import '@/assets/styles/articles.css'
  const items = ref<Article[]>([])
  const total = ref(0)
  const page = ref(1)
  const q = ref('')
  const filter = ref('')
  const loading = ref(false)
  const opening = ref(false)
  const saving = ref(false)
  const error = ref('')
  const listError = ref('')
  const notice = ref('')
  const selected = ref<Article>()
  const mode = ref<'edit' | 'preview'>('edit')
  const tagText = ref('')
  const dialog = ref<HTMLDialogElement>()
  const deleting = ref(false)
  const empty = () => ({
    title: '',
    summary: '',
    content: '<p></p>',
    category: '随笔',
    coverUrl: '',
    status: 'draft' as 'draft' | 'published'
  })
  const draft = reactive(empty())
  const snapshot = () => JSON.stringify({ ...draft, tagText: tagText.value })
  const baseline = ref(snapshot())
  const dirty = computed(() => baseline.value !== snapshot())
  const wordCount = computed(() => {
    const div = document.createElement('div')
    div.innerHTML = draft.content
    return (div.textContent || '').replace(/\s/g, '').length
  })
  let listController: AbortController | undefined
  let editController: AbortController | undefined
  const busy = computed(() => saving.value || opening.value || deleting.value)
  async function loadList() {
    listController?.abort()
    const current = new AbortController()
    listController = current
    loading.value = true
    listError.value = ''
    try {
      const result = await listArticles(
        { page: page.value, limit: 10, q: q.value, status: filter.value },
        true,
        current.signal
      )
      if (current.signal.aborted) return
      if (!result.items.length && page.value > 1) {
        page.value--
        await loadList()
        return
      }
      items.value = result.items
      total.value = result.total
    } catch (e) {
      if (!current.signal.aborted) listError.value = e instanceof Error ? e.message : '列表加载失败'
    } finally {
      if (!current.signal.aborted) loading.value = false
    }
  }
  function canDiscard() {
    return !dirty.value || window.confirm('有尚未保存的修改，确定放弃吗？')
  }
  function apply(article?: Article) {
    selected.value = article
    Object.assign(
      draft,
      article
        ? {
            title: article.title,
            summary: article.summary,
            content: article.content || '<p></p>',
            category: article.category,
            coverUrl: article.coverUrl,
            status: article.status
          }
        : empty()
    )
    tagText.value = article?.tags.join('，') || ''
    baseline.value = snapshot()
    mode.value = 'edit'
  }
  function newArticle() {
    if (busy.value || !canDiscard()) return
    editController?.abort()
    apply()
    error.value = ''
    notice.value = ''
  }
  async function openArticle(id: string) {
    if (busy.value || !canDiscard()) return
    editController?.abort()
    const current = new AbortController()
    editController = current
    opening.value = true
    error.value = ''
    notice.value = ''
    try {
      const result = await getArticle(id, true, current.signal)
      if (!current.signal.aborted) apply(result)
    } catch (e) {
      if (!current.signal.aborted) error.value = e instanceof Error ? e.message : '文章加载失败'
    } finally {
      if (!current.signal.aborted) opening.value = false
    }
  }
  async function save(status: 'draft' | 'published') {
    if (busy.value) return
    error.value = ''
    notice.value = ''
    if (!draft.title.trim()) {
      error.value = '请先填写文章标题'
      await nextTick()
      document.getElementById('article-title')?.focus()
      return
    }
    const tags = [
      ...new Set(
        tagText.value
          .split(/[,，]/)
          .map(tag => tag.trim())
          .filter(Boolean)
      )
    ]
    if (tags.length > 8 || tags.some(tag => tag.length > 24)) {
      error.value = '标签最多 8 个，每个不超过 24 字'
      return
    }
    if (draft.content.length > 200000) {
      error.value = '正文过长，请缩短后保存'
      return
    }
    saving.value = true
    try {
      const payload: ArticleInput = { ...draft, tags, status }
      if (selected.value) payload.version = selected.value.version
      const result = selected.value
        ? await updateArticle(selected.value.id, payload)
        : await createArticle(payload)
      apply(result)
      notice.value = status === 'published' ? '文章已发布，阅读页已同步。' : '草稿已保存。'
      await loadList()
    } catch (e) {
      error.value = e instanceof Error ? e.message : '保存失败，请重试'
    } finally {
      saving.value = false
    }
  }
  async function remove() {
    if (!selected.value || busy.value) return
    const id = selected.value.id
    deleting.value = true
    error.value = ''
    try {
      await deleteArticle(id)
      dialog.value?.close()
      apply()
      notice.value = '文章已删除。'
      await loadList()
    } catch (e) {
      dialog.value?.close()
      error.value = e instanceof Error ? e.message : '删除失败，请重试'
    } finally {
      deleting.value = false
    }
  }
  function search() {
    page.value = 1
    loadList()
  }
  function paginate(value: number) {
    page.value = value
    loadList()
  }
  function beforeUnload(event: BeforeUnloadEvent) {
    if (dirty.value || saving.value) {
      event.preventDefault()
      event.returnValue = ''
    }
  }
  onBeforeRouteLeave(() => (saving.value || deleting.value ? false : canDiscard()))
  onMounted(() => {
    loadList()
    window.addEventListener('beforeunload', beforeUnload)
  })
  onUnmounted(() => {
    listController?.abort()
    editController?.abort()
    window.removeEventListener('beforeunload', beforeUnload)
  })
  watch(filter, search)
</script>
<template>
  <main class="article-workspace article-manage">
    <header class="article-header">
      <RouterLink class="article-brand" to="/article">
        <Icon icon="lucide:notebook-pen" />
        myBlob
        <span class="brand-divider">/ 写作空间</span>
      </RouterLink>
      <nav class="article-navigation" aria-label="文章导航">
        <RouterLink to="/article">阅读文章</RouterLink>
        <RouterLink to="/articleManage">文章管理</RouterLink>
      </nav>
    </header>
    <section class="manage-intro">
      <div>
        <p class="article-eyebrow">Your writing desk</p>
        <h1>文章管理</h1>
        <p class="article-subtitle">从草稿到发布，让每一个想法都有自己的位置。</p>
      </div>
      <button class="article-primary" :disabled="busy" @click="newArticle">
        <Icon icon="lucide:plus" />
        新建文章
      </button>
    </section>
    <div class="manage-layout">
      <aside class="article-library" aria-label="全部文章">
        <div class="library-heading">
          <strong>全部文章</strong>
          <span>{{ total }} 篇</span>
        </div>
        <form class="article-search" @submit.prevent="search">
          <Icon icon="lucide:search" />
          <input
            v-model="q"
            aria-label="搜索全部文章"
            placeholder="搜索标题或摘要…"
            maxlength="100"
          />
          <button type="submit" aria-label="执行文章搜索">
            <Icon icon="lucide:arrow-right" />
          </button>
        </form>
        <div class="library-tabs" role="group" aria-label="文章状态筛选">
          <button
            v-for="tab in [
              { label: '全部', value: '' },
              { label: '草稿', value: 'draft' },
              { label: '已发布', value: 'published' }
            ]"
            :key="tab.value"
            :aria-pressed="filter === tab.value"
            @click="filter = tab.value"
          >
            {{ tab.label }}
          </button>
        </div>
        <div v-if="listError" class="article-error" role="alert">
          {{ listError }}
          <button @click="loadList">重试</button>
        </div>
        <p v-else-if="loading" class="library-empty" role="status">正在加载…</p>
        <p v-else-if="!items.length" class="library-empty">
          {{ q || filter ? '没有匹配的文章。' : '还没有文章，开始第一篇吧。' }}
        </p>
        <div v-else class="library-list">
          <button
            v-for="item in items"
            :key="item.id"
            class="library-item"
            :class="{ selected: selected?.id === item.id }"
            :aria-current="selected?.id === item.id ? 'true' : undefined"
            :disabled="busy"
            @click="openArticle(item.id)"
          >
            <span class="item-meta">
              <span class="status-dot" :class="item.status">
                {{ item.status === 'published' ? '已发布' : '草稿' }}
              </span>
              <span>{{ articleDate(item.updatedAt) }}</span>
            </span>
            <strong>{{ item.title }}</strong>
            <span class="item-summary">{{ item.summary || '还没有摘要' }}</span>
            <span class="item-category">{{ item.category }}</span>
          </button>
        </div>
        <div v-if="total > 10" class="article-pagination">
          <button
            class="article-secondary"
            :disabled="loading || page === 1"
            @click="paginate(page - 1)"
          >
            上一页
          </button>
          <span>{{ page }}/{{ Math.ceil(total / 10) }}</span>
          <button
            class="article-secondary"
            :disabled="loading || page * 10 >= total"
            @click="paginate(page + 1)"
          >
            下一页
          </button>
        </div>
        <div class="library-note">
          <Icon icon="lucide:lock-keyhole" />
          <span>
            管理员可以维护所有文章。
            <br />
            草稿不会出现在阅读页。
          </span>
        </div>
      </aside>
      <section class="writing-panel" aria-label="文章编辑区" :aria-busy="busy">
        <header class="writing-header">
          <div>
            <span class="writing-label">{{ selected ? '编辑文章' : '新建文章' }}</span>
            <span class="save-indicator">
              {{ saving ? '正在保存…' : dirty ? '尚未保存' : selected ? '已保存' : '等待落笔' }}
            </span>
          </div>
          <div class="editor-mode" role="group" aria-label="编辑模式">
            <button :aria-pressed="mode === 'edit'" @click="mode = 'edit'">编辑</button>
            <button :aria-pressed="mode === 'preview'" @click="mode = 'preview'">预览</button>
          </div>
        </header>
        <div v-if="error" class="article-error" role="alert">
          {{ error }}
          <button v-if="selected" :disabled="busy" @click="openArticle(selected.id)">
            重新加载文章
          </button>
        </div>
        <p v-if="notice" class="save-notice" role="status">
          <Icon icon="lucide:check-circle-2" />
          {{ notice }}
        </p>
        <div v-if="opening" class="article-empty" role="status">正在打开文章…</div>
        <template v-else>
          <fieldset v-show="mode === 'edit'" :disabled="busy" class="writing-form">
            <label class="title-label" for="article-title">文章标题</label>
            <input
              id="article-title"
              v-model="draft.title"
              class="title-input"
              maxlength="160"
              placeholder="给这个想法，一个标题"
            />
            <div class="metadata-row">
              <label>
                分类
                <input v-model="draft.category" maxlength="40" placeholder="随笔" />
              </label>
              <label>
                标签
                <span class="field-help">用逗号分隔，最多 8 个</span>
                <input v-model="tagText" maxlength="220" placeholder="前端，设计，生活" />
              </label>
            </div>
            <label class="field-label">
              摘要
              <span class="field-help">留空时从正文自动生成</span>
              <textarea
                v-model="draft.summary"
                maxlength="300"
                rows="2"
                placeholder="用几句话，告诉读者这篇文章关于什么…"
              />
            </label>
            <label class="field-label cover-field">
              封面图片
              <span class="field-help">可选，填写 HTTPS 图片地址</span>
              <input v-model="draft.coverUrl" maxlength="2000" type="url" placeholder="https://…" />
            </label>
            <div class="body-label">
              <label>正文</label>
              <span>{{ wordCount }} 字</span>
            </div>
            <ArticleEditor v-model="draft.content" :disabled="busy" />
          </fieldset>
          <article v-if="mode === 'preview'" class="writing-preview">
            <span class="article-tag">{{ draft.category || '随笔' }}</span>
            <h1>{{ draft.title || '未命名文章' }}</h1>
            <p v-if="draft.summary" class="preview-summary">{{ draft.summary }}</p>
            <img
              v-if="draft.coverUrl && draft.coverUrl.startsWith('https://')"
              :src="draft.coverUrl"
              alt="封面预览"
              referrerpolicy="no-referrer"
              @error="($event.target as HTMLImageElement).style.display = 'none'"
            />
            <ArticleContent :content="draft.content" />
          </article>
          <footer class="writing-footer">
            <div>
              <button
                v-if="selected"
                class="delete-link"
                :disabled="busy"
                @click="dialog?.showModal()"
              >
                <Icon icon="lucide:trash-2" />
                删除文章
              </button>
              <RouterLink
                v-if="selected?.status === 'published'"
                class="published-link"
                :to="`/article/${selected.id}`"
              >
                查看已发布文章
                <Icon icon="lucide:arrow-up-right" />
              </RouterLink>
            </div>
            <div class="save-actions">
              <button class="article-secondary" :disabled="busy" @click="save('draft')">
                {{ selected?.status === 'published' ? '撤回为草稿' : '保存草稿' }}
              </button>
              <button class="article-primary" :disabled="busy" @click="save('published')">
                <Icon icon="lucide:send" />
                {{ selected?.status === 'published' ? '更新文章' : '发布文章' }}
              </button>
            </div>
          </footer>
        </template>
      </section>
    </div>
    <dialog ref="dialog" class="delete-dialog" @cancel="deleting && $event.preventDefault()">
      <h2>删除这篇文章？</h2>
      <p>「{{ selected?.title }}」将永久删除，无法恢复。</p>
      <div>
        <button class="article-secondary" :disabled="deleting" @click="dialog?.close()">
          保留文章
        </button>
        <button class="article-primary danger" :disabled="deleting" @click="remove">
          {{ deleting ? '正在删除…' : '确认删除' }}
        </button>
      </div>
    </dialog>
  </main>
</template>
<style scoped>
  .brand-divider {
    color: var(--article-muted);
    font-weight: 400;
    font-size: 13px;
    margin-left: 5px;
  }
  .manage-intro {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 24px;
    margin: 42px 0 30px;
  }
  .manage-intro h1 {
    font-size: 32px;
  }
  .manage-layout {
    display: grid;
    grid-template-columns: 300px minmax(0, 1fr);
    gap: 24px;
    align-items: start;
  }
  .article-library {
    padding: 22px 16px;
    border: 1px solid var(--article-border);
    border-radius: 14px;
    background: var(--article-surface);
  }
  .library-heading {
    display: flex;
    justify-content: space-between;
    margin: 0 4px 20px;
    font-size: 15px;
  }
  .library-heading span {
    color: var(--article-muted);
    font-size: 12px;
  }
  .library-tabs {
    display: flex;
    gap: 6px;
    margin: 18px 0;
  }
  .library-tabs button {
    flex: 1;
    padding: 7px;
    border-radius: 7px;
    color: var(--article-muted);
    background: transparent;
    font-size: 12px;
  }
  .library-tabs button[aria-pressed='true'] {
    color: var(--article-accent);
    background: var(--article-soft);
    font-weight: 650;
  }
  .article-search button {
    background: transparent;
    padding: 5px;
  }
  .library-item {
    display: flex;
    flex-direction: column;
    width: 100%;
    text-align: left;
    padding: 17px 12px;
    border-radius: 9px;
    background: transparent;
    color: var(--article-text);
    border: 1px solid transparent;
    margin-bottom: 6px;
  }
  .library-item.selected {
    background: var(--article-soft);
    border-color: var(--article-accent);
  }
  .library-item:hover:not(:disabled) {
    background: var(--article-soft);
  }
  .item-meta {
    display: flex;
    justify-content: space-between;
    gap: 6px;
    color: var(--article-muted);
    font-size: 10px;
    margin-bottom: 10px;
  }
  .status-dot.published {
    color: #208268;
  }
  .library-item strong {
    font-size: 14px;
    line-height: 1.6;
    margin-bottom: 8px;
    overflow-wrap: anywhere;
  }
  .item-summary {
    color: var(--article-muted);
    font-size: 12px;
    overflow: hidden;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    line-height: 1.6;
  }
  .item-category {
    color: var(--article-muted);
    font-size: 10px;
    margin-top: 10px;
  }
  .library-empty {
    padding: 32px 10px;
    color: var(--article-muted);
    line-height: 1.8;
    font-size: 13px;
  }
  .library-note {
    display: flex;
    gap: 10px;
    align-items: flex-start;
    border-top: 1px solid var(--article-border);
    padding: 20px 4px 0;
    margin-top: 24px;
    font-size: 11px;
    line-height: 1.8;
    color: var(--article-muted);
  }
  .library-note svg {
    flex-shrink: 0;
    width: 15px;
    margin-top: 3px;
  }
  .article-library .article-pagination {
    gap: 6px;
    font-size: 10px;
  }
  .article-library .article-pagination button {
    font-size: 11px;
    padding: 8px;
  }
  .writing-panel {
    min-width: 0;
    padding: 24px 30px;
    background: var(--article-surface);
    border: 1px solid var(--article-border);
    border-radius: 14px;
  }
  .writing-header {
    display: flex;
    justify-content: space-between;
    gap: 16px;
    align-items: center;
    border-bottom: 1px solid var(--article-border);
    padding-bottom: 22px;
    margin-bottom: 28px;
  }
  .writing-label {
    font-weight: 650;
    font-size: 14px;
  }
  .save-indicator {
    color: var(--article-muted);
    font-size: 11px;
    margin-left: 12px;
  }
  .editor-mode {
    display: flex;
    padding: 3px;
    border-radius: 8px;
    background: var(--article-soft);
  }
  .editor-mode button {
    padding: 6px 14px;
    font-size: 12px;
    background: transparent;
    color: var(--article-muted);
    border-radius: 6px;
  }
  .editor-mode button[aria-pressed='true'] {
    color: var(--article-accent);
    background: var(--article-surface);
  }
  .writing-form {
    border: 0;
    padding: 0;
    margin: 0;
    min-width: 0;
  }
  .title-label {
    display: block;
    font-size: 12px;
    font-weight: 600;
    margin-bottom: 12px;
  }
  .title-input {
    width: 100%;
    font-size: 28px !important;
    font-weight: 650;
    background: transparent;
    border: 0;
    padding: 0 0 22px;
    border-bottom: 1px solid var(--article-border);
    color: var(--article-text);
    border-radius: 0;
  }
  .title-input::placeholder {
    color: var(--article-muted);
    font-weight: 400;
  }
  .metadata-row {
    display: grid;
    grid-template-columns: 1fr 2fr;
    gap: 16px;
    margin: 24px 0 20px;
  }
  .metadata-row label,
  .field-label {
    font-size: 12px;
    font-weight: 600;
    display: block;
  }
  .field-help {
    font-size: 10px;
    font-weight: 400;
    color: var(--article-muted);
    margin-left: 8px;
  }
  .writing-form label > :is(input, textarea) {
    display: block;
    width: 100%;
    margin-top: 8px;
    padding: 10px 12px;
    background: var(--article-surface);
    border: 1px solid var(--article-border);
    border-radius: 8px;
    font-weight: 400;
    color: var(--article-text);
    font-size: 13px;
  }
  .writing-form textarea {
    resize: vertical;
    line-height: 1.8;
  }
  .cover-field {
    margin-top: 20px;
  }
  .body-label {
    display: flex;
    justify-content: space-between;
    margin: 24px 0 10px;
    font-size: 12px;
    font-weight: 600;
  }
  .body-label span {
    color: var(--article-muted);
    font-weight: 400;
  }
  .writing-footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 16px;
    margin-top: 24px;
    border-top: 1px solid var(--article-border);
    padding-top: 24px;
  }
  .writing-footer > div {
    display: flex;
    gap: 12px;
    flex-wrap: wrap;
  }
  .delete-link,
  .published-link {
    display: flex;
    align-items: center;
    gap: 5px;
    font-size: 11px !important;
    padding: 5px 0;
    background: transparent;
    color: var(--article-muted);
  }
  .delete-link {
    color: #c13d58;
  }
  .delete-link svg,
  .published-link svg {
    width: 14px;
    height: 14px;
  }
  .save-notice {
    display: flex;
    align-items: center;
    gap: 8px;
    color: #208268;
    background: var(--article-soft);
    padding: 12px;
    border-radius: 8px;
    margin-bottom: 20px;
  }
  .writing-preview {
    min-height: 560px;
    padding: 20px 8px;
  }
  .writing-preview h1 {
    margin: 18px 0 24px;
    overflow-wrap: anywhere;
  }
  .preview-summary {
    color: var(--article-muted);
    line-height: 1.8;
    margin-bottom: 28px;
  }
  .writing-preview > img {
    width: 100%;
    border-radius: 10px;
    margin-bottom: 24px;
  }
  .delete-dialog {
    background: var(--article-surface);
    color: var(--article-text);
    border: 1px solid var(--article-border);
    border-radius: 16px;
    max-width: min(440px, calc(100vw - 32px));
    padding: 28px;
    margin: auto;
  }
  .delete-dialog::backdrop {
    background: rgba(15, 14, 30, 0.45);
  }
  .delete-dialog h2 {
    font-size: 20px;
    font-weight: 700;
  }
  .delete-dialog p {
    line-height: 1.8;
    color: var(--article-muted);
    margin: 16px 0 24px;
    overflow-wrap: anywhere;
  }
  .delete-dialog > div {
    display: flex;
    justify-content: end;
    gap: 12px;
  }
  .delete-dialog .danger {
    background: #bc3550;
    border-color: #bc3550;
  }
  @media (max-width: 1000px) {
    .manage-layout {
      grid-template-columns: 250px minmax(0, 1fr);
      gap: 16px;
    }
    .writing-panel {
      padding: 22px;
    }
    .writing-footer {
      flex-direction: column;
      align-items: stretch;
    }
    .writing-footer .save-actions {
      justify-content: end;
    }
  }
  @media (max-width: 720px) {
    .manage-layout {
      grid-template-columns: 1fr;
    }
    .manage-intro {
      margin-top: 20px;
      align-items: start;
    }
    .article-library {
      padding: 18px 14px;
    }
    .library-list {
      max-height: 290px;
      overflow-y: auto;
    }
    .library-note {
      display: none;
    }
    .writing-panel {
      padding: 20px 16px;
    }
    .title-input {
      font-size: 23px !important;
    }
    .metadata-row {
      grid-template-columns: 1fr;
    }
    .writing-header {
      gap: 8px;
    }
    .save-indicator {
      display: block;
      margin: 4px 0 0;
    }
    .field-help {
      display: inline-block;
    }
  }
</style>
