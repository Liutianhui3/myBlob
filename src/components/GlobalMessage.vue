<template>
  <Teleport to="body">
    <Transition name="message" appear @after-leave="emit('close')">
      <div v-if="visible" class="message-position">
        <div
          class="message-card"
          :class="`message-${type}`"
          @mouseenter="pause('hover')"
          @mouseleave="resume('hover')"
          @focusin="pause('focus')"
          @focusout="resume('focus')"
        >
          <svg
            class="message-icon"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            aria-hidden="true"
          >
            <circle cx="12" cy="12" r="9" />
            <path v-if="type === 'success'" d="m8 12 3 3 5-6" />
            <path v-else-if="type === 'error'" d="m9 9 6 6m0-6-6 6" />
            <path v-else d="M12 7v6m0 3v1" />
          </svg>
          <p role="status" aria-live="polite">{{ message }}</p>
          <button type="button" aria-label="关闭提示" @click="close">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              aria-hidden="true"
            >
              <path d="m6 6 12 12M18 6 6 18" />
            </svg>
          </button>
          <div
            v-if="duration > 0"
            class="message-water"
            :class="{ 'is-paused': paused }"
            :style="{
              transform: `translateY(calc(${(1 - remaining / duration) * 100}% + ${(1 - remaining / duration) * 20}px))`
            }"
            aria-hidden="true"
          >
            <svg class="message-wave" viewBox="0 0 800 20" preserveAspectRatio="none">
              <path
                d="M0 10 Q50 0 100 10 T200 10 T300 10 T400 10 T500 10 T600 10 T700 10 T800 10 V20 H0Z"
              />
            </svg>
            <svg
              class="message-wave message-wave-back"
              viewBox="0 0 800 20"
              preserveAspectRatio="none"
            >
              <path
                d="M0 10 Q50 0 100 10 T200 10 T300 10 T400 10 T500 10 T600 10 T700 10 T800 10 V20 H0Z"
              />
            </svg>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
  import { ref, onMounted, onUnmounted } from 'vue'

  export type MessageType = 'success' | 'error' | 'warning' | 'info'
  const props = withDefaults(
    defineProps<{ message: string; type?: MessageType; duration?: number }>(),
    {
      type: 'info',
      duration: 4000
    }
  )
  const emit = defineEmits<{ close: [] }>()
  const visible = ref(true)
  const remaining = ref(Math.max(0, props.duration))
  const pauses = new Set<string>()
  const paused = ref(false)
  let frame: number | undefined
  let closeTimer: ReturnType<typeof setTimeout> | undefined
  let deadline = 0

  function close() {
    if (frame !== undefined) cancelAnimationFrame(frame)
    clearTimeout(closeTimer)
    visible.value = false
  }

  function tick(now: number) {
    remaining.value = Math.max(0, deadline - now)
    if (remaining.value > 0) frame = requestAnimationFrame(tick)
    else {
      frame = undefined
      // Let the last water surface leave the container before fading out.
      closeTimer = setTimeout(close, 80)
    }
  }

  function resume(reason?: string) {
    if (reason) pauses.delete(reason)
    paused.value = pauses.size > 0
    if (props.duration <= 0 || pauses.size || frame !== undefined || remaining.value <= 0) return
    deadline = performance.now() + remaining.value
    frame = requestAnimationFrame(tick)
  }

  function pause(reason: string) {
    pauses.add(reason)
    paused.value = true
    if (frame === undefined) return
    cancelAnimationFrame(frame)
    frame = undefined
    remaining.value = Math.max(0, deadline - performance.now())
  }

  onMounted(() => resume())
  onUnmounted(() => {
    if (frame !== undefined) cancelAnimationFrame(frame)
    clearTimeout(closeTimer)
  })
</script>

