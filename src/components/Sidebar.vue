<template>
    <div class="sidebar">
      <div class="logo">IoT Platform</div>
      <router-link 
        v-for="item in menuItems" 
        :key="item.path" 
        :to="item.path"
        class="menu-item"
        active-class="active"
      >
        <span class="icon">{{ item.icon }}</span>
        {{ item.title }}
      </router-link>
    </div>
  </template>
  
  <script setup>
  const menuItems = [
    { path: '/home', title: '总览', icon: '🏠' },
    { path: '/monitor', title: '数据监控', icon: '📊' },
    { path: '/control', title: '设备控制', icon: '🎛' },
    { path: '/automation', title: '自动化设置', icon: '⚡' },
    { path: '/iot', title: '设备管理', icon: '🔧' }
  ]
  </script>
  
  <style scoped>
  .sidebar {
    width: 240px;
    height: 100vh;
    background: #2c3e50;
    padding: 20px;
    position: fixed;
    left: 0;
    top: 0;
    color: white;
  }
  
  .logo {
    font-size: 24px;
    font-weight: bold;
    margin-bottom: 40px;
    padding: 10px;
    border-bottom: 1px solid #34495e;
  }
  
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
  
  .menu-item:hover {
    background: #34495e;
    color: white;
  }
  
  .active {
    background: #3498db;
    color: white;
  }
  
  .icon {
    margin-right: 12px;
    font-size: 18px;
  }
  </style>