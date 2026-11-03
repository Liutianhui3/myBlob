<script setup lang="ts">
  import { onMounted, onUnmounted, ref, watch } from 'vue'
  import { useRouter, onBeforeRouteLeave } from 'vue-router'
  import { Icon } from '@iconify/vue'
  import { currentUser, checkSession } from '@/lib/auth'
  import { listRoleUsers, listRoles, setUserRole, type RoleUser, type Role } from '@/api/roles'
  import { canAccessPage } from '@/config/access'
  import { articleDate } from '@/api/articles'
  import '@/assets/styles/articles.css'
  const router = useRouter()
  const users = ref<RoleUser[]>([])
  const total = ref(0)
  const page = ref(1)
  const q = ref('')
  const role = ref('')
  const loading = ref(false)
  const saving = ref(false)
  const error = ref('')
  const notice = ref('')
  const pending = ref<RoleUser>()
  const availableRoles = ref<Role[]>([])
  const selectedRoles = ref<number[]>([])
  const dialogError = ref('')
  const dialog = ref<HTMLDialogElement>()
  let controller: AbortController | undefined
  async function load() {
    controller?.abort()
    const current = new AbortController()
    controller = current
    loading.value = true
    error.value = ''
    try {
      const result = await listRoleUsers(
        { page: page.value, q: q.value, role: role.value },
        current.signal
      )
      if (current.signal.aborted) return
      if (!result.items.length && page.value > 1) {
        page.value--
        await load()
        return
      }
      users.value = result.items
      total.value = result.total
    } catch (e) {
      if (!current.signal.aborted) error.value = e instanceof Error ? e.message : '用户加载失败'
    } finally {
      if (!current.signal.aborted) loading.value = false
    }
  }
  function paginate(value: number) {
    page.value = value
    load()
  }
  function search() {
    page.value = 1
    load()
  }
  function confirm(user: RoleUser) {
    if (saving.value) return
    pending.value = user
    selectedRoles.value = user.roles.map(role => role.id)
    dialogError.value = ''
    dialog.value?.showModal()
  }
  async function update() {
    if (!pending.value || saving.value) return
    if (!selectedRoles.value.length) {
      dialogError.value = '每个用户至少需要一个角色'
      return
    }
    const user = pending.value
    saving.value = true
    error.value = ''
    notice.value = ''
    let demotedSelf = false
    try {
      const result = await setUserRole(user.id, selectedRoles.value)
      dialog.value?.close()
      if (currentUser.value?.id === result.id) {
        await checkSession({ refresh: true })
        demotedSelf = !canAccessPage(currentUser.value, 'roleManage')
      }
      notice.value = `${result.name || result.username}的角色已保存。`
      if (!demotedSelf) await load()
    } catch (e) {
      dialogError.value = e instanceof Error ? e.message : '角色保存失败'
    } finally {
      saving.value = false
    }
    if (demotedSelf) await router.replace('/article')
  }
  watch(role, search)
  onMounted(async () => {
    try {
      availableRoles.value = await listRoles()
      await load()
    } catch (e) {
      error.value = e instanceof Error ? e.message : '角色加载失败'
    }
  })
  onUnmounted(() => controller?.abort())
  onBeforeRouteLeave(() => !saving.value)
