<script setup lang="ts">
  import { computed, ref } from 'vue'
  import { downloadChatFile, type ChatFile } from '@/api/chat'
  import excelLogo from '@/assets/images/excel.svg'

  const props = defineProps<{ file: ChatFile; conversationId: string; messageId: string }>()
  const busy = ref(false)
  const error = ref('')
  const kind = computed(() => {
    if (props.file.mimeType.includes('spreadsheetml') || /\.xlsx$/i.test(props.file.name))
      return 'Excel'
    if (props.file.mimeType.includes('wordprocessingml') || /\.docx$/i.test(props.file.name))
      return 'Word'
    return '文件'
  })
  async function download() {
    if (busy.value) return
    busy.value = true
    error.value = ''
    try {
      const blob = await downloadChatFile(props.conversationId, props.messageId, props.file.id)
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = props.file.name
      document.body.appendChild(anchor)
      anchor.click()
      anchor.remove()
      setTimeout(() => URL.revokeObjectURL(url), 60000)
    } catch {
      error.value = '文件下载失败，请重试。'
    } finally {
      busy.value = false
    }
  }
</script>

<template>
  <section class="file-card" :aria-label="`${kind} 文件`">
    <img v-if="kind === 'Excel'" :src="excelLogo" alt="" />
    <span v-else class="file-icon" aria-hidden="true">W</span>
    <div class="file-info">
      <strong>{{ file.name }}</strong>
      <p>{{ kind }} · {{ Math.max(1, Math.ceil(file.size / 1024)) }} KB</p>
      <p v-if="error" role="alert">{{ error }}</p>
    </div>
    <button type="button" :disabled="busy" @click="download">
      {{ busy ? '下载中…' : '下载文件' }}
    </button>
  </section>
</template>

<style scoped>
  .file-card {
    display: flex;
    align-items: center;
    gap: 14px;
    padding: 18px;
    margin: 12px 0;
    border: 1px solid #e5e5e5;
    border-radius: 16px;
    max-width: 520px;
  }
  .file-card img,
  .file-icon {
    width: 36px;
    height: 40px;
    flex-shrink: 0;
  }
  .file-icon {
    background: #e6efff;
    color: #245bb0;
    display: grid;
    place-items: center;
    border-radius: 6px;
    font-weight: 700;
  }
  .file-info {
    flex: 1;
    min-width: 0;
  }
  strong {
    display: block;
    overflow-wrap: anywhere;
  }
  p {
    font-size: 12px;
    color: #777;
    margin: 5px 0 0;
  }
  button {
    border: 0;
    border-radius: 8px;
    padding: 8px 12px;
    cursor: pointer;
    flex-shrink: 0;
  }
  button:disabled {
    cursor: wait;
    opacity: 0.6;
  }
</style>
