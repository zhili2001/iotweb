<template>
  <div class="iot-container">
    <h2>设备管理</h2>
    <button @click="refreshDeviceKeys" class="refresh-btn">刷新设备信息</button>

    <div class="device-list">
      <div v-for="(device, mac) in devices" :key="mac" class="device-card">
        <div class="device-header">
          <h3>
            网关: {{ device.mac_alias || mac }}
            <span v-if="device.mac_alias" class="original-name">({{ mac }})</span>
          </h3>
          <input v-model="device.new_mac_alias" placeholder="输入网关别名" class="alias-input" />
        </div>

        <div class="key-list">
          <div v-for="key in device.keys" :key="key.mac_key" class="key-item">
            <div class="key-info">
              <span class="key-name">{{ key.key_alias || key.mac_key }}</span>
              <span class="original-name">({{ key.mac_key }})</span>
              <span class="key-value">{{ getKeyValue(device.msg, key.mac_key) }}</span>
            </div>
            <div class="key-controls">
              <div class="key-alias-row">
                <label class="key-label">设备名:</label>
                <input v-model="key.new_key_alias" placeholder="输入设备别名" class="key-input" />
              </div>
              <div class="key-type-row">
                <label class="key-label">设备类型:</label>
                <select v-model="key.type" class="key-select">
                  <option value="1">传感器</option>
                  <option value="2">控制器</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        <button @click="saveDeviceConfig(device, mac)" class="save-btn">保存配置</button>
        <button @click="removeDevice(mac)" class="remove-btn">移除网关</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import axios from 'axios';
import { useAuthStore } from '../stores/auth';
import { useRouter } from 'vue-router';

const authStore = useAuthStore();
const router = useRouter();
const devices = ref({});

const checkLoginStatus = () => {
  if (!authStore.isAuthenticated || authStore.expiresAt < Date.now()) {
    alert('登录已过期，请重新登录');
    authStore.logout();
    router.push('/login');
  }
};

const fetchDevices = async () => {
  try {
    checkLoginStatus();
    const { data } = await axios.get('/api/iot/devices', {
      params: { userId: authStore.userId },
    });
    for (const mac in data) {
      const device = data[mac];
      device.new_mac_alias = device.mac_alias || '';
      device.keys = device.keys || [];
      device.msg = device.msg || '{}';
      device.keys.forEach((key) => {
        key.new_key_alias = key.key_alias || '';
        key.type = key.device_type || '1';
      });
    }
    devices.value = data;
  } catch (error) {
    handleRequestError(error, '获取设备失败');
  }
};

const getKeyValue = (msg, mac_key) => {
  try {
    return JSON.parse(msg).msg[mac_key] || '无数据';
  } catch {
    return '数据解析失败';
  }
};

const saveDeviceConfig = async (device, mac) => {
  try {
    checkLoginStatus();
    await axios.post('/api/iot/set_keyvalue', {
      mac_address: mac,
      mac_alias: device.new_mac_alias,
      keys: device.keys.map((key) => ({
        mac_key: key.mac_key,
        key_alias: key.new_key_alias || key.mac_key,
        device_type: key.type,
      })),
    });
    alert('配置已保存');
    await fetchDevices();
  } catch (error) {
    handleRequestError(error, '保存失败');
  }
};

const refreshDeviceKeys = async () => {
  try {
    checkLoginStatus();
    await axios.post('/api/iot/save_keys', { userId: authStore.userId });
    await fetchDevices();
    alert('设备信息已刷新');
  } catch (error) {
    handleRequestError(error, '刷新设备信息失败');
  }
};

const removeDevice = async (mac) => {
  try {
    checkLoginStatus();
    const confirmDelete = confirm('确定要移除该网关吗？');
    if (!confirmDelete) return;

    await axios.delete('/api/iot/delete-device', {
      data: { mac_address: mac },
    });
    alert('网关已移除');
    await fetchDevices();
  } catch (error) {
    handleRequestError(error, '移除网关失败');
  }
};

const handleRequestError = (error, defaultMessage) => {
  console.error(defaultMessage, error);
  if (error.response?.status === 401) {
    alert('登录已过期，请重新登录');
    authStore.logout();
    router.push('/login');
  } else {
    alert(defaultMessage);
  }
};

onMounted(() => {
  checkLoginStatus();
  fetchDevices();
});
</script>

<style scoped>
.iot-container {
  display: grid;
  gap: 12px;
  padding: 12px;
}

.refresh-btn {
  padding: 8px 16px;
  background-color: #3b82f6;
  color: white;
  border: none;
  border-radius: 6px;
  font-size: 14px;
  cursor: pointer;
}

.refresh-btn:hover {
  background-color: #2563eb;
}

.device-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(270px, 1fr));
  gap: 12px;
}

.device-card {
  background: white;
  border-radius: 8px;
  padding: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.device-header {
  margin-bottom: 16px;
}

.device-header h3 {
  margin: 0 0 8px 0;
  font-size: 16px;
  color: #333;
}

.alias-input {
  width: 100%;
  padding: 8px;
  border: 2px solid #cbd5e1;
  border-radius: 6px;
  font-size: 14px;
}

.key-list {
  margin-top: 12px;
  display: grid;
  gap: 12px;
}

.key-item {
  padding: 10px;
  border-radius: 6px;
  background: #e3f2fd;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.key-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.key-name {
  font-weight: bold;
  color: #3b82f6;
}

.key-value {
  font-size: 14px;
  color: #27ae60;
}

.key-controls {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.key-alias-row,
.key-type-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.key-label {
  margin-left: auto; /* 靠右对齐 */
  font-size: 14px;
  color: #333;
}

.key-input,
.key-select {
  width: 70%;
  padding: 8px;
  border: 2px solid #cbd5e1;
  border-radius: 6px;
  font-size: 14px;
  margin-left: auto; /* 靠右对齐 */
}

.save-btn {
  margin-top: 12px;
  padding: 8px 16px;
  background-color: #3b82f6;
  color: white;
  border: none;
  border-radius: 6px;
  font-size: 14px;
  cursor: pointer;
}

.save-btn:hover {
  background-color: #2563eb;
}

.remove-btn {
  margin-top: 12px;
  padding: 8px 16px;
  background-color: #6b7280; /* 灰色 */
  color: white;
  border: none;
  border-radius: 6px;
  font-size: 14px;
  cursor: pointer;
  float: right; /* 靠右对齐 */
}

.remove-btn:hover {
  background-color: #4b5563; /* 深灰色 */
}
</style>