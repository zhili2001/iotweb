<script setup>
import { ref } from 'vue';
import { useAuthStore } from '../stores/auth';
import { useRouter } from 'vue-router';

const form = ref({ username: '', password: '' });
const loading = ref(false);
const errorMessage = ref('');

const authStore = useAuthStore();
const router = useRouter();

const handleLogin = async () => {
  try {
    loading.value = true;
    errorMessage.value = '';
    
    await authStore.login(form.value);
    
    // 登录成功后，手动检查状态并跳转
    if (authStore.isAuthenticated) {
      router.replace('/monitor'); // 使用 replace 避免历史记录问题
    } else {
      errorMessage.value = '认证状态异常，请重新登录';
    }
  } catch (error) {
    errorMessage.value = error.message;
    // 自动清除错误提示
    setTimeout(() => errorMessage.value = '', 5000);
  } finally {
    loading.value = false;
  }
};
</script>

<template>
  <div class="login-container">
    <!-- 错误提示 -->
    <div v-if="errorMessage" class="error-alert">
      {{ errorMessage }}
    </div>
    
    <!-- 加载状态 -->
    <div v-if="loading" class="loading-overlay">
      <div class="loader"></div>
    </div>
    
    <div class="login-container">
      <h2>用户登录</h2>
      <form @submit.prevent="handleLogin">
        <div class="form-group">
          <label>用户名</label>
          <input v-model="form.username" type="text" required />
        </div>
        <div class="form-group">
          <label>密码</label>
          <input v-model="form.password" type="password" required />
        </div>
        <button type="submit">登录</button>
        <p>没有账号？<router-link to="/register">立即注册</router-link></p>
      </form>
    </div>
  </div>
</template>

<style>
.error-alert {
  background: #ffebee;
  color: #b71c1c;
  padding: 1rem;
  margin-bottom: 1rem;
  border-radius: 4px;
}

.loading-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(255,255,255,0.8);
  display: grid;
  place-items: center;
}

.loader {
  border: 4px solid #f3f3f3;
  border-top: 4px solid #3498db;
  border-radius: 50%;
  width: 40px;
  height: 40px;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.login-container {
  max-width: 400px;
  margin: 2rem auto;
  padding: 20px;
  box-shadow: 0 0 10px rgba(0,0,0,0.1);
}
.form-group {
  margin-bottom: 1rem;
}
input {
  width: 100%;
  padding: 8px;
  margin-top: 5px;
}
button {
  width: 100%;
  padding: 10px;
  background: #42b983;
  color: white;
  border: none;
  cursor: pointer;
}
</style>