<template>
  <div class="iot-container">
    <h2>设备管理</h2>
    <button @click="refreshDeviceKeys" class="refresh-btn">刷新设备信息</button>

    <div class="device-list">
      <!-- 实际含义：
      devices: 一个对象格式应为 { mac1: device1, mac2: device2 ... }
      device: 对象的值（即设备数据）
      mac: 对象的键（即 MAC 地址字符串）-->
      <div v-for="(device, mac) in devices" :key="mac" class="device-card">
        <!-- 设备名称部分 -->
        <div class="device-header">
          <h3 v-if="device.mac_alias">
            网关: {{ device.mac_alias }}
            <span class="original-name">({{ mac }})</span>
          </h3>
          <h3 v-else>网关: {{ mac }}</h3>
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
              <input v-model="key.new_key_alias" placeholder="输入设备别名" class="key-input" />
              <select v-model="key.type" class="key-select">
                <option value="1">传感器</option>
                <option value="2">控制器</option>
              </select>
            </div>
          </div>
        </div>

        <button @click="saveConfig(device, mac)" class="save-btn">保存配置</button>
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

// 检查登录状态
const checkLoginStatus = () => {
  if (!authStore.isAuthenticated || authStore.expiresAt < Date.now()) {
    alert('登录已过期，请重新登录');
    authStore.logout();
    router.push('/login');
  }
};

// 获取设备数据
const fetchDevices = async () => {
  try {
    checkLoginStatus(); // 每次请求前检查登录状态
    const res = await axios.get('/api/iot/devices', {
      params: { userId: authStore.userId },
    });
    // 初始化 new_mac_alias 和 new_key_alias
    for (const mac in res.data) {
      const device = res.data[mac];
      device.new_mac_alias = device.mac_alias || '';
      device.keys = device.keys || []; // 确保 device.keys 是一个数组
      device.msg = device.msg || '{}'; // 确保 device.msg 存在
      if (device.keys) {
        device.keys.forEach((key) => {
          key.new_key_alias = key.key_alias || '';
          key.type = key.device_type || '1'; // 默认类型为传感器
        });
      }
    }
    devices.value = res.data;
    console.log('设备数据:', devices.value); // 打印设备数据
  } catch (error) {
    console.error('获取设备失败:', error);
    if (error.response?.status === 401) {
      alert('登录已过期，请重新登录');
      authStore.logout();
      router.push('/login');
    }
  }
};

// 解析 msg 中的 key 值
const getKeyValue = (msg, mac_key) => {
  try {
    const msgObj = JSON.parse(msg).msg;
    return msgObj[mac_key] || '无数据';
  } catch (e) {
    return '数据解析失败';
  }
};

// 保存配置
const saveConfig = async (device, mac) => {
  try {
    checkLoginStatus(); // 每次请求前检查登录状态
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
    await fetchDevices();
  } catch (error) {
    console.error('保存失败:', error);
    if (error.response?.status === 401) {
      alert('登录已过期，请重新登录');
      authStore.logout();
      router.push('/login');
    } else {
      alert('保存失败，请重试');
    }
  }
};

// 刷新设备信息
const refreshDeviceKeys = async () => {
  try {
    checkLoginStatus(); // 每次请求前检查登录状态
    // 调用后端接口保存设备的原始 key
    await axios.post('/api/iot/save_keys', {
      userId: authStore.userId,
    });

    // 刷新页面：以显示新增的 key
    await fetchDevices();
    alert('设备信息已刷新');
  } catch (error) {
    console.error('刷新设备信息失败:', error);
    if (error.response?.status === 401) {
      alert('登录已过期，请重新登录');
      authStore.logout();
      router.push('/login');
    } else {
      alert('刷新设备信息失败，请重试');
    }
  }
};

onMounted(() => {
  checkLoginStatus(); // 组件加载时检查登录状态
  fetchDevices();
});
</script>

<style scoped>
.iot-container {
  padding: 10px;
}

.refresh-btn {
  margin-bottom: 20px;
  padding: 10px 20px;
  background-color: #28a745;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.refresh-btn:hover {
  background-color: #218838;
}

.device-list {
  display: flex;
  flex-wrap: wrap;
  gap: 20px;
}

.device-card {
  border: 1px solid #ddd;
  padding: 15px;
  border-radius: 8px;
  background-color: #f9f9f9;
  flex: 1 1 calc(33.333% - 20px); /* 每行显示三个卡片，间距为20px */
  box-sizing: border-box;
}

.device-header {
  margin-bottom: 20px;
}

.device-header h3 {
  margin: 0 0 10px 0;
  font-size: 18px;
  color: #333;
}

.alias-input {
  width: 100%;
  padding: 8px;
  border: 1px solid #ccc;
  border-radius: 4px;
  margin-bottom: 15px;
}

.key-list {
  margin-top: 15px;
}

.key-item {
  margin: 10px 0;
  padding: 10px;
  border: 1px solid #eee;
  border-radius: 4px;
  background-color: #fff;
}

.key-info {
  margin-bottom: 8px;
}

.key-name {
  font-weight: bold;
  color: #007bff;
}

.key-value {
  font-size: small;
  color: #28a745;
}

.key-controls input {
  width: 100%;
  padding: 8px;
  border: 1px solid #ccc;
  border-radius: 4px;
  margin-bottom: 8px;
}

.key-controls select {
  width: 100%;
  padding: 8px;
  border: 1px solid #ccc;
  border-radius: 4px;
}

.save-btn {
  margin-top: 15px;
  padding: 10px 20px;
  background-color: #007bff;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.save-btn:hover {
  background-color: #0056b3;
}
</style>