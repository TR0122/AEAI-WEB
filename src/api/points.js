import request from './request';

/**
 * 获取积分规则列表
 * @param {Object} params - 请求参数
 * @param {number} params.page - 页码，从1开始
 * @param {number} params.size - 每页记录数
 * @returns {Promise}
 */
export const getPointsRules = (params) => {
  return request({
    url: '/api/points/rules',
    method: 'GET',
    params
  });
};

/**
 * 获取用户积分信息
 * @param {number} userId - 用户ID
 * @returns {Promise}
 */
export const getUserPoints = (userId) => {
  return request({
    url: '/api/points/info',
    method: 'GET',
    params: { userId }
  });
};

/**
 * 获取积分充值套餐
 * @returns {Promise}
 */
export const getPointsPackages = () => {
  return request({
    url: '/api/points/packages',
    method: 'GET'
  });
};

/**
 * 使用积分
 * @param {Object} params
 * @param {number} params.userId - 用户ID
 * @param {number} params.points - 使用的积分数量
 * @param {string} params.usage - 使用场景
 * @returns {Promise}
 */
export const usePoints = (params) => {
  return request({
    url: '/api/points/use',
    method: 'POST',
    data: params
  });
}; 