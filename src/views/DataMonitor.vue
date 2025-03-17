<template>
  <!-- 密码提示框 -->
  <div v-if="showPasswordPrompt" class="password-prompt">
    <input v-model="password" type="password" placeholder="请输入密码" />
    <button @click="handlePasswordSubmit">提交</button>
  </div>
  
  <!-- 监控容器 -->
  <div v-else class="monitor-container">
    <div v-for="gateway in gateways" :key="gateway.mac" class="gateway-card">
      <div class="gateway-header">
        <h3>{{ gateway.alias }}</h3>
        <span :class="['status', gateway.online ? 'online' : 'offline']">
          {{ gateway.online ? '在线' : '离线' }}
        </span>
      </div>
      <div class="sensor-grid">
        <div v-for="sensor in gateway.sensors" :key="sensor.key" class="sensor-item">
          <div class="sensor-label">{{ sensor.alias }}</div>
          <div class="sensor-value">{{ sensor.value }}</div>
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

const authStore = useAuthStore();
const devices = reactive({}); // 改为 reactive 实现深度响应式
const password = ref('');
const showPasswordPrompt = ref(true);
let mqttClientInstance = null; // MQTT 单例

// 标准化 MAC 地址格式（去除分隔符并小写）
const normalizeMac = (mac) => {
  return mac ? mac.replace(/[^a-fA-F0-9]/g, '').toLowerCase() : '';
};

// 计算网关列表
const gateways = computed(() => {
  return Object.entries(devices).map(([mac, device]) => ({
    mac,
    alias: device.mac_alias || mac,
    online: device.is_online,
    sensors: device.keys
      .filter(k => k.device_type === 1)
      .map(k => ({
        key: k.mac_key,
        alias: k.key_alias || k.mac_key,
        value: k.value || 'N/A'
      }))
  }));
});

// 获取设备数据
const fetchDevices = async () => {
  try {
    const res = await axios.get('/api/iot/devices', {
      params: { userId: authStore.userId }
    });
    
    // 标准化 MAC 并初始化数据
    Object.entries(res.data).forEach(([rawMac, device]) => {
      const mac = normalizeMac(rawMac);
      try {
        const msg = JSON.parse(device.msg || '{}').msg || {};
        device.keys.forEach(key => {
          key.value = msg[key.mac_key] || 'N/A';
        });
      } catch (e) {
        console.error('设备消息解析失败:', e);
      }
      devices[mac] = { ...device, normalizedMac: mac }; // 存储标准化 MAC
    });
  } catch (error) {
    console.error('获取设备失败:', error);
  }
};

// 修改后的更新函数
const updateSensorValues = (rawMac, msg) => {
  const mac = normalizeMac(rawMac);
  const device = devices[mac];
  
  if (!device) {
    console.warn(`未注册设备: ${mac} (原始值: ${rawMac})`);
    return;
  }

  device.keys.forEach(key => {
    const value = msg[key.mac_key];
    if (key.device_type === 1 && value !== undefined) {
      key.value = value;
    }
  });
};

// 初始化 MQTT
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
        err ? console.error('订阅失败:', err) : console.log('订阅成功:', res.data.topic);
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
        console.log('[MQTT消息]', payload);

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

// 生命周期
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
  height: 100vh;
}

.sensor-value-updated {
  background-color: #ffeb3b;
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
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 24px;
  padding: 24px;
}

.gateway-card {
  background: white;
  border-radius: 8px;
  padding: 16px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
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
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
}

.sensor-item {
  background: #f8f9fa;
  padding: 12px;
  border-radius: 6px;
}

.sensor-label {
  color: #7f8c8d;
  font-size: 12px;
}

.sensor-value {
  /* 添加更新动画 */
  transition: background-color 0.5s;
  font-size: 18px;
  font-weight: bold;
  color: #2c3e50;
}
</style>