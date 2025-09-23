<template>
  <section id="projects">
    <div class="flex min-h-0 flex-col gap-y-3 mt-5">
      <BlurReveal :delay="0.2" :duration="0.4">
        <div style="opacity: 1; filter: blur(0px); transform: translateY(-6px) translateZ(0px)">
          <h2 class="text-xl font-bold">项目经历</h2>
        </div>
      </BlurReveal>
    </div>
    <ContainerScroll>
      <template #title>
        <span class="mt-2 text-xl font-bold leading-none md:text-[2rem]">高绩仪表盘项目</span>
      </template>
      <template #card>
        <img
          src="@/assets/images/opsight.png"
          class="mx-auto h-full rounded-2xl object-cover object-left-top"
          alt="hero"
          height="auto"
          width="100%"
        />
      </template>
    </ContainerScroll>
  </section>
</template>
<script setup>
  import BlurReveal from '@/components/BlurReveal.vue'
</script>
<style scoped></style>
