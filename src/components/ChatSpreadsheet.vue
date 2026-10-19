<script setup lang="ts">
  import { ref } from 'vue'
  import { Icon } from '@iconify/vue'
  import icons from '@/assets/chat-icons.json'
  import excelLogo from '@/assets/images/excel.svg'
  import { createSpreadsheet, type SpreadsheetFile } from '@/lib/spreadsheet'
  const props = defineProps<{ file: SpreadsheetFile }>()
  const busy = ref(false)
  const error = ref('')
  async function download() {
    busy.value = true
    error.value = ''
    try {
      const buffer = await createSpreadsheet(props.file)
      const url = URL.createObjectURL(
        new Blob([new Uint8Array(buffer)], {
          type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        })
      )
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = props.file.filename
      document.body.appendChild(anchor)
      anchor.click()
      anchor.remove()
      setTimeout(() => URL.revokeObjectURL(url), 60000)
    } catch {
      error.value = '文件生成失败，请重试。'
    } finally {
      busy.value = false
    }
  }
</script>

<template>
  <section class="spreadsheet-card" aria-label="Excel 文件">
    <img class="excel-logo" :src="excelLogo" alt="" />
    <div>
      <strong>{{ file.filename }}</strong>
      <p>Excel · {{ file.sheets.length }} 个工作表</p>
    </div>
    <button
      type="button"
      :disabled="busy"
      :aria-label="busy ? '正在生成 Excel' : '下载 Excel'"
      @click="download"
    >
      <span v-if="busy" class="download-spinner" aria-hidden="true" />
      <Icon
        v-else
        :icon="{ ...icons.icons['download-01'], width: 24, height: 24 }"
        width="18"
        height="18"
        aria-hidden="true"
      />
      <span class="download-tooltip" aria-hidden="true">{{ busy ? '正在生成…' : '下载文件' }}</span>
    </button>
    <p v-if="error" role="alert">{{ error }}</p>
  </section>
</template>

<style scoped>
  .spreadsheet-card {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 16px;
    padding: 18px;
    margin: 18px 0;
    border: 1px solid var(--chat-border);
    border-radius: 16px;
    background: var(--chat-input);
  }
  .spreadsheet-card div {
    flex: 1;
    min-width: 0;
    overflow-wrap: anywhere;
  }
  .excel-logo {
    width: 40px;
    height: 40px;
    flex: 0 0 auto;
  }
  .download-spinner {
    width: 20px;
    height: 20px;
    border: 2px solid currentColor;
    border-right-color: transparent;
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }
  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .download-spinner {
      animation: none;
    }
  }
  .spreadsheet-card p {
    margin: 4px 0 0;
    color: var(--chat-muted);
    font-size: 13px;
  }
  button {
    position: relative;
    display: grid;
    place-items: center;
    width: 36px;
    height: 36px;
    flex: 0 0 auto;
    cursor: pointer;
    border: 0;
    border-radius: 8px;
    padding: 0;
    background: var(--chat-hover);
    color: inherit;
  }
  button::after {
    content: '';
    position: absolute;
    inset: -4px;
  }
  .download-tooltip {
    position: absolute;
    bottom: calc(100% + 6px);
    left: 50%;
    transform: translateX(-50%);
    padding: 6px 13px;
    border-radius: 999px;
    background: #111;
    color: #fff;
    font-size: 12px;
    font-weight: 600;
    line-height: 18px;
    white-space: nowrap;
    box-shadow: 0 6px 18px rgb(0 0 0 / 18%);
    pointer-events: none;
    opacity: 0;
  }
  button:hover .download-tooltip,
  button:focus-visible .download-tooltip {
    opacity: 1;
  }
  button:focus-visible {
    outline: 2px solid var(--chat-link);
    outline-offset: 3px;
  }
  button:disabled {
    cursor: wait;
    opacity: 0.6;
  }
</style>
