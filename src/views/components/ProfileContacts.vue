<script setup lang="ts">
  import { Icon, addCollection } from '@iconify/vue'
  import icons from '@/assets/profile-icons.json'
  import { userProfile } from '@/lib/profile'
  addCollection(icons)
</script>
<template>
  <ul class="profile-contacts text-muted-foreground" aria-label="联系方式">
    <li v-if="userProfile.email">
      <Icon icon="hugeicons:mail-01" aria-hidden="true" />
      <a :href="`mailto:${userProfile.email}`" aria-label="邮箱">{{ userProfile.email }}</a>
    </li>
    <li v-if="userProfile.location">
      <Icon icon="hugeicons:location-01" aria-hidden="true" />
      <span aria-label="所在地">{{ userProfile.location }}</span>
    </li>
    <li v-if="userProfile.phone">
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="1.5"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true"
      >
        <path
          d="M21 16v3a2 2 0 0 1-2.2 2A18 18 0 0 1 3 5.2 2 2 0 0 1 5 3h3l2 5-2 2a14 14 0 0 0 6 6l2-2z"
        />
      </svg>
      <a :href="`tel:${userProfile.phone.replace(/[\s()-]/g, '')}`" aria-label="手机号码">
        {{ userProfile.phone }}
      </a>
    </li>
    <li v-if="/^https?:\/\//i.test(userProfile.website)">
      <Icon icon="hugeicons:link-01" aria-hidden="true" />
      <a
        :href="userProfile.website"
        target="_blank"
        rel="noopener noreferrer"
        aria-label="个人网站"
      >
        {{ userProfile.website.replace(/^https?:\/\//i, '').replace(/\/$/, '') }}
      </a>
    </li>
  </ul>
</template>
<style scoped>
  .profile-contacts {
    display: flex;
    flex-wrap: wrap;
    gap: 12px 22px;
    font-size: 13px;
  }
  li {
    display: flex;
    align-items: flex-start;
    gap: 7px;
    min-width: 0;
    max-width: 100%;
    line-height: 20px;
  }
  svg {
    width: 17px;
    height: 20px;
    flex-shrink: 0;
  }
  a,
  span {
    overflow-wrap: anywhere;
    min-width: 0;
  }
  a:hover {
    color: #7974ee;
  }
  a:focus-visible {
    outline: 2px solid #7974ee;
    outline-offset: 4px;
  }
</style>
