<script setup>
import { ref, onMounted, computed, nextTick } from 'vue';
import { marked } from 'marked';
import Prism from 'prismjs';
// 导入主题
import 'prismjs/themes/prism-tomorrow.css';
// 导入常用的语言支持
import 'prismjs/components/prism-javascript';
import 'prismjs/components/prism-typescript';
import 'prismjs/components/prism-jsx';
import 'prismjs/components/prism-bash';
import 'prismjs/components/prism-python';
import 'prismjs/components/prism-java';
import 'prismjs/components/prism-json';
import 'prismjs/components/prism-markdown';
import SettingsModal from './SettingsModal.vue';
import { getConversationList, createConversation, getConversationMessages } from '../api/conversation';
import { ElMessage, ElImage } from 'element-plus';
import { sendChatMessage } from '../api/chat';

// 修改 marked 配置
marked.setOptions({
  highlight: function(code, lang) {
    if (lang && Prism.languages[lang]) {
      try {
        const highlightedCode = Prism.highlight(code, Prism.languages[lang], lang);
        // 使用 HTML 字符串模板
        return `
          <div class="code-block">
            <div class="code-header">
              <span class="code-lang">${lang}</span>
              <button class="copy-btn" onclick="document.execCommand('copy')" onmousedown="event.preventDefault(); navigator.clipboard.writeText(\`${code.replace(/`/g, '\\`')}\`)">
                <i class="fas fa-copy"></i>
                复制代码
              </button>
            </div>
            <pre><code class="language-${lang}">${highlightedCode}</code></pre>
          </div>
        `;
      } catch (e) {
        console.error(e);
      }
    }
    return `<pre><code>${code}</code></pre>`;
  },
  langPrefix: 'language-',
  breaks: true,
  gfm: true
});

// 修改 renderMarkdown 函数
const renderMarkdown = (content) => {
  if (!content) return '';
  try {
    // 对于正在输入的内容，可以简单处理
    if (content.length < 100) {
      return content;
    }
    // 对于较长的内容，使用 marked 解析
    return marked.parse(content, { mangle: false, headerIds: false });
  } catch (e) {
    console.error('Markdown parsing error:', e);
    return content || '';
  }
};

// 是否显示设置弹出层
const showSettingsModal = ref(false);

// 切换设置弹出层
const toggleSettingsModal = () => {
  showSettingsModal.value = !showSettingsModal.value;
};

// 关闭设置弹出层
const closeSettingsModal = () => {
  showSettingsModal.value = false;
};

// 聊天历史记录
const chatHistory = ref([]);

// 当前输入的消息
const currentMessage = ref('');

// 对话列表状态
const chatList = ref([]);
const currentPage = ref(1);
const pageSize = ref(10);
const total = ref(0);
const loading = ref(false);

// 当前选中的会话
const selectedChat = ref(null);

// 选择会话
const selectChat = async (chat) => {
  try {
    selectedChat.value = chat;
    
    const userInfo = JSON.parse(localStorage.getItem('userInfo'));
    
    if (!userInfo?.id) {
      ElMessage({
        type: 'error',
        message: '未找到用户信息，请重新登录',
        duration: 3000
      });
      return;
    }

    // 获取对话内容
    const response = await getConversationMessages({
      conversationId: chat.id,
      usersId: userInfo.id
    });

    if (response.code === 200) {
      // 清空当前聊天记录
      chatHistory.value = [];
      
      // 处理返回的消息数据
      response.data.forEach(msg => {
        // 添加用户消息
        if (msg.question) {
          chatHistory.value.push({
            id: msg.id,
            role: 'user',
            content: msg.question,
            type: msg.messageType,
            imageUrl: msg.userFileUrl,
            fileUrl: msg.userFileUrl,
            createTime: msg.createdTime
          });
        }
        
        // 添加助手回复
        if (msg.result) {
          chatHistory.value.push({
            id: msg.id,
            role: 'assistant',
            content: msg.result,
            type: msg.messageType,
            imageUrl: msg.fileUrl,
            fileUrl: msg.fileUrl,
            createTime: msg.createdTime
          });
        }
      });

      // 滚动到底部
      nextTick(() => {
        scrollToBottom();
      });
    } else {
      throw new Error(response.msg || '获取对话内容失败');
    }
  } catch (error) {
    ElMessage({
      type: 'error',
      message: error.message || '获取对话内容失败',
      duration: 3000
    });
  }
};

// 处理键盘事件
const handleKeyDown = (event) => {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault();
    sendMessage();
  }
};

// 是否显示移动端侧边栏
const showMobileSidebar = ref(false);

// 是否为移动设备
const isMobile = ref(false);

// 切换移动端侧边栏
const toggleMobileSidebar = () => {
  showMobileSidebar.value = !showMobileSidebar.value;
};

// 关闭移动端侧边栏
const closeMobileSidebar = () => {
  showMobileSidebar.value = false;
};

// 用户信息
const userInfo = ref(null);

// 获取对话列表
const fetchConversations = async () => {
  try {
    loading.value = true;
    const userInfo = JSON.parse(localStorage.getItem('userInfo'));
    
    if (!userInfo?.id) {
      console.error('未找到用户ID');
      return;
    }

    const response = await getConversationList({
      usersId: userInfo.id,
      page: currentPage.value,
      size: pageSize.value
    });

    // 更新对话列表
    chatList.value = response.data.records.map(conv => ({
      id: conv.id,
      title: conv.title || '新对话',
      updateTime: conv.updatedAt, // 保存原始时间用于排序
      timeDisplay: formatTime(conv.updatedAt), // 格式化后的时间显示
      messageCount: conv.messageCount
    }));

    total.value = response.data.total;
  } catch (error) {
    console.error('获取对话列表失败:', error);
  } finally {
    loading.value = false;
  }
};

// 格式化时间显示
const formatTime = (dateString) => {
  if (!dateString) return '';
  
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) {
      return '';
    }

    const now = new Date();
    const diff = now - date;
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    // 今天
    if (days === 0) {
      return '今天';
    }
    
    // 昨天
    if (days === 1) {
      return '昨天';
    }
    
    // 前天
    if (days === 2) {
      return '前天';
    }
    
    // 7天内
    if (days < 7) {
      return `${days}天前`;
    }
    
    // 30天内
    if (days < 30) {
      return `${Math.floor(days / 7)}周前`;
    }
    
    // 更早
    if (days < 365) {
      return `${Math.floor(days / 30)}月前`;
    }
    
    return `${Math.floor(days / 365)}年前`;
  } catch (error) {
    console.error('Time formatting error:', error);
    return '';
  }
};

// 在组件挂载时获取对话列表和创建新对话
onMounted(async () => {
  try {
    // 获取并解析存储的用户信息
    const storedUserInfo = localStorage.getItem('userInfo');
    if (storedUserInfo) {
      userInfo.value = JSON.parse(storedUserInfo);
      
      // 先获取对话列表
      await fetchConversations();
      
      // 如果没有对话，创建一个新对话
      if (chatList.value.length === 0) {
        const response = await createConversation(userInfo.value.id);
        
        if (response.code === 200) {
          const newConversation = {
            id: response.data.conversation.id,
            title: response.data.conversation.title,
            date: formatTime(response.data.conversation.updatedAt),
            updateTime: response.data.conversation.updatedAt,
            messageCount: 0
          };
          
          chatList.value.unshift(newConversation);
          selectedChat.value = newConversation; // 自动选中新对话
        }
      } else {
        // 如果有对话，选中第一个并获取其对话记录
        selectedChat.value = chatList.value[0];
        await selectChat(chatList.value[0]); // 获取第一个对话的聊天记录
      }
    }
    
    // 初始化检查窗口大小
    checkWindowSize();
    
    // 监听窗口大小变化
    window.addEventListener('resize', checkWindowSize);
    
    // 获取 textarea 元素并初始化高度
    const textarea = document.querySelector('textarea');
    if (textarea) {
      autoResizeTextarea({ target: textarea });
    }
    scrollToBottom();
  } catch (error) {
    console.error('初始化失败:', error);
    ElMessage({
      type: 'error',
      message: '初始化失败，请刷新页面重试',
      duration: 3000
    });
  }
});

