<template>
  <section id="work" class="mt-5">
    <div class="flex min-h-0 flex-col gap-y-3">
      <BlurReveal :delay="0.2" :duration="0.4">
        <div style="opacity: 1; filter: blur(0px); transform: translateY(-6px) translateZ(0px)">
          <h2 class="text-xl font-bold">工作经历</h2>
        </div>
      </BlurReveal>
      <BlurReveal
        :delay="0.2"
        :duration="BLUR_FADE_DELAY * 10 + node.id * 0.05"
        v-for="node in experienceList"
        :key="node.id"
      >
        <div
          style="
            opacity: 1;
            filter: blur(0px);
            transform: translateY(-6px) translateZ(0px);
            overflow: hidden;
          "
        >
          <div class="rounded-lg text-card-foreground flex">
            <div class="flex-none">
              <span
                class="relative flex shrink-0 overflow-hidden rounded-full border size-12 m-auto bg-muted-background dark:bg-foreground"
              >
                <img
                  class="aspect-square h-full w-full object-contain"
                  :alt="node.alt"
                  :src="node.img"
                />
              </span>
            </div>
            <div class="flex-grow ml-4 items-center flex-col group">
              <div class="flex flex-col">
                <div class="flex items-center justify-between gap-x-2 text-base">
                  <h3
                    class="inline-flex items-center justify-center font-semibold leading-none text-xs sm:text-sm cursor-pointer"
                    @click="expand(node)"
                  >
                    {{ node.name }}
                    <span class="inline-flex gap-x-1"></span>
                    <svg
                      v-if="node.expand"
                      xmlns="http://www.w3.org/2000/svg"
                      width="24"
                      height="24"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      class="lucide lucide-chevron-right size-4 translate-x-0 transform opacity-0 transition-all duration-300 ease-out group-hover:translate-x-1 group-hover:opacity-100 rotate-90"
                    >
                      <path d="m9 18 6-6-6-6"></path>
                    </svg>
                    <svg
                      v-else
                      xmlns="http://www.w3.org/2000/svg"
                      width="24"
                      height="24"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      class="lucide lucide-chevron-right size-4 translate-x-0 transform opacity-0 transition-all duration-300 ease-out group-hover:translate-x-1 group-hover:opacity-100 rotate-0"
                    >
                      <path d="m9 18 6-6-6-6"></path>
                    </svg>
                  </h3>
                  <div class="text-xs sm:text-sm tabular-nums text-muted-foreground text-right">
                    {{ node.time }}
                  </div>
                </div>
                <div class="font-sans text-xs">{{ node.job }}</div>
              </div>
              <Motion
                as="div"
                class="mt-2 text-xs sm:text-sm"
                :initial="{ opacity: 0, height: 0 }"
                :animate="{
                  opacity: node.expand ? 1 : 0,
                  height: node.expand ? 'auto' : 0
                }"
                :transition="{
                  duration: 0.7,
                  ease: [0.16, 1, 0.3, 1]
                }"
              >
                <div v-html="node.desc"></div>
              </Motion>
            </div>
          </div>
        </div>
      </BlurReveal>
    </div>
  </section>
