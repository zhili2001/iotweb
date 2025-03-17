<template>
  <div class="app-container">
    <Sidebar v-if="showSidebar" />
    <Navbar v-if="showSidebar" />
    <main class="main-content">
      <router-view />
    </main>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import Sidebar from './components/Sidebar.vue'
import Navbar from './components/Navbar.vue'

const route = useRoute()
const showSidebar = computed(() => route.meta.requiresAuth)
</script>

<style>
.app-container {
  min-height: 100vh;
  background: #f5f6fa;
}

.main-content {
  margin-left: 240px;
  margin-top: 60px;
  padding: 24px;
  min-height: calc(100vh - 60px);
}
</style>