// 检查窗口大小
const checkWindowSize = () => {
  isMobile.value = window.innerWidth <= 768;
  if (window.innerWidth > 768) {
    showMobileSidebar.value = false;
  }
};
// 是否折叠侧边栏
const isSidebarCollapsed = ref(false);

// 搜索关键词
const searchKeyword = ref('');

// 智能体列表
const agentList = ref([
  { 
    id: 3, 
    name: '图片修改器', 
    icon: 'image',
    url: 'https://aistudio.google.com/prompts/new_chat'
  }
]);

// 修改为 null 或不设置初始值
const selectedAgent = ref(null);  // 改为 null，不默认选中任何智能体

// 切换侧边栏折叠状态
const toggleSidebar = () => {
  isSidebarCollapsed.value = !isSidebarCollapsed.value;
};

// 选择智能体
const selectAgent = (agent) => {
  if (agent.url) {
    // 显示自定义模态框
    webviewUrl.value = agent.url;
    showWebview.value = true;
    return;
  }
  
  selectedAgent.value = agent;
};

// 搜索对话
const searchChats = () => {
  // 实现搜索逻辑
};

// 滚动到底部的函数
const scrollToBottom = () => {
  const messagesContainer = document.querySelector('.messages-container');
  if (messagesContainer) {
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }
};

// 修改文件预览状态为数组
const filePreview = ref([]);

// 修改文件上传处理方法
const handleFileUpload = (event) => {
  const files = event.target.files;
  if (!files || files.length === 0) return;

  // 处理多个文件
  Array.from(files).forEach(file => {
    if (file.size > 10 * 1024 * 1024) {
      alert('文件大小不能超过10MB');
      return;
    }

    // 创建预览对象
    const preview = {
      id: Date.now() + Math.random(), // 添加唯一ID
      name: file.name,
      size: (file.size / 1024).toFixed(1) + 'KB',
      type: file.type,
      file: file
    };

    // 如果是图片，创建预览URL
    if (file.type.startsWith('image/')) {
      preview.previewUrl = URL.createObjectURL(file);
    }

    filePreview.value.push(preview);
  });

  event.target.value = '';
};

// 修改移除文件预览方法
const removeFilePreview = (index) => {
  const preview = filePreview.value[index];
  if (preview.previewUrl) {
    URL.revokeObjectURL(preview.previewUrl);
  }
  filePreview.value.splice(index, 1);
};

// 修改发送消息的方法
const sendMessage = async () => {
  if (!currentMessage.value.trim() && filePreview.value.length === 0) return;

  try {
    const userInfo = JSON.parse(localStorage.getItem('userInfo'));
    if (!userInfo?.id || !selectedChat?.value?.id) {
      ElMessage({
        type: 'error',
        message: '发送失败：未找到用户信息或对话ID',
        duration: 3000
      });
      return;
    }

    // 保存用户消息内容
    const question = currentMessage.value;

    // 添加用户消息到聊天记录
    chatHistory.value.push({
      id: Date.now(),
      role: 'user',
      content: question,
      type: 'text',
      createTime: new Date().toISOString()
    });

    // 清空输入框
    currentMessage.value = '';

    // 添加一个空的助手消息用于流式显示
    const assistantMessage = {
      id: Date.now() + 1,
      role: 'assistant',
      content: '',
      type: 'text',
      createTime: new Date().toISOString(),
      isLoading: true,
      isStreaming: true  // 添加流式显示标记
    };
    chatHistory.value.push(assistantMessage);

    // 滚动到底部
    await nextTick();
    scrollToBottom();

    // 发送消息并处理流式响应
    await sendChatMessage({
      userId: userInfo.id,
      conversationId: selectedChat.value.id,
      question: question,
      messageType: 'text',
      onMessage: (content) => {
        console.log('收到消息内容:', content);
        
        // 查找助手消息
        const index = chatHistory.value.findIndex(msg => msg.id === assistantMessage.id);
        if (index !== -1) {
          if (content === '[DONE]') {
            // 消息结束，关闭加载动画和流式显示
            console.log('消息接收完成，关闭加载动画');
            
            // 直接修改对象属性
            const updatedMessage = { ...chatHistory.value[index] };
            updatedMessage.isLoading = false;
            updatedMessage.isStreaming = false;
            
            // 替换整个对象
            chatHistory.value.splice(index, 1, updatedMessage);
          } else if (content !== undefined) {
            // 直接更新内容
            const updatedMessage = { ...chatHistory.value[index] };
            updatedMessage.content += content;
            updatedMessage.isLoading = false;
            
            // 替换整个对象
            chatHistory.value.splice(index, 1, updatedMessage);
            
            console.log('更新后的内容:', updatedMessage.content);
          }
          
          // 强制更新视图并滚动到底部
          nextTick(() => {
            scrollToBottom();
          });
        } else {
          console.warn('未找到对应的助手消息');
        }
      }
    });

  } catch (error) {
    console.error('发送消息失败:', error);
    ElMessage({
      type: 'error',
      message: error.message || '发送失败，请重试',
      duration: 3000
    });
    // 发送失败时移除助手的空消息
    const index = chatHistory.value.findIndex(msg => msg.id === assistantMessage.id);
    if (index !== -1) {
      chatHistory.value.splice(index, 1);
    }
  }
};

// 新建聊天
const startNewChat = async () => {
  try {
    // 检查当前是否已经是一个空的新对话
    if (selectedChat.value && 
        chatHistory.value.length === 0 && 
        selectedChat.value.messageCount === 0) {
      // 如果当前已经是空的新对话，直接返回
      ElMessage({
        type: 'info',
        message: '当前已经是新对话',
        duration: 2000
      });
      return;
    }

    const userInfo = JSON.parse(localStorage.getItem('userInfo'));
    
    if (!userInfo?.id) {
      ElMessage({
        type: 'error',
        message: '未找到用户信息，请重新登录',
        duration: 3000
      });
      return;
    }

    // 创建新对话
    const response = await createConversation(userInfo.id);
    
    if (response.code === 200) {
      // 清空当前聊天记录
      chatHistory.value = [];
      
      const newConversation = {
        id: response.data.conversation.id,
        title: response.data.conversation.title,
        date: formatTime(response.data.conversation.updatedAt),
        updateTime: response.data.conversation.updatedAt,
        messageCount: 0
      };
      
      chatList.value.unshift(newConversation);
      selectedChat.value = newConversation;
      
      ElMessage({
        type: 'success',
        message: '新对话创建成功',
        duration: 2000
      });
    }
  } catch (error) {
    ElMessage({
      type: 'error',
      message: error.msg || '创建对话失败',
      duration: 3000
    });
  }
};

