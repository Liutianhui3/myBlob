<script setup lang="ts">
  import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
  import { Icon } from '@iconify/vue'
  import { currentUser } from '@/lib/auth'
  import { effortLabels, getChatModels } from '@/lib/chat'
  import type { ChatModel, GenerationOptions } from '@/lib/chat'

  const props = defineProps<{ disabled?: boolean }>()
  const emit = defineEmits<{ change: [value: GenerationOptions | null]; error: [error: unknown] }>()
  const models = ref<ChatModel[]>([])
  const selectedId = ref('')
  const useDefaultModel = ref(true)
  const effort = ref('auto')
  const open = ref<'model' | 'effort' | null>(null)
  const loading = ref(true)
  const failed = ref(false)
  const shell = ref<HTMLElement>()
  const modelTrigger = ref<HTMLButtonElement>()
  const effortTrigger = ref<HTMLButtonElement>()
  const slider = ref<HTMLInputElement>()
  const modelPanel = ref<HTMLElement>()
  const selected = computed(() => models.value.find(model => model.id === selectedId.value))
  const selectedLabel = computed(() => selected.value?.label.replace(/^GPT-/, '') || '')
  const levels = computed(() => ['auto', ...(selected.value?.reasoningEfforts || [])])
  const levelIndex = computed(() => Math.max(0, levels.value.indexOf(effort.value)))
  const isUltra = computed(() => effort.value === 'max')
  const modelChoices = computed(() => [
    {
      key: '$default',
      model: models.value.find(model => model.id === defaultModel),
      label: '默认'
    },
    ...models.value.map(model => ({
      key: model.id,
      model,
      label: model.label.replace(/^GPT-/, '')
    }))
  ])
  const selectedChoice = computed(() => (useDefaultModel.value ? '$default' : selectedId.value))
  const controller = new AbortController()
  let defaultModel = ''
  const storageKey = () => `myblob_chat_settings:${currentUser.value?.id || 'guest'}`

  function publish() {
    if (!selected.value) {
      emit('change', null)
      return
    }
    const value = { model: selectedId.value, reasoningEffort: effort.value }
    emit('change', value)
    try {
      sessionStorage.setItem(
        storageKey(),
        JSON.stringify({ ...value, useDefaultModel: useDefaultModel.value })
      )
    } catch {
      /* Preferences are optional. */
    }
  }
  function restore() {
    let saved: Partial<GenerationOptions> & { useDefaultModel?: boolean } = {}
    try {
      saved = JSON.parse(sessionStorage.getItem(storageKey()) || '{}') || {}
    } catch {
      /* Use configured defaults. */
    }
    const savedModel = models.value.find(item => item.id === saved.model)
    useDefaultModel.value = saved.useDefaultModel === true || !savedModel
    const model =
      (!useDefaultModel.value && savedModel) ||
      models.value.find(item => item.id === defaultModel) ||
      models.value[0]
    selectedId.value = model?.id || ''
    effort.value =
      model &&
      savedModel &&
      typeof saved.reasoningEffort === 'string' &&
      ['auto', ...model.reasoningEfforts].includes(saved.reasoningEffort)
        ? saved.reasoningEffort
        : model?.defaultEffort || 'auto'
    publish()
  }
  async function load() {
    if (controller.signal.aborted) return
    loading.value = true
    failed.value = false
    try {
      const result = await getChatModels(controller.signal)
      if (controller.signal.aborted) return
      if (!Array.isArray(result.models) || !result.models.length)
        throw new Error('暂时没有可用模型')
      models.value = result.models
      defaultModel = result.defaultModel
      restore()
    } catch (error) {
      if (controller.signal.aborted) return
      failed.value = true
      emit('change', null)
      emit('error', error)
    } finally {
      loading.value = false
    }
  }
  function chooseModel(model: ChatModel, useDefault = false) {
    if (props.disabled) return
    selectedId.value = model.id
    useDefaultModel.value = useDefault
    if (!['auto', ...model.reasoningEfforts].includes(effort.value))
      effort.value = model.defaultEffort
    publish()
    open.value = 'effort'
    void nextTick(() => modelTrigger.value?.focus())
  }
  async function moveModel(event: KeyboardEvent) {
    if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key))
      return
    event.preventDefault()
    const choices = modelChoices.value
    const index = choices.findIndex(choice => choice.key === selectedChoice.value)
    const next =
      event.key === 'Home'
        ? 0
        : event.key === 'End'
          ? choices.length - 1
          : (index + (['ArrowUp', 'ArrowLeft'].includes(event.key) ? -1 : 1) + choices.length) %
            choices.length
    const choice = choices[next]
    const model = choice?.model
    if (!model) return
    selectedId.value = model.id
    useDefaultModel.value = choice.key === '$default'
    if (!['auto', ...model.reasoningEfforts].includes(effort.value))
      effort.value = model.defaultEffort
    publish()
    await nextTick()
    modelPanel.value?.querySelector<HTMLButtonElement>('[aria-checked="true"]')?.focus()
  }
  function changeEffort(event: Event) {
    effort.value = levels.value[Number((event.target as HTMLInputElement).value)] || 'auto'
    publish()
  }
  function resetEffort() {
    effort.value = selected.value?.defaultEffort || 'auto'
    publish()
    slider.value?.focus()
  }
  function close(restoreFocus = false) {
    open.value = null
    if (restoreFocus) effortTrigger.value?.focus()
  }
  async function escape() {
    if (open.value === 'model') {
      open.value = 'effort'
      await nextTick()
      modelTrigger.value?.focus()
    } else close(true)
  }
  async function toggle(panel: 'model' | 'effort') {
    if (props.disabled) return
    if (panel === 'effort' && open.value) {
      close()
      return
    }
    open.value = open.value === panel ? null : panel
    await nextTick()
    if (open.value === 'effort') slider.value?.focus()
    if (open.value === 'model')
      modelPanel.value?.querySelector<HTMLButtonElement>(`[aria-checked="true"]`)?.focus()
  }
  function outside(event: PointerEvent) {
    if (!shell.value?.contains(event.target as Node)) close()
  }
  function focusOut(event: FocusEvent) {
    // Replacing the focused panel with v-if can emit focusout with no next target.
    // Outside pointer presses and Escape already close that case safely.
    if (event.relatedTarget && !shell.value?.contains(event.relatedTarget as Node)) close()
  }
  watch(
    () => props.disabled,
    disabled => {
      if (disabled) close()
    }
  )
  watch(
    () => currentUser.value?.id,
    () => {
      close()
      if (models.value.length) restore()
    }
  )
  onMounted(() => {
    document.addEventListener('pointerdown', outside)
    void load()
  })
  onUnmounted(() => {
    controller.abort()
    document.removeEventListener('pointerdown', outside)
  })
