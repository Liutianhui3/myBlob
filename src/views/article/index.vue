<template>
  <div class="container max-w-screen-xl mx-auto px-4 md:px-6 py-4">
    <BlurReveal :delay="0.2" :duration="0.4">
      <BentoGrid class="mx-auto max-w-screen">
        <BentoGridItem v-for="(item, index) in items" :key="index" :class="'md:col-span-2'">
          <template #header>
            <div class="flex size-full space-x-4">
              <div class="flex size-full flex-1 rounded-md bg-zinc-800 text-white">123</div>
            </div>
          </template>

          <template #title>
            <strong>{{ item.title }}</strong>
          </template>

          <template #icon></template>

          <template #description>
            <p>{{ item.description }}</p>
          </template>
        </BentoGridItem>
      </BentoGrid>
    </BlurReveal>
  </div>
</template>

<script setup>
  import BentoGrid from '@/components/BentoGrid/BentoGrid.vue'
  import BlurReveal from '@/components/BlurReveal.vue'

  const BLUR_FADE_DELAY = 0.04

  const items = [
    {
      title: 'The Dawn of Innovation',
      description: 'Explore the birth of groundbreaking ideas and inventions.'
    },
    {
      title: 'The Digital Revolution',
      description: 'Dive into the transformative power of technology.'
    },
    {
      title: 'The Art of Design',
      description: 'Discover the beauty of thoughtful and experience design.'
    },
    {
      title: 'The Power of Communication',
      description: 'Understand the impact of effective communication in our lives.'
    },
    {
      title: 'The Pursuit of Knowledge',
      description: 'Join the quest for understanding and enlightenment.'
    },
    {
      title: 'The Joy of Creation',
      description: 'Experience the thrill of bringing ideas to life.'
    }
  ]
</script>
<style lang="less" scoped></style>
