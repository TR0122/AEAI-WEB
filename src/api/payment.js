import request from './request';

/**
 * 创建支付订单
 * @param {Object} params
 * @param {number} params.userId - 用户ID
 * @param {number} params.amount - 支付金额
 * @param {string} params.orderType - 订单类型，'POINTS'或'PACKAGE'
 * @param {number} params.value - 购买的积分数量或软件包ID
 * @param {string} params.paymentType - 支付方式，默认为 'ALIPAY'
 * @returns {Promise}
 */
export const createPaymentOrder = (params) => {
  return request({
    url: '/api/payment/create',
    method: 'POST',
    data: {
      userId: params.userId,
      orderType: params.orderType || 'POINTS', // 默认为积分订单
      amount: params.amount,
      value: params.value, // 积分数量或软件包ID
      paymentType: params.paymentType || 'ALIPAY'
    }
  });
};

/**
 * 查询支付结果
 * @param {string} orderId - 订单号
 * @returns {Promise}
 */
export const queryPaymentResult = (orderId) => {
  return request({
    url: '/api/payment/status',
    method: 'GET',
    params: { orderId }
  });
};

// 为了向后兼容，保留旧的函数名
export const createAlipayOrder = createPaymentOrder; 