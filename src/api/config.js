// API 配置文件
export const API_BASE_URL = 'http://192.168.31.61:8081';

// 请求超时时间
export const TIMEOUT = 10000;

// 响应状态码
export const STATUS_CODES = {
  SUCCESS: 200,
  BAD_REQUEST: 400,
  TOO_MANY_REQUESTS: 429,
  SERVER_ERROR: 500
};

// 默认请求头
export const DEFAULT_HEADERS = {
  'Content-Type': 'application/json'
};