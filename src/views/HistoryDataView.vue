<template>
  <div class="header">
    <h1>{{ gatewayName }}</h1>
    <div class="toolbar">
      <button @click="handleManualRefresh" class="refresh-button">立即刷新</button>
      <label class="auto-refresh">
        <input type="checkbox" v-model="autoRefresh" :disabled="!isDataLoaded" />
        自动刷新（120S）
      </label>
    </div>
  </div>
  <div class="toolbar">
    <label>选择设备：</label>
    <select v-model="selectedKey" class="key-select" :disabled="!isDataLoaded">
      <option v-for="item in rawData" :key="item.key" :value="item.key">
        {{ item.key_alias || item.key }}
      </option>
    </select>
    <label>选择日期：</label>
    <select v-model="selectedDate">
      <option v-for="date in dateOptions" :key="date" :value="date">
        {{ date }}
      </option>
    </select>
  </div>
  <div class="toolbar">
    <label>选择时间范围：</label>
    <select v-model="startHour">
      <option v-for="hour in hourOptions" :key="hour" :value="hour">
        {{ hour }}:00
      </option>
    </select>
    <span>至</span>
    <select v-model="endHour">
      <option v-for="hour in hourOptions" :key="hour" :value="hour">
        {{ hour }}:00
      </option>
    </select>
  </div>
  <div v-if="!isDataLoaded" class="loading-container">
    <p>未获取数据，请点击“立即刷新”按钮获取数据。</p>
  </div>
  <div v-else class="history-container">
    <div class="chart-container">
      <div ref="chartEl" class="chart"></div>
    </div>
    <div class="data-table">
      <table>
        <thead>
          <tr>
            <th>时间</th>
            <th>值</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(item, index) in paginatedTableData" :key="index"> <!-- 使用 paginatedTableData -->
            <td>{{ formatTime(item.time) }}</td>
            <td>{{ item.value }}</td>
          </tr>
        </tbody>
      </table>
      <div class="pagination">
        <button @click="goToFirstPage" :disabled="currentPage === 1">第一页</button>
        <button @click="goToPreviousPage" :disabled="currentPage === 1">上一页</button>
        <span>第 {{ currentPage }} 页 / 共 {{ totalPages }} 页</span>
        <button @click="goToNextPage" :disabled="currentPage === totalPages">下一页</button>
        <button @click="goToLastPage" :disabled="currentPage === totalPages">最后一页</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch, onUnmounted } from 'vue';
import { useRoute } from 'vue-router';
import { useAuthStore } from '../stores/auth';
import axios from 'axios';
import * as echarts from 'echarts';

const route = useRoute();
const authStore = useAuthStore();
const chartEl = ref(null);
let chartInstance = null;

const gatewayName = ref(''); // 网关名称

// 页面加载时获取网关别名
const fetchGatewayAlias = async () => {
  try {
    const mac = route.params.mac;
    const res = await axios.get('/api/iot/devices', { params: { userId: authStore.userId } });
    const device = res.data[mac];
    if (device) {
      gatewayName.value = device.mac_alias || mac; // 设置网关名称

      // 更新 rawData，确保设备名（key_alias）正确显示
      rawData.value = device.keys.map(key => ({
        key: key.mac_key,
        key_alias: key.key_alias || key.mac_key, // 使用自定义名称或默认值
        values: [] // 初始化为空，等待历史数据填充
      }));
    } else {
      gatewayName.value = mac; // 如果未找到别名，使用 MAC 地址
    }
  } catch (error) {
    console.error('获取网关别名失败:', error);
    gatewayName.value = route.params.mac; // 回退到 MAC 地址
  }
};

// 响应式数据
const autoRefresh = ref(false);
const refreshInterval = ref(120000); // 自动刷新间隔设置为2分钟
let autoRefreshTimer = null; // 自动刷新定时器
const selectedKey = ref(null); // 当前选择的 key
const isDataLoaded = ref(false); // 数据是否加载成功
const currentPage = ref(1); // 当前页码
const itemsPerPage = 5; // 每页显示的行数

// 数据处理
const rawData = ref([]);
const filteredTableData = computed(() => {
  if (!selectedKey.value) return [];
  const keyData = rawData.value.find(item => item.key === selectedKey.value);
  return keyData ? keyData.values : [];
});

// 分页逻辑更新
const paginatedTableData = computed(() => {
  const start = (currentPage.value - 1) * itemsPerPage;
  const end = start + itemsPerPage;
  return filteredTableDataByRange.value.slice(start, end); // 确保分页基于筛选后的数据
});

const totalPages = computed(() => Math.ceil(filteredTableDataByRange.value.length / itemsPerPage)); // 使用筛选后的数据计算总页数

