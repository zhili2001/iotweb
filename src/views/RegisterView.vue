<template>
    <div class="register-container">
      <h2>用户注册</h2>
      <form @submit.prevent="handleRegister">
        <div class="form-group">
          <label>用户名</label>
          <input v-model="form.username" type="text" required />
        </div>
        <div class="form-group">
          <label>邮箱</label>
          <input v-model="form.email" type="email" required />
        </div>
        <div class="form-group">
          <label>密码</label>
          <input v-model="form.password" type="password" required />
        </div>
        <button type="submit">注册</button>
        <p>已有账号？<router-link to="/login">立即登录</router-link></p>
      </form>
    </div>
  </template>
  
  <script setup>
  import { ref } from 'vue';
  import { useAuthStore } from '../stores/auth';
  import { useRouter } from 'vue-router';
  
  const form = ref({
    username: '',
    email: '',
    password: ''
  });
  
  const authStore = useAuthStore();
  const router = useRouter();
  
  const handleRegister = async () => {
    try {
      await authStore.register(form.value);
      alert('注册成功，请登录');
      router.push('/login');
    } catch (error) {
      alert(error.message || '注册失败');
    }
  };
  </script>
  
  <style scoped>
  /* 样式与登录页类似，可复用 */
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