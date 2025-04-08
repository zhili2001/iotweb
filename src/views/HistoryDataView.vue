<template>
  <div class="header">
    <h1>{{ gatewayName }}</h1>
    <div class="toolbar">
      <button @click="handleManualRefresh" class="refresh-button">立即刷新</button>
      <label class="auto-refresh">
        <input type="checkbox" v-model="autoRefresh" :disabled="!isDataLoaded" />
        自动刷新（150S）
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
  <div class="toolbar time-range">
    <label>选择时间范围：</label>
    <input type="time" v-model="startTime" @change="validateTimeRange" />
    <span>至</span>
    <input type="time" v-model="endTime" @change="validateTimeRange" />
  </div>
  <div v-if="!isDataLoaded" class="loading-container">
    <p>未获取数据，请点击“立即刷新”按钮获取数据。</p>
  </div>
  <div v-else-if="processedChartData.length === 0" class="no-data-container">
    <p>无数据，请调整时间范围或刷新数据。</p>
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
          <tr v-for="(item, index) in paginatedTableData" :key="index">
            <td>{{ formatTime(item.time) }}</td>
            <td>{{ parseFloat(item.value.toFixed(2)) }}</td> <!-- 保留两位小数 -->
          </tr>
        </tbody>
      </table>
      <div class="pagination">
        <button @click="goToFirstPage" :disabled="currentPage === 1">首页</button> <!-- 修改为首页 -->
        <button @click="goToPreviousPage" :disabled="currentPage === 1">上一页</button>
        <span>第 {{ currentPage }} 页 / 共 {{ totalPages }} 页</span>
        <button @click="goToNextPage" :disabled="currentPage === totalPages">下一页</button>
        <button @click="goToLastPage" :disabled="currentPage === totalPages">末页</button> <!-- 修改为末页 -->
      </div>
    </div>
  </div>
  <div v-if="isLoading" class="loading-overlay">
    <div class="spinner"></div>
    <p>加载中，请稍候...</p>
  </div>
  <div class="footer">
    <p>统计规则：</p>
    <ol>
      <li>选择全部日期时：折线图前三天数据显示每半小时的平均值，表格显示所有完整数据。</li>
      <li>选择准确日期时：</li>
      <li>1、时间精度选择大于8小时时，折线图前三天数据显示每五分钟的平均值，表格显示当日完整数据</li>
      <li>2、时间精度选择大于30分钟且小于等于8小时，折线图显示每分钟平均值，表格当日完整数据</li>
      <li>3、时间精度选择小于等于30分钟时，折线图显示完整数据，表格当日完整数据</li>
    </ol>
    <p>数据存储方式：</p>
    <ul>
      <li>前三天内数据全部保存；七天前的数据将被删除</li>
      <li>每天0:00，将三天之后的数据取半小时平均值</li>
    </ul>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch, onUnmounted,nextTick } from 'vue';
import { useRoute } from 'vue-router';
import { useAuthStore } from '../stores/auth';
import axios from 'axios';
import * as echarts from 'echarts';

const route = useRoute();
const authStore = useAuthStore();
const chartEl = ref(null);
let chartInstance = null;

// 响应式数据
const gatewayName = ref('');
const autoRefresh = ref(false);
const refreshInterval = 150000; // 150秒
let autoRefreshTimer = null;
const selectedKey = ref(null);
const isDataLoaded = ref(false);
const currentPage = ref(1);
const itemsPerPage = 5; // 修改每页显示数据行数
const rawData = ref([]);
const selectedDate = ref('全部');
const startTime = ref('00:00');
const endTime = ref('23:59');
const dateOptions = ref([]);
const isLoading = ref(false);

// 获取北京时间
const getBeijingDate = (date = new Date()) => {
  try {
    const d = date instanceof Date ? date : new Date(date);
    return new Date(d.getTime() + 8 * 60 * 60 * 1000); // 确保始终返回Date对象
  } catch (e) {
    console.error('Invalid date input:', date);
    return new Date(); // 返回当前时间作为fallback
  }
};

// 初始化日期选项
const initDateOptions = () => {
  const today = getBeijingDate();
  dateOptions.value = ['全部', ...Array.from({ length: 8 }, (_, i) => {
    const date = new Date(today);
    date.setUTCDate(date.getUTCDate() - i);
    return date.toISOString().split('T')[0];
  })];
};

