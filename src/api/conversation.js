import request from './request';

/**
 * 获取对话列表
 * @param {Object} params - 请求参数
 * @param {number} params.usersId - 用户ID
 * @param {number} [params.page=1] - 页码
 * @param {number} [params.size=10] - 每页条数
 * @returns {Promise}
 */
export const getConversationList = async (params) => {
  try {
    const response = await request.get('/api/conversations/list', { params });
    return response;
  } catch (error) {
    throw error;
  }
};

/**
 * 新建对话
 * @param {number} userId - 用户ID
 * @returns {Promise}
 */
export const createConversation = async (userId) => {
  try {
    const response = await request.post('/api/conversations/create', {
      userId
    });
    return response;
  } catch (error) {
    throw error;
  }
};

/**
 * 获取对话内容
 * @param {Object} params - 请求参数
 * @param {number} params.conversationId - 对话ID
 * @param {number} params.usersId - 用户ID
 * @returns {Promise}
 */
export const getConversationMessages = async (params) => {
  try {
    const response = await request.get('/api/conversations/messages', { params });
    return response;
  } catch (error) {
    throw error;
  }
}; 