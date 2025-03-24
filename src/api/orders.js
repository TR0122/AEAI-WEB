import request from './request';

/**
 * 获取用户订单列表
 * @param {Object} params
 * @param {number} params.userId - 用户ID
 * @param {string} params.orderType - 订单类型，可选 'PACKAGE'
 * @param {number} params.page - 页码
 * @param {number} params.size - 每页数量
 * @returns {Promise}
 */
export const getUserOrders = (params) => {
  return request({
    url: '/api/orders/list',
    method: 'GET',
    params
  });
};

/**
 * 获取订单详情
 * @param {string} orderId - 订单ID
 * @returns {Promise}
 */
export const getOrderDetail = (orderId) => {
  return request({
    url: '/api/orders/detail',
    method: 'GET',
    params: { orderId }
  });
};

/**
 * 获取软件包下载链接
 * @param {Object} params
 * @param {string} params.orderId - 订单ID
 * @param {number} params.packageId - 软件包ID
 * @returns {Promise}
 */
export const getPackageDownloadLink = (params) => {
  return request({
    url: '/api/packages/download',
    method: 'GET',
    params
  });
}; 