// 获取网关别名
const fetchGatewayAlias = async () => {
  isLoading.value = true;
  try {
    const mac = route.params.mac;
    const res = await axios.get('/api/iot/devices', { 
      params: { userId: authStore.userId } 
    });
    
    if (res.data && res.data[mac]) {
      const device = res.data[mac];
      gatewayName.value = device.mac_alias || mac;
      rawData.value = device.keys.map(key => ({
        key: key.mac_key,
        key_alias: key.key_alias || key.mac_key,
        values: []
      }));
      
      // 默认选择第一个设备
      if (rawData.value.length > 0) {
        selectedKey.value = rawData.value[0].key;
      }
    }
  } catch (error) {
    console.error('获取网关信息失败:', error);
    gatewayName.value = route.params.mac;
  } finally {
    isLoading.value = false;
  }
};

// 修改后的数据处理方法
const handleManualRefresh = async () => {
  isLoading.value = true;
  try {
    const res = await axios.post('/api/iot/get_mac_data', { 
      mac_address: route.params.mac 
    });

    rawData.value = Object.entries(res.data.data).map(([key, values]) => ({
      key,
      key_alias: rawData.value.find(item => item.key === key)?.key_alias || key,
      values: values
        .map(data => ({
          value: parseFloat(data.value) || 0,
          time: new Date(data.time).getTime() // 确保转换为时间戳
        }))
        .filter(item => !isNaN(item.time)) // 过滤无效时间
        .sort((a, b) => a.time - b.time)
    }));

    // 自动选择第一个设备
    if (rawData.value.length > 0 && !selectedKey.value) {
      selectedKey.value = rawData.value[0].key;
    }

    isDataLoaded.value = true;
    
    // 强制图表更新
    await nextTick();
    if (chartInstance) chartInstance.dispose();
    initChart();

  } catch (error) {
    console.error('刷新失败:', error);
    alert(`数据获取失败: ${error.message}`);
  } finally {
    isLoading.value = false;
  }
};

// 数据分组逻辑
const groupData = (data, interval) => {
  const groups = new Map();
  data.forEach(item => {
    const groupKey = Math.floor(item.time / interval) * interval + interval/2;
    if (!groups.has(groupKey)) groups.set(groupKey, []);
    groups.get(groupKey).push(item.value);
  });
  return Array.from(groups.entries()).map(([time, values]) => ({
    time,
    value: values.reduce((a, b) => a + b, 0) / values.length
  }));
};

// 修复后的图表数据计算
const processedChartData = computed(() => {
  if (!selectedKey.value) return [];
  const keyData = rawData.value.find(item => item.key === selectedKey.value);
  if (!keyData?.values) return [];

  // 添加数据有效性检查
  const validValues = keyData.values.filter(item => 
    item.time && !isNaN(new Date(item.time).getTime())
  );

  const now = getBeijingDate();
  const threeDaysAgo = new Date(now);
  threeDaysAgo.setUTCDate(threeDaysAgo.getUTCDate() - 3);
  threeDaysAgo.setUTCHours(0, 0, 0, 0);

  // 修复后的时间范围计算
  const getRange = () => {
    if (selectedDate.value === '全部') return {
      start: threeDaysAgo.getTime(),
      end: now.getTime()
    };
    
    try {
      const start = new Date(`${selectedDate.value}T${startTime.value}:00+08:00`);
      const end = new Date(`${selectedDate.value}T${endTime.value}:59+08:00`);
      return { 
        start: start.getTime(), 
        end: end.getTime(),
        minutes: (end - start) / 60000 
      };
    } catch (e) {
      console.error('Invalid date range:', e);
      return { start: 0, end: 0, minutes: 0 };
    }
  };

  // 修复后的数据过滤
  const { start, end, minutes } = getRange();
  const filteredData = validValues.filter(item => {
    const itemTime = new Date(item.time).getTime();
    return selectedDate.value === '全部' ? 
      itemTime >= threeDaysAgo.getTime() :
      itemTime >= start && itemTime <= end;
  });

  // 分组逻辑增加容错
  const safeGroupData = (data, interval) => {
    try {
      return groupData(data, interval);
    } catch (e) {
      console.error('Data grouping failed:', e);
      return [];
    }
  };

  // 新增逻辑：显示三天外的原始数据
  if (selectedDate.value === '全部') {
    const groupedData = safeGroupData(
      filteredData.filter(item => item.time >= threeDaysAgo.getTime()),
      30 * 60 * 1000
    ).map(d => [d.time, parseFloat(d.value.toFixed(2))]); // 保留两位小数

    const rawDataOutsideThreeDays = validValues
      .filter(item => item.time < threeDaysAgo.getTime())
      .map(d => [d.time, parseFloat(d.value.toFixed(2))]); // 保留两位小数

    return [...rawDataOutsideThreeDays, ...groupedData];
  }

  if (minutes > 480) {
    return safeGroupData(filteredData, 5 * 60 * 1000).map(d => [d.time, parseFloat(d.value.toFixed(2))]); // 保留两位小数
  }
  if (minutes > 30) {
    return safeGroupData(filteredData, 60 * 1000).map(d => [d.time, parseFloat(d.value.toFixed(2))]); // 保留两位小数
  }
  return filteredData.map(d => [d.time, parseFloat(d.value.toFixed(2))]); // 保留两位小数
});

