import MarkdownIt from 'markdown-it'

const markdown = new MarkdownIt({ html: false, breaks: true, linkify: true })

// Read the visible content, without Markdown markers or link destinations.
export function markdownToSpeechText(content: string) {
  const parts: string[] = []
  for (const token of markdown.parse(content, {})) {
    if (token.type === 'inline') {
      for (const child of token.children || []) {
        if (['text', 'code_inline', 'image'].includes(child.type)) parts.push(child.content)
        else if (['softbreak', 'hardbreak'].includes(child.type)) parts.push('\n')
      }
    } else if (['fence', 'code_block'].includes(token.type)) {
      parts.push(token.content, '\n')
    } else if (['paragraph_close', 'heading_close', 'tr_close', 'hr'].includes(token.type)) {
      parts.push('\n')
    } else if (['td_close', 'th_close'].includes(token.type)) {
      parts.push('，')
    }
  }
  return parts
    .join('')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n/g, '\n')
    .trim()
}

// Short utterances keep long replies usable across browser speech engines.
export function splitSpeechText(text: string) {
  const maxLength = 160
  const characters = Array.from(text)
  const chunks: string[] = []
  let offset = 0
  while (offset < characters.length) {
    let end = Math.min(offset + maxLength, characters.length)
    if (end < characters.length) {
      for (let index = end - 1; index >= offset + maxLength / 2; index--) {
        if (/[。！？!?；;，,\s]/.test(characters[index])) {
          end = index + 1
          break
        }
      }
    }
    const chunk = characters.slice(offset, end).join('').trim()
    if (chunk) chunks.push(chunk)
    offset = end
  }
  return chunks
}

interface ReaderCallbacks {
  onChange: (messageId: string) => void
  onError: (message: string) => void
}

interface ReadingSession {
  messageId: string
  chunks: string[]
  index: number
  language: string
  voice?: SpeechSynthesisVoice
  utterance?: SpeechSynthesisUtterance
}

export function createMessageReader(callbacks: ReaderCallbacks) {
  const synthesis = typeof window === 'undefined' ? undefined : window.speechSynthesis
  const Utterance = typeof window === 'undefined' ? undefined : window.SpeechSynthesisUtterance
  let session: ReadingSession | undefined

  function stop() {
    if (!session) return
    const previous = session
    session = undefined
    if (previous.utterance) {
      previous.utterance.onend = null
      previous.utterance.onerror = null
    }
    callbacks.onChange('')
    synthesis?.cancel()
  }

  function speakNext(current: ReadingSession) {
    if (session !== current || !synthesis || !Utterance) return
    try {
      const utterance = new Utterance(current.chunks[current.index])
      current.utterance = utterance
      utterance.lang = current.language
      if (current.voice) utterance.voice = current.voice
      utterance.onend = () => {
        if (session !== current || current.utterance !== utterance) return
        current.index++
        if (current.index < current.chunks.length) speakNext(current)
        else {
          session = undefined
          callbacks.onChange('')
        }
      }
      utterance.onerror = event => {
        if (session !== current || current.utterance !== utterance) return
        stop()
        if (!['canceled', 'interrupted'].includes(event.error))
          callbacks.onError('朗读失败，请检查浏览器的语音设置后重试。')
      }
      synthesis.speak(utterance)
    } catch {
      stop()
      callbacks.onError('朗读失败，请检查浏览器的语音设置后重试。')
    }
  }

  function toggle(messageId: string, content: string) {
    if (session?.messageId === messageId) {
      stop()
      return
    }
    stop()
    if (!synthesis || !Utterance) {
      callbacks.onError('当前浏览器不支持朗读，请使用新版 Chrome、Edge 或 Safari。')
      return
    }
    const text = markdownToSpeechText(content)
    if (!text) {
      callbacks.onError('这条回复没有可朗读的文字。')
      return
    }
    try {
      const language = /[\u3400-\u9fff]/.test(text) ? 'zh-CN' : 'en-US'
      const voices = synthesis.getVoices()
      const voice =
        voices.find(item => item.lang.toLowerCase() === language.toLowerCase()) ||
        voices.find(item => item.lang.toLowerCase().startsWith(language.slice(0, 2)))
      const current: ReadingSession = {
        messageId,
        chunks: splitSpeechText(text),
        index: 0,
        language,
        voice
      }
      session = current
      callbacks.onChange(messageId)
      // Browsers can retain a paused state from an earlier speech session.
      synthesis.resume()
      speakNext(current)
    } catch {
      stop()
      callbacks.onError('朗读失败，请检查浏览器的语音设置后重试。')
    }
  }

  return { toggle, stop }
}