// 修改 autoResizeTextarea 函数
const autoResizeTextarea = (event) => {
  const textarea = event.target;
  const wrapper = textarea.closest('.input-wrapper');
  const defaultHeight = 104;
  const maxHeight = 300;
  
  // 创建一个隐藏的div来计算实际高度
  const hiddenDiv = document.createElement('div');
  hiddenDiv.style.cssText = `
    position: absolute;
    top: -9999px;
    width: ${textarea.clientWidth}px;
    font-family: ${getComputedStyle(textarea).fontFamily};
    font-size: ${getComputedStyle(textarea).fontSize};
    line-height: ${getComputedStyle(textarea).lineHeight};
    white-space: pre-wrap;
    word-wrap: break-word;
    padding: ${getComputedStyle(textarea).padding};
  `;
  document.body.appendChild(hiddenDiv);
  
  // 替换换行符
  const content = textarea.value.replace(/\n/g, '<br>');
  hiddenDiv.innerHTML = content + '<br>'; // 额外的br确保有足够空间
  
  // 计算实际需要的高度
  const contentHeight = hiddenDiv.clientHeight;
  document.body.removeChild(hiddenDiv);
  
  // 根据内容高度设置textarea和wrapper的高度
  if (contentHeight > 24) {
    const textareaNewHeight = Math.min(contentHeight, 200);
    const wrapperNewHeight = Math.min(textareaNewHeight + 80, maxHeight);
    
    textarea.style.height = textareaNewHeight + 'px';
    wrapper.style.height = wrapperNewHeight + 'px';
  } else {
    textarea.style.height = '24px';
    wrapper.style.height = defaultHeight + 'px';
  }
};

// 当前正在编辑的消息索引
const editingMessageIndex = ref(null);

// 编辑消息的临时内容
const editingContent = ref('');

// 开始编辑消息
const startEdit = (index) => {
  editingMessageIndex.value = index;
  editingContent.value = chatHistory.value[index].content;
  
  // 在下一个 tick 后聚焦文本框
  nextTick(() => {
    const textarea = document.querySelector('.edit-mode textarea');
    if (textarea) {
      textarea.focus();
      autoResizeTextarea({ target: textarea });
    }
  });
};

// 保存编辑的消息
const saveEdit = () => {
  if (editingMessageIndex.value !== null) {
    chatHistory.value[editingMessageIndex.value].content = editingContent.value;
    editingMessageIndex.value = null;
    editingContent.value = '';
  }
};

// 取消编辑
const cancelEdit = () => {
  editingMessageIndex.value = null;
  editingContent.value = '';
};

// 复制消息内容
const copyMessage = (content) => {
  navigator.clipboard.writeText(content);
  // 可以添加复制成功的提示
};

// 点赞消息
const likeMessage = (index) => {
  // 处理点赞逻辑
};

// 重新生成回复
const regenerateResponse = (index) => {
  // 处理重新生成逻辑
};

// 添加踩消息的方法
const dislikeMessage = (index) => {
  // 处理踩的逻辑
};

// 复制代码块内容
const copyCode = (code) => {
  navigator.clipboard.writeText(code).then(() => {
    alert('代码已复制到剪贴板');
  });
};

// 确保 copyCode 方法在全局可用
window.copyCode = copyCode;

// 加载更多对话
const loadMoreConversations = async () => {
  if (loading.value) return;
  if (currentPage.value * pageSize.value >= total.value) return;
  
  currentPage.value++;
  await fetchConversations();
};

// 监听滚动加载更多
const handleScroll = (e) => {
  const element = e.target;
  if (element.scrollHeight - element.scrollTop - element.clientHeight < 50) {
    loadMoreConversations();
  }
};

// 添加文件上传的触发方法
const triggerFileUpload = () => {
  // 创建一个隐藏的文件输入框
  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.accept = 'image/*,.txt,.pdf,.doc,.docx'; // 限制文件类型
  fileInput.multiple = true; // 允许多选
  fileInput.style.display = 'none';
  
  // 监听文件选择
  fileInput.addEventListener('change', handleFileUpload);
  
  // 添加到 body 并触发点击
  document.body.appendChild(fileInput);
  fileInput.click();
  
  // 点击后移除该元素
  fileInput.remove();
};

// 格式化手机号显示
const formatPhone = (phone) => {
  if (!phone) return '';
  return phone.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2');
};

// 添加图片加载错误处理
// const handleImageError = (e) => {
//   console.error('图片加载失败:', e.target.src);
//   e.target.src = ''; // 可以设置一个默认的错误图片
//   ElMessage({
//     type: 'warning',
//     message: '图片加载失败',
//     duration: 2000
//   });
// };

// 对话列表分组
const groupedChats = computed(() => {
  const groups = {};
  
  chatList.value.forEach(chat => {
    const date = new Date(chat.updateTime);
    const now = new Date();
    const diffDays = Math.floor((now - date) / (1000 * 60 * 60 * 24));
    
    let groupKey;
    if (diffDays === 0) {
      groupKey = '今天';
    } else if (diffDays === 1) {
      groupKey = '昨天';
    } else if (diffDays <= 7) {
      // 判断是否在本周内
      const nowWeek = now.getDay() || 7; // 将周日的 0 转换为 7
      if (diffDays < nowWeek) {
        groupKey = '本周';
      } else {
        groupKey = '前7天';
      }
    } else {
      groupKey = '更早';
    }
    
    if (!groups[groupKey]) {
      groups[groupKey] = [];
    }
    groups[groupKey].push(chat);
  });
  
  // 定义分组顺序
  const orderMap = {
    '今天': 1,
    '昨天': 2,
    '本周': 3,
    '前7天': 4,
    '更早': 5
  };
  
  // 返回排序后的分组对象
  return Object.fromEntries(
    Object.entries(groups)
      .sort(([a], [b]) => orderMap[a] - orderMap[b])
  );
});

// 当前激活的更多菜单
const activeMoreMenu = ref(null);

// 显示更多菜单
const showMoreMenu = (chat) => {
  activeMoreMenu.value = activeMoreMenu.value === chat.id ? null : chat.id;
};

// 重命名对话
const renameChat = (chat) => {
  // TODO: 实现重命名逻辑
  activeMoreMenu.value = null;
};

// 删除对话
const deleteChat = (chat) => {
  // TODO: 实现删除逻辑
  activeMoreMenu.value = null;
};

// 点击其他地方关闭菜单
onMounted(() => {
  document.addEventListener('click', () => {
    activeMoreMenu.value = null;
  });
});

// 添加 webview 相关的状态
const showWebview = ref(false);
const webviewUrl = ref('');

// 关闭 webview
const closeWebview = () => {
  showWebview.value = false;
  webviewUrl.value = '';
};

// 在自定义模态框中打开链接
const openInNewTab = () => {
  if (webviewUrl.value) {
    window.open(webviewUrl.value, '_blank', 'noopener,noreferrer');
  }
  closeWebview();
};
</script>

