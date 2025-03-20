<template>
  <div>
      <div class="automation-view">
          <div class="summary">
              <!-- 网关在线情况 -->
              <div class="section">
                  <h3 class="section-title">网关在线情况</h3>
                  <div class="card">
                      <p class="label">当前在线网关数</p>
                      <p class="value">{{ onlineGatewaysCount }}</p>
                  </div>
                  <div class="card">
                      <p class="label">当前离线网关数</p>
                      <p class="value">{{ offlineGatewaysCount }}</p>
                  </div>
              </div>
  
              <!-- 网关数量 -->
              <div class="section">
                  <h3 class="section-title">网关数量</h3>
                  <div class="card">
                      <p class="label">已确认网关数量</p>
                      <p class="value">{{ confirmedGatewaysCount }}</p>
                  </div>
                  <div class="card">
                      <p class="label">未知网关数量</p>
                      <p class="value">{{ unknownGatewaysCount }}</p>
                  </div>
              </div>
  
              <!-- 设备数量 -->
              <div class="section">
                  <h3 class="section-title">设备数量</h3>
                  <div class="card">
                      <p class="label">已确认设备数量</p>
                      <p class="value">{{ confirmedDevicesCount }}</p>
                  </div>
                  <div class="card">
                      <p class="label">未知设备数量</p>
                      <p class="value">{{ unknownDevicesCount }}</p>
                  </div>
              </div>
          </div>
      </div>
  
      <div class="automation-view">
          <div class="summary">
              <!-- 数据条数 -->
              <div class="section">
                  <h3 class="section-title">数据条数</h3>
                  <div class="card">
                      <p class="label">收到数据条数</p>
                      <p class="value">{{ totalGatherCount }}</p>
                  </div>
                  <div class="card">
                      <p class="label">发送数据条数</p>
                      <p class="value">{{ totalOperateCount }}</p>
                  </div>
              </div>
          </div>
      </div>
  </div>
  </template>
  
  <script setup>
  import { ref, reactive, computed, onMounted } from 'vue';
  import axios from 'axios';
  import { useAuthStore } from '../stores/auth';
  
  const authStore = useAuthStore();
  const devices = reactive({}); // 存储设备数据
  
  // 标准化 MAC 地址格式
  const normalizeMac = (mac) => mac?.replace(/[^a-fA-F0-9]/g, '').toLowerCase() || '';
  
  // 获取设备数据
  const fetchDevices = async () => {
    try {
      const res = await axios.get('/api/iot/devices', { params: { userId: authStore.userId } });
      Object.entries(res.data).forEach(([rawMac, device]) => {
        const mac = normalizeMac(rawMac);
        devices[mac] = {
          ...device,
          normalizedMac: mac,
          alias: device.mac_alias || mac,
          keys: device.keys.map(key => ({
            ...key,
            alias: key.key_alias || key.mac_key
          }))
        };
      });
    } catch (error) {
      console.error('获取设备失败:', error);
    }
  };
  
  // 计算统计信息
  const confirmedGatewaysCount = computed(() =>
    Object.values(devices).filter(device => device.mac_alias).length
  );
  const unknownGatewaysCount = computed(() =>
    Object.values(devices).filter(device => !device.mac_alias).length
  );
  const confirmedDevicesCount = computed(() =>
    Object.values(devices).reduce((count, device) =>
      count + device.keys.filter(key => key.key_alias).length, 0)
  );
  const unknownDevicesCount = computed(() =>
    Object.values(devices).reduce((count, device) =>
      count + device.keys.filter(key => !key.key_alias).length, 0)
  );
  
  // 新增计算在线和离线网关数量
  const onlineGatewaysCount = computed(() =>
    Object.values(devices).filter(device => device.is_online).length
  );
  const offlineGatewaysCount = computed(() =>
    Object.values(devices).filter(device => !device.is_online).length
  );
  
  const totalGatherCount = ref(0); // 收到数据条数
  const totalOperateCount = ref(0); // 发送数据条数
  
  // 获取数据条数
  const fetchRecordCounts = async () => {
    try {
      const res = await axios.post('/api/iot/get_record_count', { userId: authStore.userId });
      totalGatherCount.value = res.data.total_gather_count;
      totalOperateCount.value = res.data.total_operate_count;
    } catch (error) {
      console.error('获取数据条数失败:', error);
    }
  };
  
  // 生命周期钩子
  onMounted(() => {
    fetchDevices();
    fetchRecordCounts();
  });
  </script>
  
  <style scoped>
  .automation-view {
    padding: 16px;
  }
  
  .summary {
    margin-top: 16px;
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); /* 设置最小宽度为 200px */
    gap: 24px; /* 设置板块之间的间距 */
    max-width: calc(4 * 270px + 3 * 24px); /* 限制最大宽度为 4 个卡片宽度加间距 */
    margin-left: auto; /* 居中对齐 */
    margin-right: auto; /* 居中对齐 */
  }
  
  .section {
    background: #f9f9f9;
    padding: 16px;
    border-radius: 8px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  }
  
  .section-title {
    font-size: 18px;
    font-weight: bold;
    margin-bottom: 16px;
    color: #333333;
  }
  
  .card {
    background: #ffffff;
    padding: 16px;
    border-radius: 8px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    text-align: center;
    margin-bottom: 16px;
  }
  
  .card .label {
    font-size: 14px;
    color: #888888;
    margin-bottom: 8px;
  }
  
  .card .value {
    font-size: 24px;
    font-weight: bold;
    color: #333333;
  }
  </style>