// 表格数据
const filteredTableDataByRange = computed(() => {
  if (!selectedKey.value) return [];
  const keyData = rawData.value.find(item => item.key === selectedKey.value);
  if (!keyData?.values) return [];

  // 统一应用时间范围过滤
  const { start, end } = getTimeRange();
  return keyData.values.filter(item => {
    const itemTime = new Date(item.time).getTime();
    return selectedDate.value === '全部' || (itemTime >= start && itemTime <= end); // 修复选择全部时展示所有数据
  }).map(item => ({
    ...item,
    value: parseFloat(item.value.toFixed(2)) // 保留两位小数
  }));
});

// 时间范围获取方法
const getTimeRange = () => {
  try {
    if (selectedDate.value === '全部') {
      // 当选择全部日期时，使用完整时间范围
      const start = new Date(`${dateOptions.value[1]}T00:00:00+08:00`).getTime(); // 最早日期
      const end = new Date().getTime() + 8 * 60 * 60 * 1000; // 当前北京时间
      const minutes = (end - start) / 60000;
      return { start, end, minutes };
    }
    
    const start = new Date(`${selectedDate.value}T${startTime.value}:00+08:00`);
    const end = new Date(`${selectedDate.value}T${endTime.value}:59+08:00`);
    return { 
      start: start.getTime(), 
      end: end.getTime(),
      minutes: (end - start) / 60000 
    };
  } catch (e) {
    console.error('时间范围解析错误:', e);
    return { start: 0, end: 0, minutes: 0 };
  }
};


// 分页逻辑
const paginatedTableData = computed(() => {
  const start = (currentPage.value - 1) * itemsPerPage;
  return filteredTableDataByRange.value.slice(start, start + itemsPerPage);
});

const totalPages = computed(() => 
  Math.ceil(filteredTableDataByRange.value.length / itemsPerPage)
);

// 图表操作
const initChart = () => {
  if (!chartEl.value) return;
  chartInstance = echarts.init(chartEl.value);
  updateChart();
};

// 优化后的图表更新逻辑
const updateChart = () => {
  if (!chartInstance || !selectedKey.value) return;
  
  // 销毁旧图表实例
  chartInstance.dispose();

  // 等待DOM更新
  nextTick(() => {
    chartInstance = echarts.init(chartEl.value);

    const option = {
      tooltip: {
        trigger: 'axis',
        formatter: params => {
          const date = getBeijingDate(params[0].data[0]);
          return `${date.getUTCFullYear()}-${(date.getUTCMonth()+1).toString().padStart(2,'0')}-${date.getUTCDate().toString().padStart(2,'0')} 
                  ${date.getUTCHours().toString().padStart(2,'0')}:${date.getUTCMinutes().toString().padStart(2,'0')}
                  <br/>${params[0].marker}${params[0].seriesName}: ${params[0].data[1]}`;
        }
      },
      xAxis: { type: 'time', boundaryGap: false },
      yAxis: { type: 'value' },
      series: [{
        name: rawData.value.find(item => item.key === selectedKey.value)?.key_alias || selectedKey.value,
        type: 'line',
        data: processedChartData.value,
        showSymbol: true, // 显示数据点
        symbol: 'circle', // 数据点样式
        symbolSize: 6, // 数据点大小
        lineStyle: {
          width: 2 // 优化折线宽度
        },
        itemStyle: {
          color: '#409eff' // 数据点颜色
        }
      }]
    };
    chartInstance.setOption(option);
  });
};

// 修复后的时间格式化
const formatTime = timestamp => {
  try {
    const date = getBeijingDate(timestamp);
    return `${date.getUTCFullYear()}-${(date.getUTCMonth()+1).toString().padStart(2,'0')}-${date.getUTCDate().toString().padStart(2,'0')} 
            ${date.getUTCHours().toString().padStart(2,'0')}:${date.getUTCMinutes().toString().padStart(2,'0')}:${date.getUTCSeconds().toString().padStart(2,'0')}`;
  } catch (e) {
    console.error('Invalid timestamp:', timestamp);
    return 'Invalid Time';
  }
};