<template>
  <!-- 添加Font Awesome CDN -->
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css">
  
  <div class="chat-container" :class="{ 'mobile': isMobile }">
    <!-- 移动端菜单按钮 -->
    <button 
      class="mobile-menu-btn" 
      @click="toggleMobileSidebar"
      v-show="isMobile"
    >
      <i class="fas fa-bars"></i>
    </button>
    
    <!-- 左侧导航栏 -->
    <aside class="sidebar" :class="{ 'active': showMobileSidebar, 'collapsed': isSidebarCollapsed }">
      <div class="sidebar-header">
        <div class="header-controls">
          <button class="control-btn" @click="toggleSidebar" :title="isSidebarCollapsed ? '展开侧边栏' : '收起侧边栏'">
            <i class="fas fa-bars-staggered"></i>
          </button>
          <div class="right-controls">
            <button class="control-btn" @click="searchChats" :title="'搜索对话'">
              <i class="fas fa-search"></i>
            </button>
            <button class="control-btn" @click="startNewChat" :title="'新建对话'">
              <i class="fas fa-pen-to-square"></i>
            </button>
          </div>
        </div>
      </div>
    
      <div class="agents-section">
        <div class="agent-list">
          <div 
            v-for="agent in agentList" 
            :key="agent.id"
            class="agent-item"
            :class="{ 'active': selectedAgent?.id === agent.id }"  
            @click="selectAgent(agent)"
          >
            <i class="fas" :class="`fa-${agent.icon}`"></i>
            <div class="agent-info" v-if="!isSidebarCollapsed">
              <div class="agent-name">{{ agent.name }}</div>
            </div>
          </div>
        </div>
        <button class="explore-agents-btn" v-if="!isSidebarCollapsed">
          <i class="fas fa-compass"></i>
          探索智能体
        </button>
      </div>
    
      <div class="chat-history" @scroll="handleScroll">
        <div v-if="loading && currentPage === 1" class="loading">
          加载中...
        </div>
        
        <!-- 按时间分组显示对话列表 -->
        <template v-for="(group, groupTime) in groupedChats" :key="groupTime">
          <!-- 时间分组标题 -->
          <div class="time-divider">{{ groupTime }}</div>
          
          <!-- 该时间组下的对话列表 -->
          <div 
            v-for="chat in group" 
            :key="chat.id"
            class="chat-item"
            :class="{ 'active': selectedChat && selectedChat.id === chat.id }"
          >
            <div class="chat-item-content">
              <div class="chat-info" @click="selectChat(chat)">
                <div class="chat-title">{{ chat.title }}</div>
              </div>
              <!-- 更多按钮和菜单 -->
              <div class="chat-actions">
                <button 
                  class="more-btn"
                  @click.stop="showMoreMenu(chat)"
                >
                  <i class="fas fa-ellipsis"></i>
                </button>
                <!-- 更多操作菜单 -->
                <div 
                  v-show="activeMoreMenu === chat.id" 
                  class="more-menu"
                >
                  <button class="menu-item" @click.stop="renameChat(chat)">
                    <i class="fas fa-pen"></i>
                    重命名
                  </button>
                  <button class="menu-item delete" @click.stop="deleteChat(chat)">
                    <i class="fas fa-trash"></i>
                    删除
                  </button>
                </div>
              </div>
            </div>
          </div>
        </template>
        
        <div v-if="loading && currentPage > 1" class="loading-more">
          加载更多...
        </div>
      </div>
      
      <div class="sidebar-footer">
        <button class="user-settings-btn" @click="toggleSettingsModal">
          <div class="user-avatar">
            <i class="fas fa-user"></i>
          </div>
          <div v-if="!isSidebarCollapsed" class="user-info">
            <span class="username">{{ userInfo?.username || '未知用户' }}</span>
            <span class="phone">{{ formatPhone(userInfo?.phone) }}</span>
          </div>
        </button>
      </div>
    </aside>

    <!-- 右侧聊天区域 -->
    <main class="chat-main">
      
      <div class="messages-container">
        <div v-if="chatHistory.length === 0" class="empty-chat">
          <h2>有什么可以帮忙的？</h2>
        </div>
        <div 
          v-for="(message, index) in chatHistory" 
          :key="message.id"
          class="message"
          :class="message.role"
        >
          <!-- 图片消息 -->
          <div v-if="message.type === 'image'" class="message-image-container">
            <el-image 
              :src="message.imageUrl" 
              :preview-src-list="[message.imageUrl]"
              class="message-image"
              fit="contain"
            >
              <template #error>
                <div class="image-error">
                  <i class="fas fa-image"></i>
                  <span>图片加载失败</span>
                </div>
              </template>
            </el-image>
          </div>
          
          <!-- 文本消息 -->
          <div v-else-if="message.type === 'text'" class="message-content">
            <!-- 加载状态 -->
            <div v-if="message.isLoading" class="typing-indicator">
              <span></span>
              <span></span>
              <span></span>
            </div>
            <!-- 编辑状态 -->
            <div v-else-if="editingMessageIndex === index" class="edit-mode">
              <textarea
                v-model="editingContent"
                placeholder="编辑消息"
                rows="1"
                ref="editTextarea"
              ></textarea>
              <div class="edit-actions">
                <button @click="saveEdit" class="edit-btn save">
                  发送
                </button>
                <button @click="cancelEdit" class="edit-btn cancel">
                  取消
                </button>
              </div>
            </div>
            <!-- 显示状态 -->
            <div v-else class="message-text-wrapper">
              <div class="edit-icon" @click="startEdit(index)" v-if="message.role === 'user'">
                <i class="fas fa-pen"></i>
              </div>
              <div class="message-text">
                <!-- 使用纯文本显示内容 -->
                <pre v-if="message.role === 'assistant' && message.isStreaming" 
                     class="streaming-text">{{ message.content }}</pre>
                <!-- 使用 markdown 渲染完整内容 -->
                <div v-else class="markdown-body" v-html="renderMarkdown(message.content)"></div>
                
                <!-- 快捷操作按钮组，只在 AI 助手消息中显示 -->
                <div v-if="message.role === 'assistant'" class="message-actions">
                  <button class="action-icon" @click="copyMessage(message.content)" title="复制">
                    <i class="fas fa-copy"></i>
                  </button>
                  <button class="action-icon" @click="likeMessage(index)" title="点赞">
                    <i class="fas fa-thumbs-up"></i>
                  </button>
                  <button class="action-icon" @click="dislikeMessage(index)" title="踩">
                    <i class="fas fa-thumbs-down"></i>
                  </button>
                  <button 
                    class="action-icon" 
                    @click="regenerateResponse(index)"
                    title="重新生成"
                  >
                    <i class="fas fa-rotate"></i>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <div class="input-container">
        <!-- 修改文件预览区域 -->
        <div class="file-preview" v-if="filePreview.length > 0">
          <div class="preview-list">
            <div v-for="(preview, index) in filePreview" 
                 :key="preview.id" 
                 class="preview-item">
              <img v-if="preview.type.startsWith('image/')" 
                   :src="preview.previewUrl" 
                   class="preview-image">
              <div v-else class="file-info">
                <i class="fas fa-file"></i>
                <span>{{ preview.name }}</span>
              </div>
              <button class="remove-file" 
                      @click="removeFilePreview(index)">
                <i class="fas fa-times"></i>
              </button>
            </div>
          </div>
        </div>
        
        <div class="input-wrapper">
          <textarea
            v-model="currentMessage"
            placeholder="询问任何问题"
            @keydown="handleKeyDown"
            @input="autoResizeTextarea"
            rows="1"
          ></textarea>
          <div class="input-btns">
            <button class="action-btn" @click="triggerFileUpload" title="上传文件">
              <i class="fas fa-plus"></i>
            </button>
            <button class="send-btn" @click="sendMessage">
              <i class="fas fa-arrow-up"></i>
            </button>
          </div>
        </div>
      </div>
    </main>
  </div>
  
  <!-- 使用新的设置组件 -->
  <SettingsModal 
    :show="showSettingsModal"
    @close="closeSettingsModal"
  />
  
  <!-- 自定义模态框，不使用 iframe -->
  <div v-if="showWebview" class="webview-modal" @click="closeWebview">
    <div class="webview-container" @click.stop>
      <div class="webview-header">
        <h3>图片修改器</h3>
        <button class="close-btn" @click="closeWebview">
          <i class="fas fa-times"></i>
        </button>
      </div>
      <div class="webview-content custom-content">
        <div class="info-card">
          <i class="fas fa-image feature-icon"></i>
          <h2>Google AI Studio 图片修改器</h2>
          <p>由于安全限制，无法直接在应用内嵌入 Google AI Studio。</p>
          <p>点击下方按钮在新标签页中打开图片修改器。</p>
          <button class="open-btn" @click="openInNewTab">
            <i class="fas fa-external-link-alt"></i>
            在新标签页中打开
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.chat-container {
  display: flex;
  height: 100vh;
  background-color: #ffffff;
  color: #1a1a1a;
  overflow: hidden;
}

.user-settings-btn {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  padding: 12px;
  background: none;
  border: none;
  cursor: pointer;
  color: #333;
  transition: background-color 0.3s;
}

.user-settings-btn:hover {
  background-color: rgba(0, 0, 0, 0.05);
}

.user-avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background-color: #e0e0e0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.settings-modal {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
}

.settings-content {
  background: white;
  border-radius: 12px;
  width: 90%;
  max-width: 400px;
  max-height: 80vh;
  overflow-y: auto;
  box-shadow: 0 2px 20px rgba(0, 0, 0, 0.15);
}

