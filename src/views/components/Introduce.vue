<template>
  <!-- 自我介绍 -->
  <div class="flex items-start gap-4">
    <BlurReveal :delay="0.2" :duration="0.4">
      <SparklesText
        text="嗨，我是 Jason 👋"
        :colors="{ first: '#9E7AFF', second: '#FE8BBB' }"
        :sparkles-count="10"
      />
      <!-- <h1 class=""></h1> -->
      <h2 class="text-2xl pt-3">
        我是一名前端软件工程师。我喜欢创造事物并帮助他人。活跃于GitHub。
      </h2>
    </BlurReveal>
    <BlurReveal :delay="0.2" :duration="0.4">
      <span class="relative flex shrink-0 overflow-hidden rounded-full size-28 border">
        <img class="img aspect-square h-full w-full" src="@/assets/images/avatar.jpg" />
      </span>
    </BlurReveal>
  </div>
</template>
<script setup>
  import BlurReveal from '@/components/BlurReveal.vue'
</script>
<style scoped>
  .img {
    border-radius: 100%;
    pointer-events: none;
  }
</style>
