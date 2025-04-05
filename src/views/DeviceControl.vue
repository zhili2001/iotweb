<template>
  <!-- 密码提示框 -->
  <div v-if="showPasswordPrompt" class="password-prompt">
    <input v-model="password" type="password" placeholder="请输入密码" />
    <button @click="handlePasswordSubmit">提交</button>
  </div>

  <!-- 监控容器（仅显示控制器） -->
  <div v-else class="monitor-container">
    <div v-for="gateway in gateways" :key="gateway.mac" class="gateway-card">
      <div class="gateway-header">
        <h3>{{ gateway.alias }}</h3>
        <span :class="['status', gateway.online ? 'online' : 'offline']">
          {{ gateway.online ? '在线' : '离线' }}
        </span>
      </div>
      <div class="controller-grid">
        <div 
          v-for="controller in gateway.controllers" 
          :key="controller.key" 
          class="controller-item"
        >
          <div class="controller-header">
            <span class="controller-label">{{ controller.alias }}</span>
            <span class="current-value">当前值: {{ controller.value }}</span>
          </div>
          <div class="controller-control">
            <input
              v-model.number="controllerValues[controller.key]"
              type="number"
              :placeholder="`输入新值 (${controller.range})`"
            >
             <!-- 只判断设备在线状态 -->
            <button 
            @click="sendControlCommand(gateway.mac, controller.key)"
            :disabled="!gateway.online"
            >
              发送
            </button>
          </div>
        </div>
      </div>
      <!-- 添加底部横线划分 -->
      <div class="control-section"></div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, onUnmounted } from 'vue';
import { useAuthStore } from '../stores/auth';
import mqtt from 'mqtt';
import axios from 'axios';

const authStore = useAuthStore();
const devices = reactive({});
const password = ref('');
const showPasswordPrompt = ref(true);
const controllerValues = reactive({}); // 存储所有控制器的输入值
const mqttTopic = ref(''); // 存储MQTT主题
let mqttClientInstance = null;

const gateways = computed(() => {
  return Object.entries(devices).map(([rawMac, device]) => ({
    mac: rawMac, // 直接使用 rawMac
    alias: device.mac_alias || rawMac,
    online: device.is_online,
    controllers: device.keys
      .filter(k => parseInt(k.device_type) === 2) // 保留控制器类型
      .map(k => ({
        key: k.mac_key,
        alias: k.key_alias || k.mac_key,
        value: k.value || 'N/A',
        range: k.range || '0-100'
      }))
  }));
});

const fetchDevices = async () => {
  try {
    const res = await axios.get('/api/iot/devices', {
      params: { 
        userId: authStore.userId
      }
    });
    
    Object.entries(res.data).forEach(([rawMac, device]) => {
      try {
        const msg = JSON.parse(device.msg || '{}').msg || {};   //提取嵌套的 msg 字段
        device.keys.forEach(key => {                            //遍历网关的每个key
          key.value = msg[key.mac_key] || 'N/A';                //提取对应 key中对应mac_key 的值，若不存在则设为 'N/A'。
          controllerValues[key.mac_key] = key.value;            //将键值（msg中信息）对保存到全局对象中
        });
      } catch (e) {
        console.error('设备消息解析失败:', e);
      }
      devices[rawMac] = { ...device, rawMac }; //  ...device:将 device 对象的所有属性展开到新对象中，添加（或覆盖）rawMac 属性
    });
  } catch (error) {
    console.error('获取设备失败:', error);
  }
};

// 恢复原始消息处理方法
const updateSensorValues = (rawMac, msg) => {
  const device = devices[rawMac]; // 直接使用 rawMac
  
  if (!device) {
    console.warn(`未注册设备: ${rawMac}`);
    return;
  }

  device.keys.forEach(key => {
    const value = msg[key.mac_key];
    if ((key.device_type === 1 || key.device_type === 2) && value !== undefined) {
      key.value = value;
    }
  });
};