<style scoped>
  .message-position {
    position: fixed;
    top: max(24px, env(safe-area-inset-top));
    left: 0;
    right: 0;
    z-index: 9999;
    display: flex;
    justify-content: center;
    padding: 0 16px;
    pointer-events: none;
  }
  .message-card {
    --message-accent: #1d4ed8;
    position: relative;
    overflow: hidden;
    display: flex;
    align-items: center;
    gap: 12px;
    width: max-content;
    max-width: 520px;
    min-width: 0;
    padding: 10px 8px 12px 16px;
    border: 1px solid #e2e8f0;
    border-radius: 16px;
    background: #fff;
    color: #1e293b;
    box-shadow:
      0 12px 40px -12px rgb(15 23 42 / 20%),
      0 2px 8px rgb(15 23 42 / 4%);
    pointer-events: auto;
  }
  .message-success {
    --message-accent: #047857;
  }
  .message-error {
    --message-accent: #be123c;
  }
  .message-warning {
    --message-accent: #92400e;
  }
  .message-icon {
    box-sizing: content-box;
    width: 22px;
    height: 22px;
    padding: 9px;
    border-radius: 12px;
    flex-shrink: 0;
    color: var(--message-accent);
    background: color-mix(in srgb, var(--message-accent) 9%, transparent);
  }
  .message-card > :not(.message-water) {
    position: relative;
    z-index: 1;
  }
  .message-water {
    position: absolute;
    inset: 0 0 -12px;
    pointer-events: none;
    background: color-mix(in srgb, var(--message-accent) 10%, transparent);
    color: color-mix(in srgb, var(--message-accent) 10%, transparent);
  }
  .message-wave {
    position: absolute;
    top: -12px;
    left: 0;
    width: 200%;
    height: 16px;
    fill: currentColor;
    animation: water-wave 3s linear infinite;
  }
  .message-wave-back {
    top: -15px;
    opacity: 0.45;
    animation-duration: 4.5s;
    animation-direction: reverse;
  }
  .is-paused .message-wave {
    animation-play-state: paused;
  }
  @keyframes water-wave {
    from {
      transform: translateX(0);
    }
    to {
      transform: translateX(-50%);
    }
  }
  p {
    margin: 0;
    min-width: 0;
    overflow-wrap: anywhere;
    font-size: 14px;
    font-weight: 500;
    line-height: 1.6;
  }
  button {
    display: grid;
    place-items: center;
    width: 44px;
    height: 44px;
    flex-shrink: 0;
    border: 0;
    border-radius: 8px;
    background: transparent;
    color: inherit;
    cursor: pointer;
    transition: background 150ms;
  }
  button svg {
    width: 18px;
    height: 18px;
  }
  button:hover {
    background: rgb(148 163 184 / 15%);
  }
  button:focus-visible {
    outline: 2px solid var(--message-accent);
    outline-offset: -2px;
  }
  .dark .message-card {
    background: #1e293b;
    color: #f8fafc;
    border-color: #475569;
    --message-accent: #93c5fd;
  }
  .dark .message-success {
    --message-accent: #6ee7b7;
  }
  .dark .message-error {
    --message-accent: #fda4af;
  }
  .dark .message-warning {
    --message-accent: #fcd34d;
  }
  .message-enter-active {
    transition:
      opacity 220ms ease-out,
      transform 220ms cubic-bezier(0.2, 0.8, 0.2, 1);
  }
  .message-leave-active {
    transition:
      opacity 180ms ease-in,
      transform 180ms ease-in;
  }
  .message-enter-from {
    opacity: 0;
    transform: translateY(-12px) scale(0.97);
  }
  .message-leave-to {
    opacity: 0;
    transform: translateY(-8px) scale(0.98);
  }
  @media (max-width: 400px) {
    .message-card {
      gap: 8px;
      padding-left: 12px;
    }
    .message-icon {
      width: 20px;
      height: 20px;
      padding: 7px;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .message-wave {
      animation: none;
    }
    .message-enter-active,
    .message-leave-active,
    button {
      transition: none;
    }
  }
</style>
