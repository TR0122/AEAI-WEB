import request from './request';

/**
 * 创建支付订单
 * @param {Object} params
 * @param {number} params.userId - 用户ID
 * @param {number} params.amount - 支付金额
 * @param {number} params.points - 购买的积分数量
 * @param {string} params.paymentType - 支付方式，默认为 'ALIPAY'
 * @returns {Promise}
 */
export const createPaymentOrder = (params) => {
  return request({
    url: '/api/payment/create',
    method: 'POST',
    data: {
      userId: params.userId,
      orderType: 'POINTS',
      amount: params.amount,
      value: params.points,
      paymentType: params.paymentType || 'ALIPAY',
      returnUrl: window.location.origin + '/payment/return',
      notifyUrl: window.location.origin + '/api/payment/notify/alipay'
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