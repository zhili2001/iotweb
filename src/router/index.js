import { createRouter, createWebHistory } from 'vue-router';
import { useAuthStore } from '../stores/auth';

const routes = [
  { path: '/', redirect: '/monitor' },
  { path: '/test', name: 'Test', component: () => import('../views/test.vue') }, // 确保 name 和 component 路径正确
  { path: '/login', name: 'Login', component: () => import('../views/LoginView.vue') },
  { path: '/register', name: 'Register', component: () => import('../views/RegisterView.vue') },
  { path: '/set', name: 'set', component: () => import('../views/IoTPlatform.vue'), meta: { requiresAuth: true } },
  { path: '/home', name: 'Home', component: () => import('../views/iothome.vue'), meta: { requiresAuth: true } },
  { path: '/monitor', name: 'DataMonitor', component: () => import('../views/DataMonitor.vue'), meta: { requiresAuth: true } },
  { path: '/control', name: 'DeviceControl', component: () => import('../views/DeviceControl.vue'), meta: { requiresAuth: true } },
  { path: '/automation', name: 'Automation', component: () => import('../views/AutomationView.vue'), meta: { requiresAuth: true } },
  {
    path: '/history/:mac',
    name: 'HistoryData',
    component: () => import('../views/HistoryDataView.vue'),
    meta: { requiresAuth: true }
  }
];

//Vue Router的配置部分，用于创建一个路由器实例
const router = createRouter({
  //history: createWebHistory(),            //指定路由器使用HTML5的History API来管理URL，这种模式使用URL的路径部分，而不需要#符号，使URL看起来更干净。
  history: createWebHistory('/iot/'),    // [!code ++]
  routes                                  //数组，包含了应用中所有路由的配置。每个路由配置通常包含path（路径）、component（组件）等属性
});

/* Router的全局前置守卫,用于在路由跳转发生之前执行一些逻辑。
具体来说，这段代码实现了一个简单的认证检查，确保用户在访问需要认证的路由时已经登录。
全局前置守卫钩子函数。它在每次路由跳转前被调用。
to 参数代表目标路由对象。
from 参数代表当前导航正要离开的路由。
next 是一个回调函数，用于决定导航的下一步操作。*/
router.beforeEach(async (to, from, next) => {
  const authStore = useAuthStore();
  
  if (to.meta.requiresAuth && !authStore.isAuthenticated) {
    next('/login')
  } else {
    next()
  }
});

export default router;