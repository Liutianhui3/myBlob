<template>
  <Teleport to="body">
    <Transition
      name="message"
      @before-enter="onBeforeEnter"
      @enter="onEnter"
      @leave="onLeave"
    >
      <div
        v-if="visible"
        class="fixed top-6 left-1/2 -translate-x-1/2 z-[9999] pointer-events-none"
        role="alert"
        aria-live="polite"
      >
        <div
          class="message-card pointer-events-auto shadow-2xl backdrop-blur-xl border"
          :class="typeClasses"
        >
          <div class="flex items-start gap-3 min-w-[320px] max-w-[520px]">
            <!-- Icon -->
            <div class="flex-shrink-0 mt-0.5">
              <div class="icon-wrapper" :class="iconWrapperClasses">
                <Icon :icon="iconName" class="w-5 h-5" />
              </div>
            </div>

            <!-- Content -->
            <div class="flex-1 pt-0.5">
              <p class="message-text">{{ message }}</p>
            </div>

            <!-- Close Button -->
            <button
              @click="close"
              class="flex-shrink-0 mt-0.5 close-button"
              aria-label="关闭"
            >
              <Icon icon="material-symbols:close-rounded" class="w-5 h-5" />
            </button>
          </div>

          <!-- Progress Bar -->
          <div v-if="duration > 0" class="progress-container">
            <div class="progress-bar" :class="progressClasses" :style="progressStyle"></div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
  import { ref, computed, watch, onUnmounted } from 'vue'
  import { Icon } from '@iconify/vue'
  import { gsap } from 'gsap'

  export type MessageType = 'success' | 'error' | 'warning' | 'info'

  interface Props {
    message: string
    type?: MessageType
    duration?: number
  }

  const props = withDefaults(defineProps<Props>(), {
    type: 'info',
    duration: 4000
  })

  const emit = defineEmits<{
    close: []
  }>()

  const visible = ref(true)
  const progressStyle = ref({ width: '100%' })
  let closeTimer: ReturnType<typeof setTimeout> | null = null
  let progressTimer: ReturnType<typeof setTimeout> | null = null

  const typeClasses = computed(() => {
    const classes = {
      success: 'message-success',
      error: 'message-error',
      warning: 'message-warning',
      info: 'message-info'
    }
    return classes[props.type]
  })

  const iconWrapperClasses = computed(() => {
    const classes = {
      success: 'icon-success',
      error: 'icon-error',
      warning: 'icon-warning',
      info: 'icon-info'
    }
    return classes[props.type]
  })

  const progressClasses = computed(() => {
    const classes = {
      success: 'progress-success',
      error: 'progress-error',
      warning: 'progress-warning',
      info: 'progress-info'
    }
    return classes[props.type]
  })

  const iconName = computed(() => {
    const icons = {
      success: 'material-symbols:check-circle-rounded',
      error: 'material-symbols:cancel-rounded',
      warning: 'material-symbols:warning-rounded',
      info: 'material-symbols:info-rounded'
    }
    return icons[props.type]
  })

  const close = () => {
    visible.value = false
    if (closeTimer) clearTimeout(closeTimer)
    if (progressTimer) clearTimeout(progressTimer)
  }

  const startAutoClose = () => {
    if (props.duration > 0) {
      // 进度条动画
      progressTimer = setTimeout(() => {
        progressStyle.value = { width: '0%' }
      }, 50)

      // 自动关闭
      closeTimer = setTimeout(() => {
        close()
      }, props.duration)
    }
  }

  // GSAP 动画
  const onBeforeEnter = (el: Element) => {
    gsap.set(el, {
      opacity: 0,
      y: -30,
      scale: 0.9
    })
  }

  const onEnter = (el: Element, done: () => void) => {
    gsap.to(el, {
      opacity: 1,
      y: 0,
      scale: 1,
      duration: 0.4,
      ease: 'back.out(1.7)',
      onComplete: done
    })
  }

  const onLeave = (el: Element, done: () => void) => {
    gsap.to(el, {
      opacity: 0,
      y: -20,
      scale: 0.95,
      duration: 0.3,
      ease: 'power2.in',
      onComplete: () => {
        done()
        emit('close')
      }
    })
  }

  // 组件挂载后开始自动关闭倒计时
  startAutoClose()

  onUnmounted(() => {
    if (closeTimer) clearTimeout(closeTimer)
    if (progressTimer) clearTimeout(progressTimer)
  })
