<script setup lang="ts">
  import { computed, onUnmounted, reactive, ref, watch } from 'vue'
  import { onBeforeRouteLeave, useRouter } from 'vue-router'
  import { Icon, addCollection } from '@iconify/vue'
  import icons from '@/assets/profile-icons.json'
  import UserAvatar from '@/components/UserAvatar.vue'
  import LocationSelect from '@/components/LocationSelect.vue'
  import { currentUser } from '@/lib/auth'
  import { cloneUserProfile, ProfileError, saveUserProfile, userProfile } from '@/lib/profile'

  addCollection(icons)
  const router = useRouter()
  const draft = reactive(cloneUserProfile(userProfile.value))
  const skillInput = ref('')
  const dirty = computed(
    () =>
      skillInput.value.trim() !== '' || JSON.stringify(draft) !== JSON.stringify(userProfile.value)
  )
  const avatarInput = ref<HTMLInputElement>()
  const avatarBusy = ref(false)
  const saving = ref(false)
  const expired = ref(false)
  const message = ref('')
  const failure = ref(false)
  const displayName = computed(
    () => userProfile.value.name.trim() || currentUser.value?.username || '我的账户'
  )
  const previewWebsite = computed(() =>
    userProfile.value.website.replace(/^https?:\/\//, '').replace(/\/$/, '')
  )

  watch(
    [draft, skillInput],
    () => {
      message.value = ''
      failure.value = false
    },
    { flush: 'sync' }
  )
  function reset() {
    Object.assign(draft, cloneUserProfile(userProfile.value))
    skillInput.value = ''
    message.value = ''
    failure.value = false
  }

  function addSkill() {
    const skill = skillInput.value.trim()
    if (!skill) return true
    if (draft.skills.includes(skill)) {
      skillInput.value = ''
      return true
    }
    if (draft.skills.length >= 30) {
      failure.value = true
      message.value = '最多添加 30 项技术栈。'
      return false
    }
    draft.skills.push(skill)
    skillInput.value = ''
    return true
  }

  function addExperience() {
    if (draft.workExperiences.length >= 20) return
    draft.workExperiences.push({
      id: crypto.randomUUID(),
      company: '',
      position: '',
      startDate: '',
      endDate: '',
      description: ''
    })
  }

  function moveExperience(index: number, direction: number) {
    const target = index + direction
    if (target < 0 || target >= draft.workExperiences.length) return
    const [item] = draft.workExperiences.splice(index, 1)
    draft.workExperiences.splice(target, 0, item)
  }

  async function save() {
    if (avatarBusy.value || saving.value) return
    failure.value = false
    if (!draft.name.trim()) {
      failure.value = true
      message.value = '请输入昵称，不能只包含空格。'
      return
    }
    if (!addSkill()) return
    const invalidExperience = draft.workExperiences.findIndex(
      item =>
        !item.company.trim() ||
        !item.position.trim() ||
        !item.startDate ||
        (item.endDate && item.endDate < item.startDate)
    )
    if (invalidExperience >= 0) {
      failure.value = true
      message.value = `请完善第 ${invalidExperience + 1} 段工作经历，结束时间不能早于开始时间。`
      return
    }
    if (
      draft.phone &&
      (!/^\+?[\d\s()-]{6,30}$/.test(draft.phone.trim()) ||
        draft.phone.replace(/\D/g, '').length < 6)
    ) {
      failure.value = true
      message.value = '请填写有效的手机号码，可包含国际区号。'
      return
    }
    saving.value = true
    try {
      await saveUserProfile(draft)
      Object.assign(draft, cloneUserProfile(userProfile.value))
      message.value = '资料已保存'
    } catch (error) {
      if (error instanceof ProfileError && error.status === 401) {
        expired.value = true
        await router.replace({ path: '/login', query: { redirect: '/profile' } })
        return
      }
      failure.value = true
      message.value = error instanceof Error ? error.message : '保存失败，请重试。'
    } finally {
      saving.value = false
    }
  }

  async function changeAvatar(event: Event) {
    const input = event.target as HTMLInputElement
    const file = input.files?.[0]
    input.value = ''
    if (!file) return
    message.value = ''
    failure.value = true
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      message.value = '请选择 JPG、PNG 或 WebP 图片。'
      return
    }
    if (file.size > 2 * 1024 * 1024) {
      message.value = '图片不能超过 2 MB，请换一张较小的图片。'
      return
    }
    avatarBusy.value = true
    const url = URL.createObjectURL(file)
    try {
      const image = new Image()
      image.src = url
      await image.decode()
      const canvas = document.createElement('canvas')
      canvas.width = canvas.height = 256
      const context = canvas.getContext('2d')
      if (!context) throw new Error('无法处理图片')
      const size = Math.min(image.width, image.height)
      context.drawImage(
        image,
        (image.width - size) / 2,
        (image.height - size) / 2,
        size,
        size,
        0,
        0,
        256,
        256
      )
      draft.avatar = canvas.toDataURL('image/png')
      failure.value = false
    } catch {
      message.value = '图片读取失败，请选择其他图片。'
    } finally {
      URL.revokeObjectURL(url)
      avatarBusy.value = false
    }
  }

  onBeforeRouteLeave(() => {
    if (expired.value) return true
    if (saving.value) return false
    if (avatarBusy.value) return false
    return !dirty.value || window.confirm('资料还未保存，确定离开吗？')
  })
  function beforeUnload(event: BeforeUnloadEvent) {
    if (dirty.value || avatarBusy.value || saving.value) {
      event.preventDefault()
      event.returnValue = ''
    }
  }
  window.addEventListener('beforeunload', beforeUnload)
  onUnmounted(() => window.removeEventListener('beforeunload', beforeUnload))
