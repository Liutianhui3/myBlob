<script setup lang="ts">
  import { computed } from 'vue'
  import MarkdownIt from 'markdown-it'
  import hljs from 'highlight.js/lib/common'
  import ChatDiagram from './ChatDiagram.vue'
  import ChatSpreadsheet from './ChatSpreadsheet.vue'
  import ChatImageAttachment from './ChatImageAttachment.vue'
  import { parseSpreadsheet, type SpreadsheetFile } from '@/lib/spreadsheet'
  import { parseDiagram, type ChatDiagram as Diagram } from '@/lib/diagram'

  const props = defineProps<{ content: string; conversationId?: string; messageId?: string }>()
  const md = new MarkdownIt({
    html: false,
    breaks: true,
    linkify: true,
    highlight(code: string, language: string) {
      return language && hljs.getLanguage(language)
        ? hljs.highlight(code, { language, ignoreIllegals: true }).value
        : md.utils.escapeHtml(code)
    }
  })
  const validateLink = md.validateLink.bind(md)
  md.validateLink = url =>
    /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(url) || validateLink(url)
  const defaultLink = md.renderer.rules.link_open
  md.renderer.rules.link_open = (tokens, index, options, env, renderer) => {
    tokens[index].attrSet('target', '_blank')
    tokens[index].attrSet('rel', 'noopener noreferrer')
    return defaultLink
      ? defaultLink(tokens, index, options, env, renderer)
      : renderer.renderToken(tokens, index, options)
  }
  const fence = md.renderer.rules.fence!
  md.renderer.rules.fence = (tokens, index, options, env, renderer) => {
    const language = md.utils.escapeHtml(tokens[index].info.trim().split(/\s+/)[0] || 'Text')
    return `<section class="code-block"><div class="code-title"><span>${language}</span><button type="button" data-copy-code aria-label="复制代码">复制代码</button></div>${fence(tokens, index, options, env, renderer)}</section>`
  }
  const rendered = computed(() => {
    const tokens = md.parse(props.content, {})
    const parts: {
      html?: string
      diagram?: Diagram
      spreadsheet?: SpreadsheetFile
      image?: { url: string; alt: string }
    }[] = []
    let start = 0
    for (let index = 0; index < tokens.length; index++) {
      const token = tokens[index]
      const children = tokens[index + 1]?.children
      if (
        token.type === 'paragraph_open' &&
        children?.length === 1 &&
        children[0].type === 'image' &&
        tokens[index + 2]?.type === 'paragraph_close'
      ) {
        const image = children[0]
        const url = image.attrGet('src') || ''
        if (/^https?:\/\//i.test(url) || /^data:image\/(png|jpeg|webp);base64,/.test(url)) {
          if (index > start)
            parts.push({ html: md.renderer.render(tokens.slice(start, index), md.options, {}) })
          parts.push({ image: { url, alt: image.content || 'AI 生成的图片' } })
          index += 2
          start = index + 1
          continue
        }
      }
      if (
        token.type !== 'fence' ||
        token.level !== 0 ||
        !['diagram', 'xlsx'].includes(token.info.trim())
      )
        continue
      // MarkdownIt also parses unclosed fences; wait for the closing line during streaming.
      const lines = props.content.split('\n')
      const lastLine = token.map ? lines[token.map[1] - 1]?.trim() : ''
      if (
        !lastLine ||
        !new RegExp(`^${token.markup[0]}{${token.markup.length},}\\s*$`).test(lastLine)
      )
        continue
      const diagram = token.info.trim() === 'diagram' ? parseDiagram(token.content) : null
      const spreadsheet = token.info.trim() === 'xlsx' ? parseSpreadsheet(token.content) : null
      if (!diagram && !spreadsheet) continue
      if (index > start)
        parts.push({ html: md.renderer.render(tokens.slice(start, index), md.options, {}) })
      parts.push(diagram ? { diagram } : { spreadsheet: spreadsheet! })
      start = index + 1
    }
    if (start < tokens.length)
      parts.push({ html: md.renderer.render(tokens.slice(start), md.options, {}) })
    return parts
  })
  async function copyCode(event: MouseEvent) {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-copy-code]')
    if (!button) return
    try {
      await navigator.clipboard.writeText(
        button.closest('.code-block')?.querySelector('code')?.textContent || ''
      )
      button.textContent = '已复制'
      setTimeout(() => {
        if (button.isConnected) button.textContent = '复制代码'
      }, 1800)
    } catch {
      button.textContent = '复制失败'
    }
  }
</script>

