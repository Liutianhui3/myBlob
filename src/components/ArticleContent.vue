<script setup lang="ts">
  import { computed } from 'vue'
  import DOMPurify from 'dompurify'
  const props = defineProps<{ content: string }>()
  const html = computed(() =>
    DOMPurify.sanitize(props.content, {
      ALLOWED_TAGS: [
        'p',
        'br',
        'h2',
        'h3',
        'h4',
        'strong',
        'em',
        's',
        'u',
        'ul',
        'ol',
        'li',
        'blockquote',
        'pre',
        'code',
        'a',
        'img',
        'hr'
      ],
      ALLOWED_ATTR: ['href', 'src', 'alt', 'title', 'target', 'rel', 'class', 'start']
    })
  )
</script>
<template><div class="article-prose" v-html="html" /></template>
<style>
  .article-prose {
    font-size: 16px;
    line-height: 1.9;
    overflow-wrap: anywhere;
  }
  .article-prose p {
    margin: 0 0 1em;
  }
  .article-prose h2 {
    font-size: 26px;
    margin: 1.6em 0 0.6em;
    font-weight: 700;
    line-height: 1.5;
  }
  .article-prose h3,
  .article-prose h4 {
    font-size: 20px;
    margin: 1.4em 0 0.5em;
    font-weight: 650;
  }
  .article-prose ul,
  .article-prose ol {
    list-style: revert;
    padding-left: 1.5em;
    margin: 1em 0;
  }
  .article-prose blockquote {
    border-left: 3px solid var(--article-accent, #514def);
    margin: 1.4em 0;
    padding: 0.5em 1em;
    color: var(--article-muted, #757486);
    background: var(--article-soft, #f6f5ff);
  }
  .article-prose pre {
    border-radius: 10px;
    padding: 18px;
    overflow-x: auto;
    background: var(--article-soft, #f6f5ff);
  }
  .article-prose code {
    font-family: Consolas, monospace;
    font-size: 0.88em;
  }
  .article-prose a {
    color: var(--article-accent, #514def);
    text-decoration: underline;
    text-underline-offset: 3px;
  }
  .article-prose img {
    max-width: 100%;
    height: auto;
    border-radius: 10px;
    margin: 16px auto;
  }
  .article-prose hr {
    border: 0;
    border-top: 1px solid var(--article-border, #eae9f1);
    margin: 28px 0;
  }
</style>