.settings-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 1px solid #eee;
}

.settings-header h3 {
  margin: 0;
  font-size: 1.1rem;
  font-weight: 600;
  color: #333;
}

.close-btn {
  background: none;
  border: none;
  cursor: pointer;
  color: #666;
  font-size: 1.2rem;
  padding: 4px;
  border-radius: 50%;
  transition: background-color 0.2s;
}

.close-btn:hover {
  background-color: #f5f5f5;
}

.settings-body {
  padding: 8px 0;
}

.settings-section {
  padding: 8px 0;
}

.settings-divider {
  height: 8px;
  background-color: #f5f5f5;
  margin: 4px 0;
}

.settings-item {
  display: flex;
  align-items: center;
  padding: 12px 20px;
  cursor: pointer;
  transition: background-color 0.2s;
}

.settings-item:hover {
  background-color: #f5f5f5;
}

.settings-item i {
  width: 24px;
  color: #666;
}

.settings-item span {
  flex: 1;
  margin-left: 12px;
  color: #333;
  font-size: 0.95rem;
}

.arrow-icon {
  color: #999;
  font-size: 0.8rem;
}

/* 移动端菜单按钮 */
.mobile-menu-btn {
  display: none;
  position: fixed;
  top: 10px;
  left: 10px;
  z-index: 200;
  background-color: transparent;
  border: none;
  font-size: 1.5rem;
  color: inherit;
  cursor: pointer;
  padding: 5px;
}

/* 侧边栏样式 */
.sidebar {
  width: 260px;
  display: flex;
  flex-direction: column;
  background-color: #f9f9f9;
  height: 100vh;
  overflow: hidden;
  transition: width 0.3s ease;
}

.sidebar.collapsed {
  width: 60px;
}

.sidebar.collapsed .right-controls,
.sidebar.collapsed .explore-agents-btn,
.sidebar.collapsed .chat-info,
.sidebar.collapsed .model-selector span {
  display: none;
}

.sidebar.collapsed .agent-item {
  justify-content: center;
  padding: 12px 0;
}

.sidebar.collapsed .agent-item i {
  margin: 0;
}

.sidebar.collapsed .chat-item-content {
  justify-content: center;
}

.sidebar.collapsed .chat-icon {
  margin: 0;
}

.sidebar.collapsed .theme-toggle {
  width: 100%;
  justify-content: center;
}

.header-controls {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 4px;
  padding: 4px;
  border-radius: 8px;
  width: 100%;
  min-height: 44px;
}

.right-controls {
  display: flex;
  gap: 4px;
}

.control-btn {
  background: transparent;
  border: none;
  color: #5d5d5d;
  cursor: pointer;
  padding: 8px;
  border-radius: 6px;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 42px;
  height: 42px;
  min-width: 36px;
  min-height: 36px;
  opacity: 1;
  visibility: visible;
}

.control-btn i {
  font-size: 1.2rem;
}

.control-btn:hover {
  background-color: #e7e7e7;
  color: #1a1a1a;
  transform: translateY(-1px);
}

.agents-section {
  padding: 10px;
  border-bottom: 1px solid #e5e5e5;
}

.section-title {
  font-size: 0.7rem;
  color: #8e8ea0;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin: 15px 0 5px 10px;
  font-weight: 500;
}

.agent-list {
  display: flex;
  flex-direction: column;
  gap: 1px;
  margin: 4px 0;
}

.agent-item {
  display: flex;
  align-items: center;
  padding: 6px 10px;
  margin: 1px 0;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.3s ease;
  color: #000000;
  border: 1px solid transparent;
}

.agent-item:hover {
  background-color: #ececec;
  transform: translateX(2px);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
}

.agent-item.active {
  background-color: #e3e3e3;
}

.agent-item i {
  font-size: 18px;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 8px;
  color: #000000;
}

.agent-info {
  flex: 1;
  min-width: 0;
}

.agent-name {
  font-size: 14px;
  font-weight: 500;
  line-height: 1;
}

.sidebar.collapsed .agent-item i {
  margin-right: 0;
  font-size: 20px;
}

.explore-agents-btn {
  display: flex;
  align-items: center;
  padding: 6px 10px;
  margin: 1px 0;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.3s ease;
  color: #000000;
  border: 1px solid transparent;
  background: transparent;
  width: 100%;
  font-size: 14px;
  font-weight: 500;
}

.explore-agents-btn:hover {
  background-color: #ececec;
  transform: translateX(2px);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
}

.explore-agents-btn i {
  font-size: 18px;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 8px;
  color: #000000;
}

.sidebar-header {
  padding: 8px 10px;
  margin-bottom: 5px;
}

.new-chat-btn {
  width: 100%;
  padding: 12px;
  border: 1px solid #e5e5e5;
  border-radius: 6px;
  background-color: #ffffff;
  color: #1a1a1a;
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  font-size: 0.9rem;
  transition: background-color 0.2s;
}

.new-chat-btn i {
  font-size: 0.8rem;
}

.new-chat-btn:hover {
  background-color: #f0f0f0;
}

.chat-history {
  flex: 1;
  overflow-y: auto;
  padding: 10px;
  display: flex;
  flex-direction: column;
  gap: 2px;
  scroll-behavior: smooth;
}

.chat-item {
  padding: 8px 10px;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
}

.chat-item:hover {
  background-color: #ececec;
}

.chat-item.active {
  background-color: #e3e3e3;
}

.chat-item-content {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
}

.chat-info {
  flex: 1;
  cursor: pointer;
  padding: 4px 0;
}

.chat-title {
  font-size: 0.85rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  font-weight: 500;
  color: #353740;
}

.chat-time {
  font-size: 0.8rem;
  color: #666;
  white-space: nowrap;
}

.sidebar-footer {
  padding: 10px;
  border-top: 1px solid #e5e5e5;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.model-selector {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px;
  border-radius: 6px;
  background-color: transparent;
  color: inherit;
  font-size: 0.9rem;
  cursor: pointer;
  border: none;
  transition: background-color 0.2s;
  width: 70%;
}

.model-selector:hover {
  background-color: #ececf1;
}

.model-selector i {
  font-size: 0.8rem;
  color: #5d5d5d;
}

/* 主聊天区域样式 */
.chat-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  height: 100vh;
  overflow: hidden;
}

.model-info {
  font-size: 0.9rem;
  font-weight: 500;
}

.messages-container {
  flex: 1;
  overflow-y: auto;
  padding: 20px 5%;
  display: flex;
  flex-direction: column;
  gap: 20px;
  scroll-behavior: smooth;
  overflow-x: hidden;
}

.messages-container::-webkit-scrollbar {
  width: 8px;
}

.messages-container::-webkit-scrollbar-track {
  background: transparent;
}

.messages-container::-webkit-scrollbar-thumb {
  background: #d1d5db;
  border-radius: 4px;
  transition: background 0.3s ease;
}

.messages-container::-webkit-scrollbar-thumb:hover {
  background: #9ca3af;
}

.empty-chat {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: balck;
  text-align: center;
}

.empty-chat h2 {
  font-size: 2rem;
  font-weight: 800;
  margin: 0;
}

.message {
  display: flex;
  flex-direction: column;
  width: 100%;
  max-width: 900px;
  margin: 0 auto;
  gap: 8px; /* 图片和文本之间的间距 */
}

/* 消息内容容器样式 */
.message-content {
  width: 100%;
  max-width: 900px;
}

/* 用户消息容器右对齐 */
.message.user .message-content {
  display: flex;
  justify-content: flex-end;
}

/* 用户消息文本样式 */
.message.user .message-text {
  background-color: #f0f0f0;
  color: #000000;
  padding: 12px 16px;
  border-radius: 18px;
  width: fit-content;
  max-width: 80%;
  margin-bottom: 0;
}

