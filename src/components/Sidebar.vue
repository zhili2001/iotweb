<template>
  <div>
    <!-- 点击遮罩层关闭侧边栏 -->
    <div class="sidebar-overlay" v-if="isMobile && isSidebarVisible" @click="toggleSidebar"></div>
    <div class="sidebar" :class="{ 'sidebar-collapsed': !isSidebarVisible, 'sidebar-hidden': isMobile && !isSidebarVisible }">
      <div class="header">
        <div class="logo">
          <!-- 仅在侧边栏展开时显示标题 -->
          <span v-if="isSidebarVisible">Iot平台</span>
        </div>
        <!-- 侧边栏切换按钮 -->
        <button class="toggle-button" @click="toggleSidebar">
          ☰
        </button>
      </div>
      <!-- 动态渲染菜单项 -->
      <router-link 
        v-for="item in menuItems" 
        :key="item.path" 
        :to="item.path"
        class="menu-item"
        :class="{ 'menu-item-collapsed': !isSidebarVisible }"
        active-class="active"
      >
        <span class="icon">{{ item.icon }}</span>
        <span v-if="isSidebarVisible">{{ item.title }}</span>
      </router-link>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, watch } from 'vue';

// 控制侧边栏可见性
const isSidebarVisible = ref(true);
// 判断是否为移动端
const isMobile = ref(false);

// 切换侧边栏显示状态
const toggleSidebar = () => {
  isSidebarVisible.value = !isSidebarVisible.value;
};

// 检查当前是否为移动端
const checkMobile = () => {
  isMobile.value = window.innerWidth <= 768;
};

// 组件挂载时绑定窗口大小变化事件
onMounted(() => {
  checkMobile();
  window.addEventListener('resize', checkMobile);
});

// 监听侧边栏状态变化并触发自定义事件
watch(isSidebarVisible, (newValue) => {
  const event = new CustomEvent('sidebar-visibility-change', { detail: newValue });
  window.dispatchEvent(event);
});

// 菜单项数据
const menuItems = [
  { path: '/home', title: '总览', icon: '🏠' },
  { path: '/monitor', title: '数据监控', icon: '📊' },
  { path: '/control', title: '设备控制', icon: '🎛️' },
  { path: '/automation', title: '自动化设置', icon: '⚡' },
  { path: '/set', title: '设备管理', icon: '🔧' }
];
</script>

<style scoped>
/* 侧边栏样式 */
.sidebar {
  width: 200px; /* 原宽度为 240px */
  height: 100vh;
  background: #2c3e50;
  padding: 20px;
  position: fixed;
  left: 0;
  top: 0;
  color: white;
  transition: width 0.3s ease, transform 0.3s ease;
  box-shadow: 2px 0 5px rgba(0, 0, 0, 0.1);
  z-index: 1000;
}

/* 侧边栏折叠状态 */
.sidebar-collapsed {
  width: 60px;
}

/* 侧边栏隐藏状态 */
.sidebar-hidden {
  transform: translateX(-100%);
}

/* 侧边栏头部样式 */
.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid #34495e;
}

/* Logo 样式 */
.logo {
  font-size: 24px;
  font-weight: bold;
  display: flex;
  align-items: center;
  flex-grow: 1;
}

/* 菜单项样式 */
.menu-item {
  display: flex;
  align-items: center;
  padding: 12px;
  margin: 8px 0;
  border-radius: 6px;
  color: #bdc3c7;
  text-decoration: none;
  transition: all 0.3s;
}

/* 折叠菜单项样式 */
.menu-item-collapsed {
  justify-content: center;
  padding: 12px 0;
}

/* 菜单项悬停样式 */
.menu-item:hover {
  background: #34495e;
  color: white;
}

/* 激活菜单项样式 */
.active {
  background: #3498db;
  color: white;
}

/* 图标样式 */
.icon {
  margin-right: 12px;
  font-size: 18px;
}

/* 折叠菜单项图标样式 */
.menu-item-collapsed .icon {
  margin-right: 0;
}

/* 切换按钮样式 */
.toggle-button {
  background: none;
  border: none;
  color: white;
  font-size: 18px;
  cursor: pointer;
  padding: 5px;
  margin-left: auto;
}

.toggle-button:hover {
  color: #3498db;
}

/* 遮罩层样式 */
.sidebar-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.5);
  z-index: 999;
}

/* 移动端适配 */
@media (max-width: 768px) {
  .sidebar {
    z-index: 1001;
  }

  .sidebar.sidebar-hidden {
    transform: translateX(-100%);
  }

  .sidebar.sidebar-collapsed {
    transform: translateX(0);
  }
}
</style>