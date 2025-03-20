<template>
  <div class="app-container">
    <Sidebar v-if="showSidebar" :sidebarWidth="sidebarWidth" />
    <Navbar v-if="showSidebar" :sidebarWidth="sidebarWidth" />
    <main class="main-content">
      <router-view />
    </main>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useRoute } from 'vue-router'
import Sidebar from './components/Sidebar.vue'
import Navbar from './components/Navbar.vue'

const route = useRoute()
const showSidebar = computed(() => route.meta.requiresAuth)

// 动态侧边栏宽度
const sidebarWidth = ref(200) // 默认宽度
</script>

<style>
.app-container {
  display: flex;
  flex-direction: column;
  height: 100vh;
  width: 100vw;
}

.sidebar {
  position: fixed;
  top: 0;
  left: 0;
  height: 100vh;
  background-color: #333;
  color: white;
  padding: 20px;
  z-index: 1000;
}

.navbar {
  position: fixed;
  top: 0;
  height: 60px;
  background-color: #444;
  color: white;
  padding: 0 20px;
  display: flex;
  align-items: center;
  z-index: 1000;
}

.main-content {
  flex: 1;
  margin-top: 60px; /* 默认导航栏高度 */
  margin-left: 200px; /* 默认侧栏高度 */
  overflow: auto;
  background-color: #f4f4f4; /* 示例背景颜色 */
  padding: 10px;
}

@media (max-width: 768px) {
  .main-content {
    /* 移动端样式 */
    margin-left: 60px; /* 默认侧栏高度 */
  }
}
</style>