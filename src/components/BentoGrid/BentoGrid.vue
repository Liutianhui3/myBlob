<template>
  <div
    :class="
      cn(
        'grid md:auto-rows-[18rem] grid-cols-2 md:grid-cols-4 gap-4 max-w-7xl mx-auto ',
        props.class
      )
    "
  >
    <slot />
  </div>
</template>

<script lang="ts" setup>
  import { cn } from '@/lib/utils'
  import type { HTMLAttributes } from 'vue'

  interface Props {
    class?: HTMLAttributes['class']
  }

  const props = defineProps<Props>()
</script>
