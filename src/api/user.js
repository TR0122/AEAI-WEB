// 用户相关的 API
import request from './request';

// 获取设备信息
const getDeviceInfo = () => {
  return {
    deviceInfo: navigator.userAgent,
    language: navigator.language,
    appVersion: '1.0.0',
    region: 'CN',
    ip_address: '' // IP 地址可以通过其他方式获取
  };
};

/**
 * 发送验证码
 * @param {string} phoneNumber - 手机号
 * @returns {Promise} 
 */
export const sendVerificationCode = async (phoneNumber) => {
  try {
    const params = {
      phoneNumber,
      ...getDeviceInfo()
    };
    
    const response = await request.post('/api/users/send-code', params);
    return response;
  } catch (error) {
    throw error;
  }
};

/**
 * 登录/注册
 * @param {string} phoneNumber - 手机号
 * @param {string} verificationCode - 验证码
 * @returns {Promise}
 */
export const loginRegister = async (phoneNumber, verificationCode) => {
  try {
    const params = {
      phoneNumber,
      verificationCode
    };
    
    const response = await request.post('/api/users/login-register', params);
    return response;
  } catch (error) {
    throw error;
  }
};

/**
 * 获取用户信息
 * @param {number} userId - 用户ID
 * @returns {Promise}
 */
export const getUserInfo = (userId) => {
  return request({
    url: '/api/users/info',
    method: 'GET',
    params: { userId }
  });
}; 