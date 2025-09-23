<template>
  <section id="concat">
    <div class="flex min-h-0 flex-col gap-y-3 mt-5">
      <BlurReveal :delay="0.2" :duration="0.4">
        <div style="opacity: 1; filter: blur(0px); transform: translateY(-6px) translateZ(0px)">
          <h2 class="text-xl font-bold">联系我</h2>
        </div>
      </BlurReveal>
    </div>
    <BlurReveal :delay="0.2" :duration="0.4">
      <AnimatedTestimonials :testimonials="testimonials" />
    </BlurReveal>
  </section>
</template>
<script setup>
  import BlurReveal from '@/components/BlurReveal.vue'
  import AnimatedTestimonials from '@/components/AnimatedTestimonials.vue'
  import wechatqr from '@/assets/images/wechatqr.jpg'

  const testimonials = [
    {
      quote: '扫描二维码进行添加',
      name: '微信',
      designation: '微信号：LIU_TIANH',
      image: wechatqr
    }
  ]
</script>
<style scoped></style>
