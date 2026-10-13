<script setup lang="ts">
  import { ref, watch } from 'vue'
  import { EditorContent, useEditor } from '@tiptap/vue-3'
  import StarterKit from '@tiptap/starter-kit'
  import Image from '@tiptap/extension-image'
  import { Icon } from '@iconify/vue'
  import './ArticleContent.vue'
  const props = defineProps<{ modelValue: string; disabled?: boolean }>()
  const emit = defineEmits<{ 'update:modelValue': [value: string] }>()
  const urlMode = ref<'link' | 'image' | ''>('')
  const url = ref('')
  const urlError = ref('')
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3, 4] },
        link: {
          openOnClick: false,
          HTMLAttributes: { target: '_blank', rel: 'noopener noreferrer' }
        }
      }),
      Image.configure({ allowBase64: false })
    ],
    content: props.modelValue,
    editable: !props.disabled,
    editorProps: {
      attributes: {
        class: 'article-prose',
        role: 'textbox',
        'aria-label': '文章正文',
        'aria-multiline': 'true',
        'data-placeholder': '从一个想法开始，写下你的故事…'
      }
    },
    onUpdate: ({ editor }) => emit('update:modelValue', editor.getHTML())
  })
  watch(
    () => props.modelValue,
    value => {
      if (editor.value && value !== editor.value.getHTML())
        editor.value.commands.setContent(value, { emitUpdate: false })
    }
  )
  watch(
    () => props.disabled,
    value => editor.value?.setEditable(!value)
  )
  const tools = [
    {
      name: '粗体',
      icon: 'lucide:bold',
      active: 'bold',
      run: () => editor.value?.chain().focus().toggleBold().run()
    },
    {
      name: '斜体',
      icon: 'lucide:italic',
      active: 'italic',
      run: () => editor.value?.chain().focus().toggleItalic().run()
    },
    {
      name: '下划线',
      icon: 'lucide:underline',
      active: 'underline',
      run: () => editor.value?.chain().focus().toggleUnderline().run()
    },
    {
      name: '删除线',
      icon: 'lucide:strikethrough',
      active: 'strike',
      run: () => editor.value?.chain().focus().toggleStrike().run()
    },
    {
      name: '无序列表',
      icon: 'lucide:list',
      active: 'bulletList',
      run: () => editor.value?.chain().focus().toggleBulletList().run()
    },
    {
      name: '有序列表',
      icon: 'lucide:list-ordered',
      active: 'orderedList',
      run: () => editor.value?.chain().focus().toggleOrderedList().run()
    },
    {
      name: '引用',
      icon: 'lucide:quote',
      active: 'blockquote',
      run: () => editor.value?.chain().focus().toggleBlockquote().run()
    },
    {
      name: '代码块',
      icon: 'lucide:code',
      active: 'codeBlock',
      run: () => editor.value?.chain().focus().toggleCodeBlock().run()
    }
  ]
  function openUrl(mode: 'link' | 'image') {
    urlMode.value = mode
    url.value = mode === 'link' ? editor.value?.getAttributes('link').href || '' : ''
    urlError.value = ''
  }
  function insertUrl() {
    try {
      const parsed = new URL(url.value.trim())
      if (
        !(urlMode.value === 'image' ? ['https:'] : ['https:', 'http:', 'mailto:']).includes(
          parsed.protocol
        )
      )
        throw new Error()
      if (urlMode.value === 'image')
        editor.value?.chain().focus().setImage({ src: parsed.href }).run()
      else
        editor.value?.chain().focus().extendMarkRange('link').setLink({ href: parsed.href }).run()
      urlMode.value = ''
    } catch {
      urlError.value =
        urlMode.value === 'image' ? '请输入有效的 HTTPS 图片地址' : '请输入有效的网页或邮箱链接'
    }
  }
