import { createApp } from 'vue'
import { createRouter, createWebHistory } from 'vue-router'
import './style.css'
import App from './App.vue'
import router from './router'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'

// 引入FontAwesome
import '@fortawesome/fontawesome-free/css/all.css'

const app = createApp(App)
app.use(ElementPlus)
app.use(router)
app.mount('#app')
