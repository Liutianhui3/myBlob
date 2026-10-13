export interface CaptchaProof {
  captchaTicket: string
  captchaRandstr: string
}
interface CaptchaResult {
  ret: number
  ticket?: string
  randstr?: string
  errorCode?: number
}
interface CaptchaInstance {
  show(): void
  destroy(): void
}
declare global {
  interface Window {
    TencentCaptcha?: new (
      appid: string,
      callback: (result: CaptchaResult) => void,
      options: Record<string, unknown>
    ) => CaptchaInstance
  }
}
let loading: Promise<void> | undefined
function loadSDK() {
  if (window.TencentCaptcha) return Promise.resolve()
  if (loading) return loading
  loading = new Promise<void>((resolve, reject) => {
    const script = document.createElement('script')
    script.src = 'https://turing.captcha.qcloud.com/TCaptcha.js'
    script.async = true
    const timeout = window.setTimeout(() => fail(), 15000)
    function fail() {
      window.clearTimeout(timeout)
      script.remove()
      loading = undefined
      reject(new Error('真人验证加载失败，请检查网络后重试。'))
    }
    script.onerror = fail
    script.onload = () => {
      window.clearTimeout(timeout)
      if (window.TencentCaptcha) resolve()
      else fail()
    }
    document.head.appendChild(script)
  })
  return loading
}

export async function verifyHuman(appid: string, signal: AbortSignal): Promise<CaptchaProof> {
  if (!/^\d+$/.test(appid)) throw new Error('真人验证尚未配置，请联系管理员。')
  await loadSDK()
  if (signal.aborted) throw new DOMException('已取消验证', 'AbortError')
  return new Promise((resolve, reject) => {
    let instance: CaptchaInstance | undefined
    let settled = false
    const finish = (proof?: CaptchaProof, error?: Error) => {
      if (settled) return
      settled = true
      window.clearTimeout(timeout)
      signal.removeEventListener('abort', abort)
      instance?.destroy()
      if (proof) resolve(proof)
      else reject(error || new Error('请完成真人验证后重试。'))
    }
    const abort = () => finish(undefined, new DOMException('已取消验证', 'AbortError'))
    const timeout = window.setTimeout(
      () => finish(undefined, new Error('真人验证已超时，请重试。')),
      120000
    )
    signal.addEventListener('abort', abort, { once: true })
    try {
      instance = new window.TencentCaptcha!(
        appid,
        result => {
          if (result.ret === 0 && !result.errorCode && result.ticket && result.randstr)
            finish({ captchaTicket: result.ticket, captchaRandstr: result.randstr })
          else
            finish(
              undefined,
              new Error(
                result.ret === 2 ? '已取消真人验证，可重新点击登录。' : '真人验证失败，请重试。'
              )
            )
        },
        { userLanguage: 'zh-cn' }
      )
      instance.show()
    } catch {
      finish(undefined, new Error('真人验证无法启动，请重试。'))
    }
  })
}
