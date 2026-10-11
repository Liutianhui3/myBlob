<script setup lang="ts">
  import { Icon } from '@iconify/vue'
  import icons from '@/assets/profile-icons.json'

  defineProps<{ src?: string }>()
</script>

<template>
  <span class="user-avatar">
    <img v-if="src" :src="src" alt="" />
    <Icon v-else :icon="{ ...icons.icons['user-circle'], width: 24, height: 24 }" />
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
  .user-avatar :deep(svg) {
    width: 70%;
    height: 70%;
  }
  :global(.dark .user-avatar) {
    background: #302d49;
    color: #b9b5ff;
  }
</style>
