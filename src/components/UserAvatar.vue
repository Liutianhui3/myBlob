<script setup lang="ts">
  import { computed } from 'vue'
  import { userInfo } from '@/lib/auth'

  const props = defineProps<{ src?: string; username?: string }>()
  const username = computed(
    () => props.username || userInfo.value?.username || userInfo.value?.name || '用户'
  )
  const initial = computed(() => Array.from(username.value.trim())[0] || '用')
  // Assign each username a random color once, shared by all avatar instances.
  const colors = [
    '#4f46e5',
    '#047857',
    '#b45309',
    '#be185d',
    '#0369a1',
    '#7e22ce',
    '#b91c1c',
    '#0f766e'
  ]
  const background = computed(() => {
    const key = `myblob_avatar_color:${username.value}`
    try {
      const saved = localStorage.getItem(key)
      if (saved && colors.includes(saved)) return saved
      const color = colors[Math.floor(Math.random() * colors.length)]
      localStorage.setItem(key, color)
      return color
    } catch {
      return colors[
        Array.from(username.value).reduce((sum, letter) => sum + (letter.codePointAt(0) || 0), 0) %
          colors.length
      ]
    }
  })
</script>

<template>
  <span
    class="user-avatar"
    :style="!src ? { backgroundColor: background, color: '#fff' } : undefined"
  >
    <img v-if="src" :src="src" alt="" />
    <span v-else class="avatar-placeholder">{{ initial }}</span>
  </span>
</template>

<style scoped>
  .user-avatar {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    width: 100%;
    height: 100%;
    overflow: hidden;
    border-radius: 50%;
    background: #eeecff;
    color: #514def;
  }
  .user-avatar img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  .avatar-placeholder {
    font-weight: 500;
  }
  .user-avatar :deep(svg) {
    width: 70%;
    height: 70%;
  }
  :global(.dark .user-avatar) {
    background: #302d49;
    color: #b9b5ff;
  }
</style>