// 分页方法
const goToFirstPage = () => (currentPage.value = 1);
const goToPreviousPage = () => (currentPage.value = Math.max(1, currentPage.value - 1));
const goToNextPage = () => (currentPage.value = Math.min(totalPages.value, currentPage.value + 1));
const goToLastPage = () => (currentPage.value = totalPages.value);

// 手动刷新方法
const handleManualRefresh = async () => {
  try {
    const mac = route.params.mac;
    const res = await axios.post('/api/iot/get_mac_data', { mac_address: mac });

    if (res.data && res.data.data) {
      // 填充历史数据到 rawData，并正确映射 key_alias
      rawData.value = Object.entries(res.data.data).map(([key, values]) => {
        const deviceKey = rawData.value.find(item => item.key === key);
        return {
          key,
          key_alias: deviceKey?.key_alias || key, // 使用 key_alias 或默认 key
          values: values.map(data => ({
            value: data.value,
            time: new Date(data.time).getTime() // 转换时间为时间戳
          }))
        };
      });

      isDataLoaded.value = true;

      // 如果当前选择的设备有数据，刷新图表和表格
      if (selectedKey.value) {
        updateChartAndTable();
      }

      // 仅在手动刷新时弹窗提示
      if (!autoRefresh.value) {
        alert('数据已刷新');
      }
    } else {
      throw new Error('返回数据格式不正确');
    }
  } catch (error) {
    isDataLoaded.value = false;
    alert('数据加载失败，请重试');
    console.error('数据加载失败:', error.message || error);
  }
};

// 初始化图表
const initChart = () => {
  if (!chartEl.value || !selectedKey.value) return;
  chartInstance = echarts.init(chartEl.value);

  const keyData = rawData.value.find(item => item.key === selectedKey.value);
  const seriesData = keyData ? keyData.values.map(d => [d.time, d.value]) : [];

  const option = {
    tooltip: { 
      trigger: 'axis',
      formatter: (params) => {
        const date = new Date(params[0].data[0]);
        const month = date.getMonth() + 1;
        const day = date.getDate();
        const hours = date.getHours();
        const minutes = date.getMinutes().toString().padStart(2, '0');
        const formattedDate = `${month}-${day} ${hours}:${minutes}`; // 格式为 "月-日 时:分"
        return `${formattedDate}<br>${params[0].marker}${params[0].seriesName}: ${params[0].data[1]}`;
      }
    },
    xAxis: {
      type: 'time', // 使用时间轴类型
      boundaryGap: false, // 确保线条从起点开始
    },
    yAxis: { type: 'value' },
    series: [
      {
        name: keyData?.key_alias || selectedKey.value, // 使用设备别名或默认 key
        type: 'line', // 使用折线图
        data: seriesData, // 使用时间戳和值的数组
      }
    ]
  };

  chartInstance.setOption(option);
};

// 时间格式化
const formatTime = (timestamp) => {
  const date = new Date(timestamp);
  const month = date.getMonth() + 1; // 月份从0开始，需要加1
  const day = date.getDate();
  const hours = date.getHours();
  const minutes = date.getMinutes().toString().padStart(2, '0');
  const seconds = date.getSeconds().toString().padStart(2, '0'); // 增加秒的显示
  return `${month}-${day} ${hours}:${minutes}:${seconds}`; // 格式为 "月-日 时:分:秒"
};

// 自动刷新逻辑
watch(autoRefresh, (newValue) => {
  if (newValue) {
    autoRefreshTimer = setInterval(() => {
      handleManualRefresh();
    }, refreshInterval.value);
  } else {
    clearInterval(autoRefreshTimer);
    autoRefreshTimer = null;
  }
});

const selectedDate = ref('全部'); // 默认值为 "全部"
const startHour = ref(0);
const endHour = ref(23);
const dateOptions = ref([]);
const hourOptions = Array.from({ length: 24 }, (_, i) => i);

// 初始化日期选项
const initDateOptions = () => {
  const today = new Date();
  dateOptions.value = ['全部', ...Array.from({ length: 8 }, (_, i) => {
    const date = new Date(today);
    date.setDate(today.getDate() - i);
    return date.toISOString().split('T')[0];
  })];
};

// 根据时间范围过滤表格和图表数据
const filteredTableDataByRange = computed(() => {
  if (!selectedKey.value) return [];
  const keyData = rawData.value.find(item => item.key === selectedKey.value);
  if (!keyData) return [];

  if (selectedDate.value === '全部') {
    return keyData.values; // 不筛选日期，返回所有数据
  }

  const startTimestamp = new Date(`${selectedDate.value}T${String(startHour.value).padStart(2, '0')}:00:00`).getTime();
  const endTimestamp = new Date(`${selectedDate.value}T${String(endHour.value).padStart(2, '0')}:59:59`).getTime();

  return keyData.values.filter(item => item.time >= startTimestamp && item.time <= endTimestamp);
});

