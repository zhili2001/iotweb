<template>
  <!-- 密码验证框 -->
  <div v-if="showPasswordPrompt" class="password-prompt">
    <input v-model="password" type="password" placeholder="请输入密码" />
    <button @click="handlePasswordSubmit">提交</button>
  </div>

  <!-- 自动化设置界面 -->
  <div v-else class="automation-view">
    <div class="automation-container">
      <div v-for="gateway in gateways" :key="gateway.mac" class="gateway-card">
        <div class="gateway-header">
          <h3>{{ gateway.alias }}</h3>
          <span :class="['status', gateway.online ? 'online' : 'offline']">
            {{ gateway.online ? '在线' : '离线' }}
          </span>
        </div>
        <div class="automation-grid">
          <div 
            v-for="automation in gateway.automations" 
            :key="automation.key" 
            class="automation-item"
          >
            <div class="automation-label">{{ automation.alias }}</div>
            <label class="switch">
              <input 
                type="checkbox" 
                :checked="automation.value === 1" 
                @change="toggleAutomation(gateway.mac, automation.key, automation.value)" 
                :disabled="!gateway.online"
              />
              <span class="slider"></span>
            </label>
          </div>
        </div>
        <!-- 添加底部横线划分 -->
        <div class="control-section"></div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, onUnmounted } from 'vue';
import mqtt from 'mqtt';
import axios from 'axios';
import { useAuthStore } from '../stores/auth';

const authStore = useAuthStore();
const devices = reactive({});
const mqttClientInstance = ref(null);
const mqttTopic = ref('');
const password = ref('');
const showPasswordPrompt = ref(true);

const gateways = computed(() =>
  Object.entries(devices).map(([rawMac, device]) => ({
    mac: rawMac,
    alias: device.mac_alias || rawMac,
    online: device.is_online,
    automations: device.keys
      .filter(k => parseInt(k.device_type) === 3)
      .map(k => ({
        key: k.mac_key,
        alias: k.key_alias || k.mac_key,
        value: k.value || 0
      }))
  }))
);

const fetchDevices = async () => {
  try {
    const res = await axios.get('/api/iot/devices', { params: { userId: authStore.userId } });
    Object.entries(res.data).forEach(([rawMac, device]) => {
      try {
        const msg = JSON.parse(device.msg || '{}').msg || {};
        device.keys.forEach(key => (key.value = msg[key.mac_key] || 0));
      } catch (e) {
        console.error('设备消息解析失败:', e);
      }
      devices[rawMac] = { ...device };
    });
  } catch (error) {
    console.error('获取设备失败:', error);
  }
};

const toggleAutomation = (mac, key, currentValue) => {
  if (!mqttClientInstance.value?.connected) {
    alert('MQTT连接失败，请重试！');
    return;
  }

  const newValue = currentValue === 1 ? 0 : 1;
  const payload = JSON.stringify({ msg: { [key]: newValue.toString() } });
  const fullMessage = `[${mac}]${payload}`;

  mqttClientInstance.value.publish(mqttTopic.value, fullMessage, err => {
    if (err) {
      console.error('发送失败:', err);
      alert('指令发送失败');
    } else {
      console.log('指令已发送:', fullMessage);
      const automation = devices[mac]?.keys.find(k => k.mac_key === key);
      if (automation) automation.value = newValue;
    }
  });
};

const initMqttClient = async () => {
  if (mqttClientInstance.value?.connected) return;

  try {
    const res = await axios.post('/api/iot/get_topic', {
      username: authStore.username,
      password: password.value
    });

    mqttTopic.value = res.data.topic;
    mqttClientInstance.value = mqtt.connect('ws://lichen129.icu:8083/mqtt', {
      clientId: '11111111111111111',
      username: authStore.username,
      password: password.value,
      protocolVersion: 5
    });

    mqttClientInstance.value.on('connect', () => {
      console.log('MQTT 连接成功');
      mqttClientInstance.value.subscribe(mqttTopic.value, err => {
        if (err) console.error('订阅失败:', err);
        else console.log('订阅成功:', mqttTopic.value);
      });
    });

    mqttClientInstance.value.on('message', (topic, message) => {
      try {
        const messageString = message.toString();
        const macMatch = messageString.match(/^\[([^\]]+)\]/);
        if (!macMatch) return console.error('消息缺少 MAC 标识:', messageString);

        const msgMac = macMatch[1];
        const payload = JSON.parse(messageString.replace(/^\[[^\]]+\]/, ''));
        console.log('[MQTT消息]', payload);

        const device = devices[msgMac];
        if (!device) return console.warn(`未注册设备: ${msgMac}`);

        device.keys.forEach(key => {
          const value = payload.msg[key.mac_key];
          if (value !== undefined) key.value = parseInt(value);
        });
      } catch (e) {
        console.error('消息解析失败:', e);
      }
    });

    mqttClientInstance.value.on('error', err => console.error('MQTT 错误:', err));
    mqttClientInstance.value.on('close', () => console.log('MQTT 连接已关闭'));
  } catch (error) {
    console.error('MQTT 初始化失败:', error);
  }
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
  document.title = '自动化设置';

});

onUnmounted(() => mqttClientInstance.value?.end(true));
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

/* 自动化界面样式 */
.automation-container {
  display: grid;
  grid-template-columns: 1fr;
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

.automation-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(110px, 1fr));
  gap: 12px;
}

.automation-item {
  padding: 10px;
  border-radius: 6px;
  background: #fff9c4;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.automation-label {
  font-size: 14px;
  font-weight: bold;
  color: #7f8c8d;
  margin-bottom: 8px;
}

.switch {
  position: relative;
  display: inline-block;
  width: 34px;
  height: 20px;
}

.switch input {
  opacity: 0;
  width: 0;
  height: 0;
}

.slider {
  position: absolute;
  cursor: pointer;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: #ccc;
  transition: 0.4s;
  border-radius: 20px;
}

.slider:before {
  position: absolute;
  content: "";
  height: 14px;
  width: 14px;
  left: 3px;
  bottom: 3px;
  background-color: white;
  transition: 0.4s;
  border-radius: 50%;
}

input:checked + .slider {
  background-color: #4caf50;
}

input:checked + .slider:before {
  transform: translateX(14px);
}

input:disabled + .slider {
  background-color: #b0b0b0;
  cursor: not-allowed;
}

/* 底部横线划分样式 */
.control-section {
  margin-top: 1rem;
  border-top: 1px solid #eee;
  padding-top: 1rem;
}
</style>