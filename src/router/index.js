import { createRouter, createWebHistory } from 'vue-router'
import Chat from '../components/Chat.vue'
import LoginRegister from '../components/LoginRegister.vue'
import PackagePurchase from '../components/PackagePurchase.vue'
import PackageLoginRegister from '../components/PackageLoginRegister.vue'

const routes = [
  {
    path: '/',
    redirect: '/login'
  },
  {
    path: '/chat',
    name: 'Chat',
    component: Chat
  },
  {
    path: '/login',
    name: 'Login',
    component: LoginRegister
  },
  {
    path: '/packages',
    name: 'Packages',
    component: PackagePurchase
  },
  {
    path: '/package-login',
    name: 'PackageLogin',
    component: PackageLoginRegister
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

export default router