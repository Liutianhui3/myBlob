<script setup lang="ts">
  import { ref } from 'vue'
  import ChatMarkdown from './ChatMarkdown.vue'

  const props = defineProps<{ content: string; analyzing: boolean; status: string }>()
  const copied = ref(false)
  const copyError = ref(false)
  async function copy() {
    try {
      await navigator.clipboard.writeText(props.content)
      copied.value = true
      copyError.value = false
      setTimeout(() => (copied.value = false), 1800)
    } catch {
      copyError.value = true
    }
  }
</script>

<template>
  <details class="chat-reasoning">
    <summary>
      <span :class="{ 'analysis-active': analyzing }">
        {{
          analyzing
            ? '正在分析'
            : status === 'failed' || status === 'cancelled'
              ? '分析已中断'
              : '已分析'
        }}
      </span>
      <svg
        class="analysis-chevron"
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden="true"
      >
        <path
          d="m9 5 7 7-7 7"
          stroke="currentColor"
          stroke-width="1.6"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
      </svg>
    </summary>
    <section class="analysis-panel" aria-label="分析内容">
      <div class="analysis-toolbar">
        <span>分析内容</span>
        <button
          v-if="content"
          type="button"
          class="analysis-copy"
          :aria-label="copied ? '已复制' : '复制分析内容'"
          @click="copy"
        >
          <svg
            v-if="!copied"
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden="true"
          >
            <rect
              x="4"
              y="8"
              width="12"
              height="13"
              rx="3"
              stroke="currentColor"
              stroke-width="1.6"
            />
            <path
              d="M9 8V6a3 3 0 0 1 3-3h5a3 3 0 0 1 3 3v7a3 3 0 0 1-3 3h-1"
              stroke="currentColor"
              stroke-width="1.6"
            />
          </svg>
          <svg v-else width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="m5 12 4 4L19 6"
              stroke="currentColor"
              stroke-width="1.6"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
        </button>
      </div>
      <ChatMarkdown v-if="content" class="analysis-body" :content="content" />
      <p v-else class="analysis-empty">正在等待模型返回分析内容…</p>
      <p v-if="copyError" class="analysis-empty" role="alert">复制失败，请选择文字复制。</p>
    </section>
  </details>
</template>

<style scoped>
  .chat-reasoning {
    --analysis-surface: #efefef;
    --analysis-border: #e2e2e2;
    --analysis-label: #686868;
    --analysis-text: #323232;
    margin: 8px 0 20px;
    color: var(--analysis-label);
  }
  summary {
    display: flex;
    align-items: center;
    gap: 8px;
    width: fit-content;
    min-height: 32px;
    padding: 2px 0;
    cursor: pointer;
    list-style: none;
    font-size: 15px;
    font-weight: 400;
    line-height: 1.6;
  }
  summary::-webkit-details-marker {
    display: none;
  }
  summary:focus-visible,
  .analysis-copy:focus-visible {
    outline: 2px solid currentColor;
    outline-offset: 4px;
    border-radius: 4px;
  }
  .analysis-chevron {
    opacity: 0;
    flex-shrink: 0;
    transition:
      opacity 0.15s ease,
      transform 0.15s ease;
  }
  summary:hover .analysis-chevron,
  summary:focus-visible .analysis-chevron {
    opacity: 1;
  }
  details[open] .analysis-chevron {
    transform: rotate(90deg);
  }
  .analysis-panel {
    margin-top: 8px;
    padding: 16px 20px 20px;
    border: 1px solid var(--analysis-border);
    border-radius: 22px;
    background: var(--analysis-surface);
    color: var(--analysis-text);
    overflow: hidden;
  }
  .analysis-toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    min-height: 28px;
    margin-bottom: 12px;
    font-size: 13px;
    color: var(--analysis-label);
  }
  .analysis-copy {
    display: grid;
    place-items: center;
    padding: 5px;
    margin: -5px;
    border: 0;
    border-radius: 6px;
    background: transparent;
    color: var(--analysis-text);
    cursor: pointer;
  }
  .analysis-copy:hover {
    background: var(--analysis-border);
  }
  .analysis-body {
    font-size: 14px;
    line-height: 1.8;
  }
  .analysis-body :deep(p:first-child) {
    margin-top: 0;
  }
  .analysis-body :deep(p:last-child) {
    margin-bottom: 0;
  }
  .analysis-body :deep(pre) {
    font-size: 13px;
  }
  .analysis-empty {
    margin: 0;
    font-size: 14px;
    line-height: 1.8;
    color: var(--analysis-label);
  }
  .analysis-active {
    animation: analysis-pulse 1.8s ease-in-out infinite;
  }
  :global(.dark .chat-reasoning) {
    --analysis-surface: #1a1a1a;
    --analysis-border: #2b2b2b;
    --analysis-label: #b5b5b5;
    --analysis-text: #e5e5e5;
  }
  @keyframes analysis-pulse {
    50% {
      opacity: 0.55;
    }
  }
  @media (max-width: 640px) {
    .analysis-panel {
      padding: 14px 16px 16px;
      border-radius: 18px;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .analysis-active {
      animation: none;
    }
    .analysis-chevron {
      transition: none;
    }
  }
</style>
