export interface DiagramNode {
  title: string
  description?: string
}
export interface DiagramStep extends DiagramNode {
  tone?: 'neutral' | 'accent'
  items?: DiagramNode[]
  connector?: 'down' | 'both' | 'none'
  connectorLabel?: string
}
export interface ChatDiagram {
  title?: string
  steps: DiagramStep[]
}

// Only text and a small set of layout options are accepted, never HTML or CSS.
export function parseDiagram(source: string): ChatDiagram | null {
  if (source.length > 24000) return null
  const text = (value: unknown, required = false) =>
    value === undefined
      ? !required
      : typeof value === 'string' && value.length <= 1000 && (!required || !!value.trim())
  const node = (value: any) =>
    value &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    text(value.title, true) &&
    text(value.description)
  try {
    const value = JSON.parse(source)
    if (
      !value ||
      !text(value.title) ||
      !Array.isArray(value.steps) ||
      !value.steps.length ||
      value.steps.length > 12
    )
      return null
    if (
      !value.steps.every(
        (step: any) =>
          node(step) &&
          (step.tone === undefined || ['neutral', 'accent'].includes(step.tone)) &&
          (step.connector === undefined || ['down', 'both', 'none'].includes(step.connector)) &&
          text(step.connectorLabel) &&
          (step.items === undefined ||
            (Array.isArray(step.items) &&
              step.items.length > 0 &&
              step.items.length <= 6 &&
              step.items.every(node)))
      )
    )
      return null
    return value
  } catch {
    return null
  }
}
