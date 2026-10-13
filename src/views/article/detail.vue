<script setup lang="ts">
  import { onUnmounted, ref, watch } from 'vue'
  import { useRoute } from 'vue-router'
  import { currentUser } from '@/lib/auth'
  import { Icon } from '@iconify/vue'
  import { getArticle, articleDate, type Article } from '@/api/articles'
  import ArticleContent from '@/components/ArticleContent.vue'
  import '@/assets/styles/articles.css'
  const route = useRoute()
  const detail = ref<Article>()
  const loading = ref(true)
  const error = ref('')
  let controller: AbortController | undefined
  async function load() {
    controller?.abort()
    const current = new AbortController()
    controller = current
    loading.value = true
    error.value = ''
    detail.value = undefined
    try {
      const result = await getArticle(String(route.params.id), false, current.signal)
      if (!current.signal.aborted) detail.value = result
    } catch (e) {
      if (!current.signal.aborted) error.value = e instanceof Error ? e.message : '文章加载失败'
    } finally {
      if (!current.signal.aborted) loading.value = false
    }
  }
  watch(() => route.params.id, load, { immediate: true })
  onUnmounted(() => controller?.abort())
</script>
<template>
  <main class="article-workspace">
    <header class="article-header">
      <RouterLink class="article-brand" to="/article">
        <Icon icon="lucide:notebook-pen" />
        myBlob
        <span class="brand-divider">/ 文章</span>
      </RouterLink>
      <nav class="article-navigation" aria-label="文章导航">
        <RouterLink to="/article">阅读文章</RouterLink>
        <RouterLink v-if="currentUser?.isAdmin === true" to="/articleManage">文章管理</RouterLink>
      </nav>
    </header>
    <RouterLink class="reader-back" to="/article">
      <Icon icon="lucide:arrow-left" />
      返回文章列表
    </RouterLink>
    <div v-if="error" class="article-error" role="alert">
      {{ error }}
      <button @click="load">重新加载</button>
    </div>
    <div v-else-if="loading" class="article-empty" role="status">正在加载文章…</div>
    <article v-else-if="detail" class="reader-paper">
      <span class="article-tag">{{ detail.category }}</span>
      <h1>{{ detail.title }}</h1>
      <div class="reader-meta">
        <span>{{ detail.authorName }}</span>
        <span>{{ articleDate(detail.publishedAt) }}</span>
      </div>
      <p v-if="detail.summary" class="reader-summary">{{ detail.summary }}</p>
      <img
        v-if="detail.coverUrl"
        class="reader-cover"
        :src="detail.coverUrl"
        alt="文章封面"
        referrerpolicy="no-referrer"
        @error="($event.target as HTMLImageElement).style.display = 'none'"
      />
      <ArticleContent :content="detail.content || ''" />
      <footer v-if="detail.tags.length" class="reader-tags">
        <span v-for="tag in detail.tags" :key="tag" class="article-tag">{{ tag }}</span>
      </footer>
    </article>
  </main>
</template>
<style scoped>
  .brand-divider {
    color: var(--article-muted);
    font-weight: 400;
    font-size: 13px;
    margin-left: 5px;
  }
  .reader-back {
    display: inline-flex;
    gap: 8px;
    align-items: center;
    margin: 10px 0 28px;
    color: var(--article-muted);
  }
  .reader-paper {
    max-width: 860px;
    margin: auto;
    background: var(--article-surface);
    border: 1px solid var(--article-border);
    border-radius: 16px;
    padding: 48px 60px;
  }
  .reader-paper h1 {
    margin-top: 20px;
    overflow-wrap: anywhere;
  }
  .reader-meta {
    display: flex;
    gap: 18px;
    margin: 18px 0 28px;
    color: var(--article-muted);
    font-size: 12px;
  }
  .reader-summary {
    font-size: 16px;
    line-height: 1.8;
    padding-bottom: 28px;
    margin-bottom: 28px;
    border-bottom: 1px solid var(--article-border);
    color: var(--article-muted);
  }
  .reader-cover {
    width: 100%;
    border-radius: 10px;
    margin-bottom: 32px;
  }
  .reader-tags {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
    padding-top: 24px;
    border-top: 1px solid var(--article-border);
    margin-top: 32px;
  }

  @media (max-width: 650px) {
    .reader-paper {
      padding: 28px 20px;
    }
  }
</style>