@keyframes typing {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

/* AI助手消息文本样式 */
.message.assistant .message-text {
  background: transparent;
  color: #000000;
  padding: 12px 0;
  width: 100%;
  white-space: pre-wrap;
  word-break: break-word;
  margin-bottom: 24px;
  opacity: 0;
  transform: translateY(10px);
  animation: messageAppear 0.3s ease-in-out forwards;
}

.message.assistant .markdown-body {
  opacity: 0;
  animation: typingEffect 0.5s ease-out forwards;
}

.typing-indicator {
  display: flex;
  gap: 4px;
  padding: 12px 16px;
  background: #f0f0f0;
  border-radius: 18px;
  width: fit-content;
}

.typing-indicator span {
  width: 8px;
  height: 8px;
  background-color: #666;
  border-radius: 50%;
  display: inline-block;
  animation: typing 1s infinite ease-in-out;
}

.typing-indicator span:nth-child(1) { animation-delay: 200ms; }
.typing-indicator span:nth-child(2) { animation-delay: 300ms; }
.typing-indicator span:nth-child(3) { animation-delay: 400ms; }

@keyframes typing {
  0%, 100% { transform: translateY(0); opacity: 0.3; }
  50% { transform: translateY(-5px); opacity: 1; }
}

@keyframes messageAppear {
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes typingEffect {
  from {
    opacity: 0;
    transform: translateY(5px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes bounce {
  0%, 80%, 100% { transform: scale(0); }
  40% { transform: scale(1); }
}

.message.assistant.loading .message-text {
  position: relative;
}

.message.assistant.loading .message-text::after {
  content: '';
  position: absolute;
  right: -30px;
  bottom: 12px;
  width: 20px;
  height: 20px;
  border: 2px solid #666;
  border-radius: 50%;
  border-top-color: transparent;
  animation: spin 0.8s linear infinite;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.input-container {
  padding: 0px 5% 24px;
  margin-top: auto;
  background-color: #ffffff;
  height: auto;
}

.input-wrapper {
  display: flex;
  flex-direction: column;
  background-color: #ffffff;
  border-radius: 24px;
  padding: 8px 16px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.08);
  transition: height 0.2s ease;
  max-width: 900px;
  margin: 0 auto;
  height: 88px;
  min-height: 88px;
  max-height: 300px;
}

.input-btns {
  display: flex;
  gap: 12px;
  margin-top: 6px;  /* 减小按钮区域的上边距 */
  align-items: center;
  justify-content: space-between;
  flex-shrink: 0;
  padding-top: 6px;  /* 减小内边距 */
}

.action-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: #f5f5f5;
  border: none;
  border-radius: 50%;
  width: 40px;
  height: 40px;
  padding: 8px;
  font-size: 0.9rem;
  color: #333;
  cursor: pointer;
  transition: all 0.2s ease;
  outline: none;  /* 移除点击时的边框 */
}

.action-btn:hover {
  background-color: #ebebeb;  /* 悬停时略微变暗 */
}

.action-btn:focus {
  outline: none;  /* 确保点击时没有边框 */
}

.send-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: #000;
  color: #fff;
  border: none;
  border-radius: 50%;
  width: 40px;
  height: 40px;
  cursor: pointer;
  transition: all 0.2s ease;
  margin-left: auto;
  outline: none;  /* 移除点击时的边框 */
}

.send-btn:hover {
  background-color: #333;  /* 悬停时略微变亮 */
}

.send-btn:focus {
  outline: none;  /* 确保点击时没有边框 */
}

/* 响应式布局 */
@media (max-width: 768px) {
  .mobile-menu-btn {
    display: block;
  }
  
  .sidebar {
    width: 260px;
    position: fixed;
    top: 0;
    left: 0;
    z-index: 100;
    transform: translateX(-100%);
    transition: transform 0.3s ease;
  }
  
  .sidebar.active {
    transform: translateX(0);
  }
  
  .messages-container {
    padding: 0;
  }
  
  .input-container {
    padding: 0;
  }
}

textarea {
  flex: 1;
  border: none;
  resize: none;
  padding: 8px 0;
  background: transparent;
  color: inherit;
  font-size: 0.95rem;
  line-height: 1.5;
  min-height: 24px;
  max-height: 200px;
  overflow-y: auto;
  outline: none;
  box-sizing: border-box;
  width: 100%;
  transition: height 0.2s ease;
}

/* 自定义滚动条样式 */
textarea::-webkit-scrollbar {
  width: 4px;
}

textarea::-webkit-scrollbar-track {
  background: transparent;
}

textarea::-webkit-scrollbar-thumb {
  background: #d1d5db;
  border-radius: 4px;
}

textarea::-webkit-scrollbar-thumb:hover {
  background: #9ca3af;
}

/* 移除 webkit 浏览器的默认样式 */
textarea::-webkit-input-placeholder {
  color: #999;
}

textarea:focus {
  outline: none;  /* 确保聚焦时也没有边框 */
}

.message-text-wrapper {
  position: relative;
  display: flex;
  align-items: flex-start;
}

.edit-icon {
  position: absolute;
  left: -30px;
  top: 50%;
  transform: translateY(-50%);
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: #f5f5f5;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  opacity: 0;
  transition: opacity 0.2s;
}

.message:hover .edit-icon {
  opacity: 1;
}

.edit-icon i {
  font-size: 0.8rem;
  color: #666;
}

/* 编辑模式样式 */
.edit-mode {
  width: 80%;
  max-width: 900px;
  margin: 16px 0;
}

/* 用户编辑模式右对齐 */
.message.user .edit-mode {
  margin-left: auto;
}

.edit-mode textarea {
  width: 100%;
  min-height: 150px;
  padding: 20px;
  border: none;
  border-radius: 12px;
  font-size: 1rem;
  line-height: 1.6;
  resize: vertical;
  outline: none;
  font-family: inherit;
  background: #f5f5f5;
  transition: all 0.2s ease;
}

.edit-actions {
  display: flex;
  gap: 12px;
  justify-content: flex-end;
  padding: 8px 0;
}

.edit-btn {
  padding: 10px 24px;
  border-radius: 20px;
  border: none;
  font-size: 0.95rem;
  cursor: pointer;
  transition: all 0.2s;
  font-weight: 500;
}

.edit-btn.save {
  background: #000;
  color: white;
}

.edit-btn.save:hover {
  background: #333;
}

.edit-btn.cancel {
  background: #f0f0f0;
  color: #666;
}

.edit-btn.cancel:hover {
  background: #e5e5e5;
}

.message-text {
  max-width: 900px;
  width: 100%;
}

.message.user .message-text {
  background-color: #f0f0f0;
  color: #000000;
  margin-bottom: 24px; /* 为操作按钮留出空间 */
}

.message.assistant .message-text {
  background: transparent;
  color: #000000;
  padding: 12px 0;
  margin-bottom: 24px; /* 为操作按钮留出空间 */
}

.message-actions {
  position: absolute;
  bottom: -30px;  /* 改为底部定位 */
  left: 0;        /* 改为左对齐 */
  display: flex;
  gap: 8px;
  background: white;
  border-radius: 20px;
  padding: 4px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  opacity: 0;
  transform: translateY(-4px);  /* 改为向上位移 */
  transition: all 0.2s ease;
  visibility: hidden;
  z-index: 1;  /* 确保按钮显示在上层 */
}

.message-text:hover .message-actions {
  opacity: 1;
  transform: translateY(0);
  visibility: visible;
}

/* 用户消息的操作按钮靠右对齐 */
.message.user .message-actions {
  left: auto;  /* 取消左对齐 */
  right: 0;    /* 设置右对齐 */
}

.action-icon {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  border: none;
  background: transparent;
  color: #666;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
  outline: none;
}

.action-icon:hover {
  background: #f5f5f5;
  color: #333;
}

.action-icon i {
  font-size: 0.9rem;
}

.markdown-body {
  font-size: 0.95rem;
  line-height: 1.6;
}

.markdown-body :deep(p) {
  margin: 0 0 1em 0;
}

.markdown-body :deep(p:last-child) {
  margin-bottom: 0;
}

.markdown-body :deep(pre) {
  background: #f8f9fa;
  border-radius: 8px;
  margin: 16px 0;
  padding: 16px;
  overflow-x: auto;
  border: 1px solid #e1e4e8;
  position: relative;
}

.markdown-body :deep(pre code) {
  font-family: 'JetBrains Mono', 'Fira Code', monospace;
  font-size: 0.9em;
  line-height: 1.5;
  padding: 0;
  background: none;
  border-radius: 0;
  color: inherit;
}

.markdown-body :deep(code) {
  font-family: 'JetBrains Mono', 'Fira Code', monospace;
  font-size: 0.9em;
}

.markdown-body :deep(:not(pre) > code) {
  background: #f0f0f0;
  color: #d63384;
  padding: 3px 6px;
  border-radius: 4px;
  font-size: 0.875em;
}

.markdown-body :deep(.token.comment),
.markdown-body :deep(.token.prolog),
.markdown-body :deep(.token.doctype),
.markdown-body :deep(.token.cdata) {
  color: #5c6370;
  font-style: italic;
}

.markdown-body :deep(.token.function) {
  color: #61afef;
}

.markdown-body :deep(.token.keyword) {
  color: #c678dd;
}

.markdown-body :deep(.token.property) {
  color: #e06c75;
}

.markdown-body :deep(.token.number) {
  color: #d19a66;
}

.markdown-body :deep(.token.string),
.markdown-body :deep(.token.attr-value) {
  color: #98c379;
}

.markdown-body :deep(.token.operator) {
  color: #56b6c2;
}

.markdown-body :deep(.token.punctuation) {
  color: #7f848e;
}

.markdown-body :deep(.token.boolean) {
  color: #d19a66;
}

.markdown-body :deep(.token.parameter) {
  color: #e06c75;
}

.markdown-body :deep(.token.class-name) {
  color: #e5c07b;
}

.markdown-body :deep(table) {
  border-collapse: collapse;
  width: 100%;
  margin: 16px 0;
  font-size: 0.9em;
}

.markdown-body :deep(th),
.markdown-body :deep(td) {
  border: 1px solid #e1e4e8;
  padding: 8px 12px;
  text-align: left;
}

.markdown-body :deep(th) {
  background: #f6f8fa;
  font-weight: 600;
}

.markdown-body :deep(ul),
.markdown-body :deep(ol) {
  padding-left: 20px;
  margin: 8px 0;
}

.markdown-body :deep(li) {
  margin: 4px 0;
}

.markdown-body :deep(blockquote) {
  margin: 16px 0;
  padding: 0 16px;
  color: #6a737d;
  border-left: 4px solid #dfe2e5;
}

.markdown-body :deep(h1),
.markdown-body :deep(h2),
.markdown-body :deep(h3),
.markdown-body :deep(h4),
.markdown-body :deep(h5),
.markdown-body :deep(h6) {
  margin: 24px 0 16px;
  font-weight: 600;
  line-height: 1.25;
}

.markdown-body :deep(a) {
  color: #0366d6;
  text-decoration: none;
}

.markdown-body :deep(a:hover) {
  text-decoration: underline;
}

.markdown-body :deep(pre[data-language])::before {
  content: attr(data-language);
  position: absolute;
  top: 0;
  right: 0;
  padding: 4px 8px;
  font-size: 0.75em;
  font-weight: 600;
  color: #666;
  background: #f8f9fa;
  border-bottom-left-radius: 4px;
  border-left: 1px solid #e1e4e8;
  border-bottom: 1px solid #e1e4e8;
  text-transform: uppercase;
}

/* 代码块滚动条 */
.markdown-body :deep(pre::-webkit-scrollbar) {
  height: 6px;
}

.markdown-body :deep(pre::-webkit-scrollbar-thumb) {
  background: #ddd;
  border-radius: 3px;
}

.markdown-body :deep(pre::-webkit-scrollbar-track) {
  background: transparent;
}

/* 代码块悬停效果 */
.markdown-body :deep(pre:hover) {
  border-color: #d0d7de;
}

/* 代码块样式 */
.markdown-body :deep(.code-block) {
  position: relative;
  margin: 16px 0;
  border-radius: 8px;
  overflow: hidden;
  border: 1px solid #e1e4e8;
}

.markdown-body :deep(.code-header) {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 16px;
  background: #f1f3f5;
  border-bottom: 1px solid #e1e4e8;
}

.markdown-body :deep(.code-lang) {
  font-size: 0.8em;
  font-weight: 600;
  color: #666;
  text-transform: uppercase;
}

.markdown-body :deep(.copy-btn) {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 8px;
  border: none;
  background: transparent;
  color: #666;
  cursor: pointer;
  font-size: 0.85em;
  border-radius: 4px;
  transition: all 0.2s;
}

.markdown-body :deep(.copy-btn:hover) {
  background: #e9ecef;
  color: #333;
}

.markdown-body :deep(.copy-btn i) {
  font-size: 0.9em;
}

.markdown-body :deep(pre) {
  margin: 0;
  padding: 16px;
  background: #f8f9fa;
  overflow-x: auto;
}

.markdown-body :deep(pre code) {
  padding: 0;
  background: none;
  border-radius: 0;
  font-family: 'JetBrains Mono', 'Fira Code', monospace;
  font-size: 0.9em;
  line-height: 1.5;
}

/* 编辑模式样式调整 */
.message.user .edit-mode {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
}

.message.user .edit-mode textarea {
  width: 100%;
}

/* 移除所有按钮的边框和焦点轮廓 */
button {
  outline: none !important;
}

button:focus {
  outline: none !important;
  box-shadow: none !important;
}

/* 移除文本框的边框和焦点轮廓 */
textarea:focus {
  outline: none !important;
  box-shadow: none !important;
}

/* 确保所有交互元素都没有边框 */
.action-btn,
.send-btn,
.edit-btn,
.action-icon,
.mobile-menu-btn,
.user-settings-btn,
.model-selector,
.new-chat-btn,
.explore-agents-btn,
.copy-btn,
.close-btn,
.control-btn {
  outline: none !important;
  box-shadow: none !important;
}

.action-btn:focus,
.send-btn:focus,
.edit-btn:focus,
.action-icon:focus,
.mobile-menu-btn:focus,
.user-settings-btn:focus,
.model-selector:focus,
.new-chat-btn:focus,
.explore-agents-btn:focus,
.copy-btn:focus,
.close-btn:focus,
.control-btn:focus {
  outline: none !important;
  box-shadow: none !important;
}

/* 移除链接的边框 */
a:focus {
  outline: none !important;
  box-shadow: none !important;
}

/* 文件预览样式 */
.file-preview {
  max-width: 900px;
  margin: 0 auto 12px;
  width: 100%;
  padding: 0;
  background: transparent;
  border: none;
}

.file-preview-content {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 12px;
  padding: 0;
}

.preview-image {
  max-width: 120px;
  max-height: 120px;
  border-radius: 8px;
  object-fit: cover;
  position: relative;
}

.file-info {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #666;
  padding: 8px 12px;
  background: #f8f9fa;
  border-radius: 8px;
  position: relative;
}

.file-info i {
  font-size: 1.5rem;
}

.remove-file {
  position: absolute;
  right: -6px;
  top: -6px;
  transform: none;
  background: rgba(0, 0, 0, 0.6);
  border: none;
  color: white;
  cursor: pointer;
  padding: 4px;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
  z-index: 1;
}

.remove-file:hover {
  background: rgba(0, 0, 0, 0.8);
  color: white;
}

.remove-file i {
  font-size: 0.8rem;
}

/* 确保关闭按钮在图片和文件信息的右上角 */
.file-preview-content > * {
  position: relative;
}

/* 修改文件预览样式 */
.preview-list {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  padding: 8px 0;
}

.preview-item {
  position: relative;
  width: fit-content;
}

.preview-image {
  max-width: 120px;
  max-height: 120px;
  border-radius: 8px;
  object-fit: cover;
}

.remove-file {
  position: absolute;
  right: -6px;
  top: -6px;
  transform: none;
  background: rgba(0, 0, 0, 0.6);
  border: none;
  color: white;
  cursor: pointer;
  padding: 4px;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
  z-index: 1;
}

.user-info {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  overflow: hidden;
}

.username {
  font-size: 0.9rem;
  font-weight: 500;
  color: #333;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.phone {
  font-size: 0.8rem;
  color: #666;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.loading,
.loading-more {
  text-align: center;
  padding: 12px;
  color: #666;
  font-size: 0.9rem;
}

.message-image {
  max-width: 100%;
  max-height: 400px;
  border-radius: 8px;
  margin: 8px 0;
}

.file-link {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  background: #f8f9fa;
  border-radius: 8px;
  color: #333;
  text-decoration: none;
  margin: 8px 0;
}

.file-link:hover {
  background: #e9ecef;
}

.file-link i {
  font-size: 1.2rem;
  color: #666;
}

.message-image-container {
  width: 100%;
  display: flex;
  justify-content: flex-start;
  margin-bottom: 12px;
}

.message.user .message-image-container {
  justify-content: flex-end;
}

.message-image {
  max-width: 300px;
  max-height: 300px;
  border-radius: 12px;
  object-fit: contain;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

/* 用户消息的图片样式 */
.message.user .message-image {
  border-radius: 12px;
}

/* 助手消息的图片样式 */
.message.assistant .message-image {
  border-radius: 12px;
}

.image-error {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 200px;
  background: #f5f5f5;
  border-radius: 12px;
  color: #999;
}

.image-error i {
  font-size: 2rem;
  margin-bottom: 8px;
}

/* 自定义预览图片的样式 */
:deep(.el-image-viewer__wrapper) {
  background-color: rgba(0, 0, 0, 0.8);
}

:deep(.el-image-viewer__close) {
  color: #fff;
}

:deep(.el-image-viewer__actions) {
  opacity: 0.9;
}

:deep(.el-image-viewer__canvas) {
  user-select: none;
}

:deep(.el-image-viewer__prev), 
:deep(.el-image-viewer__next) {
  background-color: rgba(0, 0, 0, 0.3);
  color: #fff;
}

.time-divider {
  padding: 8px 12px;
  font-size: 0.8rem;
  color: #666;
  font-weight: 500;
  background-color: #f9f9f9;
  margin: 4px 0;
  border-radius: 6px;
}

.chat-history {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

/* 调整对话项的样式 */
.chat-item {
  margin: 0 4px;
}

.chat-actions {
  position: relative;
  opacity: 0;
  transition: opacity 0.2s;
  z-index: 2;
}

.chat-item:hover .chat-actions {
  opacity: 1;
}

.more-btn {
  background: transparent;
  border: none;
  color: #666;
  padding: 4px 8px;
  cursor: pointer;
  border-radius: 4px;
  transition: all 0.2s;
}

.more-btn:hover {
  background: #e0e0e0;
  color: #333;
}

.more-menu {
  position: absolute;
  right: 0;
  top: 100%;
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.15);
  padding: 4px 0;
  z-index: 100;
  min-width: 120px;
  margin-top: 4px;
}

/* 使用 v-show 替代 v-if，避免菜单重新渲染 */
.more-menu[style*="display: none"] {
  display: none !important;
}

.menu-item {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 8px 16px;
  border: none;
  background: transparent;
  color: #333;
  cursor: pointer;
  font-size: 0.9rem;
  text-align: left;
  transition: all 0.2s;
}

.menu-item:hover {
  background: #f5f5f5;
}

.menu-item.delete {
  color: #dc3545;
}

.menu-item.delete:hover {
  background: #ffebee;
}

.menu-item i {
  font-size: 0.9rem;
  width: 16px;
}

/* 添加过渡效果 */
.message-content {
  transition: all 0.1s ease-out;
}

/* 添加打字机动画样式 */
.typing-indicator {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 8px 0;
}

.typing-indicator span {
  width: 8px;
  height: 8px;
  background-color: #666;
  border-radius: 50%;
  animation: typing 1s infinite ease-in-out;
}

.typing-indicator span:nth-child(1) {
  animation-delay: 0.2s;
}

.typing-indicator span:nth-child(2) {
  animation-delay: 0.4s;
}

.typing-indicator span:nth-child(3) {
  animation-delay: 0.6s;
}

@keyframes typing {
  0%, 100% { transform: translateY(0); opacity: 0.3; }
  50% { transform: translateY(-5px); opacity: 1; }
}

/* 打字机动画相关样式 */
.typing-indicator {
  display: flex;
  gap: 4px;
  padding: 12px 16px;
  background: #f0f0f0;
  border-radius: 18px;
  width: fit-content;
}

.typing-indicator span {
  width: 8px;
  height: 8px;
  background-color: #666;
  border-radius: 50%;
  display: inline-block;
  animation: typing 1s infinite ease-in-out;
}

.typing-indicator span:nth-child(1) { animation-delay: 200ms; }
.typing-indicator span:nth-child(2) { animation-delay: 300ms; }
.typing-indicator span:nth-child(3) { animation-delay: 400ms; }

/* 统一的打字机动画 */
@keyframes typing {
  0%, 100% { 
    transform: translateY(0); 
    opacity: 0.3; 
  }
  50% { 
    transform: translateY(-5px); 
    opacity: 1; 
  }
}

/* 消息出现动画 */
@keyframes messageAppear {
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* 打字效果动画 */
@keyframes typingEffect {
  from {
    opacity: 0;
    transform: translateY(5px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
/* 添加流式文本样式 */
.streaming-text {
  white-space: pre-wrap;
  word-break: break-word;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  line-height: 1.5;
  margin: 0;
  padding: 0;
  background: transparent;
  border: none;
  overflow: visible;
}

/* Webview 模态框样式 */
.webview-modal {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.webview-container {
  background: white;
  border-radius: 12px;
  width: 90vw;
  height: 90vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.2);
}

.webview-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 1px solid #eee;
}

.webview-header h3 {
  margin: 0;
  font-size: 1.1rem;
  font-weight: 600;
  color: #333;
}

.webview-content {
  flex: 1;
  overflow: hidden;
}

.webview-content iframe {
  width: 100%;
  height: 100%;
  border: none;
}

.close-btn {
  background: none;
  border: none;
  cursor: pointer;
  color: #666;
  font-size: 1.2rem;
  padding: 4px;
  border-radius: 50%;
  transition: background-color 0.2s;
}

.close-btn:hover {
  background-color: #f5f5f5;
}

/* 自定义内容样式 */
.custom-content {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}

.info-card {
  max-width: 500px;
  text-align: center;
  padding: 40px;
  background: #f9f9f9;
  border-radius: 12px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.1);
}

.feature-icon {
  font-size: 3rem;
  color: #1677ff;
  margin-bottom: 20px;
}

.info-card h2 {
  margin: 0 0 16px 0;
  font-size: 1.5rem;
  color: #333;
}

.info-card p {
  margin: 8px 0;
  color: #666;
  line-height: 1.6;
}

.open-btn {
  margin-top: 24px;
  padding: 12px 24px;
  background: #1677ff;
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 1rem;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  transition: background 0.2s;
}

.open-btn:hover {
  background: #0e5ecc;
}
</style>
