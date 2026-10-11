<script setup lang="ts">
  import { onMounted, onUnmounted, ref } from 'vue'
  import { gsap } from 'gsap'
  import BlurReveal from '@/components/BlurReveal.vue'
  import { userProfile } from '@/lib/profile'
  const root = ref<HTMLElement>()
  let motion: gsap.Context | undefined
  const expanded = ref<string[]>([])
  function toggle(id: string, event: MouseEvent) {
    const opening = !expanded.value.includes(id)
    expanded.value = opening
      ? [...expanded.value, id]
      : expanded.value.filter(value => value !== id)
    const button = event.currentTarget as HTMLButtonElement
    const details = button.closest('.experience')?.querySelector<HTMLElement>('.experience-details')
    const arrow = button.querySelector<SVGElement>('.work-chevron')
    if (!details || !arrow) return
    const duration = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 0.4
    motion?.add(() => {
      gsap.to(details, {
        // Height must reflow the following experiences as the content opens and closes.
        height: opening ? 'auto' : 0,
        autoAlpha: opening ? 1 : 0,
        duration,
        ease: 'power2.inOut',
        overwrite: true
      })
      gsap.to(arrow, {
        rotation: opening ? 90 : 0,
        duration,
        ease: 'power2.inOut',
        overwrite: true
      })
    })
  }
  onMounted(() => {
    motion = gsap.context(() => {}, root.value)
  })
  onUnmounted(() => motion?.revert())
  function formatMonth(value: string) {
    const [year, month] = value.split('-')
    return `${year}.${Number(month)}`
  }
</script>
<template>
  <section v-if="userProfile.workExperiences.length" id="work" ref="root" class="mt-5">
    <BlurReveal :delay="0.2" :duration="0.4">
      <h2 class="text-xl font-bold mb-3">工作经历</h2>
      <div class="experience-list">
        <article v-for="item in userProfile.workExperiences" :key="item.id" class="experience">
          <span class="company-avatar" aria-hidden="true">{{ item.company.slice(0, 2) }}</span>
          <div class="experience-body">
            <div class="experience-heading">
              <button
                v-if="item.description"
                type="button"
                class="company-name"
                :aria-expanded="expanded.includes(item.id)"
                :aria-controls="`work-description-${item.id}`"
                @click="toggle(item.id, $event)"
              >
                <span>{{ item.company }}</span>
                <svg
                  class="work-chevron"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  aria-hidden="true"
                >
                  <path d="m9 6 6 6-6 6" />
                </svg>
              </button>
              <h3 v-else class="company-name">{{ item.company }}</h3>
              <p class="experience-time text-muted-foreground">
                {{ formatMonth(item.startDate) }} -
                {{ item.endDate ? formatMonth(item.endDate) : '至今' }}
              </p>
            </div>
            <p class="experience-position">{{ item.position }}</p>
            <div
              v-if="item.description"
              :id="`work-description-${item.id}`"
              class="experience-details"
              :aria-hidden="!expanded.includes(item.id)"
              :inert="!expanded.includes(item.id)"
            >
              <p class="experience-description text-muted-foreground">{{ item.description }}</p>
            </div>
          </div>
        </article>
      </div>
    </BlurReveal>
  </section>
</template>
<style scoped>
  h2 {
    margin-bottom: 12px;
  }
  .experience-list {
    display: grid;
    gap: 18px;
  }
  .experience {
    display: flex;
    gap: 14px;
    align-items: flex-start;
  }
  .company-avatar {
    display: grid;
    place-items: center;
    flex-shrink: 0;
    width: 48px;
    height: 48px;
    border: 1px solid var(--border);
    border-radius: 50%;
    font-size: 12px;
    font-weight: 600;
    color: var(--muted-foreground);
  }
  .experience-body {
    flex: 1;
    min-width: 0;
  }
  .experience-heading {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    align-items: baseline;
  }
  .company-name {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    background: none;
    border: 0;
    padding: 0;
    color: inherit;
    font: inherit;
    font-size: 14px;
    font-weight: 600;
    text-align: left;
    overflow-wrap: anywhere;
    line-height: 20px;
  }
  button.company-name {
    cursor: pointer;
  }
  .work-chevron {
    display: block;
    width: 14px;
    height: 14px;
    flex-shrink: 0;
    transform-origin: center;
    transform-box: fill-box;
  }
  .company-name:focus-visible {
    outline: 2px solid #7974ee;
    outline-offset: 4px;
  }
  .experience-time {
    flex-shrink: 0;
    font-size: 13px;
  }
  .experience-position {
    font-size: 12px;
    margin-top: 3px;
    overflow-wrap: anywhere;
  }
  .experience-description {
    font-size: 13px;
    line-height: 1.8;
    margin-top: 12px;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
  }
  .experience-details {
    height: 0;
    opacity: 0;
    visibility: hidden;
    overflow: hidden;
  }
  @media (max-width: 480px) {
    .experience-heading {
      flex-direction: column;
      gap: 5px;
    }
    .experience-time {
      font-size: 12px;
    }
  }
</style>