// 分页方法
const goToFirstPage = () => currentPage.value = 1;
const goToPreviousPage = () => currentPage.value = Math.max(1, currentPage.value - 1);
const goToNextPage = () => currentPage.value = Math.min(totalPages.value, currentPage.value + 1);
const goToLastPage = () => currentPage.value = totalPages.value;

// 优化后的时间范围验证
const validateTimeRange = () => {
  const [startH, startM] = startTime.value.split(':').map(Number);
  const [endH, endM] = endTime.value.split(':').map(Number);
  
  // 处理跨天时间
  if (endH * 60 + endM <= startH * 60 + startM) {
    alert('结束时间必须晚于开始时间');
    endTime.value = '23:59';
  }
  updateChart(); // 立即刷新图表
};

// 生命周期
onMounted(() => {
  initDateOptions();
  fetchGatewayAlias();
  window.addEventListener('resize', () => chartInstance?.resize());
});

onUnmounted(() => {
  clearInterval(autoRefreshTimer);
  window.removeEventListener('resize', () => chartInstance?.resize());
});

// 新增设备选择监听
watch(selectedKey, (newVal) => {
  if (newVal) {

    
    // 等待DOM更新后刷新图表
    nextTick(() => {
      if (chartInstance) {
        chartInstance.dispose();
      }
      initChart();
    });
  }
});

// 优化watch监听
let refreshTimer = null;
watch([selectedDate, startTime, endTime], () => {
  clearTimeout(refreshTimer);
  refreshTimer = setTimeout(() => {
    // 强制重置分页
    currentPage.value = 1;
    // 双重验证数据有效性
    if (chartEl.value && chartEl.value.offsetHeight > 0) {
      updateChart();
    }
  }, 200); // 缩短防抖时间到200ms
});

// 自动刷新逻辑
watch(autoRefresh, (newVal) => {
  clearInterval(autoRefreshTimer);
  if (newVal) {
    autoRefreshTimer = setInterval(() => {
      if (isDataLoaded.value) {
        handleManualRefresh();
      }
    }, refreshInterval);
  }
});

document.title = '历史数据'; // 设置页面标题

</script>

<style scoped>
.header { padding: 1rem; text-align: center; }
.toolbar { 
  display: flex; 
  gap: 1rem; 
  padding: 1rem; 
  flex-wrap: wrap;
  align-items: center;
}
.refresh-button { 
  background: #409eff; 
  color: white; 
  border: none; 
  padding: 8px 15px; 
  border-radius: 4px; 
  cursor: pointer;
}
.auto-refresh { display: flex; align-items: center; gap: 5px; }
.key-select { padding: 5px; min-width: 200px; }
.time-range input[type="time"] {
  flex: 1;
  min-width: 100px;
}
.history-container { 
  display: grid; 
  grid-template-columns: 2fr 1fr; 
  gap: 2rem; 
  padding: 1rem;
}
.chart { height: 400px; }
.data-table { overflow-x: auto; }
table { 
  width: 100%; 
  border-collapse: collapse; 
  margin-top: 1rem;
}
th, td { 
  padding: 10px; 
  border: 1px solid #ebeef5; 
  text-align: left;
}
th { background: #f5f7fa; }
.pagination { 
  display: flex; 
  gap: 10px; 
  margin-top: 1rem;
  justify-content: center;
  align-items: center;
}
.pagination button { 
  padding: 5px 10px; 
  background: #409eff; 
  color: white; 
  border: none; 
  border-radius: 3px;
}
.pagination button:disabled { background: #c0c4cc; }
.loading-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(255,255,255,0.8);
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  z-index: 999;
}
.spinner {
  width: 40px;
  height: 40px;
  border: 4px solid #f3f3f3;
  border-top: 4px solid #409eff;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

/* 新增时间选择器样式 */
input[type="time"] {
  padding: 6px;
  border: 1px solid #dcdfe6;
  border-radius: 4px;
  transition: border-color 0.3s;
}
input[type="time"]:hover {
  border-color: #c0c4cc;
}
input[type="time"]:focus {
  border-color: #409eff;
  outline: none;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

@media (max-width: 768px) {
  .history-container { grid-template-columns: 1fr; }
  .toolbar { flex-direction: column; }
  .key-select, input[type="time"] { width: 100%; }
}
.no-data-container {
  text-align: center;
  padding: 2rem;
  color: #909399;
  font-size: 1.2rem;
}
</style>