</script>
<template>
  <main class="article-workspace roles-page">
    <header class="article-header">
      <RouterLink class="article-brand" to="/article">
        <Icon icon="lucide:users-round" />
        myBlob
        <span class="roles-breadcrumb">/ 角色管理</span>
      </RouterLink>
      <nav class="article-navigation" aria-label="管理导航">
        <RouterLink to="/article">阅读文章</RouterLink>
        <RouterLink v-if="canAccessPage(currentUser, 'articleManage')" to="/articleManage">
          文章管理
        </RouterLink>
        <RouterLink v-if="canAccessPage(currentUser, 'roleManage')" to="/roleManage">
          角色管理
        </RouterLink>
      </nav>
    </header>
    <section class="roles-intro">
      <p class="article-eyebrow">Access & permissions</p>
      <h1>角色管理</h1>
      <p class="article-subtitle">为用户分配一个或多个角色，管理内容维护与系统访问权限。</p>
    </section>
    <section class="roles-policy">
      <Icon icon="lucide:shield-check" />
      <div>
        <strong>管理员可以维护文章与管理用户角色</strong>
        <p>文章编辑可维护文章，普通用户可阅读已发布文章。系统会保留至少一位管理员。</p>
      </div>
    </section>
    <!-- <div v-if="error" class="article-error" role="alert">
      {{ error }}
      <button :disabled="saving" @click="load">重新加载</button>
    </div> -->
    <p v-if="notice" class="role-notice" role="status">{{ notice }}</p>
    <section class="roles-table-panel">
      <div class="roles-filters">
        <div class="roles-tabs" role="group" aria-label="角色筛选">
          <button
            v-for="tab in [
              { label: '全部用户', value: '' },
              { label: '管理员', value: 'admin' },
              { label: '普通用户', value: 'common' },
              { label: '文章编辑', value: 'editor' }
            ]"
            :key="tab.value"
            :aria-pressed="role === tab.value"
            :disabled="saving"
            @click="role = tab.value"
          >
            {{ tab.label }}
          </button>
        </div>
        <form class="article-search" @submit.prevent="search">
          <Icon icon="lucide:search" />
          <input
            v-model="q"
            aria-label="搜索用户"
            maxlength="100"
            placeholder="搜索用户名、姓名或邮箱…"
            :disabled="saving"
          />
          <button type="submit" aria-label="执行用户搜索" :disabled="saving">
            <Icon icon="lucide:arrow-right" />
          </button>
        </form>
      </div>
      <div v-if="loading" class="article-empty" role="status">正在加载用户…</div>
      <div v-else-if="!users.length && !error" class="article-empty">
        <Icon icon="lucide:users-round" />
        <strong>没有匹配的用户</strong>
        <p>试试其他搜索词或角色筛选。</p>
      </div>
      <div v-else class="roles-table-scroll">
        <table>
          <thead>
            <tr>
              <th>用户</th>
              <th>邮箱</th>
              <th>角色</th>
              <th>注册日期</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="user in users" :key="user.id">
              <td>
                <div class="role-user-name">
                  {{ user.name || user.username }}
                  <span v-if="user.id === currentUser?.id" class="self-tag">我</span>
                </div>
                <span class="role-username">@{{ user.username || '未设置用户名' }}</span>
              </td>
              <td class="role-email">{{ user.email }}</td>
              <td>
                <span
                  v-for="item in user.roles"
                  :key="item.id"
                  class="role-badge"
                  :class="{ admin: item.id === 1 }"
                >
                  {{ item.nameCn }}
                </span>
                <span v-if="!user.roles.length" class="role-username">未分配角色</span>
              </td>
              <td>{{ articleDate(user.createdAt) }}</td>
              <td>
                <button
                  class="role-action"
                  :disabled="saving || !availableRoles.length"
                  :aria-label="`分配${user.username || user.name}的角色`"
                  @click="confirm(user)"
                >
                  分配角色
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <footer class="roles-footer">
        <span>共 {{ total }} 位用户</span>
        <div v-if="total > 20" class="article-pagination">
          <button
            class="article-secondary"
            :disabled="loading || saving || page === 1"
            @click="paginate(page - 1)"
          >
            上一页
          </button>
          <span>{{ page }} / {{ Math.ceil(total / 20) }}</span>
          <button
            class="article-secondary"
            :disabled="loading || saving || page * 20 >= total"
            @click="paginate(page + 1)"
          >
            下一页
          </button>
        </div>
      </footer>
    </section>
    <dialog
      ref="dialog"
      class="roles-dialog"
      aria-labelledby="role-dialog-title"
      @cancel="saving && $event.preventDefault()"
    >
      <h2 id="role-dialog-title">分配角色</h2>
      <p>{{ pending?.name || pending?.username }} · {{ pending?.email }}</p>
      <fieldset class="role-options" :disabled="saving">
        <legend>选择用户角色（可多选）</legend>
        <label v-for="item in availableRoles" :key="item.id" class="role-option">
          <input v-model="selectedRoles" type="checkbox" :value="item.id" />
          <span>
            {{ item.nameCn }}
            <small>{{ item.name }}</small>
          </span>
        </label>
      </fieldset>
      <p v-if="pending?.id === currentUser?.id" class="self-warning">
        修改自己的角色后，系统会重新检查管理页面访问权限。
      </p>
      <p v-if="!selectedRoles.length" role="status">每个用户至少需要一个角色。</p>
      <p v-if="dialogError" class="article-error" role="alert">{{ dialogError }}</p>
      <div>
        <button class="article-secondary" :disabled="saving" @click="dialog?.close()">取消</button>
        <button class="article-primary" :disabled="saving || !selectedRoles.length" @click="update">
          {{ saving ? '正在保存…' : '保存角色' }}
        </button>
      </div>
    </dialog>
  </main>
