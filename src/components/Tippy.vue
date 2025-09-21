<template>
  <div ref="tippyContainer">
    <slot></slot>
  </div>
</template>

<script setup>
import { onMounted, onUnmounted, ref } from 'vue';
import tippy from 'tippy.js';
import 'tippy.js/dist/tippy.css'; // 导入默认样式

const props = defineProps({
  content: {
    type: String,
    required: true
  },
  options: {
    type: Object,
    default: () => ({})
  }
});

const tippyContainer = ref(null);
let tippyInstance = null;

onMounted(() => {
  if (tippyContainer.value) {
    tippyInstance = tippy(tippyContainer.value, {
      content: props.content,
      ...props.options
    });
  }
});

onUnmounted(() => {
  if (tippyInstance) {
    tippyInstance.destroy();
  }
});
</script>

<style scoped>
/* 可选：如果你想为容器添加一些特定样式 */
</style>