</script>
<template>
  <div class="rich-editor">
    <div v-if="editor" class="editor-toolbar" role="group" aria-label="正文格式工具">
      <select
        aria-label="段落样式"
        :disabled="disabled"
        :value="
          editor.isActive('heading', { level: 2 })
            ? '2'
            : editor.isActive('heading', { level: 3 })
              ? '3'
              : 'p'
        "
        @change="
          ($event.target as HTMLSelectElement).value === 'p'
            ? editor.chain().focus().setParagraph().run()
            : editor
                .chain()
                .focus()
                .setHeading({ level: Number(($event.target as HTMLSelectElement).value) as 2 | 3 })
                .run()
        "
      >
        <option value="p">正文</option>
        <option value="2">二级标题</option>
        <option value="3">三级标题</option>
      </select>
      <button
        v-for="tool in tools"
        :key="tool.name"
        type="button"
        :aria-label="tool.name"
        :title="tool.name"
        :aria-pressed="editor.isActive(tool.active)"
        :disabled="disabled"
        @click="tool.run"
      >
        <Icon :icon="tool.icon" />
      </button>
      <button
        type="button"
        aria-label="插入链接"
        title="插入链接"
        :disabled="disabled"
        @click="openUrl('link')"
      >
        <Icon icon="lucide:link" />
      </button>
      <button
        v-if="editor.isActive('link')"
        type="button"
        aria-label="移除链接"
        :disabled="disabled"
        @click="editor.chain().focus().unsetLink().run()"
      >
        <Icon icon="lucide:unlink" />
      </button>
      <button
        type="button"
        aria-label="插入图片"
        title="插入图片"
        :disabled="disabled"
        @click="openUrl('image')"
      >
        <Icon icon="lucide:image" />
      </button>
      <button
        type="button"
        aria-label="撤销"
        title="撤销"
        :disabled="disabled || !editor.can().undo()"
        @click="editor.chain().focus().undo().run()"
      >
        <Icon icon="lucide:undo-2" />
      </button>
      <button
        type="button"
        aria-label="重做"
        title="重做"
        :disabled="disabled || !editor.can().redo()"
        @click="editor.chain().focus().redo().run()"
      >
        <Icon icon="lucide:redo-2" />
      </button>
    </div>
    <div v-if="urlMode" class="editor-url">
      <label>
        {{ urlMode === 'image' ? '图片地址' : '链接地址' }}
        <input
          v-model="url"
          type="url"
          placeholder="https://"
          :disabled="disabled"
          @keydown.enter.prevent="insertUrl"
        />
      </label>
      <button type="button" :disabled="disabled" @click="insertUrl">插入</button>
      <button type="button" @click="urlMode = ''">取消</button>
      <span v-if="urlError" role="alert">{{ urlError }}</span>
    </div>
    <EditorContent :editor="editor" />
  </div>
</template>
<style scoped>
  .rich-editor {
    border: 1px solid var(--article-border);
    border-radius: 12px;
    overflow: hidden;
    background: var(--article-surface);
  }
  .editor-toolbar {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 3px;
    padding: 10px;
    border-bottom: 1px solid var(--article-border);
    background: var(--article-soft);
  }
  .editor-toolbar button {
    padding: 8px;
    border-radius: 6px;
    background: transparent;
    color: var(--article-muted);
  }
  .editor-toolbar button svg {
    width: 17px;
    height: 17px;
  }
  .editor-toolbar button[aria-pressed='true'],
  .editor-toolbar button:hover:not(:disabled) {
    background: var(--article-surface);
    color: var(--article-accent);
  }
  .editor-toolbar select {
    width: 98px;
    padding: 6px;
    margin-right: 6px;
    background: var(--article-surface);
    color: var(--article-text);
    border: 1px solid var(--article-border);
    border-radius: 6px;
    font-size: 12px;
  }
  .rich-editor :deep(.tiptap) {
    min-height: 340px;
    padding: 24px;
    outline: none;
  }
  .rich-editor :deep(.tiptap:focus) {
    box-shadow: inset 0 0 0 2px var(--article-accent);
  }
  .rich-editor :deep(.tiptap p.is-editor-empty:first-child::before) {
    content: attr(data-placeholder);
    float: left;
    color: var(--article-muted);
    pointer-events: none;
    height: 0;
  }
  .editor-url {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    align-items: end;
    padding: 12px;
    border-bottom: 1px solid var(--article-border);
  }
  .editor-url label {
    flex: 1;
    font-size: 12px;
  }
  .editor-url input {
    width: 100%;
    display: block;
    padding: 8px;
    border: 1px solid var(--article-border);
    border-radius: 6px;
  }
  .editor-url button {
    padding: 8px;
  }
  .editor-url span {
    width: 100%;
    color: #c33d53;
  }
</style>
