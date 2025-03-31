<template>
  <!-- 密码验证框 -->
  <div v-if="showPasswordPrompt" class="password-prompt">
    <input v-model="password" type="password" placeholder="请输入密码" />
    <button @click="handlePasswordSubmit">提交</button>
  </div>
  
  <!-- 数据监控容器 -->
  <div v-else class="monitor-container">
    <div v-for="gateway in gateways" :key="gateway.mac" class="gateway-card">
      <div class="gateway-header">
        <h3>{{ gateway.alias }}</h3>
        <span :class="['status', gateway.online ? 'online' : 'offline']">
          {{ gateway.online ? '在线' : '离线' }}
        </span>
      </div>
      <div class="sensor-grid">
        <!-- 传感器和控制器统一处理 -->
        <div v-for="item in [...gateway.sensors, ...gateway.controllers]" 
             :key="item.key" 
             :class="item.device_type === 1 ? 'sensor-item' : 'controller-item'">
          <div class="sensor-label">{{ item.alias }}</div>
          <div class="sensor-value">{{ item.value }}</div>
        </div>
      </div>
      <!-- 在网关卡片底部添加 -->
      <div class="history-control-section">
        <div class="button-group">
          <button 
            class="history-btn"
            @click="openHistory(gateway.mac)"
          >
            查看历史数据
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, onUnmounted } from 'vue';
import { useAuthStore } from '../stores/auth';
import mqtt from 'mqtt';
import axios from 'axios';
import router from '../router'; // 添加 router 导入

const authStore = useAuthStore();
const devices = reactive({}); // 存储设备数据
const password = ref('');
const showPasswordPrompt = ref(true);
let mqttClientInstance = null; // MQTT 客户端实例

//--------------------------------------------------

// 新增响应式数据
const isLoading = ref(false);
const isError = ref(false);
const isSuccess = ref(false);
const lastUpdateTime = ref(null);
const refreshButtonText = ref('更新历史数据');

// 获取历史数据方法
const fetchHistoryData = async (mac) => {
  try {
    isLoading.value = true;
    isError.value = false;
    isSuccess.value = false;
    refreshButtonText.value = '正在更新...';

    const res = await axios.post('/api/iot/get_mac_data', { 
      mac_address: mac 
    });

    if (res.data && res.data.mac_address && res.data.data) {
      const formattedData = Object.entries(res.data.data).map(([key, values]) => ({
        key,
        values: values.map(item => ({
          value: item.value,
          time: item.time // 保留原始时间戳，避免格式化为字符串
        }))
      }));
      console.log('格式化后的数据:', formattedData); // 调试日志
      authStore.setHistoryData(mac, formattedData); // 确保数据格式正确
      isSuccess.value = true;
      lastUpdateTime.value = new Date().toLocaleTimeString();
    } else {
      throw new Error('返回数据格式不正确');
    }
  } catch (error) {
    isError.value = true;
    lastUpdateTime.value = new Date().toLocaleTimeString();
    console.error('数据获取失败:', error.message || error);
  } finally {
    isLoading.value = false;
    refreshButtonText.value = '更新历史数据';
  }
};

// 打开历史页面
const openHistory = (mac) => {
  const url = router.resolve({
    name: 'HistoryData',
    params: { mac },
    query: { timestamp: Date.now() } // 避免路由缓存
  }).href;
  window.open(url, '_blank'); // 在新页面打开
};

// 计算网关列表
const gateways = computed(() => {
  return Object.entries(devices).map(([rawMac, device]) => ({
    mac: rawMac, // 使用 rawMac
    alias: device.mac_alias || rawMac,
    online: device.is_online,
    sensors: device.keys
      .filter(k => k.device_type === 1)
      .map(k => ({
        ...k,
        alias: k.key_alias || k.mac_key,
        value: k.value || 'N/A'
      })),
    controllers: device.keys
      .filter(k => k.device_type === 2)
      .map(k => ({
        ...k,
        alias: k.key_alias || k.mac_key,
        value: k.value || 'N/A'
      }))
  }));
});

// 获取设备数据
const fetchDevices = async () => {
  try {
    const res = await axios.get('/api/iot/devices', { params: { userId: authStore.userId } });
    Object.entries(res.data).forEach(([rawMac, device]) => {
      device.rawMac = rawMac; // 保存原始 MAC 地址
      try {
        const msg = JSON.parse(device.msg || '{}').msg || {};
        device.keys.forEach(key => {
          key.value = msg[key.mac_key] || 'N/A';
        });
      } catch (e) {
        console.error('设备消息解析失败:', e);
      }
      devices[rawMac] = { ...device }; // 使用 rawMac 作为键
    });
  } catch (error) {
    console.error('获取设备失败:', error);
  }
};

