<template>
  <!-- 自我介绍 -->
  <div class="introduction flex items-start gap-4">
    <BlurReveal class="introduction-copy" :delay="0.2" :duration="0.4">
      <SparklesText
        :text="`嗨，我是 ${userDisplayName} 👋`"
        :colors="{ first: '#9E7AFF', second: '#FE8BBB' }"
        :sparkles-count="10"
      />
      <!-- <h1 class=""></h1> -->
      <p v-if="userProfile.bio" class="intro-bio text-2xl pt-3">{{ userProfile.bio }}</p>
      <RouterLink v-else to="/profile" class="empty-bio">完善个人简介，让大家了解你。</RouterLink>
    </BlurReveal>
    <BlurReveal :delay="0.2" :duration="0.4">
      <span class="relative flex shrink-0 overflow-hidden rounded-full size-28 border">
        <UserAvatar
          class="img aspect-square h-full w-full"
          :src="userInfo?.avatar"
          role="img"
          :aria-label="
            userInfo?.avatar ? '用户头像' : `${userInfo?.username || userDisplayName}的默认头像`
          "
        />
      </span>
    </BlurReveal>
  </div>
</template>
<script setup>
  import BlurReveal from '@/components/BlurReveal.vue'
  import UserAvatar from '@/components/UserAvatar.vue'
  import { userInfo, userDisplayName } from '@/lib/auth'
  import { userProfile } from '@/lib/profile'
</script>
<style scoped>
  .img {
    border-radius: 100%;
    pointer-events: none;
    font-size: 22px;
  }
  .introduction-copy {
    flex: 1;
    min-width: 0;
  }
  .intro-bio {
    white-space: pre-wrap;
    overflow-wrap: anywhere;
  }
  .empty-bio {
    display: inline-block;
    margin-top: 12px;
    color: var(--muted-foreground);
    font-size: 14px;
  }
  @media (max-width: 480px) {
    .introduction {
      flex-direction: column-reverse;
    }
    .intro-bio {
      font-size: 19px;
    }
  }
</style>
