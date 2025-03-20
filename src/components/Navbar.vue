<template>
    <div class="navbar" :class="{ 'navbar-collapsed': !isSidebarVisible, 'navbar-mobile': isMobile }">
      <div class="left">
        <a href="http://lichen129.icu" class="home-btn" rel="noopener noreferrer">
            <span class="icon">🏠</span>个人主页
        </a>
      </div>
      <div class="right">
        <div class="user-info">
          <span class="username">{{ username }}</span>
          <button class="logout-btn" @click="handleLogout">
            <span class="icon">🚪</span>
            退出
          </button>
        </div>
      </div>
    </div>
</template>

<script setup>
import { useAuthStore } from '../stores/auth'
import { useRouter } from 'vue-router'
import { ref, onMounted } from 'vue'

const authStore = useAuthStore()
const router = useRouter()

const username = authStore.username || '访客'

const handleLogout = () => {
  authStore.logout()
  router.push('/login')
}

const isSidebarVisible = ref(true)
const isMobile = ref(false)

const checkMobile = () => {
  isMobile.value = window.innerWidth <= 768
}

onMounted(() => {
  checkMobile()
  window.addEventListener('resize', checkMobile)
  window.addEventListener('sidebar-visibility-change', (event) => {
    isSidebarVisible.value = event.detail
  })
})
</script>

<style scoped>
.navbar {
  height: 60px;
  background: white;
  padding: 0 24px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
  position: fixed;
  top: 0;
  left: 200px;
  right: 0;
  z-index: 1000;
  transition: left 0.3s ease;
}

.navbar-collapsed {
  left: 60px;
}

.navbar-mobile {
  left: 60px; /* 在移动端时，顶部导航栏与收起的侧边栏对齐 */
  width: calc(100% - 60px); /* 减去侧边栏宽度 */
}

.home-btn {
  display: flex;
  align-items: center;
  font-size: 16px;
  color: #2c3e50;
  text-decoration: none;
  padding: 8px 12px;
  border-radius: 6px;
  transition: background 0.3s;
}

.home-btn:hover {
  background: #f5f6fa;
}

.icon {
  margin-right: 6px;
}

.user-info {
  display: flex;
  align-items: center;
  gap: 20px;
}

.username {
  font-weight: 500;
  color: #2c3e50;
}

.logout-btn {
  background: #e74c3c;
  color: white;
  border: none;
  padding: 8px 16px;
  border-radius: 6px;
  cursor: pointer;
  display: flex;
  align-items: center;
  transition: background 0.3s;
}

.logout-btn:hover {
  background: #c0392b;
}

@media (max-width: 768px) {
  .navbar {
    left: 60px; /* 在移动端时，顶部导航栏与侧边栏对齐 */
    width: calc(100% - 60px); /* 减去侧边栏宽度 */
  }
}
</style>