</template>
<style scoped>
  .role-options {
    border: 0;
    padding: 0;
  }
  .role-options legend {
    margin-bottom: 12px;
    font-size: 13px;
  }
  .role-option {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px;
    border: 1px solid var(--article-border);
    border-radius: 8px;
    margin-bottom: 8px;
    cursor: pointer;
  }
  .role-option input {
    width: 18px;
    height: 18px;
    accent-color: var(--article-accent);
  }
  .role-option small {
    color: var(--article-muted);
    margin-left: 8px;
  }
  .role-badge {
    margin: 2px 4px 2px 0;
  }
  .roles-tabs {
    flex-wrap: wrap;
  }

  .roles-breadcrumb {
    font-size: 13px;
    font-weight: 400;
    color: var(--article-muted);
  }
  .roles-intro {
    padding: 30px 0;
  }
  .roles-policy {
    display: flex;
    align-items: start;
    gap: 14px;
    padding: 20px 24px;
    border-radius: 12px;
    border: 1px solid var(--article-border);
    background: var(--article-soft);
    margin-bottom: 28px;
  }
  .roles-policy > svg {
    width: 23px;
    height: 23px;
    color: var(--article-accent);
    flex-shrink: 0;
  }
  .roles-policy strong {
    font-size: 14px;
  }
  .roles-policy p {
    font-size: 12px;
    color: var(--article-muted);
    line-height: 1.8;
    margin-top: 7px;
  }
  .roles-table-panel {
    border: 1px solid var(--article-border);
    border-radius: 14px;
    background: var(--article-surface);
    overflow: hidden;
  }
  .roles-filters {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 20px;
    padding: 24px;
    border-bottom: 1px solid var(--article-border);
  }
  .roles-tabs {
    display: flex;
    gap: 6px;
  }
  .roles-tabs button {
    padding: 9px 14px;
    color: var(--article-muted);
    background: transparent;
    border-radius: 7px;
    white-space: nowrap;
  }
  .roles-tabs button[aria-pressed='true'] {
    color: var(--article-accent);
    background: var(--article-soft);
    font-weight: 600;
  }
  .roles-filters form {
    width: 320px;
  }
  .roles-filters form button {
    background: transparent;
    padding: 5px;
  }
  .roles-table-scroll {
    overflow-x: auto;
  }
  .roles-table-panel table {
    width: 100%;
    text-align: left;
    border-collapse: collapse;
  }
  .roles-table-panel th {
    padding: 16px 24px;
    background: var(--article-bg);
    color: var(--article-muted);
    font-size: 12px;
    font-weight: 500;
    white-space: nowrap;
  }
  .roles-table-panel td {
    padding: 22px 24px;
    border-top: 1px solid var(--article-border);
    font-size: 12px;
    white-space: nowrap;
  }
  .role-user-name {
    font-size: 14px;
    font-weight: 600;
    display: flex;
    align-items: center;
    gap: 7px;
  }
  .self-tag {
    padding: 2px 5px;
    border-radius: 4px;
    font-size: 10px;
    background: var(--article-soft);
    color: var(--article-accent);
  }
  .role-username {
    display: block;
    color: var(--article-muted);
    font-size: 11px;
    margin-top: 5px;
  }
  .role-email {
    color: var(--article-muted);
  }
  .role-badge {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 5px 9px;
    border-radius: 5px;
    background: var(--article-bg);
    color: var(--article-muted);
  }
  .role-badge.admin {
    background: var(--article-soft);
    color: var(--article-accent);
  }
  .role-badge svg {
    width: 13px;
    height: 13px;
  }
  .role-action {
    color: var(--article-accent);
    background: transparent;
    padding: 7px 0;
  }
  .roles-footer {
    display: flex;
    gap: 20px;
    justify-content: space-between;
    align-items: center;
    padding: 20px 24px;
    border-top: 1px solid var(--article-border);
    color: var(--article-muted);
    font-size: 12px;
  }
  .roles-footer .article-pagination {
    margin: 0;
  }
  .role-notice {
    background: var(--article-soft);
    color: var(--article-accent);
    border-radius: 8px;
    padding: 12px 16px;
    margin-bottom: 16px;
  }
  .roles-dialog {
    margin: auto;
    background: var(--article-surface);
    color: var(--article-text);
    padding: 28px;
    border: 1px solid var(--article-border);
    border-radius: 14px;
    width: min(440px, calc(100vw - 32px));
  }
  .roles-dialog::backdrop {
    background: rgba(15, 14, 30, 0.45);
  }
  .roles-dialog h2 {
    font-size: 20px;
    font-weight: 700;
  }
  .roles-dialog p {
    line-height: 1.8;
    color: var(--article-muted);
    margin: 16px 0;
    overflow-wrap: anywhere;
  }
  .roles-dialog .self-warning {
    color: #c13d58;
  }
  .roles-dialog > div {
    display: flex;
    justify-content: end;
    gap: 12px;
    margin-top: 24px;
  }
  @media (max-width: 750px) {
    .roles-filters {
      flex-direction: column;
      align-items: stretch;
      padding: 16px;
    }
    .roles-filters form {
      width: 100%;
    }
    .roles-tabs {
      justify-content: space-between;
    }
    .article-header {
      flex-direction: column;
    }
    .roles-table-panel th,
    .roles-table-panel td {
      padding: 16px;
    }
  }
</style>