</script>

<template>
  <div ref="shell" class="model-settings" @keydown.esc.stop.prevent="escape" @focusout="focusOut">
    <span v-if="loading" class="settings-status" role="status">加载模型…</span>
    <button
      v-else-if="failed"
      type="button"
      class="settings-retry"
      :disabled="disabled"
      @click="load"
    >
      重试加载模型
    </button>
    <button
      v-else
      ref="effortTrigger"
      type="button"
      class="settings-trigger"
      :class="{ 'is-ultra': isUltra }"
      :disabled="disabled"
      :title="selectedLabel + ' · ' + effortLabels[effort]"
      :aria-label="'思考强度：' + effortLabels[effort] + '，选择模型与强度'"
      aria-haspopup="dialog"
      :aria-expanded="open !== null"
      :aria-controls="open === 'model' ? 'chat-model-panel' : 'chat-effort-panel'"
      @click="toggle('effort')"
    >
      <span class="trigger-model-name">{{ selectedLabel }}</span>
      <Icon icon="hugeicons:arrow-down-01" />
    </button>

    <div
      v-if="open === 'model'"
      id="chat-model-panel"
      ref="modelPanel"
      class="settings-panel model-panel"
      role="dialog"
      aria-label="选择模型"
    >
      <p class="panel-title">选择模型</p>
      <div role="radiogroup" aria-label="可用模型" class="model-list" @keydown="moveModel">
        <button
          v-for="choice in modelChoices"
          :key="choice.key"
          type="button"
          class="model-option"
          role="radio"
          :aria-checked="choice.key === selectedChoice"
          :tabindex="choice.key === selectedChoice ? 0 : -1"
          @click="choice.model && chooseModel(choice.model, choice.key === '$default')"
        >
          <span>
            <span class="model-name">{{ choice.label }}</span>
            <small v-if="choice.key === '$default'">推荐模型集</small>
          </span>
          <Icon v-if="choice.key === selectedChoice" icon="hugeicons:tick-02" />
        </button>
      </div>
    </div>
    <div
      v-if="open === 'effort'"
      id="chat-effort-panel"
      class="settings-panel effort-panel"
      :class="{ 'is-ultra': isUltra }"
      role="dialog"
      aria-label="思考强度设置"
    >
      <div class="effort-heading">
        <strong class="effort-title" aria-live="polite">{{ effortLabels[effort] }}</strong>
        <span v-if="isUltra" class="ultra-description">更快消耗使用额度</span>
        <button
          ref="modelTrigger"
          type="button"
          class="model-trigger"
          aria-label="选择模型"
          aria-haspopup="dialog"
          aria-controls="chat-model-panel"
          @click="toggle('model')"
        >
          <span>{{ selectedLabel }}</span>
          <Icon icon="hugeicons:arrow-down-01" />
        </button>
        <button
          type="button"
          class="reset-effort"
          title="恢复默认思考强度"
          aria-label="恢复默认思考强度"
          @click="resetEffort"
        >
          <Icon icon="hugeicons:refresh" />
        </button>
      </div>
      <div
        class="effort-slider"
        :style="{ '--effort-progress': (levelIndex / Math.max(1, levels.length - 1)) * 100 + '%' }"
      >
        <div class="slider-track" aria-hidden="true"><span class="slider-fill"></span></div>
        <div class="effort-ticks" aria-hidden="true">
          <span
            v-for="(level, index) in levels"
            :key="level"
            :class="{ filled: index <= levelIndex }"
          ></span>
        </div>
        <input
          ref="slider"
          type="range"
          min="0"
          :max="Math.max(1, levels.length - 1)"
          step="1"
          :value="levelIndex"
          :disabled="levels.length < 2"
          aria-label="思考强度"
          :aria-valuetext="effortLabels[effort]"
          @keydown.enter.prevent
          @input="changeEffort"
        />
      </div>
      <p v-if="levels.length < 2" class="effort-unavailable">当前模型自动调节思考强度</p>
    </div>
  </div>
