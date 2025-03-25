<template>
  <div class="container">
    <!-- 连接配置区域 -->
    <div class="config-section">
      <h2>MQTT 连接配置</h2>
      <div class="input-group">
        <input v-model="brokerUrl" placeholder="mqtt://broker.url:port" />
        <input v-model="username" placeholder="用户名" />
        <input v-model="password" type="password" placeholder="密码" />
        <button @click="toggleConnection">
          {{ isConnected ? '断开连接' : '连接' }}
        </button>
      </div>
    </div>

    <!-- 订阅和发布区域 -->
    <div class="operation-section">
      <div class="subscription">
        <h3>订阅主题</h3>
        <div class="input-group">
          <input v-model="subTopic" placeholder="输入订阅主题" />
          <button @click="subscribeTopic" :disabled="!isConnected">订阅</button>
        </div>
      </div>

      <div class="publish">
        <h3>发布消息</h3>
        <div class="input-group">
          <input v-model="pubTopic" placeholder="输入发布主题" />
          <input v-model="pubMessage" placeholder="输入消息内容" />
          <button @click="publishMessage" :disabled="!isConnected">发布</button>
        </div>
      </div>
    </div>

    <!-- 消息展示区域 -->
    <div class="message-section">
      <h3>接收到的消息（主题: {{ currentTopic }}）</h3>
      <div class="message-list">
        <div v-for="(msg, index) in messages" :key="index" class="message-item">
          <span class="timestamp">{{ msg.timestamp }}</span>
          <span class="topic">[{{ msg.topic }}]</span>
          <span class="content">{{ msg.message }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive } from 'vue'
import mqtt from 'mqtt'

const brokerUrl = ref('ws://your-broker:8083/mqtt')
const username = ref('')
const password = ref('')
const subTopic = ref('')
const pubTopic = ref('')
const pubMessage = ref('')
const isConnected = ref(false)
const currentTopic = ref('')
const messages = reactive([])

let client = null

const toggleConnection = () => {
  if (!isConnected.value) {
    if (!brokerUrl.value) {
      alert('请输入服务器地址')
      return
    }
    connectToBroker()
  } else {
    disconnectFromBroker()
  }
}

const connectToBroker = () => {
  const options = {
    clean: true,
    connectTimeout: 4000,
    username: username.value,
    password: password.value,
  }

  client = mqtt.connect(brokerUrl.value, options)

  client.on('connect', () => {
    isConnected.value = true
    console.log('认证连接成功')
  })

  client.on('message', (topic, message) => {
    messages.push({
      timestamp: new Date().toLocaleTimeString(),
      topic,
      message: message.toString()
    })
  })

  client.on('error', (err) => {
    console.error('认证失败:', err)
    alert(`连接错误: ${err.message}`)
    disconnectFromBroker()
  })
}

const disconnectFromBroker = () => {
  if (client) {
    client.end()
    isConnected.value = false
    currentTopic.value = ''
    messages.splice(0, messages.length)
  }
}


// 订阅主题
const subscribeTopic = () => {
  if (subTopic.value && client) {
    client.subscribe(subTopic.value, (err) => {
      if (!err) {
        currentTopic.value = subTopic.value
        subTopic.value = ''
      }
    })
  }
}

// 发布消息
const publishMessage = () => {
  if (pubTopic.value && pubMessage.value && client) {
    client.publish(pubTopic.value, pubMessage.value)
    pubMessage.value = ''
  }
}
</script>

<style scoped>
/* 样式优化 */
.input-group {
display: grid;
grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
gap: 10px;
}

button {
background-color: #2196F3;
}

button:disabled {
background-color: #9E9E9E;
}

.container {
  max-width: 800px;
  margin: 0 auto;
  padding: 20px;
}


.input-group input {
  flex: 1;
  padding: 8px;
}

button {
  padding: 8px 16px;
  background-color: #4CAF50;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.message-section {
  margin-top: 20px;
}

.message-list {
  border: 1px solid #ddd;
  padding: 10px;
  max-height: 400px;
  overflow-y: auto;
}

.message-item {
  padding: 8px;
  border-bottom: 1px solid #eee;
  display: flex;
  gap: 15px;
}

.timestamp {
  color: #666;
  min-width: 70px;
}

.topic {
  color: #2196F3;
  min-width: 120px;
}
</style>