// 更新传感器值
const updateSensorValues = (rawMac, msg) => {
  const device = devices[rawMac]; // 直接使用 rawMac
  if (!device) {
    console.warn(`未注册设备: ${rawMac}`);
    return;
  }
  device.keys.forEach(key => {
    if (msg[key.mac_key] !== undefined) {
      key.value = msg[key.mac_key];
    }
  });
};

// 初始化 MQTT 客户端
const initMqttClient = async () => {
  if (mqttClientInstance?.connected) {
    console.log('复用现有 MQTT 连接');
    return;
  }
  try {
    const res = await axios.post('/api/iot/get_topic', { 
      username: authStore.username, 
      password: password.value 
    });
    mqttClientInstance = mqtt.connect('ws://lichen129.icu:8083/mqtt', {
      clientId: '11111111111111111',
      username: authStore.username,
      password: password.value,
      protocolVersion: 5
    });
    mqttClientInstance.on('connect', () => {
      console.log('MQTT 连接成功');
      mqttClientInstance.subscribe(res.data.topic, (err) => {
        if (err) console.error('订阅失败:', err);
        else console.log('订阅成功:', res.data.topic);
      });
    });
    mqttClientInstance.on('message', (topic, message) => {
      try {
        const messageString = message.toString();
        const macMatch = messageString.match(/^\[([^\]]+)\]/);
        if (!macMatch) {
          console.error('消息缺少 MAC 标识:', messageString);
          return;
        }
        const msgMac = macMatch[1];
        const payload = JSON.parse(messageString.replace(/^\[[^\]]+\]/, ''));
        updateSensorValues(msgMac, payload.msg);
      } catch (e) {
        console.error('消息解析失败:', e);
      }
    });
  } catch (error) {
    console.error('MQTT 初始化失败:', error);
    throw error;
  }
};

// 密码提交处理
const handlePasswordSubmit = async () => {
  try {
    await initMqttClient();
    showPasswordPrompt.value = false;
    sessionStorage.setItem('mqttPassword', password.value);
  } catch {
    showPasswordPrompt.value = true;
    sessionStorage.removeItem('mqttPassword');
  }
};

// 生命周期钩子
onMounted(() => {
  const savedPassword = sessionStorage.getItem('mqttPassword');
  if (savedPassword) {
    password.value = savedPassword;
    handlePasswordSubmit();
  }
  fetchDevices();
});

onUnmounted(() => {
  if (mqttClientInstance?.connected) {
    mqttClientInstance.end(true);
    console.log('MQTT 连接已断开');
  }
});
</script>

<style scoped>
/* 密码提示框样式 */
.password-prompt {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
}
.password-prompt input {
  margin-bottom: 16px;
  padding: 8px;
  font-size: 16px;
}
.password-prompt button {
  padding: 8px 16px;
  font-size: 16px;
  cursor: pointer;
}

/* 监控容器样式 */
.monitor-container {
  display: grid;
  grid-template-columns: 1fr;
  gap: 12px;
  padding: 12px;
}
.gateway-card {
  background: white;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  padding: 12px;
}
.gateway-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}
.status {
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 12px;
}
.online {
  background: #27ae60;
  color: white;
}
.offline {
  background: #e74c3c;
  color: white;
}
.sensor-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(110px, 1fr));
  gap: 12px;
}
.sensor-item,
.controller-item {
  padding: 10px;
  border-radius: 6px;
  width: 110px;
  height: 72px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}
.sensor-item {
  background: #e8f5e9;
}
.controller-item {
  background: #e3f2fd;
}
.sensor-label {
  font-size: 16px; /* 增大字体 */
  font-weight: bold; /* 加粗 */
  color: #7f8c8d;
}
.sensor-value {
  font-size: 16px; /* 增大字体 */
  font-weight: bold; /* 保持加粗 */
  color: #2c3e50;
  transition: background-color 0.5s;
}

/* --------------------历史数据新增-------------------- */
.history-control-section {
  margin-top: 1rem;
  border-top: 1px solid #eee;
  padding-top: 1rem;
}
.button-group {
  display: flex;
  gap: 0.8rem;
  margin-bottom: 0.5rem;
}
.refresh-btn {
  background: #3b82f6;
  color: white;
  padding: 0.5rem 1rem;
  border-radius: 4px;
  transition: all 0.3s;
  &:disabled {
    background: #94a3b8;
    cursor: not-allowed;
  }
}
.history-btn {
  background: #10b981;
  color: white;
  padding: 0.5rem 1rem;
  border-radius: 4px;
  transition: all 0.3s;
  &.disabled {
    background: #6ee7b7;
    cursor: not-allowed;
  }
  &.error {
    background: #ef4444;
  }
}
.status-indicator {
  font-size: 0.9rem;
  .success-text { color: #10b981; }
  .error-text { color: #ef4444; }
  .loading-text { color: #3b82f6; }
}
/* --------------------历史数据新增-------------------- */
</style>