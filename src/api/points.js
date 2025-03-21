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