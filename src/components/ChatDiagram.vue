<script setup lang="ts">
  import type { ChatDiagram } from '@/lib/diagram'
  defineProps<{ diagram: ChatDiagram }>()
</script>

<template>
  <figure class="chat-diagram" :aria-label="diagram.title || '流程图'">
    <figcaption v-if="diagram.title" class="diagram-caption">{{ diagram.title }}</figcaption>
    <ol class="diagram-steps">
      <li v-for="(step, index) in diagram.steps" :key="index">
        <div class="diagram-step" :class="{ 'diagram-accent': step.tone === 'accent' }">
          <strong class="diagram-title">{{ step.title }}</strong>
          <div v-if="step.items" class="diagram-options">
            <div v-for="(item, itemIndex) in step.items" :key="itemIndex" class="diagram-option">
              <span class="diagram-option-title">{{ item.title }}</span>
              <span v-if="item.description" class="diagram-description">
                {{ item.description }}
              </span>
            </div>
          </div>
          <span v-if="step.description" class="diagram-description">{{ step.description }}</span>
        </div>
        <div
          v-if="index < diagram.steps.length - 1 && step.connector !== 'none'"
          class="diagram-connector"
        >
          <span aria-hidden="true">{{ step.connector === 'both' ? '↕' : '↓' }}</span>
          <span v-if="step.connectorLabel" class="diagram-connector-label">
            {{ step.connectorLabel }}
          </span>
          <span class="diagram-sr-only">
            {{ step.connector === 'both' ? '双向连接' : '连接下一步' }}
          </span>
        </div>
      </li>
    </ol>
  </figure>
</template>

<style scoped>
  .chat-diagram {
    margin: 22px 0;
    padding: 24px 16px;
    border: 1px solid var(--chat-border);
    border-radius: 12px;
    overflow-wrap: anywhere;
  }
  .diagram-caption {
    text-align: center;
    font-size: 14px;
    color: var(--chat-muted);
    margin-bottom: 20px;
  }
  .diagram-steps {
    list-style: none !important;
    padding: 0 !important;
    margin: 0 !important;
  }
  .diagram-steps > li {
    margin: 0 !important;
  }
  .diagram-step {
    display: flex;
    flex-direction: column;
    gap: 6px;
    text-align: center;
    padding: 8px 14px;
    border: 1px solid transparent;
    border-radius: 8px;
  }
  .diagram-title {
    font-size: 17px;
    font-weight: 650;
    line-height: 1.5;
  }
  .diagram-description {
    font-size: 14px;
    line-height: 1.6;
    color: var(--chat-muted);
    white-space: pre-wrap;
  }
  .diagram-accent {
    background: rgba(73, 124, 235, 0.09);
    border-color: rgba(73, 124, 235, 0.4);
    padding: 16px 14px;
  }
  .diagram-options {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    margin: 6px 0;
  }
  .diagram-option {
    flex: 1 1 140px;
    min-width: 0;
    padding: 12px;
    border-radius: 8px;
    background: var(--chat-hover);
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .diagram-option-title {
    font-size: 16px;
    line-height: 1.5;
  }
  .diagram-connector {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    min-height: 38px;
    color: var(--chat-muted);
    font-size: 24px;
  }
  .diagram-connector-label {
    font-size: 12px;
  }
  .diagram-sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
  }
  @media (max-width: 480px) {
    .chat-diagram {
      padding: 18px 10px;
    }
    .diagram-option {
      flex-basis: 100%;
    }
  }
</style>
