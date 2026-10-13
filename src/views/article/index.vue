<script setup lang="ts">
  import { onMounted, onUnmounted, ref } from 'vue'
  import { currentUser } from '@/lib/auth'
  import { Icon } from '@iconify/vue'
  import BentoGrid from '@/components/BentoGrid/BentoGrid.vue'
  import BentoGridItem from '@/components/BentoGrid/BentoGridItem.vue'
  import BlurReveal from '@/components/BlurReveal.vue'
  import { listArticles, type Article } from '@/api/articles'
  const items = ref<Article[]>([])
  const page = ref(1)
  const total = ref(0)
  const loading = ref(true)
  const error = ref('')
  const pageSize = 6
  let controller: AbortController | undefined
  async function load(next = page.value) {
    controller?.abort()
    const current = new AbortController()
    controller = current
    loading.value = true
    error.value = ''
    try {
      const result = await listArticles({ page: next, limit: pageSize }, false, current.signal)
      if (current.signal.aborted) return
      if (!result.items.length && next > 1) {
        await load(Math.max(1, Math.ceil(result.total / pageSize)))
        return
      }
      items.value = result.items
      total.value = result.total
      page.value = next
    } catch (e) {
      if (!current.signal.aborted)
        error.value = e instanceof Error ? e.message : '文章加载失败，请重试'
    } finally {
      if (!current.signal.aborted) loading.value = false
    }
  }
  onMounted(() => load())
  onUnmounted(() => controller?.abort())
</script>
<template>
  <div class="article-bento-page container max-w-screen-xl mx-auto px-4 md:px-6 py-4">
    <p v-if="error" class="bento-state" role="alert">
      {{ error }}
      <button @click="load()">重新加载</button>
    </p>
    <p v-else-if="loading" class="bento-state" role="status">正在加载文章…</p>
    <p v-else-if="!items.length" class="bento-state">
      还没有已发布的文章。
      <RouterLink v-if="currentUser?.isAdmin === true" to="/articleManage">去写第一篇</RouterLink>
    </p>
    <BlurReveal v-else class="bento-reveal" :key="page" :delay="0.2" :duration="0.4">
      <BentoGrid
        class="bento-grid mx-auto max-w-screen"
        :style="{ '--bento-rows': Math.ceil(items.length / 2) }"
      >
        <RouterLink
          v-for="item in items"
          :key="item.id"
          :to="`/article/${item.id}`"
          class="bento-article-link md:col-span-2"
          :aria-label="`阅读：${item.title}`"
        >
          <BentoGridItem class="bento-card h-full">
            <template #header>
              <div class="flex size-full space-x-4 bento-cover">
                <div
                  class="flex size-full flex-1 rounded-md bg-zinc-800 text-white bento-cover-content"
                >
                  <img
                    v-if="item.coverUrl"
                    :src="item.coverUrl"
                    alt=""
                    loading="lazy"
                    referrerpolicy="no-referrer"
                    @error="($event.target as HTMLImageElement).style.display = 'none'"
                  />
                  <span v-else class="bento-cover-category">
                    <Icon icon="lucide:book-open" />
                    {{ item.category }}
                  </span>
                </div>
              </div>
            </template>
            <template #title>
              <strong>{{ item.title }}</strong>
            </template>
            <template #icon></template>
            <template #description>
              <p class="bento-summary">{{ item.summary }}</p>
            </template>
          </BentoGridItem>
        </RouterLink>
      </BentoGrid>
    </BlurReveal>
    <nav v-if="!error && total > 0" class="bento-pagination" aria-label="文章分页">
      <button
        v-if="page > 1"
        type="button"
        class="page-arrow page-arrow-left"
        :disabled="loading"
        aria-label="上一页文章"
        title="上一页"
        @click="load(page - 1)"
      >
        <Icon icon="lucide:chevron-left" />
      </button>
      <button
        v-if="page * pageSize < total"
        type="button"
        class="page-arrow page-arrow-right"
        :disabled="loading"
        aria-label="下一页文章"
        title="下一页"
        @click="load(page + 1)"
      >
        <Icon icon="lucide:chevron-right" />
      </button>
    </nav>
  </div>
