<script setup lang="ts">
  import { ref, onBeforeUnmount } from 'vue'
  import type { ChatAttachment } from '@/api/chat'
  import { downloadChatImage } from '@/api/chat'

  const props = defineProps<{
    attachment: ChatAttachment
    removable?: boolean
    disabled?: boolean
    generated?: boolean
    conversationId?: string
    messageId?: string
  }>()
  defineEmits<{ remove: [] }>()
  const dialog = ref<HTMLDialogElement>()
  const downloadError = ref(false)
  const downloading = ref(false)
  async function downloadImage() {
    if (!props.attachment.data || downloading.value) return
    downloading.value = true
    downloadError.value = false
    try {
      let blob: Blob
      if (/^https?:\/\//i.test(props.attachment.data) && props.conversationId && props.messageId) {
        blob = await downloadChatImage(props.conversationId, props.messageId, props.attachment.data)
      } else {
        const response = await fetch(props.attachment.data, {
          credentials: 'omit',
          referrerPolicy: 'no-referrer'
        })
        if (!response.ok) throw new Error()
        blob = await response.blob()
      }
      if (!['image/png', 'image/jpeg', 'image/webp'].includes(blob.type)) throw new Error()
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = `AI-image.${blob.type === 'image/jpeg' ? 'jpg' : blob.type.split('/')[1]}`
      document.body.appendChild(anchor)
      anchor.click()
      anchor.remove()
      setTimeout(() => URL.revokeObjectURL(url), 60000)
    } catch {
      downloadError.value = true
    } finally {
      downloading.value = false
    }
  }
  function openPreview() {
    dialog.value?.showModal()
  }
  function closePreview() {
    dialog.value?.close()
  }
  onBeforeUnmount(closePreview)
</script>

<template>
  <div class="image-attachment" :class="{ 'generated-image': generated }">
    <button
      type="button"
      class="image-thumbnail"
      :aria-label="`预览图片 ${attachment.name}`"
      @click="openPreview"
    >
      <img :src="attachment.data" :alt="attachment.name" referrerpolicy="no-referrer" />
    </button>
    <button
      v-if="generated"
      type="button"
      class="image-download"
      aria-label="下载图片"
      title="下载图片"
      :disabled="downloading"
      @click="downloadImage"
    >
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" aria-hidden="true">
        <path
          d="M12 3v12m-4-4 4 4 4-4M5 15v5h14v-5"
          stroke="currentColor"
          stroke-width="1.5"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
      </svg>
    </button>
    <p v-if="downloadError" role="alert" class="image-download-error">下载失败，请稍后重试。</p>
    <button
      v-if="removable"
      type="button"
      class="image-remove"
      :aria-label="`移除 ${attachment.name}`"
      :disabled="disabled"
      @click="$emit('remove')"
    >
      <svg viewBox="0 0 16 16" width="12" height="12" fill="none" aria-hidden="true">
        <path
          d="m4 4 8 8M12 4l-8 8"
          stroke="currentColor"
          stroke-width="1.8"
          stroke-linecap="round"
        />
      </svg>
    </button>
    <dialog ref="dialog" class="image-preview" aria-label="图片预览" @click="closePreview">
      <button
        type="button"
        class="preview-close"
        aria-label="关闭图片预览"
        autofocus
        @click.stop="closePreview"
      >
        <svg viewBox="0 0 24 24" width="24" height="24" fill="none" aria-hidden="true">
          <path
            d="m6 6 12 12M18 6 6 18"
            stroke="currentColor"
            stroke-width="1.8"
            stroke-linecap="round"
          />
        </svg>
      </button>
      <img :src="attachment.data" :alt="attachment.name" referrerpolicy="no-referrer" @click.stop />
    </dialog>
  </div>
</template>

<style scoped>
  .image-attachment {
    position: relative;
    width: 122px;
    height: 122px;
    flex: 0 0 auto;
  }
  .generated-image {
    width: min(100%, 512px);
    height: auto;
    margin: 18px 0;
  }
  .generated-image .image-thumbnail {
    height: auto;
    min-height: 100px;
  }
  .generated-image .image-thumbnail img {
    height: auto;
    max-height: 640px;
    object-fit: contain;
  }
  .image-download {
    position: absolute;
    right: 10px;
    bottom: 10px;
    display: grid;
    place-items: center;
    width: 36px;
    height: 36px;
    padding: 0;
    border: 1px solid rgb(0 0 0 / 8%);
    border-radius: 8px;
    color: #171717;
    background: rgb(255 255 255 / 92%);
    cursor: pointer;
  }
  .image-download:disabled {
    opacity: 0.5;
    cursor: wait;
  }
  .image-download-error {
    margin: 6px 0;
    font-size: 12px;
  }
  .image-thumbnail {
    display: block;
    width: 100%;
    height: 100%;
    padding: 0;
    overflow: hidden;
    border: 1px solid var(--chat-border);
    border-radius: 16px;
    background: var(--chat-hover);
    cursor: zoom-in;
  }
  .image-thumbnail img {
    display: block;
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  .image-remove {
    position: absolute;
    top: -6px;
    right: -6px;
    display: grid;
    place-items: center;
    width: 24px;
    height: 24px;
    padding: 0;
    border: 2px solid var(--chat-input);
    border-radius: 50%;
    background: #171717;
    color: #fff;
    cursor: pointer;
  }
  .image-remove::after {
    content: '';
    position: absolute;
    inset: -7px;
  }
  .image-remove:disabled {
    opacity: 0.5;
    cursor: default;
  }
  button:focus-visible {
    outline: 2px solid var(--chat-link, #5366ab);
    outline-offset: 3px;
  }
  .image-preview {
    position: fixed;
    inset: 0;
    width: 100vw;
    height: 100dvh;
    max-width: none;
    max-height: none;
    padding: 64px 20px 24px;
    border: 0;
    background: transparent;
    overflow: auto;
  }
  .image-preview[open] {
    display: grid;
    place-items: center;
  }
  .image-preview::backdrop {
    background: rgb(0 0 0 / 85%);
  }
  .image-preview > img {
    display: block;
    max-width: 100%;
    max-height: calc(100dvh - 88px);
    object-fit: contain;
  }
  .preview-close {
    position: fixed;
    top: 12px;
    right: 16px;
    display: grid;
    place-items: center;
    width: 44px;
    height: 44px;
    border: 0;
    border-radius: 50%;
    background: rgb(255 255 255 / 15%);
    color: #fff;
    cursor: pointer;
  }
</style>
