// 封装 axios 请求
import axios from 'axios';
import { API_BASE_URL, TIMEOUT, DEFAULT_HEADERS } from './config';

// 创建 axios 实例
const instance = axios.create({
  baseURL: API_BASE_URL,
  timeout: TIMEOUT,
  headers: DEFAULT_HEADERS
});

// 请求拦截器
instance.interceptors.request.use(
  config => {
    // 从 localStorage 获取 token
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  error => {
    return Promise.reject(error);
  }
);

// 响应拦截器
instance.interceptors.response.use(
  response => {
    const { data } = response;
    // 如果返回的 code 不是 200，也当作错误处理
    if (data.code !== 200) {
      return Promise.reject(data);
    }
    return data;
  },
  error => {
    // 如果是 401 未授权，清除 token 并跳转到登录页
    if (error.response && error.response.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('userInfo');
      window.location.href = '/login';
      return Promise.reject({
        code: 401,
        msg: '登录已过期，请重新登录'
      });
    }
    
    // 统一处理错误
    if (error.response) {
      const { status, data } = error.response;
      return Promise.reject({
        code: status,
        msg: data.msg || '请求失败',
        data: data.data
      });
    }
    return Promise.reject({
      code: 500,
      msg: '网络错误',
      data: null
    });
  }
);

export default instance; 