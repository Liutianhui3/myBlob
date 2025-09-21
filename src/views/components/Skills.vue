<template>
  <section id="skills">
    <div class="flex min-h-0 flex-col gap-y-3 mt-5">
      <BlurReveal :delay="0.2" :duration="0.4">
        <div style="opacity: 1; filter: blur(0px); transform: translateY(-6px) translateZ(0px)">
          <h2 class="text-xl font-bold">技术栈</h2>
        </div>
      </BlurReveal>
      <div class="flex flex-wrap gap-1">
        <BlurReveal
          v-for="item in skillsList"
          :key="item.id"
          :delay="0.2"
          :duration="BLUR_FADE_DELAY * 10 + item.id * 0.05"
        >
          <div
            class="cursor-pointer inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 border-transparent bg-primary text-primary-foreground shadow hover:bg-primary/80"
          >
            {{ item.label }}
          </div>
        </BlurReveal>
      </div>
    </div>
  </section>
</template>
<script setup>
  import BlurReveal from '@/components/BlurReveal.vue'

  const BLUR_FADE_DELAY = 0.04

  const skillsList = ref([
    { id: 1, label: 'HTML' },
    { id: 2, label: 'CSS' },
    { id: 3, label: 'Less' },
    { id: 4, label: 'Javascript' },
    { id: 5, label: 'Typescript' },
    { id: 6, label: 'Vue' },
    { id: 7, label: 'React' },
    { id: 8, label: 'Node.js' },
    { id: 9, label: 'Java' },
    { id: 10, label: 'SpringBoot' },
    { id: 11, label: 'Ant-Design' },
    { id: 12, label: 'Vite' }
  ])
</script>
<style scoped></style>
