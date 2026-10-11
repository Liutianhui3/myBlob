<template>
  <div class="home min-h-[100dvh] max-w-2xl mx-auto py-12 sm:py-24 px-6">
    <!-- 自我介绍 -->
    <Introduce />
    <ProfileContacts />
    <!-- 关于 -->
    <About />
    <!-- 技术栈 -->
    <Skills />
    <!-- 工作经历 -->
    <WorkExperience />

    <!-- 项目经历 -->
    <!-- <Projects /> -->
    <!-- 交流 -->
    <!-- <Concat /> -->
  </div>
</template>
<script setup>
  import Introduce from '../components/Introduce.vue'
  import About from '../components/About.vue'
  import WorkExperience from '../components/WorkExperience.vue'
  import Skills from '../components/Skills.vue'
  import ProfileContacts from '../components/ProfileContacts.vue'
</script>
<style scoped>
  .home {
    display: flex;
    flex-direction: column;
    gap: 24px;
    justify-content: center;
  }
</style>
