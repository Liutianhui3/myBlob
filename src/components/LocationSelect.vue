<script setup lang="ts">
  import { computed } from 'vue'
  import regionData from '@/assets/regions.json'

  const props = defineProps<{ modelValue: string }>()
  const emit = defineEmits<{ 'update:modelValue': [value: string] }>()
  const regions: Record<string, string[]> = {
    ...regionData,
    香港特别行政区: [],
    澳门特别行政区: [],
    台湾省: [
      '台北市',
      '新北市',
      '桃园市',
      '台中市',
      '台南市',
      '高雄市',
      '基隆市',
      '新竹市',
      '嘉义市',
      '其他地区'
    ]
  }
  const provinces = Object.keys(regions)
  const selection = computed(() => {
    const raw = props.modelValue.replace(/^中国\s*[·/\-]\s*/, '').trim()
    const province = provinces.find(name => raw.startsWith(name))
    if (province) {
      return { province, city: regions[province].find(city => raw.includes(city)) || '' }
    }
    for (const name of provinces) {
      if (raw === name.replace(/省$|市$|特别行政区$/, '')) return { province: name, city: '' }
      const city = regions[name].find(city => raw === city || raw === city.replace(/市$/, ''))
      if (city) return { province: name, city }
    }
    return { province: raw ? '__legacy__' : '', city: '' }
  })
  const cities = computed(() => regions[selection.value.province] || [])
  function changeProvince(event: Event) {
    emit('update:modelValue', (event.target as HTMLSelectElement).value)
  }
  function changeCity(event: Event) {
    const city = (event.target as HTMLSelectElement).value
    emit('update:modelValue', [selection.value.province, city].filter(Boolean).join(' · '))
  }
</script>

<template>
  <div class="location-select">
    <select
      id="profile-location"
      :value="selection.province"
      aria-label="所在地省份"
      autocomplete="address-level1"
      @change="changeProvince"
    >
      <option value="">暂不设置</option>
      <option v-if="selection.province === '__legacy__'" value="__legacy__" disabled>
        {{ modelValue }}（已保存）
      </option>
      <option v-for="province in provinces" :key="province" :value="province">
        {{ province }}
      </option>
    </select>
    <select
      :value="selection.city"
      aria-label="所在地城市或区县"
      autocomplete="address-level2"
      :disabled="!cities.length"
      @change="changeCity"
    >
      <option value="">{{ cities.length ? '选择城市 / 区县（可选）' : '城市 / 区县' }}</option>
      <option v-for="city in cities" :key="city" :value="city">{{ city }}</option>
    </select>
  </div>
</template>

<style scoped>
  .location-select {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px;
  }
  select {
    width: 100%;
    min-width: 0;
    padding: 11px 9px;
    border: 1px solid var(--border);
    border-radius: 9px;
    color: var(--text);
    background: var(--input);
    font: inherit;
    font-size: 13px;
    line-height: 20px;
    min-height: 44px;
  }
  select:focus {
    outline: none;
    border-color: var(--accent);
    box-shadow: 0 0 0 3px #514def12;
  }
  select:disabled {
    opacity: 0.55;
  }
</style>
