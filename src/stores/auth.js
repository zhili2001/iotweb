import { defineStore } from 'pinia';
import axios from 'axios';                                //用于发送 HTTP 请求
import router from '../router';                           //从项目的路由配置中导入，用于在认证成功后导航到特定页面

// 在 axios 请求头中自动添加 Token
axios.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers['Authorization'] = `Bearer ${token}`;
  }
  return config;
});

// 全局响应拦截器（处理 401 错误）
axios.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      const authStore = useAuthStore();
      if (authStore.token) { // 仅在 Token 存在时触发一次
        alert('登录已过期，请重新登录');
        authStore.logout();
        router.push('/login');
      }
    }
    return Promise.reject(error);
  }
);

export const useAuthStore = defineStore('auth', {
  //state 是一个返回对象的函数，定义了存储的状态，从 localStorage 中获取,不存在则为 null。
  state: () => ({
    token: localStorage.getItem('token') || null,
    username: localStorage.getItem('username') || null,
    userId: localStorage.getItem('userId') || null,
    expiresAt: localStorage.getItem('expiresAt')?Number(localStorage.getItem('expiresAt')):null // 新增字段
  }),

  //动作
  actions: {
    //异步函数，用于处理用户登录。
    /*  发送 POST 请求到 /api/login，传递用户凭证。
        如果响应中缺少 token 或 username，则抛出错误。
        存储 token、username、userId 和计算出的 expiresAt 到 localStorage。
        设置 Authorization 头以便后续请求使用。
        导航到 /monitor 页面*/
    async login(credentials) {
      try {
        const response = await axios.post('/api/login', credentials);
        if (!response.data.token) {
          throw new Error('登录响应数据不完整');
        }
    
        // 更新 Pinia 状态
        this.token = response.data.token;
        this.username = response.data.username;
        this.userId = response.data.userId;
        this.expiresAt = Date.now() + response.data.expiresIn * 1000;
    
        // 存储到 localStorage
        localStorage.setItem('token', this.token);
        localStorage.setItem('username', this.username);
        localStorage.setItem('userId', this.userId);
        localStorage.setItem('expiresAt', this.expiresAt.toString());
    
        // 设置请求头
        axios.defaults.headers.common['Authorization'] = `Bearer ${this.token}`;
    
        // 直接跳转，避免触发路由守卫的额外验证
        router.push('/monitor');
      } catch (error) {
        throw new Error(error.response?.data?.error || '登录失败');
      }
    },

     // 注册方法
     /* 发送 POST 请求到 /api/register，传递用户数据。
        如果注册失败，抛出错误。*/
     async register(userData) {
      try {
        await axios.post('/api/register', userData);
      } catch (error) {
        if (error.response?.data?.error) {
          throw new Error(error.response.data.error);
        }
        throw new Error('注册失败，请检查网络连接');
      }
    },

    //用于注销用户,退出登录
    async logout() {
      try {
        await axios.post('/api/logout');
      } catch (error) {
        console.error('退出登录失败:', error);
      } finally {
        this.token = null;
        this.username = null;
        this.userId = null;
        this.expiresAt = null;
        localStorage.clear();
        delete axios.defaults.headers.common['Authorization'];
        router.push('/login');
      }
    },

    // 获取设备列表
    async fetchDevices() {
      if (!this.checkTokenExpiration()) return;
      try {
        const res = await axios.get('/api/iot/devices', {
          params: { userId: this.userId }
        })
        this.devices = res.data
      } catch (error) {
        console.error('获取设备失败:', error)
      }
    },

    // 保存配置
    async saveConfig(device, mac) {
      if (!this.checkTokenExpiration()) return;
      try {
        await axios.post('/api/iot/set_keyvalue', {
          mac_address: mac,
          mac_alias: device.new_mac_alias,
          keys: device.keys.map((k) => ({
            mac_key: k.mac_key,
            key_alias: k.new_key_alias || k.mac_key, // 如果没有别名，使用原始 key
            device_type: k.type,
          })),
        });
        alert('配置已保存');
        // 重新获取设备数据以更新页面显示
        await this.fetchDevices();
      } catch (error) {
        console.error('保存失败:', error);
        if (error.response?.status === 401) {
          alert('登录已过期，请重新登录');
          this.logout();
          router.push('/login');
        } else {
          alert('保存失败，请重试');
        }
      }
    },

    // 检查登录状态是否过期
    checkTokenExpiration() {
      if (this.expiresAt && this.expiresAt < Date.now()) {
        this.logout();
        return false;
      }
      return true;
    },

    async initMqtt() {
      try {
        const res = await axios.post('/api/iot/get_topic', {
          username: this.username,
          password: this.password
        })
        
        this.userTopic = res.data.topic
        this.mqttClient = mqtt.connect('ws://lichen129.icu:8083/mqtt', {
          clientId: '11111111111111111',
          username: this.username,
          password: this.password,
          protocolVersion: 5
        })
        
        return this.mqttClient
      } catch (error) {
        console.error('MQTT初始化失败:', error)
      }
    }
  },

  //获取器
  /*  isAuthenticated：检查 token 是否存在，返回布尔值。
      getUsername：返回 username，如果不存在则返回 '访客用户'。*/
  getters: {
    isAuthenticated: (state) => !!state.token && state.expiresAt > Date.now(),
    getUsername: (state) => state.username || '访客用户'
  }
});