</template>
<style scoped>
  .article-bento-page {
    position: relative;
    z-index: 1;
    height: 100dvh;
    padding-top: 48px;
    padding-bottom: 48px;
  }
  .bento-reveal,
  .bento-reveal :deep(> div) {
    height: 100%;
    min-height: 0;
  }
  .bento-reveal :deep(.bento-grid) {
    height: 100%;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    grid-template-rows: repeat(var(--bento-rows, 3), minmax(0, calc((100% - 32px) / 3)));
    align-content: center;
  }
  .bento-reveal :deep(.bento-card) {
    min-height: 0;
    padding: clamp(8px, 1.5vh, 16px);
    gap: 8px;
  }
  .bento-reveal :deep(.bento-card > div:last-child) {
    flex-shrink: 0;
  }
  .bento-article-link:last-child:nth-child(odd) {
    grid-column: 2 / span 2;
  }
  .bento-article-link {
    grid-column: span 2;
    min-width: 0;
    min-height: 0;
    text-decoration: none;
    display: block;
  }
  .bento-article-link:focus-visible {
    outline: 2px solid #514def;
    outline-offset: 4px;
    border-radius: 12px;
  }
  .bento-cover {
    min-height: 0;
    flex: 1;
    overflow: hidden;
  }
  .bento-cover-content {
    align-items: center;
    justify-content: center;
    overflow: hidden;
  }
  .bento-cover img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  .bento-cover-category {
    display: flex;
    gap: 10px;
    align-items: center;
    color: #d4d4d8;
    font-size: 13px;
  }
  .bento-cover-category svg {
    width: 20px;
    height: 20px;
  }
  .bento-summary {
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
    overflow-wrap: anywhere;
  }
  .bento-article-link strong {
    display: -webkit-box;
    -webkit-line-clamp: 1;
    -webkit-box-orient: vertical;
    overflow: hidden;
    overflow-wrap: anywhere;
  }
  .bento-pagination {
    display: contents;
  }
  .bento-pagination button {
    position: fixed;
    top: 50%;
    transform: translateY(-50%);
    z-index: 5;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 44px;
    height: 44px;
    padding: 0;
    border: 1px solid #e4e4e7;
    border-radius: 50%;
    background: white;
    cursor: pointer;
    color: #514def;
  }
  .page-arrow-left {
    left: 24px;
  }
  .page-arrow-right {
    right: 24px;
  }
  .bento-pagination button svg {
    width: 24px;
    height: 24px;
  }
  .bento-pagination button:hover:not(:disabled) {
    background: #f3f2ff;
    border-color: #514def;
  }
  @media (max-width: 1400px) {
    .article-bento-page {
      width: calc(100% - 128px);
    }
  }
  @media (max-width: 650px) {
    .article-bento-page {
      width: calc(100% - 64px);
      padding-left: 4px;
      padding-right: 4px;
    }
    .page-arrow-left {
      left: 4px;
    }
    .page-arrow-right {
      right: 4px;
    }
    .bento-pagination button {
      width: 30px;
      height: 40px;
      border-radius: 8px;
    }
  }
  .bento-pagination button:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
  .bento-pagination button:focus-visible {
    outline: 2px solid #514def;
    outline-offset: 3px;
  }
  .bento-state {
    padding: 70px 20px;
    text-align: center;
    color: #71717a;
  }
  .bento-state :is(button, a) {
    margin-left: 12px;
    color: #514def;
    text-decoration: underline;
  }
  :global(.dark .bento-pagination button) {
    background: #18181b;
    border-color: #3f3f46;
    color: #d4d4d8;
  }
</style>