// 更新图表和表格
const updateChartAndTable = () => {
  if (!chartEl.value || !selectedKey.value) return;

  // 根据时间范围筛选数据
  const seriesData = filteredTableDataByRange.value.map(d => [d.time, d.value]); // 使用时间戳作为 x 轴数据

  const option = {
    tooltip: { 
      trigger: 'axis',
      formatter: (params) => {
        const date = new Date(params[0].data[0]);
        const month = date.getMonth() + 1;
        const day = date.getDate();
        const hours = date.getHours();
        const minutes = date.getMinutes().toString().padStart(2, '0');
        const formattedDate = `${month}-${day} ${hours}:${minutes}`; // 格式为 "月-日 时:分"
        return `${formattedDate}<br>${params[0].marker}${params[0].seriesName}: ${params[0].data[1]}`;
      }
    },
    xAxis: {
      type: 'time', // 保持时间轴类型
      boundaryGap: false, // 确保线条从起点开始
    },
    yAxis: { type: 'value' },
    series: [
      {
        name: rawData.value.find(item => item.key === selectedKey.value)?.key_alias || selectedKey.value, // 使用设备别名或默认 key
        type: 'line', // 使用折线图
        data: seriesData // 使用时间戳和值的数组
      }
    ],
    title: {
      text: seriesData.length === 0 ? '当前日期无数据' : '', // 无数据时显示提示
      left: 'center',
      top: 'middle',
      textStyle: {
        color: '#999',
        fontSize: 16
      }
    }
  };

  chartInstance.setOption(option);

  // 重置分页到第一页
  currentPage.value = 1;
};

// 监听时间范围和设备变化
watch([selectedDate, startHour, endHour, selectedKey], updateChartAndTable);

// 监听设备选择变化，重置日期和时间范围
watch(selectedKey, () => {
  selectedDate.value = '全部'; // 重置日期为 "全部"
  startHour.value = 0; // 重置开始时间为 0
  endHour.value = 23; // 重置结束时间为 23
  initChart();
});

// 初始化日期选项
onMounted(() => {
  initDateOptions();
  fetchGatewayAlias();
  watch(selectedKey, () => {
    initChart();
  });
});

// 页面卸载时清除定时器
onUnmounted(() => {
  clearInterval(autoRefreshTimer);
});

// 响应窗口变化
window.addEventListener('resize', () => {
  chartInstance?.resize();
});
</script>

<style scoped>
.loading-container {
  text-align: center;
  margin-top: 2rem;
  font-size: 1.2rem;
  color: #555;
}
.toolbar {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-bottom: 1rem;
  flex-wrap: wrap; /* 支持换行 */
}

.key-select {
  padding: 0.5rem;
  font-size: 1rem;
}

.refresh-button {
  padding: 0.5rem 1rem;
  background-color: #3b82f6;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.refresh-button:hover {
  background-color: #2563eb;
}

.auto-refresh {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.history-container {
  padding: 2rem;
  max-width: 1200px;
  margin: 0 auto;
}

.chart-container {
  margin-bottom: 2rem;
}

.chart {
  width: 100%;
  height: 400px;
}

.data-table {
  overflow-x: auto;
}

table {
  width: 100%;
  border-collapse: collapse;
}

th, td {
  padding: 0.8rem;
  border: 1px solid #ddd;
  text-align: left;
}

th {
  background-color: #f5f6fa;
}

.pagination {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 0.5rem;
  margin-top: 1rem;
}

.pagination button {
  padding: 0.5rem 1rem;
  background-color: #3b82f6;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.pagination button:disabled {
  background-color: #94a3b8;
  cursor: not-allowed;
}

.header {
  text-align: center;
  margin-bottom: 1rem;
}
.header h1 {
  font-size: 1.5rem;
  color: #333;
}

.date-range {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

@media (max-width: 768px) {
  .toolbar {
    flex-direction: column; /* 小屏幕下垂直排列 */
    align-items: stretch; /* 拉伸子元素宽度 */
  }

  .key-select,
  .refresh-button,
  .pagination button {
    width: 100%; /* 按钮和选择框宽度占满 */
    box-sizing: border-box; /* 包括内边距和边框 */
  }

  .header h1 {
    font-size: 1.2rem; /* 调整标题大小 */
  }

  .chart {
    height: 300px; /* 图表高度适配小屏幕 */
  }

  table {
    font-size: 0.9rem; /* 表格字体缩小 */
  }

  th, td {
    padding: 0.5rem; /* 缩小单元格内边距 */
  }

  .pagination {
    flex-direction: column; /* 分页按钮垂直排列 */
    gap: 0.5rem;
  }
}
</style>