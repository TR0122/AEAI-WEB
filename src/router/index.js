import { createRouter, createWebHistory } from 'vue-router'
import Chat from '../components/Chat.vue'
import LoginRegister from '../components/LoginRegister.vue'

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
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

export default router