</script>

<style scoped>
  .message-card {
    position: relative;
    padding: 1rem 1.25rem;
    overflow: hidden;
    border-radius: 0.75rem;
    transition: all 0.3s;
  }

  /* Success 样式 */
  .message-success {
    background: rgba(16, 185, 129, 0.1);
    border: 1px solid rgba(16, 185, 129, 0.3);
  }

  .dark .message-success {
    background: rgba(5, 46, 22, 0.9);
    border-color: rgba(6, 78, 59, 0.5);
  }

  .icon-success {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 2rem;
    height: 2rem;
    border-radius: 0.5rem;
    background: rgba(16, 185, 129, 0.15);
    color: rgb(16, 185, 129);
  }

  .dark .icon-success {
    background: rgba(6, 78, 59, 0.6);
    color: rgb(52, 211, 153);
  }

  .progress-success {
    background: linear-gradient(to right, rgb(52, 211, 153), rgb(16, 185, 129));
  }

  /* Error 样式 */
  .message-error {
    background: rgba(244, 63, 94, 0.1);
    border: 1px solid rgba(244, 63, 94, 0.3);
  }

  .dark .message-error {
    background: rgba(76, 5, 25, 0.9);
    border-color: rgba(136, 19, 55, 0.5);
  }

  .icon-error {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 2rem;
    height: 2rem;
    border-radius: 0.5rem;
    background: rgba(244, 63, 94, 0.15);
    color: rgb(244, 63, 94);
  }

  .dark .icon-error {
    background: rgba(136, 19, 55, 0.6);
    color: rgb(251, 113, 133);
  }

  .progress-error {
    background: linear-gradient(to right, rgb(251, 113, 133), rgb(244, 63, 94));
  }

  /* Warning 样式 */
  .message-warning {
    background: rgba(245, 158, 11, 0.1);
    border: 1px solid rgba(245, 158, 11, 0.3);
  }

  .dark .message-warning {
    background: rgba(69, 26, 3, 0.9);
    border-color: rgba(146, 64, 14, 0.5);
  }

  .icon-warning {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 2rem;
    height: 2rem;
    border-radius: 0.5rem;
    background: rgba(245, 158, 11, 0.15);
    color: rgb(245, 158, 11);
  }

  .dark .icon-warning {
    background: rgba(146, 64, 14, 0.6);
    color: rgb(251, 191, 36);
  }

  .progress-warning {
    background: linear-gradient(to right, rgb(251, 191, 36), rgb(245, 158, 11));
  }

  /* Info 样式 */
  .message-info {
    background: rgba(59, 130, 246, 0.1);
    border: 1px solid rgba(59, 130, 246, 0.3);
  }

  .dark .message-info {
    background: rgba(23, 37, 84, 0.9);
    border-color: rgba(30, 58, 138, 0.5);
  }

  .icon-info {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 2rem;
    height: 2rem;
    border-radius: 0.5rem;
    background: rgba(59, 130, 246, 0.15);
    color: rgb(59, 130, 246);
  }

  .dark .icon-info {
    background: rgba(30, 58, 138, 0.6);
    color: rgb(96, 165, 250);
  }

  .progress-info {
    background: linear-gradient(to right, rgb(96, 165, 250), rgb(59, 130, 246));
  }

  /* 文本样式 */
  .message-text {
    font-size: 0.875rem;
    font-weight: 500;
    line-height: 1.625;
    color: rgb(31, 41, 55);
  }

  .dark .message-text {
    color: rgb(243, 244, 246);
  }

  /* 关闭按钮 */
  .close-button {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 1.5rem;
    height: 1.5rem;
    border-radius: 0.375rem;
    color: rgb(107, 114, 128);
    transition: all 0.2s;
  }

  .close-button:hover {
    color: rgb(55, 65, 81);
    background: rgba(0, 0, 0, 0.05);
  }

  .dark .close-button {
    color: rgb(156, 163, 175);
  }

  .dark .close-button:hover {
    color: rgb(229, 231, 235);
    background: rgba(255, 255, 255, 0.05);
  }

  /* 进度条容器 */
  .progress-container {
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    height: 0.25rem;
    overflow: hidden;
  }

  /* 进度条 */
  .progress-bar {
    height: 100%;
    transition-property: width;
    transition-timing-function: linear;
    transition-duration: v-bind('`${props.duration}ms`');
  }
</style>