</template>
<script setup>
  import BlurReveal from '@/components/BlurReveal.vue'
  import systexImg from '@/assets/images/systex.jpg'
  import { Motion } from 'motion-v'

  const BLUR_FADE_DELAY = 0.04

  const experienceList = ref([
    {
      id: 1,
      img: systexImg,
      alt: 'systex',
      name: '精诚资讯',
      job: '前端开发工程师',
      time: '2021.3 - 2023.4',
      expand: false,
      desc: `<div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px; background-color: #f9f9f9;">
  <div style="border-bottom: 2px solid #3498db; padding-bottom: 10px; margin-bottom: 20px;">
    <h3 style="margin: 0; font-size: 20px; font-weight: bold; color: #333;">精诚资讯</h3>
    <span style="font-size: 14px; color: #777;">前端开发工程师 | 2021.3 - 2023.4</span>
  </div>

  <div style="margin-bottom: 20px;">
    <h4 style="font-size: 16px; font-weight: bold; color: #555; margin-bottom: 10px;">主要职责与贡献</h4>
    <ul style="list-style-type: none; padding: 0; margin: 0;">
      <li style="margin-bottom: 10px; position: relative; padding-left: 20px;">
        <span style="position: absolute; left: 0; top: 5px; color: #3498db; font-size: 18px;">&bull;</span>
        <strong style="color: #444;">核心业务开发：</strong>参与并负责多个企业级应用的前端开发，包括但不限于数据可视化平台、客户关系管理系统等。
      </li>
      <li style="margin-bottom: 10px; position: relative; padding-left: 20px;">
        <span style="position: absolute; left: 0; top: 5px; color: #3498db; font-size: 18px;">&bull;</span>
        <strong style="color: #444;">技术栈应用：</strong>熟练运用 Vue.js/React 生态，结合 TypeScript，确保项目的高质量和可维护性。
      </li>
      <li style="margin-bottom: 10px; position: relative; padding-left: 20px;">
        <span style="position: absolute; left: 0; top: 5px; color: #3498db; font-size: 18px;">&bull;</span>
        <strong style="color: #444;">前端性能优化：</strong>通过对 Webpack 打包配置、资源懒加载等优化，成功将关键页面加载时间缩短了 **20%**。
      </li>
    </ul>
  </div>

  <div style="font-size: 14px; color: #888; text-align: right; border-top: 1px dashed #ddd; padding-top: 10px;">
    这段经历锤炼了我独立解决问题的能力和团队协作精神，为我后续的职业发展奠定了坚实的基础。
  </div>
</div>`
    },
    {
      id: 2,
      img: 'https://www.shanghairanking.com/_nuxt/img/logo.902480b.svg',
      alt: 'ranking',
      name: 'Shanghai Ranking',
      job: '前端开发工程师',
      time: '2023.5 - 至今',
      expand: false,
      desc: `<div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; max-width: 800px; margin: 0 auto; line-height: 1.8;;" class="text-black dark:text-white">
  <div >
    <h3 style="font-size: 18px; color: #4A90E2; border-bottom: 1px solid #E0E0E0; padding-bottom: 5px; margin-bottom: 15px;">核心贡献</h3>
    <ul style="list-style-type: none; padding: 0;">
      <li style="margin-bottom: 20px; position: relative; padding-left: 20px;">
        <span style="position: absolute; left: 0; top: 8px; width: 6px; height: 6px; background-color: #4A90E2; border-radius: 50%;"></span>
        <strong style="font-size: 16px;">性能优化：</strong>主导开发了全新的后台管理系统，通过深入分析并优化打包策略，成功将**页面初始加载速度提升了 35%**，大幅改善了系统的响应性能。
      </li>
      <li style="margin-bottom: 20px; position: relative; padding-left: 20px;">
        <span style="position: absolute; left: 0; top: 8px; width: 6px; height: 6px; background-color: #4A90E2; border-radius: 50%;"></span>
        <strong style="font-size: 16px;">架构重构：</strong>对核心业务模块进行组件化重构，代码复用率提高，可维护性显著增强，**减少了 50% 的冗余代码**，为后续功能迭代奠定了坚实基础。
      </li>
      <li style="margin-bottom: 20px; position: relative; padding-left: 20px;">
        <span style="position: absolute; left: 0; top: 8px; width: 6px; height: 6px; background-color: #4A90E2; border-radius: 50%;"></span>
        <strong style="font-size: 16px;">技术栈精进：</strong>熟练运用 Vue.js 和 React，并结合 Element UI、Ant Design 等现代组件库进行高效开发，确保项目质量与交付速度。
      </li>
      <li style="margin-bottom: 20px; position: relative; padding-left: 20px;">
        <span style="position: absolute; left: 0; top: 8px; width: 6px; height: 6px; background-color: #4A90E2; border-radius: 50%;"></span>
        <strong style="font-size: 16px;">协作与沟通：</strong>与后端团队紧密协作，高效进行 API 联调，确保了前后端数据的无缝对接与流畅交互。
      </li>
    </ul>
  </div>
  
  <p style="font-style: italic; font-size: 14px; color: #999;">
    这段宝贵的工作经历不仅锤炼了我的技术能力，更让我深刻理解了前端工程化和团队协作的重要性。
  </p>
</div>`
    }
  ])

  const expand = node => {
    const idx = experienceList.value.findIndex(v => v.id == node.id)
    if (idx > -1) {
      experienceList.value[idx].expand = !experienceList.value[idx].expand

      console.log(experienceList.value, 'bb')
    }
  }
</script>
<style scoped></style>
