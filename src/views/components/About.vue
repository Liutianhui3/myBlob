<script setup lang="ts">
  import BlurReveal from '@/components/BlurReveal.vue'
  import { userProfile } from '@/lib/profile'
</script>
<template>
  <section v-if="userProfile.about" id="about" class="mt-5">
    <BlurReveal :delay="0.2" :duration="0.4">
      <h2 class="text-xl font-bold mb-2">关于</h2>
      <p class="about-copy text-sm text-muted-foreground">{{ userProfile.about }}</p>
    </BlurReveal>
  </section>
</template>
<style scoped>
  h2 {
    margin-bottom: 8px;
  }
  .about-copy {
    white-space: pre-wrap;
    overflow-wrap: anywhere;
    line-height: 1.8;
  }
</style>