<template>
  <div class="chat-markdown" @click="copyCode">
    <template v-for="(part, index) in rendered" :key="index">
      <ChatDiagram v-if="part.diagram" :diagram="part.diagram" />
      <ChatSpreadsheet v-else-if="part.spreadsheet" :file="part.spreadsheet" />
      <ChatImageAttachment
        v-else-if="part.image"
        generated
        :conversation-id="conversationId"
        :message-id="messageId"
        :attachment="{ type: 'image', mime: '', name: part.image.alt, data: part.image.url }"
      />
      <div v-else v-html="part.html" />
    </template>
  </div>
</template>

<style scoped>
  .chat-markdown {
    font-size: 16px;
    line-height: 1.85;
    overflow-wrap: anywhere;
  }
  .chat-markdown :deep(p) {
    margin: 0 0 18px;
  }
  .chat-markdown :deep(h1),
  .chat-markdown :deep(h2),
  .chat-markdown :deep(h3) {
    margin: 26px 0 12px;
    font-weight: 650;
    line-height: 1.5;
  }
  .chat-markdown :deep(h1) {
    font-size: 23px;
  }
  .chat-markdown :deep(h2) {
    font-size: 20px;
  }
  .chat-markdown :deep(h3) {
    font-size: 17px;
  }
  .chat-markdown :deep(ul),
  .chat-markdown :deep(ol) {
    margin: 12px 0 20px;
    padding-left: 24px;
    list-style: revert;
  }
  .chat-markdown :deep(li) {
    margin: 5px 0;
  }
  .chat-markdown :deep(li p) {
    margin: 4px 0;
  }
  .chat-markdown :deep(a) {
    color: var(--chat-link);
    text-decoration: underline;
    text-underline-offset: 3px;
  }
  .chat-markdown :deep(blockquote) {
    border-left: 3px solid var(--chat-border);
    margin: 18px 0;
    padding-left: 18px;
    color: var(--chat-muted);
  }
  .chat-markdown :deep(code),
  .chat-markdown :deep(pre *) {
    font-family: 'Cascadia Code', Consolas, monospace !important;
  }
  .chat-markdown :deep(p code),
  .chat-markdown :deep(li code) {
    background: var(--chat-hover);
    padding: 2px 5px;
    border-radius: 5px;
    font-size: 0.88em;
  }
  .chat-markdown :deep(.code-block) {
    margin: 22px 0;
    background: var(--chat-code);
    border-radius: 20px;
    overflow: hidden;
  }
  .chat-markdown :deep(.code-title) {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 20px;
    font-size: 12px;
  }
  .chat-markdown :deep(.code-title button) {
    border: 0;
    background: transparent;
    cursor: pointer;
    color: var(--chat-muted);
    font-size: 12px;
    padding: 4px 6px;
  }
  .chat-markdown :deep(pre) {
    margin: 0;
    padding: 6px 20px 20px;
    overflow-x: auto;
    font-size: 13px;
    line-height: 1.7;
  }
  .chat-markdown :deep(table) {
    display: block;
    width: 100%;
    overflow-x: auto;
    border-collapse: collapse;
    margin: 20px 0;
  }
  .chat-markdown :deep(th),
  .chat-markdown :deep(td) {
    padding: 10px 14px;
    border: 1px solid var(--chat-border);
    text-align: left;
  }
  .chat-markdown :deep(th) {
    background: var(--chat-hover);
  }
  .chat-markdown :deep(hr) {
    border: 0;
    border-top: 1px solid var(--chat-border);
    margin: 24px 0;
  }
  .chat-markdown :deep(img) {
    max-width: 100%;
    border-radius: 12px;
  }
  .chat-markdown :deep(.hljs-keyword),
  .chat-markdown :deep(.hljs-selector-tag) {
    color: #ba397b;
  }
  .chat-markdown :deep(.hljs-string),
  .chat-markdown :deep(.hljs-attr) {
    color: #16835e;
  }
  .chat-markdown :deep(.hljs-title),
  .chat-markdown :deep(.hljs-built_in) {
    color: #6553c7;
  }
  .chat-markdown :deep(.hljs-number),
  .chat-markdown :deep(.hljs-literal) {
    color: #b55b1b;
  }
  .chat-markdown :deep(.hljs-comment) {
    color: var(--chat-muted);
  }
  :global(.dark .chat-markdown .hljs-keyword) {
    color: #ee90bf;
  }
  :global(.dark .chat-markdown .hljs-string) {
    color: #80cbaa;
  }
  :global(.dark .chat-markdown .hljs-title),
  :global(.dark .chat-markdown .hljs-built_in) {
    color: #b0a1ef;
  }
</style>
