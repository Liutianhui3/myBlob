<template>
  <section id="concat">
    <div class="flex min-h-0 flex-col gap-y-3 mt-5">
      <BlurReveal :delay="0.2" :duration="0.4">
        <div style="opacity: 1; filter: blur(0px); transform: translateY(-6px) translateZ(0px)">
          <h2 class="text-xl font-bold">联系我</h2>
        </div>
      </BlurReveal>
    </div>
  </section>
</template>
<script setup>
  import BlurReveal from '@/components/BlurReveal.vue'
</script>
<style scoped></style>
