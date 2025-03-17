import { ref, computed } from 'vue'
import { defineStore } from 'pinia'

//名为 counter 的Pinia状态管理存储（store），用于管理一个简单的计数器功能。
export const useCounterStore = defineStore('counter', () => {
  const count = ref(0)                                                  //创建响应式引用 count，初始值为 0。这个引用用于存储计数器的当前值。
  const doubleCount = computed(() => count.value * 2)                   //属性 doubleCount，值是 count 两倍。响应式：当count改变时，doubleCount自动更新。
  function increment() {                                                //动作定义函数increment，用于将count值增加。函数可被外部调用，以更新计数器的值
    count.value++
  }
                                                                        //返回一个对象，包含存储的公共接口。包含了count、doubleCount和increment，
  return { count, doubleCount, increment }                              //可以在组件中通过调用useCounterStore函数来访问和使用。
})
