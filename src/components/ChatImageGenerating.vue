<script setup lang="ts">
  import { onMounted, onUnmounted, ref } from 'vue'

  const progress = ref(10)
  let timer: ReturnType<typeof setInterval> | undefined
  onMounted(() => {
    const started = performance.now()
    timer = setInterval(() => {
      // Images API has no progress events; approach 94% while awaiting the result.
      progress.value = Math.min(
        94,
        Math.floor(10 + 85 * (1 - Math.exp(-(performance.now() - started) / 90000)))
      )
    }, 1000)
  })
  onUnmounted(() => clearInterval(timer))
</script>

<template>
  <section class="image-generating" aria-label="正在创建图像" aria-busy="true">
    <p class="image-generating-title" role="status">正在创建图像</p>
    <div class="image-generating-area">
      <div class="image-generating-dots" aria-hidden="true" />
      <span
        class="image-generating-progress"
        :aria-label="`模拟进度 ${progress}%`"
        title="预计进度，以实际生成结果为准"
      >
        {{ progress }}%
      </span>
    </div>
  </section>
</template>

<style scoped>
  .image-generating {
    width: 368px;
    max-width: 100%;
    margin: 8px 0 20px;
  }
  .image-generating-title {
    margin: 0 0 12px 4px;
    color: var(--chat-muted, #666);
    font-size: 15px;
    line-height: 24px;
  }
  .image-generating-area {
    position: relative;
    width: 100%;
    aspect-ratio: 1.12;
  }
  .image-generating-dots {
    position: absolute;
    inset: 0;
    background: radial-gradient(circle, #ff9acb 0.8px, transparent 1px) 0 0 / 13px 13px;
    mask-image: radial-gradient(ellipse at 48% 48%, #000 18%, transparent 76%);
    opacity: 0.65;
  }
  .image-generating-dots::after {
    content: '';
    position: absolute;
    inset: 0;
    background: radial-gradient(circle, #ff55ac 0.85px, transparent 1.1px) 0 0 / 13px 13px;
    mask-image: radial-gradient(ellipse at center, #000 5%, transparent 50%);
    mask-size: 180% 180%;
    animation: image-dot-drift 5s ease-in-out infinite alternate;
  }
  .image-generating-progress {
    position: absolute;
    right: 2px;
    bottom: 0;
    min-width: 56px;
    padding: 4px 12px;
    border: 1px solid var(--chat-border, #e6e6e6);
    border-radius: 999px;
    background: var(--chat-input, #fff);
    box-shadow: 0 2px 6px rgb(0 0 0 / 6%);
    color: var(--chat-muted, #666);
    font-size: 14px;
    line-height: 20px;
    text-align: center;
    font-variant-numeric: tabular-nums;
  }
  @keyframes image-dot-drift {
    from {
      mask-position: 0% 80%;
      opacity: 0.4;
    }
    to {
      mask-position: 90% 5%;
      opacity: 1;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .image-generating-dots::after {
      animation: none;
      mask-position: center;
      opacity: 0.6;
    }
  }
</style>
