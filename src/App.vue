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
import { ref, computed } from 'vue';
import { useRoute } from 'vue-router';
import Sidebar from './components/Sidebar.vue';
import Navbar from './components/Navbar.vue';

const route = useRoute();
const showSidebar = computed(() => route.meta.requiresAuth);
const sidebarWidth = ref(200); // 默认宽度
</script>

<style>
.app-container {
  display: flex;
  flex-direction: column;
  height: 100vh;
  width: 100vw;
}

.main-content {
  flex: 1;
  margin-top: 60px; /* 默认导航栏高度 */
  margin-left: 200px; /* 默认侧栏宽度 */
  overflow: auto;
  background-color: #f4f4f4;
  padding: 10px;
}

@media (max-width: 768px) {
  .main-content {
    margin-left: 60px; /* 移动端侧栏宽度 */
  }
}
</style>