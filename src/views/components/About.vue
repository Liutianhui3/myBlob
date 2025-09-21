<template>
  <!-- 关于我 -->
  <div class="mt-5">
    <BlurReveal :delay="0.2" :duration="0.4">
      <div class="text-xl font-bold mb-2">关于：</div>
      <p
        class="prose max-w-full text-pretty font-sans text-sm text-muted-foreground dark:prose-invert"
      >
        {{ desc }}
      </p>
    </BlurReveal>
  </div>
</template>
<script setup>
  import BlurReveal from '@/components/BlurReveal.vue'

  const desc = ref(
    '我毕业于2020年，工作后一直担任前端开发工程师的岗位，定居苏州，目前在上海一家互联网企业就职，参与该公司的SaaS产品研发。我热衷于学习新技术，经常在GitHub上寻找有趣的项目。业余时间，我还对炒股有所学习。'
  )
</script>
<style scoped></style>
