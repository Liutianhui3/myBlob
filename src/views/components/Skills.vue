<script setup lang="ts">
  import BlurReveal from '@/components/BlurReveal.vue'
  import { userProfile } from '@/lib/profile'
</script>
<template>
  <section v-if="userProfile.skills.length" id="skills" class="mt-5">
    <BlurReveal :delay="0.2" :duration="0.4">
      <h2 class="text-xl font-bold mb-3">技术栈</h2>
      <div class="flex flex-wrap gap-1">
        <span
          v-for="skill in userProfile.skills"
          :key="skill"
          class="skill inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold border-transparent bg-primary text-primary-foreground shadow"
        >
          {{ skill }}
        </span>
      </div>
    </BlurReveal>
  </section>
</template>
<style scoped>
  h2 {
    margin-bottom: 12px;
  }
  .skill {
    max-width: 100%;
    overflow-wrap: anywhere;
  }
</style>
