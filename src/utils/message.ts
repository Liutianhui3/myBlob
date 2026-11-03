import { createApp, h } from 'vue'
import GlobalMessage from '@/components/GlobalMessage.vue'
import type { MessageType } from '@/components/GlobalMessage.vue'

export interface MessageOptions {
  message: string
  type?: MessageType
  duration?: number
}

let messageInstance: ReturnType<typeof createApp> | null = null
let container: HTMLDivElement | null = null
let activeKey = ''

export function showMessage(options: MessageOptions | string) {
  const opts: MessageOptions = typeof options === 'string' ? { message: options } : options
  const key = `${opts.type || 'info'}:${opts.message}`
  if (messageInstance && activeKey === key) return
  activeKey = key

  // 如果已存在消息,先移除
  if (messageInstance && container) {
    messageInstance.unmount()
    container.remove()
    messageInstance = null
    container = null
  }

  // 创建容器
  container = document.createElement('div')
  document.body.appendChild(container)

  // 创建消息实例
  messageInstance = createApp({
    render() {
      return h(GlobalMessage, {
        ...opts,
        onClose: () => {
          if (messageInstance && container) {
            messageInstance.unmount()
            container.remove()
            messageInstance = null
            container = null
          }
        }
      })
    }
  })

  messageInstance.mount(container)
}

// 便捷方法
export const message = {
  success(msg: string, duration = 3000) {
    showMessage({ message: msg, type: 'success', duration })
  },
  error(msg: string, duration = 4000) {
    showMessage({ message: msg, type: 'error', duration })
  },
  warning(msg: string, duration = 3500) {
    showMessage({ message: msg, type: 'warning', duration })
  },
  info(msg: string, duration = 3000) {
    showMessage({ message: msg, type: 'info', duration })
  }
}