</template>

<style scoped>
  .model-settings {
    --effort-accent: #1876ce;
    --ultra-accent: #9255cd;
    position: relative;
    display: flex;
    align-items: center;
    flex-shrink: 0;
    color: var(--chat-text);
    font-size: 12px;
  }
  :global(.dark) .model-settings {
    --effort-accent: #91b0ff;
    --ultra-accent: #c59aff;
  }
  button {
    font: inherit;
    color: inherit;
    cursor: pointer;
    transition:
      transform 160ms ease,
      background-color 160ms ease;
  }
  button:disabled {
    cursor: not-allowed;
    opacity: 0.45;
  }
  .settings-trigger {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 5px;
    min-width: 94px;
    height: 28px;
    padding: 0 11px;
    border: 0;
    border-radius: 999px;
    background: var(--chat-hover);
    background: color-mix(in srgb, var(--chat-text) 7%, var(--chat-input));
    white-space: nowrap;
    color: var(--chat-muted);
  }
  .settings-trigger:hover:not(:disabled) {
    transform: scale(1.04);
  }
  .trigger-model-name {
    max-width: 140px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .settings-trigger:hover:not(:disabled),
  .settings-trigger[aria-expanded='true'] {
    filter: brightness(0.95);
  }
  .model-settings .settings-trigger svg {
    width: 13px;
    height: 13px;
  }
  .settings-panel {
    position: absolute;
    z-index: 25;
    right: 0;
    bottom: calc(100% + 12px);
    width: 256px;
    max-width: calc(100vw - 86px);
    box-sizing: border-box;
    border: 1px solid var(--chat-border);
    border-radius: 16px;
    background: var(--chat-input);
    color: var(--chat-text);
    box-shadow:
      0 5px 24px #00000018,
      0 1px 4px #00000008;
  }
  .model-panel {
    padding: 7px;
  }
  .panel-title {
    margin: 0;
    padding: 8px 11px 9px;
    color: var(--chat-muted);
    font-size: 12px;
    font-weight: 500;
  }
  .model-list {
    max-height: min(350px, 45dvh);
    overflow-y: auto;
  }
  .model-option {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 12px;
    width: 100%;
    min-height: 38px;
    padding: 9px 11px;
    border: 0;
    border-radius: 9px;
    background: transparent;
    text-align: left;
  }
  .model-option:hover,
  .model-option:focus-visible {
    background: var(--chat-hover);
  }
  .model-name {
    display: block;
    font-size: 13px;
    font-weight: 450;
  }
  .model-option small {
    display: block;
    margin-top: 3px;
    color: var(--chat-muted);
    font-size: 11px;
  }
  .model-settings .model-option svg {
    width: 17px;
    height: 17px;
    flex-shrink: 0;
  }
  .effort-panel {
    padding: 12px 12px 11px;
  }
  .effort-heading {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0;
    padding: 0 24px;
  }
  .effort-title {
    color: var(--effort-accent);
    font-size: 14px;
    line-height: 20px;
    font-weight: 600;
  }
  .model-settings .model-trigger {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 3px;
    max-width: 100%;
    min-height: 18px;
    padding: 0 4px;
    border: 0;
    border-radius: 5px;
    background: transparent;
    color: var(--chat-muted);
    font-size: 11px;
  }
  .model-trigger span {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .model-settings .model-trigger svg {
    width: 12px;
    height: 12px;
    transform: rotate(-90deg);
  }
  .model-trigger:hover {
    background: var(--chat-hover);
    color: var(--chat-text);
    transform: scale(1.03);
  }
  .model-settings .reset-effort {
    position: absolute;
    top: -5px;
    right: -6px;
    display: grid;
    place-items: center;
    width: 24px;
    height: 24px;
    padding: 0;
    border: 0;
    border-radius: 7px;
    background: transparent;
    color: var(--chat-muted);
  }
  .model-settings .reset-effort svg {
    width: 16px;
    height: 16px;
  }
  .reset-effort:hover {
    background: var(--chat-hover);
    transform: scale(1.06);
  }
  .ultra-description {
    color: var(--chat-muted);
    font-size: 11px;
    line-height: 15px;
    white-space: nowrap;
  }
  .is-ultra .effort-title {
    color: var(--ultra-accent);
  }
  .effort-slider {
    position: relative;
    height: 26px;
    margin-top: 10px;
  }
  .slider-track {
    position: absolute;
    inset: 1px 0;
    overflow: hidden;
    border-radius: 999px;
    background: var(--chat-border);
  }
  .slider-fill {
    display: block;
    width: var(--effort-progress);
    height: 100%;
    border-radius: inherit;
    background: #319bff;
  }
  .is-ultra .slider-fill {
    background: linear-gradient(105deg, #355cda 0%, #5d63e8 42%, #a774f2 76%, #a06aee 100%);
  }
  .is-ultra .slider-fill::after {
    content: '';
    display: block;
    height: 100%;
    opacity: 0.35;
    background-image:
      radial-gradient(circle, #fff 0.5px, transparent 0.8px),
      radial-gradient(circle, #fff 0.4px, transparent 0.7px);
    background-size:
      9px 11px,
      13px 7px;
    background-position:
      2px 1px,
      7px 4px;
  }
  .effort-ticks {
    position: absolute;
    inset: 0 13px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    pointer-events: none;
  }
  .effort-ticks span {
    width: 4px;
    height: 4px;
    border-radius: 50%;
    background: var(--chat-muted);
    opacity: 0.3;
  }
  .effort-ticks .filled {
    background: #fff;
    opacity: 0.4;
  }
  .effort-slider input {
    position: relative;
    display: block;
    z-index: 1;
    appearance: none;
    -webkit-appearance: none;
    width: 100%;
    height: 26px;
    margin: 0;
    border: 0;
    border-radius: 999px;
    background: transparent;
    cursor: pointer;
  }
  .effort-slider input::-webkit-slider-thumb {
    -webkit-appearance: none;
    width: 26px;
    height: 26px;
    border-radius: 50%;
    background: #fff;
    border: 1px solid #dedee6;
    box-shadow: 0 1px 4px #00000018;
  }
  .effort-slider input::-moz-range-thumb {
    width: 24px;
    height: 24px;
    border-radius: 50%;
    background: #fff;
    border: 1px solid #dedee6;
    box-shadow: 0 1px 4px #00000018;
  }
  .effort-slider input:disabled {
    cursor: default;
  }
  .effort-unavailable {
    margin: 8px 0 0;
    color: var(--chat-muted);
    font-size: 11px;
    text-align: center;
  }
  .settings-status,
  .settings-retry {
    font-size: 11px;
    color: var(--chat-muted);
  }
  .settings-retry {
    min-height: 30px;
    padding: 4px 8px;
    border: 0;
    border-radius: 999px;
    background: var(--chat-hover);
  }
  .model-settings button:focus-visible,
  .model-settings input:focus-visible {
    outline: 2px solid #4673ea;
    outline-offset: 2px;
  }
  @media (max-width: 540px) {
    .settings-trigger {
      min-width: 90px;
      padding-inline: 9px;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .model-settings button,
    .model-settings button:hover:not(:disabled) {
      transition: none;
      transform: none;
    }
  }
</style>
