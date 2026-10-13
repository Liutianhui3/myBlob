<script setup lang="ts">
  import { computed, nextTick, onMounted, onUnmounted, reactive, ref, watch } from 'vue'
  import { useRoute, useRouter } from 'vue-router'
  import { Icon } from '@iconify/vue'
  import { gsap } from 'gsap'
  import { saveSession } from '@/lib/auth'
  import { login, register } from '@/api/auth'
  import { verifyHuman } from '@/lib/captcha'

  const route = useRoute()
  const router = useRouter()
  const registering = computed(() => route.path === '/register')
  const form = reactive({ username: '', email: '', password: '', confirm: '' })
  const errors = reactive<Record<string, string>>({})
  const showPassword = ref(false)
  const busy = ref(false)
  const verifying = ref(false)
  const captchaAppId = import.meta.env.VITE_TENCENT_CAPTCHA_APP_ID?.trim() || ''
  let verificationController: AbortController | undefined
  const message = ref('')
  const success = ref(false)
  const formElement = ref<HTMLFormElement>()
  const panel = ref<HTMLElement>()
  let animationContext: gsap.Context | undefined
  const modeLink = (path: string) => ({
    path,
    query: route.query.redirect ? { redirect: route.query.redirect } : {}
  })
  const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches
  onMounted(() => {
    animationContext = gsap.context(() => {}, panel.value)
  })
  onUnmounted(() => {
    verificationController?.abort()
    animationContext?.revert()
  })

  function beforeLeave() {
    if (panel.value) gsap.set(panel.value, { height: panel.value.offsetHeight, overflow: 'hidden' })
  }
  function leave(element: Element, done: () => void) {
    animationContext?.add(() => {
      gsap.to(element, {
        opacity: 0,
        y: -8,
        duration: reducedMotion() ? 0 : 0.14,
        ease: 'power2.in',
        onComplete: done
      })
    })
  }
  function enter(element: Element, done: () => void) {
    if (!panel.value) {
      done()
      return
    }
    const style = getComputedStyle(panel.value)
    const targetHeight =
      (element as HTMLElement).offsetHeight +
      parseFloat(style.paddingTop) +
      parseFloat(style.paddingBottom)
    animationContext?.add(() => {
      gsap
        .timeline({
          defaults: { ease: 'power2.out' },
          onComplete: () => {
            gsap.set(panel.value!, { clearProps: 'height,overflow' })
            gsap.set(element, { clearProps: 'opacity,transform' })
            done()
            element.querySelector<HTMLElement>('h2')?.focus({ preventScroll: true })
          }
        })
        .to(panel.value!, { height: targetHeight, duration: reducedMotion() ? 0 : 0.3 }, 0)
        .fromTo(
          element,
          { opacity: 0, y: 10 },
          { opacity: 1, y: 0, duration: reducedMotion() ? 0 : 0.25 },
          reducedMotion() ? 0 : 0.06
        )
    })
  }
  const strength = computed(
    () =>
      [
        form.password.length >= 8,
        /[a-zA-Z]/.test(form.password),
        /\d/.test(form.password),
        /[^a-zA-Z0-9]/.test(form.password)
      ].filter(Boolean).length
  )

  watch(registering, () => {
    verificationController?.abort()
    form.password = ''
    form.confirm = ''
    message.value = ''
    success.value = false
    showPassword.value = false
    Object.keys(errors).forEach(key => delete errors[key])
  })

  async function submit() {
    if (busy.value) return
    Object.keys(errors).forEach(key => delete errors[key])
    message.value = ''
    success.value = false
    if (!/^[a-zA-Z0-9_]{3,32}$/.test(form.username.trim()))
      errors.username = '请输入 3–32 位字母、数字或下划线'
    if (!form.password || form.password.length > 128) errors.password = '请输入密码，最多 128 位'
    if (registering.value) {
      if (form.email.trim().length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim()))
        errors.email = '请输入有效的邮箱地址'
      if (form.password.length < 8 || !/[a-zA-Z]/.test(form.password) || !/\d/.test(form.password))
        errors.password = '密码需为 8–128 位，包含字母和数字'
      if (form.password !== form.confirm) errors.confirm = '两次输入的密码不一致'
    }
    if (Object.keys(errors).length) {
      await nextTick()
      formElement.value?.querySelector<HTMLInputElement>('[aria-invalid="true"]')?.focus()
      return
    }
    busy.value = true
    try {
      if (registering.value) {
        await register({
          username: form.username.trim(),
          email: form.email.trim(),
          password: form.password
        })
        await router.replace(modeLink('/login'))
        success.value = true
        message.value = '注册成功，请使用新账号登录。'
      } else {
        verificationController = new AbortController()
        verifying.value = true
        const proof = await verifyHuman(captchaAppId, verificationController.signal)
        verifying.value = false
        const session = await login({
          username: form.username.trim(),
          password: form.password,
          ...proof
        })
        saveSession(session.token, session.user)
        form.password = ''
        const destination =
          typeof route.query.redirect === 'string' &&
          /^\/(home|article|articleManage|roleManage|chat|profile|knowledge)(?:[/?#]|$)/.test(
            route.query.redirect
          )
            ? route.query.redirect
            : '/home'
        await router.replace(destination)
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return
      message.value =
        error instanceof TypeError
          ? '暂时无法连接服务，请稍后重试。'
          : error instanceof Error && ['TimeoutError', 'AbortError'].includes(error.name)
            ? '请求超时，请重试。'
            : error instanceof Error
              ? error.message
              : '操作失败，请重试。'
    } finally {
      verifying.value = false
      verificationController = undefined
      busy.value = false
    }
  }
</script>

<template>
  <main class="auth-page">
    <header class="auth-header">
      <RouterLink class="brand" to="/login">
        <span class="brand-mark">
          m
          <span>·</span>
        </span>
        myBlob
        <span class="brand-caption">个人博客</span>
      </RouterLink>
      <span class="back-link">
        <Icon icon="lucide:shield-check" />
        登录后开启你的空间
      </span>
    </header>
    <section class="auth-shell">
      <aside class="story-panel">
        <span class="eyebrow">
          <span class="small-dot"></span>
          IDEAS LIVE HERE
        </span>
        <h1>
          记录热爱，
          <br />
          让想法
          <span>自由生长。</span>
        </h1>
        <p class="story-copy">
          一个属于思考与分享的角落。
          <br />
          留下灵感，连接同样好奇的你。
        </p>
        <div class="illustration" aria-hidden="true">
          <div class="orbit orbit-one"></div>
          <div class="orbit orbit-two"></div>
          <div class="note note-back">
            <span></span>
            <span></span>
            <span></span>
          </div>
          <div class="note note-front">
            <div class="note-icon"><Icon icon="lucide:feather" /></div>
            <strong>
              每一个想法
              <br />
              都值得被记录
            </strong>
            <div class="note-line"></div>
            <div class="note-line short"></div>
            <span class="note-tag">MAKE SOMETHING GOOD</span>
          </div>
          <div class="floating-plus">+</div>
          <div class="floating-star">✦</div>
          <div class="orbit-dot"></div>
        </div>
        <div class="story-footer">
          <Icon icon="lucide:sparkles" />
          <span>从一个想法开始，创造更多可能。</span>
        </div>
      </aside>
      <div ref="panel" class="form-panel">
        <Transition
          mode="out-in"
          :css="false"
          @before-leave="beforeLeave"
          @leave="leave"
          @enter="enter"
        >
          <div :key="registering ? 'register' : 'login'">
            <div class="form-intro">
              <span class="eyebrow">{{ registering ? 'A NEW CHAPTER' : 'WELCOME BACK' }}</span>
              <h2 tabindex="-1">
                {{ registering ? '开启你的新篇章' : '欢迎回来' }}
                <span class="heading-dot">.</span>
              </h2>
              <p class="subtitle">
                {{
                  registering
                    ? '创建账号，与你的下一个灵感相遇。'
                    : '登录你的账号，继续探索与分享。'
                }}
              </p>
            </div>
            <nav class="mode-switch" aria-label="账号操作">
              <RouterLink
                :to="modeLink('/login')"
                :aria-current="!registering ? 'page' : undefined"
                :class="{ active: !registering }"
                :tabindex="busy ? -1 : 0"
                :style="busy ? { pointerEvents: 'none' } : {}"
              >
                登录
              </RouterLink>
              <RouterLink
                :to="modeLink('/register')"
                :aria-current="registering ? 'page' : undefined"
                :class="{ active: registering }"
                :tabindex="busy ? -1 : 0"
                :style="busy ? { pointerEvents: 'none' } : {}"
              >
                注册
              </RouterLink>
            </nav>
            <p
              v-if="message"
              class="feedback"
              :class="{ success }"
              :role="success ? 'status' : 'alert'"
            >
              {{ message }}
            </p>
            <form ref="formElement" novalidate @submit.prevent="submit">
              <fieldset :disabled="busy">
                <div class="field">
                  <label for="username">用户名</label>
                  <div class="input-wrap">
                    <Icon icon="lucide:user-round" />
                    <input
                      id="username"
                      v-model="form.username"
                      autocomplete="username"
                      autocapitalize="none"
                      :spellcheck="false"
                      placeholder="输入你的用户名"
                      maxlength="32"
                      :aria-invalid="!!errors.username"
                      aria-describedby="username-hint"
                    />
                  </div>
                  <p id="username-hint" :class="{ 'field-error': errors.username }">
                    {{ errors.username || (registering ? '3–32 位字母、数字或下划线' : '') }}
                  </p>
                </div>
                <div v-if="registering" class="field">
                  <label for="email">邮箱</label>
                  <div class="input-wrap">
                    <Icon icon="lucide:mail" />
                    <input
                      id="email"
                      v-model="form.email"
                      type="email"
                      autocomplete="email"
                      placeholder="you@example.com"
                      maxlength="254"
                      :aria-invalid="!!errors.email"
                      aria-describedby="email-hint"
                    />
                  </div>
                  <p id="email-hint" class="field-error">{{ errors.email }}</p>
                </div>
                <div class="field">
                  <label for="password">密码</label>
                  <div class="input-wrap">
                    <Icon icon="lucide:lock-keyhole" />
                    <input
                      id="password"
                      v-model="form.password"
                      :type="showPassword ? 'text' : 'password'"
                      :autocomplete="registering ? 'new-password' : 'current-password'"
                      placeholder="输入你的密码"
                      maxlength="128"
                      :aria-invalid="!!errors.password"
                      aria-describedby="password-hint"
                    />
                    <button
                      type="button"
                      class="eye-button"
                      :aria-label="showPassword ? '隐藏密码' : '显示密码'"
                      :aria-pressed="showPassword"
                      @click="showPassword = !showPassword"
                    >
                      <Icon :icon="showPassword ? 'lucide:eye-off' : 'lucide:eye'" />
                    </button>
                  </div>
                  <p id="password-hint" :class="{ 'field-error': errors.password }">
                    {{ errors.password || (registering ? '8–128 位，至少包含字母和数字' : '') }}
                  </p>
                  <div
                    v-if="registering && form.password"
                    class="strength"
                    :aria-label="`密码强度：${strength < 3 ? '较弱' : strength === 3 ? '合格' : '强'}`"
                  >
                    <span v-for="n in 4" :key="n" :class="{ filled: n <= strength }"></span>
                    <small>{{ strength < 3 ? '较弱' : strength === 3 ? '合格' : '强' }}</small>
                  </div>
                </div>
                <div v-if="registering" class="field">
                  <label for="confirm">确认密码</label>
                  <div class="input-wrap">
                    <Icon icon="lucide:shield-check" />
                    <input
                      id="confirm"
                      v-model="form.confirm"
                      :type="showPassword ? 'text' : 'password'"
                      autocomplete="new-password"
                      placeholder="再次输入密码"
                      maxlength="128"
                      :aria-invalid="!!errors.confirm"
                      aria-describedby="confirm-hint"
                    />
                  </div>
                  <p id="confirm-hint" class="field-error">{{ errors.confirm }}</p>
                </div>
                <!-- <div v-if="!registering" class="human-verification" aria-live="polite">
                  <Icon icon="lucide:shield-check" />
                  <span>{{ verifying ? '请在弹窗中完成真人验证' : '登录前将进行安全验证' }}</span>
                </div> -->
                <button class="submit-button" type="submit" :disabled="busy">
                  <Icon v-if="busy" icon="lucide:loader-circle" class="spinner" />
                  {{
                    verifying ? '正在验证…' : busy ? '正在处理…' : registering ? '创建账号' : '登录'
                  }}
                  <Icon v-if="!busy" icon="lucide:arrow-right" />
                </button>
              </fieldset>
            </form>
            <p class="switch-copy">
              {{ registering ? '已经有账号？' : '还没有账号？' }}
              <RouterLink
                :to="modeLink(registering ? '/login' : '/register')"
                :tabindex="busy ? -1 : 0"
                :style="busy ? { pointerEvents: 'none' } : {}"
              >
                {{ registering ? '立即登录' : '创建一个账号' }}
                <span>↗</span>
              </RouterLink>
            </p>
            <div class="security-note">
              <Icon icon="lucide:shield-check" />
              密码加密存储，安心开启你的旅程
            </div>
          </div>
        </Transition>
      </div>
    </section>
    <footer class="page-footer">
      <span>© {{ new Date().getFullYear() }} myBlob</span>
      <span>记录 · 思考 · 分享</span>
    </footer>
  </main>
</template>

<style scoped>
  .human-verification {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px 14px;
    margin-bottom: 16px;
    border: 1px solid var(--line);
    border-radius: 10px;
    background: #f7f7fb;
    color: var(--secondary);
    font-size: 13px;
  }
  .auth-page {
    --ink: #242337;
    --secondary: #6c6b7f;
    --purple: #514def;
    --line: #e6e5ee;
    --surface: #fff;
    min-height: 100svh;
    background: #f7f7fb;
    color: var(--ink);
    padding: 32px 6vw 24px;
    display: flex;
    flex-direction: column;
    font-size: 14px;
  }
  .auth-header,
  .page-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    max-width: 1180px;
    margin: auto;
    gap: 16px;
  }
  .auth-header {
    margin-top: 0;
    margin-bottom: 44px;
  }
  .brand {
    display: flex;
    align-items: center;
    gap: 12px;
    font-size: 23px;
    font-weight: 750;
    color: var(--ink);
    text-decoration: none;
  }
  .brand-mark {
    width: 40px;
    height: 40px;
    border-radius: 12px;
    background: var(--purple);
    color: white;
    display: grid;
    place-content: center;
    font-size: 28px;
    position: relative;
  }
  .brand-mark span {
    position: absolute;
    right: 5px;
    bottom: 0;
    color: #c4c2ff;
  }
  .brand-caption {
    font-size: 12px;
    font-weight: 400;
    color: var(--secondary);
    border-left: 1px solid var(--line);
    padding-left: 12px;
  }
  .back-link {
    display: flex;
    align-items: center;
    gap: 8px;
    color: var(--secondary);
    text-decoration: none;
    min-height: 44px;
  }
  .back-link svg {
    width: 16px;
  }
  .auth-shell {
    width: 100%;
    max-width: 1060px;
    display: grid;
    grid-template-columns: 1fr 1fr;
    background: var(--surface);
    border: 1px solid var(--line);
    border-radius: 24px;
    overflow: hidden;
    box-shadow: 0 20px 70px #27214e08;
    margin: auto;
  }
  .story-panel {
    position: relative;
    background: #f0efff;
    padding: 54px 48px 32px;
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }
  .eyebrow {
    font-size: 11px;
    letter-spacing: 2.2px;
    font-weight: 650;
    color: var(--purple);
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .small-dot {
    width: 6px;
    height: 6px;
    background: var(--purple);
    border-radius: 50%;
  }
  .story-panel h1 {
    font-size: 38px;
    line-height: 1.5;
    letter-spacing: -1px;
    margin: 24px 0 16px;
    font-weight: 700;
  }
  .story-panel h1 span {
    color: var(--purple);
  }
  .story-copy {
    color: var(--secondary);
    line-height: 1.9;
    font-size: 14px;
  }
  .illustration {
    position: relative;
    height: 270px;
    margin: 18px 0;
    flex: 1;
    min-height: 240px;
  }
  .orbit {
    position: absolute;
    left: 50%;
    top: 50%;
    border: 1px solid #dad7f6;
    border-radius: 50%;
    transform: translate(-50%, -50%) rotate(-25deg);
    width: 340px;
    height: 210px;
  }
  .orbit-two {
    width: 250px;
    height: 250px;
  }
  .note {
    position: absolute;
    left: 50%;
    top: 50%;
    border-radius: 14px;
    box-shadow: 0 15px 35px #48428b12;
  }
  .note-back {
    width: 175px;
    height: 210px;
    background: #d8d5fb;
    transform: translate(-28%, -55%) rotate(13deg);
    padding: 30px 20px;
  }
  .note-back span {
    height: 5px;
    background: #b9b4e9;
    display: block;
    margin: 15px 0;
    width: 80%;
  }
  .note-front {
    width: 187px;
    height: 217px;
    background: #fff;
    transform: translate(-64%, -45%) rotate(-9deg);
    padding: 22px;
    color: #343046;
  }
  .note-icon {
    width: 32px;
    height: 32px;
    border-radius: 9px;
    background: #eeecff;
    color: #655ce1;
    display: grid;
    place-items: center;
    margin-bottom: 14px;
  }
  .note-icon svg {
    width: 19px;
  }
  .note-front strong {
    font-size: 18px;
    line-height: 1.65;
  }
  .note-line {
    height: 4px;
    background: #eceaf5;
    margin-top: 13px;
    border-radius: 4px;
  }
  .note-line.short {
    width: 60%;
    margin-top: 7px;
  }
  .note-tag {
    font-size: 7px;
    letter-spacing: 1.2px;
    color: #918aaa;
    display: block;
    margin-top: 19px;
  }
  .floating-plus {
    position: absolute;
    left: 7%;
    top: 30%;
    font-size: 30px;
    color: #8c83d5;
  }
  .floating-star {
    position: absolute;
    right: 6%;
    bottom: 24%;
    font-size: 36px;
    color: #8277d9;
  }
  .orbit-dot {
    position: absolute;
    right: 15%;
    top: 15%;
    width: 12px;
    height: 12px;
    background: #b5abed;
    border-radius: 50%;
  }
  .story-footer {
    display: flex;
    gap: 9px;
    color: #736c99;
    font-size: 12px;
    align-items: center;
  }
  .story-footer svg {
    width: 17px;
  }
  .form-panel {
    padding: 55px 54px;
    align-self: center;
  }
  .form-panel h2 {
    font-size: 30px;
    letter-spacing: -0.6px;
    font-weight: 700;
    margin: 10px 0;
  }
  .heading-dot {
    color: var(--purple);
  }
  .subtitle {
    color: var(--secondary);
    line-height: 1.8;
    font-size: 14px;
    margin-bottom: 26px;
  }
  .mode-switch {
    display: flex;
    background: #f5f5f9;
    border-radius: 10px;
    padding: 4px;
    margin-bottom: 25px;
  }
  .mode-switch a {
    width: 50%;
    text-align: center;
    padding: 11px;
    text-decoration: none;
    color: var(--secondary);
    border-radius: 7px;
    font-weight: 600;
  }
  .mode-switch a.active {
    background: var(--surface);
    color: var(--purple);
    box-shadow: 0 2px 6px #23203c0d;
  }
  fieldset {
    border: 0;
    padding: 0;
    margin: 0;
    min-width: 0;
  }
  .field {
    margin-bottom: 18px;
  }
  .field label {
    display: block;
    font-size: 13px;
    font-weight: 600;
    margin-bottom: 8px;
  }
  .input-wrap {
    display: flex;
    align-items: center;
    border: 1px solid var(--line);
    border-radius: 10px;
    background: var(--surface);
    padding-left: 14px;
    transition:
      border-color 0.2s,
      box-shadow 0.2s;
  }
  .input-wrap:focus-within {
    border-color: var(--purple);
    box-shadow: 0 0 0 3px #514def16;
  }
  .input-wrap:has([aria-invalid='true']) {
    border-color: #c33948;
  }
  .input-wrap > svg {
    width: 18px;
    height: 18px;
    flex-shrink: 0;
    color: #9693a8;
  }
  .input-wrap input {
    color: var(--ink);
    background: transparent;
    width: 100%;
    height: 48px;
    font-size: 14px;
    padding: 0 12px;
    min-width: 0;
    border: 0;
    outline: 0;
  }
  .input-wrap input::placeholder {
    color: #8b889b;
  }
  .eye-button {
    border: 0;
    background: none;
    color: var(--secondary);
    width: 44px;
    height: 44px;
    flex-shrink: 0;
    cursor: pointer;
    display: grid;
    place-items: center;
  }
  .eye-button svg {
    width: 18px;
  }
  .field p {
    font-size: 12px;
    color: var(--secondary);
    margin-top: 6px;
    line-height: 1.5;
  }
  .field-error {
    color: #bc3042 !important;
  }
  .submit-button {
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 10px;
    background: var(--purple);
    color: white;
    border: 0;
    border-radius: 10px;
    width: 100%;
    min-height: 49px;
    font-weight: 600;
    font-size: 14px;
    cursor: pointer;
    text-decoration: none;
    margin-top: 8px;
    transition: background 0.2s;
  }
  .submit-button:hover {
    background: #433fd3;
  }
  .submit-button svg {
    width: 17px;
  }
  .submit-button:disabled {
    opacity: 0.65;
    cursor: wait;
  }
  .switch-copy {
    text-align: center;
    color: var(--secondary);
    margin-top: 24px;
    font-size: 13px;
  }
  .switch-copy a {
    color: var(--purple);
    font-weight: 600;
    text-decoration: none;
    margin-left: 6px;
    display: inline-flex;
    align-items: center;
    min-height: 44px;
    gap: 5px;
  }
  .security-note {
    border-top: 1px solid var(--line);
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 7px;
    color: var(--secondary);
    font-size: 11px;
    margin-top: 16px;
    padding-top: 22px;
  }
  .security-note svg {
    width: 14px;
  }
  .page-footer {
    color: var(--secondary);
    font-size: 11px;
    margin-bottom: 0;
    margin-top: 32px;
    max-width: 1060px;
  }
  .feedback {
    padding: 12px;
    border-radius: 8px;
    background: #fff0f2;
    color: #a12839;
    font-size: 13px;
    line-height: 1.6;
    margin-bottom: 18px;
  }
  .feedback.success {
    color: #176447;
    background: #ecf8f1;
  }
  .strength {
    display: flex;
    align-items: center;
    gap: 5px;
    margin-top: 8px;
  }
  .strength > span {
    height: 3px;
    border-radius: 3px;
    background: var(--line);
    flex: 1;
  }
  .strength > span.filled {
    background: var(--purple);
  }
  .strength small {
    color: var(--secondary);
    font-size: 11px;
    margin-left: 5px;
  }
  .welcome-icon {
    background: #efedff;
    color: var(--purple);
    width: 56px;
    height: 56px;
    border-radius: 16px;
    display: grid;
    place-items: center;
    margin-bottom: 24px;
  }
  .switch-button {
    border: 0;
    background: none;
    color: var(--secondary);
    cursor: pointer;
    min-height: 44px;
    display: block;
    margin: 16px auto 0;
  }
  :is(a, button):focus-visible {
    outline: 3px solid #9b97fc;
    outline-offset: 4px;
  }
  .spinner {
    animation: spin 1s linear infinite;
  }
  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
  :global(body:has(.auth-page)) {
    min-width: 320px;
  }
  :global(.dark) .auth-page {
    --ink: #f0eef9;
    --secondary: #b0adc1;
    --purple: #a29bff;
    --line: #393548;
    --surface: #22202d;
    background: #17151f;
  }
  :global(.dark) .story-panel {
    background: #2a2540;
  }
  :global(.dark) .mode-switch {
    background: #181620;
  }
  :global(.dark) .submit-button {
    background: #6557e8;
    color: white;
  }
  :global(.dark) .submit-button:hover {
    background: #7467ef;
  }
  :global(.dark) .story-footer {
    color: #b8afd7;
  }
  @media (min-width: 1600px) {
    .auth-shell {
      min-height: 650px;
    }
    .story-panel h1 {
      font-size: 42px;
    }
    .illustration {
      min-height: 300px;
    }
  }
  @media (max-width: 850px) {
    .auth-page {
      padding: 22px 24px;
    }
    .story-panel {
      padding: 36px 28px;
    }
    .story-panel h1 {
      font-size: 30px;
    }
    .form-panel {
      padding: 36px 28px;
    }
    .orbit {
      width: 260px;
    }
    .story-footer {
      font-size: 11px;
    }
  }
  @media (max-width: 640px) {
    .auth-page {
      padding: 16px 20px 24px;
    }
    .auth-header {
      margin-bottom: 24px;
    }
    .brand-caption {
      display: none;
    }
    .brand {
      font-size: 20px;
    }
    .auth-shell {
      display: block;
      max-width: 440px;
      border-radius: 18px;
    }
    .story-panel {
      display: none;
    }
    .form-panel {
      padding: 32px 24px;
    }
    .form-panel h2 {
      font-size: 28px;
    }
    .page-footer {
      max-width: 440px;
    }
    .back-link {
      font-size: 12px;
    }
    .security-note {
      font-size: 11px;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    *,
    *::before,
    *::after {
      animation: none !important;
      transition: none !important;
    }
  }
</style>
