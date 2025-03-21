import { API_BASE_URL } from './config';

/**
 * 发送聊天消息（流式响应）
 * @param {Object} params - 请求参数
 * @param {number} params.userId - 用户ID
 * @param {number} params.conversationId - 会话ID
 * @param {string} params.question - 问题内容
 * @param {string} params.messageType - 消息类型：text/image/file/code
 * @param {Function} onMessage - 接收消息的回调函数
 * @returns {Promise}
 */
export const sendChatMessage = async (params) => {
  try {
    console.log('发送聊天消息:', params);
    
    const response = await fetch(`${API_BASE_URL}/api/chat/stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'text/event-stream',
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      },
      body: JSON.stringify({
        userId: params.userId,
        conversationId: params.conversationId,
        question: params.question,
        messageType: params.messageType
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    // 使用原生的 EventSource 处理 SSE
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    const processChunk = async () => {
      try {
        const { value, done } = await reader.read();
        if (done) {
          console.log('Stream completed');
          params.onMessage('[DONE]');
          return;
        }

        const chunk = decoder.decode(value, { stream: true });
        console.log('收到数据块:', chunk);
        
        // 处理数据块
        if (chunk.includes('data:')) {
          // 提取所有 data: 行
          const dataLines = chunk.match(/data:(.*?)(?=\n|$)/g);
          if (dataLines) {
            for (const line of dataLines) {
              const dataContent = line.replace('data:', '').trim();
              
            
              try {
                const data = JSON.parse(dataContent);
                
                // 提取 delta.content
                if (data.choices?.[0]?.delta?.content !== undefined) {
                  const content = data.choices[0].delta.content;
                  console.log('提取的内容:', content);
                  params.onMessage(content);
                }
              } catch (error) {
                console.error('解析 JSON 失败:', error);
              }

              if (dataContent === '[DONE]') {
                console.log('收到 [DONE] 标记');
                params.onMessage('[DONE]');
                continue;
              }
              
            }
          }
        }
        
        // 继续处理下一个数据块
        processChunk();
      } catch (error) {
        console.error('处理数据块失败:', error);
        throw error;
      }
    };

    // 开始处理数据流
    processChunk();

    return {
      close: () => {
        console.log('关闭流');
        reader.cancel();
      }
    };
  } catch (error) {
    console.error('Stream request failed:', error);
    throw error;
  }
};