</script>

<template>
  <main class="profile-page">
    <header class="page-header">
      <RouterLink to="/home" class="back-link">
        <Icon icon="hugeicons:arrow-left-02" />
        返回首页
      </RouterLink>
      <div class="page-heading">
        <div>
          <p class="eyebrow">MY ACCOUNT</p>
          <h1>个人资料</h1>
          <p class="page-description">介绍一下自己，让每一次相遇更有温度。</p>
        </div>
        <span class="page-badge">我的账户</span>
      </div>
    </header>

    <div class="profile-grid">
      <aside class="profile-preview" aria-label="已保存的个人资料">
        <div class="preview-cover"></div>
        <div class="preview-content">
          <UserAvatar class="preview-avatar" :src="userProfile.avatar" />
          <p class="preview-label">已保存资料</p>
          <h2>{{ displayName }}</h2>
          <p class="username">@{{ currentUser?.username }}</p>
          <p class="preview-bio">
            {{ userProfile.bio.trim() || '用一句话，分享你的热爱与日常。' }}
          </p>
          <ul class="preview-details">
            <li v-if="userProfile.location.trim()">
              <Icon icon="hugeicons:location-01" />
              <span>{{ userProfile.location }}</span>
            </li>
            <li v-if="userProfile.email.trim()">
              <Icon icon="hugeicons:mail-01" />
              <span>{{ userProfile.email }}</span>
            </li>
            <li v-if="userProfile.phone.trim()">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="1.5"
                aria-hidden="true"
              >
                <path
                  d="M21 16v3a2 2 0 0 1-2.2 2A18 18 0 0 1 3 5.2 2 2 0 0 1 5 3h3l2 5-2 2a14 14 0 0 0 6 6l2-2z"
                />
              </svg>
              <span>{{ userProfile.phone }}</span>
            </li>
            <li v-if="userProfile.website.trim()">
              <Icon icon="hugeicons:link-01" />
              <span>{{ previewWebsite }}</span>
            </li>
          </ul>
          <div class="preview-footnote">这里的你，正在变得更完整。</div>
        </div>
      </aside>

      <form class="profile-form" @submit.prevent="save">
        <div class="section-heading">
          <h2>基本信息</h2>
          <p>记录你的名字、联系方式，以及正在热爱的事。</p>
        </div>
        <fieldset class="profile-fields" :disabled="saving" :aria-busy="saving">
          <div class="avatar-editor">
            <UserAvatar class="editor-avatar" :src="draft.avatar" />
            <div class="avatar-controls">
              <div class="avatar-buttons">
                <button
                  type="button"
                  class="secondary-button upload-button"
                  :disabled="avatarBusy"
                  @click="avatarInput?.click()"
                >
                  <Icon icon="hugeicons:camera-01" />
                  {{ avatarBusy ? '正在处理…' : '更换头像' }}
                </button>
                <button
                  v-if="draft.avatar"
                  type="button"
                  class="text-button"
                  :disabled="avatarBusy"
                  @click="draft.avatar = ''"
                >
                  移除
                </button>
              </div>
              <p id="avatar-help">JPG、PNG 或 WebP，最大 2 MB</p>
              <input
                ref="avatarInput"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                class="visually-hidden"
                tabindex="-1"
                aria-label="选择头像图片"
                aria-describedby="avatar-help"
                @change="changeAvatar"
              />
            </div>
          </div>

          <div class="fields-grid">
            <div class="field">
              <label for="profile-name">
                昵称
                <span class="required">*</span>
              </label>
              <input
                id="profile-name"
                v-model="draft.name"
                required
                maxlength="40"
                autocomplete="nickname"
                placeholder="你希望大家如何称呼你"
              />
            </div>
            <div class="field">
              <label for="profile-username">
                用户名
                <span class="field-tag">不可修改</span>
              </label>
              <input
                id="profile-username"
                :value="currentUser?.username"
                readonly
                autocomplete="username"
              />
            </div>
            <div class="field">
              <label for="profile-email">
                邮箱
                <span class="required">*</span>
              </label>
              <input
                id="profile-email"
                v-model="draft.email"
                type="email"
                required
                maxlength="254"
                autocomplete="email"
                placeholder="hello@example.com"
              />
            </div>
            <div class="field">
              <label for="profile-phone">手机号码</label>
              <input
                id="profile-phone"
                v-model="draft.phone"
                type="tel"
                maxlength="30"
                autocomplete="tel"
                placeholder="例如：13800138000"
              />
            </div>
            <div class="field full-width">
              <label for="profile-location">所在地</label>
              <LocationSelect v-model="draft.location" />
            </div>
            <div class="field full-width">
              <label for="profile-website">个人网站</label>
              <input
                id="profile-website"
                v-model="draft.website"
                type="url"
                pattern="https?://.+"
                maxlength="240"
                autocomplete="url"
                placeholder="https://your-website.com"
                aria-describedby="website-help"
              />
              <p id="website-help" class="field-help">
                你的博客、作品集，或任何想分享的地方，以 https:// 或 http:// 开头。
              </p>
            </div>
            <div class="field full-width">
              <label for="profile-bio">个人简介</label>
              <textarea
                id="profile-bio"
                v-model="draft.bio"
                rows="4"
                maxlength="200"
                placeholder="分享你的职业、兴趣，或一句喜欢的话…"
                aria-describedby="bio-count"
              ></textarea>
              <span id="bio-count" class="character-count">{{ draft.bio.length }} / 200</span>
              <p class="field-help">显示在首页姓名下方。</p>
            </div>
          </div>

          <section class="profile-section" aria-labelledby="about-heading">
            <div class="section-heading">
              <h2 id="about-heading">关于</h2>
              <p>详细介绍你的经历、兴趣和正在做的事，保存后展示在首页。</p>
            </div>
            <div class="field">
              <label for="profile-about" class="visually-hidden">关于</label>
              <textarea
                id="profile-about"
                v-model="draft.about"
                rows="5"
                maxlength="2000"
                placeholder="写下更多关于自己的故事…"
                aria-describedby="about-count"
              ></textarea>
              <span id="about-count" class="character-count">{{ draft.about.length }} / 2000</span>
            </div>
          </section>

          <section class="profile-section" aria-labelledby="skills-heading">
            <div class="section-heading">
              <h2 id="skills-heading">技术栈</h2>
              <p>添加你熟悉的技术，按添加顺序展示，最多 30 项。</p>
            </div>
            <div v-if="draft.skills.length" class="skills-editor">
              <span v-for="(skill, index) in draft.skills" :key="skill" class="skill-tag">
                {{ skill }}
                <button
                  type="button"
                  :aria-label="`移除 ${skill}`"
                  @click="draft.skills.splice(index, 1)"
                >
                  ×
                </button>
              </span>
            </div>
            <div class="skill-input-row">
              <label for="profile-skill" class="visually-hidden">添加技术</label>
              <input
                id="profile-skill"
                v-model="skillInput"
                maxlength="40"
                placeholder="例如：Vue、TypeScript，回车添加"
                @keydown.enter.prevent="addSkill"
              />
              <button
                type="button"
                class="secondary-button"
                :disabled="!skillInput.trim()"
                @click="addSkill"
              >
                添加
              </button>
            </div>
          </section>

          <section class="profile-section" aria-labelledby="work-heading">
            <div class="section-heading">
              <h2 id="work-heading">工作经历</h2>
              <p>维护公司、职位、任职时间与工作内容，最多 20 段。</p>
            </div>
            <p v-if="!draft.workExperiences.length" class="empty-experiences">
              还没有工作经历，点击下方按钮添加。
            </p>
            <article
              v-for="(item, index) in draft.workExperiences"
              :key="item.id"
              class="experience-editor"
            >
              <header class="experience-editor-heading">
                <h3>经历 {{ index + 1 }}</h3>
                <div class="experience-actions">
                  <button
                    type="button"
                    class="text-button"
                    :disabled="index === 0"
                    :aria-label="`上移经历 ${index + 1}`"
                    @click="moveExperience(index, -1)"
                  >
                    上移
                  </button>
                  <button
                    type="button"
                    class="text-button"
                    :disabled="index === draft.workExperiences.length - 1"
                    :aria-label="`下移经历 ${index + 1}`"
                    @click="moveExperience(index, 1)"
                  >
                    下移
                  </button>
                  <button
                    type="button"
                    class="text-button remove-experience"
                    :aria-label="`删除经历 ${index + 1}`"
                    @click="draft.workExperiences.splice(index, 1)"
                  >
                    删除
                  </button>
                </div>
              </header>
              <div class="fields-grid">
                <div class="field">
                  <label :for="`work-company-${item.id}`">
                    公司名称
                    <span class="required">*</span>
                  </label>
                  <input
                    :id="`work-company-${item.id}`"
                    v-model="item.company"
                    required
                    maxlength="100"
                    placeholder="公司或组织名称"
                  />
                </div>
                <div class="field">
                  <label :for="`work-position-${item.id}`">
                    职位
                    <span class="required">*</span>
                  </label>
                  <input
                    :id="`work-position-${item.id}`"
                    v-model="item.position"
                    required
                    maxlength="100"
                    placeholder="例如：前端开发工程师"
                  />
                </div>
                <div class="field">
                  <label :for="`work-start-${item.id}`">
                    开始时间
                    <span class="required">*</span>
                  </label>
                  <input
                    :id="`work-start-${item.id}`"
                    v-model="item.startDate"
                    type="month"
                    required
                    min="1900-01"
                    max="9999-12"
                  />
                </div>
                <div class="field">
                  <label :for="`work-end-${item.id}`">结束时间</label>
                  <input
                    :id="`work-end-${item.id}`"
                    v-model="item.endDate"
                    type="month"
                    :min="item.startDate || '1900-01'"
                    max="9999-12"
                  />
                  <p class="field-help">留空表示至今。</p>
                </div>
                <div class="field full-width">
                  <label :for="`work-description-${item.id}`">工作内容</label>
                  <textarea
                    :id="`work-description-${item.id}`"
                    v-model="item.description"
                    rows="3"
                    maxlength="2000"
                    placeholder="分享主要职责、项目或成果…"
                  ></textarea>
                  <span class="character-count">{{ item.description.length }} / 2000</span>
                </div>
              </div>
            </article>
            <button
              type="button"
              class="secondary-button"
              :disabled="draft.workExperiences.length >= 20"
              @click="addExperience"
            >
              ＋ 添加工作经历
            </button>
          </section>
        </fieldset>
        <div class="form-footer">
          <div
            class="save-status"
            role="status"
            aria-live="polite"
            :class="{ 'is-error': failure, 'is-success': message && !failure }"
          >
            <Icon v-if="message && !failure" icon="hugeicons:checkmark-circle-02" />
            <span>
              {{
                message ||
                (saving ? '正在保存资料…' : dirty ? '有尚未保存的修改' : '资料已与账户同步')
              }}
            </span>
          </div>
          <div class="footer-buttons">
            <button
              type="button"
              class="secondary-button"
              :disabled="!dirty || avatarBusy || saving"
              @click="reset"
            >
              取消修改
            </button>
            <button type="submit" class="primary-button" :disabled="!dirty || avatarBusy || saving">
              {{ saving ? '正在保存…' : '保存资料' }}
            </button>
          </div>
        </div>
      </form>
    </div>
  </main>