// 修复MQTT初始化（保持客户端ID一致）
const initMqttClient = async () => {
  if (mqttClientInstance?.connected) return;

  try {
    const res = await axios.post('/api/iot/get_topic', {
      username: authStore.username,
      password: password.value
    });
    
    mqttTopic.value = res.data.topic;
    mqttClientInstance = mqtt.connect('ws://lichen129.icu:8083/mqtt', {
      clientId: '11111111111111111', // 保持固定客户端ID
      username: authStore.username,
      password: password.value,
      protocolVersion: 5
    });

    mqttClientInstance.on('connect', () => {
      console.log('MQTT 连接成功');
      mqttClientInstance.subscribe(mqttTopic.value, { qos: 0, nl: true }, (err) => {
        err ? console.error('订阅失败:', err) : console.log('订阅成功:', mqttTopic.value);
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

        // 调用正确的处理方法
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

const sendControlCommand = (mac, key) => {
  if (!mqttClientInstance?.connected) {
    alert('MQTT连接堵塞，请重试！');
    return;
  }

  const value = controllerValues[key];
  if (value === undefined || value === null) {
    alert('请输入有效值');
    return;
  }

  const payload = JSON.stringify({ msg: { [key]: value.toString() } });
  // 发送控制命令
  const fullMessage = `[${mac}]${payload}`;
  mqttClientInstance.publish(mqttTopic.value, fullMessage, err => {
    if (err) {
      console.error('发送失败:', err);
      alert('指令发送失败');
    } else {
      console.log('指令已发送:', fullMessage);
      // 更新本地值显示
      const device = devices[mac];
      const controller = device.keys.find(k => k.mac_key === key);
      if (controller) controller.value = value;
    }
  });
};

const handlePasswordSubmit = async () => {
  try {
    await initMqttClient();
    showPasswordPrompt.value = false;
    sessionStorage.setItem('mqttPassword', password.value);
    fetchDevices();
  } catch {
    showPasswordPrompt.value = true;
    sessionStorage.removeItem('mqttPassword');
  }
};

onMounted(() => {
  const savedPassword = sessionStorage.getItem('mqttPassword');
  if (savedPassword) {
    password.value = savedPassword;
    handlePasswordSubmit();
  }
});

onUnmounted(() => {
  mqttClientInstance?.end(true);
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
  grid-template-columns: 1fr; /* 横排布局 */
  gap: 12px;
  padding: 12px;
}

.gateway-card {
  background: white;
  border-radius: 8px;
  padding: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
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

/* 控制器网格样式 */
.controller-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); /* 横排布局 */
  gap: 12px;
}

.controller-item {
  padding: 10px;
  border-radius: 6px;
  background: #e3f2fd;
  display: flex;
  flex-direction: column;
  gap: 8px; /* 调整为统一间距 */
}

.controller-header {
  display: flex;
  justify-content: space-between; /* 设备名和设备值两端对齐 */
  width: 100%;
}

.controller-control {
  display: flex;
  justify-content: space-between; /* 输入框和按钮两端对齐 */
  align-items: center;
  gap: 8px; /* 调整为统一间距 */
  width: 100%;
}

.controller-control input {
  flex: 1; /* 输入框占据剩余空间 */
  max-width: 65%; /* 限制宽度为父容器的0.6*/
  padding: 8px;
  border: 2px solid #cbd5e1;
  border-radius: 6px;
  font-size: 14px;
}

.controller-control button {
  max-width: 60px; /* 限制宽度为父容器的0.6*/
  padding: 8px 16px;
  background: #3b82f6;
  color: white;
  border: none;
  border-radius: 6px;
  font-size: 14px;
  cursor: pointer;
  white-space: nowrap; /* 防止按钮文字换行 */
}

.controller-control button:hover {
  background: #2563eb;
}

.controller-control button:disabled {
  background: #94a3b8;
  cursor: not-allowed;
  opacity: 0.7;
}

/* 底部横线划分样式 */
.control-section {
  margin-top: 1rem;
  border-top: 1px solid #eee;
  padding-top: 1rem;
}
</style>