</template>

<style scoped>
  .profile-page {
    --surface: rgba(255, 255, 255, 0.94);
    --text: #242338;
    --muted: #757486;
    --border: #eae9f1;
    --input: #fff;
    --accent: #514def;
    position: relative;
    z-index: 1;
    width: min(1080px, 100%);
    box-sizing: border-box;
    padding: 42px 32px 112px;
    color: var(--text);
    color-scheme: light;
  }
  .profile-fields {
    min-width: 0;
    padding: 0;
    margin: 0;
    border: 0;
  }
  .back-link {
    display: inline-flex;
    gap: 8px;
    align-items: center;
    color: var(--muted);
    text-decoration: none;
    font-size: 13px;
    min-height: 32px;
  }
  svg {
    width: 20px;
    height: 20px;
    flex-shrink: 0;
  }
  .back-link:hover {
    color: var(--accent);
  }
  .page-heading {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    margin: 25px 0 30px;
  }
  .eyebrow {
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.17em;
    color: var(--accent);
    margin-bottom: 8px;
  }
  h1 {
    font-size: 30px;
    font-weight: 650;
    letter-spacing: -0.04em;
  }
  .page-description {
    margin-top: 10px;
    font-size: 13px;
    line-height: 1.7;
    color: var(--muted);
  }
  .page-badge {
    border: 1px solid var(--border);
    border-radius: 999px;
    padding: 8px 14px;
    background: var(--surface);
    color: var(--muted);
    font-size: 12px;
    white-space: nowrap;
  }
  .profile-grid {
    display: grid;
    grid-template-columns: 280px minmax(0, 1fr);
    gap: 24px;
    align-items: start;
  }
  .profile-preview,
  .profile-form {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 20px;
    box-shadow: 0 8px 40px #28214d06;
  }
  .profile-preview {
    overflow: hidden;
  }
  .preview-cover {
    height: 94px;
    background: #eeecff;
  }
  .preview-content {
    padding: 0 24px;
  }
  .preview-avatar {
    width: 80px;
    height: 80px;
    margin-top: -40px;
    border: 5px solid var(--input);
    box-sizing: border-box;
  }
  .preview-label {
    color: var(--muted);
    font-size: 11px;
    margin: 18px 0 8px;
  }
  .preview-content h2 {
    font-size: 23px;
    line-height: 1.5;
    overflow-wrap: anywhere;
  }
  .username {
    color: var(--muted);
    font-size: 12px;
    margin-top: 4px;
    overflow-wrap: anywhere;
  }
  .preview-bio {
    color: var(--muted);
    font-size: 13px;
    line-height: 1.9;
    margin: 22px 0;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
  }
  .preview-details {
    display: grid;
    gap: 14px;
    font-size: 12px;
    color: var(--muted);
  }
  .preview-details li {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    line-height: 20px;
  }
  .preview-details span {
    overflow-wrap: anywhere;
    min-width: 0;
  }
  .preview-details svg {
    width: 17px;
  }
  .preview-footnote {
    border-top: 1px solid var(--border);
    padding: 20px 0;
    margin-top: 28px;
    font-size: 11px;
    color: var(--muted);
  }
  .profile-form {
    padding: 30px;
    min-width: 0;
  }
  .section-heading h2 {
    font-size: 18px;
    font-weight: 600;
  }
  .section-heading p {
    color: var(--muted);
    font-size: 12px;
    margin-top: 8px;
    line-height: 1.7;
  }
  .profile-section {
    border-top: 1px solid var(--border);
    margin-top: 28px;
    padding-top: 26px;
  }
  .profile-section > .section-heading {
    margin-bottom: 20px;
  }
  .skills-editor {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-bottom: 14px;
  }
  .skill-tag {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    max-width: 100%;
    overflow-wrap: anywhere;
    background: #514def10;
    color: var(--accent);
    border-radius: 7px;
    padding: 4px 9px;
    font-size: 12px;
  }
  .skill-tag button {
    background: none;
    border: 0;
    color: inherit;
    padding: 0 4px;
    min-width: 24px;
    min-height: 28px;
    font-size: 18px;
  }
  .skill-input-row {
    display: flex;
    gap: 10px;
  }
  .skill-input-row input {
    flex: 1;
    min-width: 0;
  }
  .empty-experiences {
    color: var(--muted);
    font-size: 12px;
    margin-bottom: 18px;
  }
  .experience-editor {
    border: 1px solid var(--border);
    border-radius: 12px;
    padding: 18px;
    margin-bottom: 16px;
  }
  .experience-editor-heading {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 10px;
    margin-bottom: 18px;
  }
  .experience-editor-heading h3 {
    font-size: 13px;
    font-weight: 600;
  }
  .experience-actions {
    display: flex;
    gap: 12px;
  }
  .experience-actions .remove-experience {
    color: #bc414e;
  }
  .avatar-editor {
    display: flex;
    align-items: center;
    gap: 18px;
    padding: 26px 0;
    border-bottom: 1px solid var(--border);
    margin-bottom: 26px;
  }
  .editor-avatar {
    width: 60px;
    height: 60px;
  }
  .avatar-buttons {
    display: flex;
    gap: 12px;
    align-items: center;
  }
  .avatar-controls p {
    font-size: 11px;
    color: var(--muted);
    margin-top: 9px;
  }
  .fields-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 23px 20px;
  }
  .field {
    min-width: 0;
  }
  .full-width {
    grid-column: 1 / -1;
  }
  label {
    display: block;
    font-size: 12px;
    font-weight: 550;
    margin-bottom: 9px;
  }
  .required {
    color: var(--accent);
  }
  .field-tag {
    color: var(--muted);
    font-size: 10px;
    font-weight: 400;
    margin-left: 5px;
  }
  input,
  textarea {
    display: block;
    width: 100%;
    box-sizing: border-box;
    padding: 11px 13px;
    border: 1px solid var(--border);
    border-radius: 9px;
    color: var(--text);
    background: var(--input);
    font-size: 13px;
    line-height: 20px;
    transition:
      border-color 0.15s,
      box-shadow 0.15s;
  }
  input::placeholder,
  textarea::placeholder {
    color: #9291a2;
  }
  input:focus,
  textarea:focus {
    outline: none;
    border-color: var(--accent);
    box-shadow: 0 0 0 3px #514def12;
  }
  input[readonly] {
    color: var(--muted);
    background: #f7f7fa;
  }
  textarea {
    resize: vertical;
    min-height: 108px;
  }
  .field-help {
    margin-top: 8px;
    font-size: 11px;
    color: var(--muted);
    line-height: 1.7;
  }
  .character-count {
    display: block;
    margin-top: 7px;
    text-align: right;
    font-size: 11px;
    color: var(--muted);
  }
  .form-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 16px;
    border-top: 1px solid var(--border);
    padding-top: 24px;
    margin-top: 23px;
  }
  .save-status {
    display: flex;
    gap: 7px;
    align-items: center;
    font-size: 11px;
    color: var(--muted);
    line-height: 1.6;
    flex: 1;
    min-width: 130px;
  }
  .save-status svg {
    width: 16px;
    height: 16px;
  }
  .is-success {
    color: #21815d;
  }
  .is-error,
  .storage-warning {
    color: #bc414e;
  }
  .storage-warning {
    font-size: 12px;
    line-height: 1.7;
    margin-top: 16px;
  }
  .footer-buttons {
    display: flex;
    gap: 10px;
  }
  button {
    font: inherit;
    cursor: pointer;
    transition: background 0.15s;
  }
  .primary-button,
  .secondary-button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 7px;
    min-height: 40px;
    padding: 9px 17px;
    border-radius: 9px;
    font-size: 12px;
    font-weight: 500;
    white-space: nowrap;
  }
  .primary-button {
    color: #fff;
    background: var(--accent);
    border: 1px solid var(--accent);
  }
  .primary-button:hover:not(:disabled) {
    background: #423ed3;
  }
  .secondary-button {
    color: var(--text);
    background: var(--input);
    border: 1px solid var(--border);
  }
  .secondary-button:hover:not(:disabled) {
    background: #514def0a;
  }
  .upload-button {
    min-height: 34px;
    padding: 6px 11px;
  }
  .upload-button svg {
    width: 16px;
    height: 16px;
  }
  .text-button {
    background: none;
    border: 0;
    color: var(--muted);
    padding: 8px 0;
    font-size: 12px;
  }
  button:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }
  button:focus-visible,
  a:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 4px;
  }
  .visually-hidden {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
    border: 0;
  }
  :global(.dark .profile-page) {
    --surface: rgba(23, 23, 30, 0.96);
    --text: #efedf7;
    --muted: #a19eb4;
    --border: #34323f;
    --input: #202029;
    --accent: #9690ff;
    color-scheme: dark;
  }
  :global(.dark .profile-page .preview-cover) {
    background: #302d49;
  }
  :global(.dark .profile-page input[readonly]) {
    background: #191920;
  }
  :global(.dark .profile-page .primary-button) {
    background: #6862eb;
    border-color: #6862eb;
  }
  :global(.dark .profile-page .is-success) {
    color: #7ed5ad;
  }
  :global(.dark .profile-page .is-error),
  :global(.dark .profile-page .storage-warning) {
    color: #ff969f;
  }
  @media (max-width: 800px) {
    .profile-page {
      padding: 24px 20px 100px;
    }
    .profile-grid {
      grid-template-columns: 220px minmax(0, 1fr);
      gap: 18px;
    }
    .profile-form {
      padding: 23px;
    }
    .fields-grid {
      grid-template-columns: minmax(0, 1fr);
      gap: 20px;
    }
    .form-footer {
      align-items: flex-start;
      flex-direction: column;
    }
    .footer-buttons {
      width: 100%;
      justify-content: flex-end;
    }
  }
  @media (max-width: 620px) {
    .profile-page {
      padding-inline: 16px;
    }
    .page-heading {
      margin-top: 20px;
    }
    h1 {
      font-size: 27px;
    }
    .page-badge {
      display: none;
    }
    .profile-grid {
      grid-template-columns: minmax(0, 1fr);
    }
    .preview-cover {
      height: 66px;
    }
    .preview-content {
      padding-inline: 22px;
    }
    .preview-avatar {
      width: 68px;
      height: 68px;
      margin-top: -34px;
    }
    .preview-label {
      margin-top: 12px;
    }
    .preview-bio {
      margin: 15px 0;
    }
    .preview-footnote {
      margin-top: 20px;
      padding-block: 16px;
    }
    .profile-form {
      padding: 23px 20px;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    input,
    textarea,
    button {
      transition: none;
    }
  }
</style>
