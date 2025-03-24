<script setup>
import { ref, onMounted, computed, onUnmounted, nextTick } from 'vue';
import { defineProps, defineEmits } from 'vue';
import { getPointsRules } from '../api/points';
import { ElMessage } from 'element-plus';
import { createPaymentOrder, queryPaymentResult } from '../api/payment';
import { getUserInfo } from '../api/user';
import QRCode from 'qrcode';

const props = defineProps({
  show: Boolean
});

const emit = defineEmits(['close']);

// 当前选中的设置项
const currentSection = ref('general');

// 导航选项
const navItems = [
  {
    id: 'general',
    title: '通用设置',
    icon: 'fa-gear'
  },
  {
    id: 'account',
    title: '账户信息',
    icon: 'fa-user'
  },
  {
    id: 'points',
    title: '积分管理',
    icon: 'fa-coins'
  },
  {
    id: 'packages',
    title: '软件包购买',
    icon: 'fa-box'
  },
  {
    id: 'feedback',
    title: '意见反馈',
    icon: 'fa-comment'
  },
  {
    id: 'logout',
    title: '退出登录',
    icon: 'fa-sign-out-alt'
  }
];

// 将用户信息改为响应式对象
const userInfo = ref({
  phone: '',
  points: 0,
  type: '普通用户'
});

// 充值选项改为响应式数据
const rechargeOptions = ref([]);

// 选择支付方式
const paymentMethods = [
  {
    id: 'alipay',
    name: '支付宝',
    icon: 'fa-alipay'
  }
];

// 反馈类型选项
const feedbackTypes = [
  { id: 'bug', label: '功能异常' },
  { id: 'suggestion', label: '功能建议' },
  { id: 'other', label: '其他问题' }
];

// 当前选中的反馈类型
const selectedFeedbackType = ref('bug');

// 反馈内容
const feedbackContent = ref('');

// 上传的图片列表
const uploadedImages = ref([]);

// 用户详细信息
const userDetail = {
  avatar: null,
  nickname: '用户123456',
  phone: '15824111978',
  email: 'user@example.com',
  registerTime: '2024-01-01'
};

// 积分规则列表
const pointsRules = ref([]);
const currentPage = ref(1);
const pageSize = ref(10);
const total = ref(0);
const loading = ref(false);
const isCreatingOrder = ref(false);

// 添加选中的充值选项
const selectedOption = ref(null);

// 添加支付状态
const showQRCode = ref(false);
const qrCodeUrl = ref('');
const qrCodeDataUrl = ref(''); // 用于存储生成的二维码图片
const orderId = ref('');
const paymentStatus = ref('PENDING'); // 支付状态：PENDING/PAID/CANCELLED/EXPIRED
const paymentTimer = ref(null); // 用于轮询支付结果的定时器

// 软件包列表
const softwarePackages = ref([
  {
    id: 1,
    name: 'Gemini软件包',
    description: '适合个人使用的Gemini功能包',
    price: 199,
    features: ['1年有效期', '软件工具', '相关教程', '咨询服务'],
    popular: false
  },

]);

// 选中的软件包
const selectedPackage = ref(null);

const selectSection = async (id) => {
  currentSection.value = id;
  
  // 当切换到积分管理页面时获取积分规则和用户信息
  if (id === 'points') {
    // 显示加载状态
    loading.value = true;
    
    try {
      // 并行获取积分规则和用户信息
      await Promise.all([
        fetchPointsRules(),
        refreshUserInfo()
      ]);
    } catch (error) {
      console.error('获取数据失败:', error);
      ElMessage.error('获取数据失败，请重试');
    } finally {
      loading.value = false;
    }
  }
};

const closeModal = () => {
  emit('close');
};

// 处理积分充值
const handleRecharge = async (points) => {
  try {
    const userInfo = JSON.parse(localStorage.getItem('userInfo'));
    if (!userInfo?.id) {
      ElMessage.error('请先登录');
      return;
    }

    isCreatingOrder.value = true;
    showQRCode.value = true;
    qrCodeDataUrl.value = '';

    const response = await createPaymentOrder({
      userId: userInfo.id,
      orderType: 'POINTS',
      amount: points.price,
      value: points.points,
      paymentType: 'ALIPAY'
    });

    if (response.code === 200) {
      qrCodeUrl.value = response.data.qrCode;
      orderId.value = response.data.orderId;
      paymentStatus.value = 'PENDING';
      
      try {
        qrCodeDataUrl.value = await QRCode.toDataURL(qrCodeUrl.value, {
          width: 200,
          margin: 1,
          color: {
            dark: '#000000',
            light: '#ffffff'
          }
        });
      } catch (err) {
        console.error('生成二维码失败:', err);
        ElMessage.error('生成二维码失败');
      }
      
      startPollingPaymentResult();
    } else {
      ElMessage.error(response.msg || '创建支付订单失败');
      closeQRCode();
    }
  } catch (error) {
    ElMessage.error(error.msg || '创建支付订单失败');
    closeQRCode();
  } finally {
    isCreatingOrder.value = false;
  }
};

// 修改刷新用户信息的函数
const refreshUserInfo = async () => {
  try {
    const userInfoStorage = JSON.parse(localStorage.getItem('userInfo'));
    if (!userInfoStorage?.id) {
      ElMessage.warning('未找到用户信息');
      return;
    }
    
    // 调用获取用户信息的 API
    const response = await getUserInfo(userInfoStorage.id);
    console.log('获取到的用户信息:', response);
    
    if (response.code === 200) {
      // 更新本地存储的用户信息
      const updatedUserInfo = {
        ...userInfoStorage,
        points: response.data.points,
        phone: response.data.phone,
        username: response.data.username,
        user_type: response.data.user_type,
        lastLoginTime: response.data.lastLoginTime
      };
      
      localStorage.setItem('userInfo', JSON.stringify(updatedUserInfo));
      
      // 使用响应式方式更新用户信息
      userInfo.value = {
        phone: response.data.phone,
        points: response.data.points,
        type: response.data.userType
      };
      
      console.log('更新后的积分:', userInfo.value.points);
      
      // 强制重新渲染
      nextTick(() => {
        // 可以添加一些视觉反馈，比如闪烁积分数字
        const pointsElement = document.querySelector('.points-value');
        console.log('找到积分元素:', pointsElement);
        
        if (pointsElement) {
          // 添加高亮动画
          pointsElement.classList.add('highlight');
          setTimeout(() => {
            pointsElement.classList.remove('highlight');
          }, 1500);
        }
      });
      
      ElMessage.success(`用户信息已更新，当前积分: ${response.data.points}`);
    } else {
      ElMessage.warning('获取用户信息失败');
    }
  } catch (error) {
    console.error('刷新用户信息失败:', error);
    ElMessage.error('刷新用户信息失败');
  }
};

// 修改支付成功后的处理
const startPollingPaymentResult = () => {
  // 清除可能存在的定时器
  if (paymentTimer.value) {
    clearInterval(paymentTimer.value);
  }
  
  // 每3秒查询一次支付结果
  paymentTimer.value = setInterval(async () => {
    try {
      const result = await queryPaymentResult(orderId.value);
      console.log('支付查询结果:', result);
      
      if (result.code === 200) {
        // 适应新的响应格式
        const responseData = result.data;
        const status = responseData.payment_status;
        console.log('支付状态:', status);
        
        paymentStatus.value = status;
        
        if (status === 'PAID') {
          // 支付成功
          ElMessage.success('支付成功！');
          clearInterval(paymentTimer.value);
          
          // 先刷新用户积分信息
          await refreshUserInfo();
          
          // 然后关闭弹窗
          closeQRCode();
          
          // 强制切换到积分管理页面
          currentSection.value = 'points';
        } else if (status === 'CANCELLED' || status === 'EXPIRED') {
          // 支付取消或过期
          ElMessage.warning(status === 'CANCELLED' ? '支付已取消' : '支付已过期');
          clearInterval(paymentTimer.value);
        }
      }
    } catch (error) {
      console.error('查询支付结果失败:', error);
    }
  }, 3000);
};

// 关闭二维码弹窗
const closeQRCode = () => {
  showQRCode.value = false;
  qrCodeUrl.value = '';
  orderId.value = '';
  
  // 清除定时器
  if (paymentTimer.value) {
    clearInterval(paymentTimer.value);
    paymentTimer.value = null;
  }
};

// 组件卸载时清除定时器
onUnmounted(() => {
  if (paymentTimer.value) {
    clearInterval(paymentTimer.value);
  }
});

// 处理反馈类型选择
const handleTypeSelect = (typeId) => {
  selectedFeedbackType.value = typeId;
};

// 处理图片上传
const handleImageUpload = (event) => {
  const files = event.target.files;
  if (files && files.length > 0) {
    // 这里可以添加图片预览和上传逻辑
    Array.from(files).forEach(file => {
      const reader = new FileReader();
      reader.onload = (e) => {
        uploadedImages.value.push(e.target.result);
      };
      reader.readAsDataURL(file);
    });
  }
};

// 删除上传的图片
const removeImage = (index) => {
  uploadedImages.value.splice(index, 1);
};

// 提交反馈
const submitFeedback = () => {
  // 处理反馈提交逻辑
  console.log({
    type: selectedFeedbackType.value,
    content: feedbackContent.value,
    images: uploadedImages.value
  });
};

// 处理头像上传
const handleAvatarUpload = (event) => {
  const file = event.target.files[0];
  if (file) {
    const reader = new FileReader();
    reader.onload = (e) => {
      userDetail.avatar = e.target.result;
    };
    reader.readAsDataURL(file);
  }
};

// 保存用户信息
const saveUserInfo = () => {
  // 处理保存逻辑
  console.log('保存用户信息:', userDetail);
};

// 获取积分规则列表
const fetchPointsRules = async () => {
  try {
    loading.value = true;
    const response = await getPointsRules({
      page: currentPage.value,
      size: pageSize.value
    });

    if (response.code === 200) {
      pointsRules.value = response.data.records;
      total.value = response.data.total;
      // 将接口返回的数据转换为充值选项格式
      rechargeOptions.value = response.data.records.map(rule => ({
        points: rule.pointsValue,
        price: rule.pointsAmount,
        tag: rule.pointsTitle
      }));
    }
  } catch (error) {
    ElMessage({
      type: 'error',
      message: '获取积分规则失败',
      duration: 3000
    });
  } finally {
    loading.value = false;
  }
};

// 页码改变
const handlePageChange = (page) => {
  currentPage.value = page;
  fetchPointsRules();
};

// 组件挂载时获取数据
onMounted(async () => {
  try {
    // 从本地存储获取用户信息
    const userInfoStorage = JSON.parse(localStorage.getItem('userInfo'));
    if (userInfoStorage) {
      // 更新组件中的用户信息
      userInfo.value.phone = userInfoStorage.phone || '';
      userInfo.value.points = userInfoStorage.points || 0;
      userInfo.value.type = userInfoStorage.user_type;
    }
    
    // 获取积分规则
    if (currentSection.value === 'points') {
      await fetchPointsRules();
    }
  } catch (error) {
    console.error('初始化用户信息失败:', error);
  }
});

// 选择充值选项
const selectOption = (option) => {
  selectedOption.value = option;
};

// 获取当前选中的金额
const currentAmount = computed(() => {
  return selectedOption.value ? selectedOption.value.price : 0;
});

// 处理软件包购买
const handlePackagePurchase = async (pkg) => {
  if (!pkg) {
    ElMessage.warning('请选择要购买的软件包');
    return;
  }
  
  selectedPackage.value = pkg;
  
  try {
    const userInfo = JSON.parse(localStorage.getItem('userInfo'));
    if (!userInfo?.id) {
      ElMessage.error('请先登录');
      return;
    }

    // 设置创建订单的加载状态
    isCreatingOrder.value = true;
    
    // 先显示二维码弹窗，但内容为加载中
    showQRCode.value = true;
    qrCodeDataUrl.value = '';

    const response = await createPaymentOrder({
      userId: userInfo.id,
      amount: pkg.price,
      orderType: 'PACKAGE',  // 修改订单类型
      value: pkg.id,  // 软件包ID
      paymentType: 'ALIPAY'
    });

    if (response.code === 200) {
      qrCodeUrl.value = response.data.qrCode;
      orderId.value = response.data.orderId;
      paymentStatus.value = 'PENDING';
      
      // 生成二维码
      try {
        qrCodeDataUrl.value = await QRCode.toDataURL(qrCodeUrl.value, {
          width: 200,
          margin: 1,
          color: {
            dark: '#000000',
            light: '#ffffff'
          }
        });
      } catch (err) {
        console.error('生成二维码失败:', err);
        ElMessage.error('生成二维码失败');
      }
      
      // 开始轮询支付结果
      startPollingPaymentResult();
    } else {
      ElMessage.error(response.msg || '创建支付订单失败');
      closeQRCode();
    }
  } catch (error) {
    ElMessage.error(error.msg || '创建支付订单失败');
    closeQRCode();
  } finally {
    // 无论成功失败，都关闭创建订单的加载状态
    isCreatingOrder.value = false;
  }
};
</script>

<template>
  <div v-if="show" class="settings-modal" @click="closeModal">
    <div class="settings-content" @click.stop>
      <div class="settings-header">
        <h3>设置</h3>
        <button class="close-btn" @click="closeModal">
          <i class="fas fa-times"></i>
        </button>
      </div>
      <div class="settings-body">
        <!-- 左侧导航 -->
        <div class="settings-nav">
          <div 
            v-for="item in navItems" 
            :key="item.id"
            class="nav-item"
            :class="{ active: currentSection === item.id }"
            @click="selectSection(item.id)"
          >
            <i class="fas" :class="item.icon"></i>
            <span>{{ item.title }}</span>
          </div>
        </div>
        
        <!-- 右侧内容区 -->
        <div class="settings-content-area">
          <div v-if="currentSection === 'general'">
            <h4>通用设置</h4>
            <!-- 通用设置的内容 -->
          </div>
          <div v-else-if="currentSection === 'account'" class="account-section">
            <h4>账户信息</h4>
            
            <!-- 头像上传 -->
            <div class="avatar-section">
              <div class="avatar-wrapper">
                <img 
                  v-if="userDetail.avatar" 
                  :src="userDetail.avatar" 
                  alt="用户头像"
                  class="avatar-img"
                >
                <i v-else class="fas fa-user"></i>
                <label class="avatar-upload">
                  <input
                    type="file"
                    accept="image/*"
                    @change="handleAvatarUpload"
                    style="display: none"
                  >
                  <i class="fas fa-camera"></i>
                </label>
              </div>
              <div class="avatar-tip">点击更换头像</div>
            </div>

            <!-- 基本信息 -->
            <div class="info-section">
              <div class="info-group">
                <label>昵称</label>
                <div class="info-content">
                  <input v-model="userDetail.nickname" type="text">
                  <i class="fas fa-pen"></i>
                </div>
              </div>
              
              <div class="info-group">
                <label>手机号</label>
                <div class="info-content">
                  <span>{{ userDetail.phone }}</span>
                </div>
              </div>
              
              
              <div class="info-group">
                <label>注册时间</label>
                <div class="info-content">
                  <span>{{ userDetail.registerTime }}</span>
                </div>
              </div>
            </div>

            <!-- 保存按钮 -->
            <button class="save-btn" @click="saveUserInfo">
              保存修改
            </button>
          </div>
          <div v-else-if="currentSection === 'points'" class="points-management">
            <!-- 用户信息卡片 -->
            <div class="user-card">
              <div class="user-info">
                <div class="avatar">
                  <i class="fas fa-user"></i>
                </div>
                <div class="info">
                  <div class="phone">{{ userInfo.phone }}</div>
                  <div class="points">当前积分余额: {{ userInfo.points }}</div>
                </div>
              </div>
              <div class="user-type">{{ userInfo.type }}</div>
            </div>

            <!-- 充值选项 -->
            <div class="recharge-section">
              <h5>选择充值金额</h5>
              <div class="recharge-options">
                <div 
                  v-for="(option, index) in rechargeOptions" 
                  :key="index"
                  class="recharge-option"
                  :class="{ 'selected': selectedOption === option }"
                  @click="selectOption(option)"
                >
                  <div class="points-amount">{{ option.points }} 积分</div>
                  <div class="price">¥{{ option.price }}</div>
                  <div class="tag">{{ option.tag }}</div>
                </div>
              </div>
            </div>

            <!-- 支付方式 -->
            <div class="payment-section">
              <h5>支付方式</h5>
              <div class="payment-methods">
                <div 
                  v-for="method in paymentMethods" 
                  :key="method.id"
                  class="payment-method"
                >
                  <i class="fab" :class="method.icon"></i>
                  <span>{{ method.name }}</span>
                  <i class="fas fa-chevron-right"></i>
                </div>
              </div>
            </div>

            <!-- 充值按钮 -->
            <button 
              class="recharge-btn" 
              @click="handleRecharge(selectedOption)"
              :disabled="!selectedOption || isCreatingOrder"
            >
              <span v-if="!isCreatingOrder">立即充值 ¥{{ currentAmount.toFixed(2) }}</span>
              <span v-else>
                <i class="fas fa-spinner fa-spin"></i> 
                处理中...
              </span>
            </button>

            <!-- 服务协议 -->
            <div class="agreement">
              充值即表示同意 <a href="#">《充值服务协议》</a>
            </div>

           
          </div>
          <div v-else-if="currentSection === 'packages'" class="section-content">
            <div class="packages-header">
              <h3>软件包购买</h3>
              <p class="packages-description">选择适合您需求的软件包，享受更多高级功能</p>
            </div>
            
            <div class="packages-container">
              <div 
                v-for="pkg in softwarePackages" 
                :key="pkg.id"
                class="package-card"
                :class="{ 
                  'selected': selectedPackage?.id === pkg.id,
                  'popular': pkg.popular 
                }"
                @click="selectedPackage = pkg"
              >
                <div class="package-header">
                  <h4>{{ pkg.name }}</h4>
                  <span v-if="pkg.popular" class="popular-tag">热门选择</span>
                </div>
                <div class="package-price">¥{{ pkg.price }}</div>
                <div class="package-description">{{ pkg.description }}</div>
                <ul class="package-features">
                  <li v-for="(feature, index) in pkg.features" :key="index">
                    <i class="fas fa-check"></i>
                    {{ feature }}
                  </li>
                </ul>
                <button 
                  class="purchase-btn"
                  :class="{ 'primary': selectedPackage?.id === pkg.id }"
                  @click.stop="handlePackagePurchase(pkg)"
                >
                  立即购买
                </button>
              </div>
            </div>
          </div>
          <div v-else-if="currentSection === 'feedback'" class="feedback-section">
            <h4>意见反馈</h4>
            
            <!-- 反馈类型选择 -->
            <div class="feedback-types">
              <div 
                v-for="type in feedbackTypes" 
                :key="type.id"
                class="type-option"
                :class="{ active: selectedFeedbackType === type.id }"
                @click="handleTypeSelect(type.id)"
              >
                {{ type.label }}
              </div>
            </div>
            
            <!-- 反馈内容输入 -->
            <div class="feedback-content">
              <textarea
                v-model="feedbackContent"
                placeholder="请详细描述您遇到的问题或建议..."
                rows="6"
              ></textarea>
              
              <!-- 图片上传区域 -->
              <div class="image-upload-section">
                <div class="uploaded-images">
                  <div 
                    v-for="(image, index) in uploadedImages" 
                    :key="index"
                    class="image-preview"
                  >
                    <img :src="image" alt="预览图">
                    <button class="remove-btn" @click="removeImage(index)">
                      <i class="fas fa-times"></i>
                    </button>
                  </div>
                  
                  <label class="upload-trigger" v-if="uploadedImages.length < 3">
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      @change="handleImageUpload"
                      style="display: none"
                    >
                    <i class="fas fa-camera"></i>
                    <span>上传图片</span>
                  </label>
                </div>
                <div class="upload-tip">最多上传3张图片</div>
              </div>
            </div>
            
            <!-- 提交按钮 -->
            <button 
              class="submit-btn"
              :disabled="!feedbackContent.trim()"
              @click="submitFeedback"
            >
              提交反馈
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- 支付二维码弹窗 -->
  <div v-if="showQRCode" class="qrcode-modal" @click="closeQRCode">
    <div class="qrcode-content" @click.stop>
      <div class="qrcode-header">
        <h4>支付宝扫码支付</h4>
        <button class="close-btn" @click="closeQRCode">
          <i class="fas fa-times"></i>
        </button>
      </div>
      <div class="qrcode-body">
        <div class="amount">¥{{ currentAmount.toFixed(2) }}</div>
        <div class="qrcode-wrapper">
          <!-- 使用生成的二维码图片 -->
          <img :src="qrCodeDataUrl" alt="支付二维码" v-if="qrCodeDataUrl">
          <div v-else class="qrcode-loading">
            <i class="fas fa-spinner fa-spin"></i>
            <span>二维码生成中...</span>
          </div>
        </div>
        <div class="qrcode-tip" v-if="qrCodeDataUrl">
          <i class="fas fa-info-circle"></i>
          <span>请使用支付宝扫码完成支付</span>
        </div>
        
        <!-- 支付状态 -->
        <div class="payment-status" :class="paymentStatus.toLowerCase()" v-if="qrCodeDataUrl">
          <span v-if="paymentStatus === 'PENDING'">等待支付...</span>
          <span v-else-if="paymentStatus === 'PAID'">支付成功！</span>
          <span v-else-if="paymentStatus === 'CANCELLED'">支付已取消</span>
          <span v-else-if="paymentStatus === 'EXPIRED'">支付已过期</span>
        </div>
      </div>
      <div class="qrcode-footer" v-if="orderId">
        <div class="order-no">订单号: {{ orderId }}</div>
      </div>
    </div>
  </div>
</template>

<style scoped>
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
  max-width: 800px;
  height: 80vh;
  overflow: hidden;
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
  display: flex;
  height: calc(100% - 60px);
}

.settings-nav {
  width: 200px;
  border-right: 1px solid #eee;
  overflow-y: auto;
}

.nav-item {
  display: flex;
  align-items: center;
  padding: 12px 20px;
  cursor: pointer;
  transition: background-color 0.2s;
}

.nav-item:hover {
  background-color: #f5f5f5;
}

.nav-item.active {
  background-color: #f0f0f0;
  font-weight: 500;
}

.nav-item i {
  width: 24px;
  color: #666;
}

.nav-item span {
  margin-left: 12px;
  color: #333;
  font-size: 0.95rem;
}

.settings-content-area {
  flex: 1;
  padding: 20px;
  overflow-y: auto;
}

.settings-content-area h4 {
  margin: 0 0 20px 0;
  font-size: 1.1rem;
  color: #333;
}

/* 积分管理样式 */
.points-management {
  padding: 20px;
}

.user-card {
  background-color: #333;
  border-radius: 12px;
  padding: 20px;
  color: white;
  margin-bottom: 24px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.user-info {
  display: flex;
  align-items: center;
  gap: 16px;
}

.avatar {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: #666;
  display: flex;
  align-items: center;
  justify-content: center;
}

.info .phone {
  font-size: 1.2rem;
  font-weight: 500;
  margin-bottom: 4px;
}

.info .points {
  font-size: 0.9rem;
  opacity: 0.8;
}

.user-type {
  background: rgba(255, 255, 255, 0.2);
  padding: 4px 12px;
  border-radius: 20px;
  font-size: 0.9rem;
}

.recharge-section, .payment-section {
  margin-bottom: 24px;
}

h5 {
  font-size: 1rem;
  margin: 0 0 16px 0;
  color: #333;
}

.recharge-options {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 16px;
}

.recharge-option {
  position: relative;
  flex: 1;
  min-width: 120px;
  padding: 16px;
  border: 1px solid #eee;
  border-radius: 12px;
  text-align: center;
  cursor: pointer;
  transition: all 0.2s;
}

.recharge-option:hover {
  border-color: #666;
}

.recharge-option.selected {
  border-color: #000;
  background: #fafafa;
}

.points-amount {
  font-size: 1.4rem;
  font-weight: 600;
  margin-bottom: 8px;
}

.price {
  color: #666;
  margin-bottom: 8px;
}

.tag {
  color: #999;
  font-size: 0.9rem;
}

.payment-methods {
  border: 1px solid #eee;
  border-radius: 12px;
}

.payment-method {
  display: flex;
  align-items: center;
  padding: 16px;
  cursor: pointer;
}

.payment-method i:first-child {
  font-size: 1.4rem;
  margin-right: 12px;
  color: #1677ff;
}

.payment-method span {
  flex: 1;
}

.payment-method .fa-chevron-right {
  color: #999;
}

.recharge-btn {
  width: 100%;
  background: #000;
  color: white;
  border: none;
  border-radius: 12px;
  padding: 16px;
  font-size: 1rem;
  cursor: pointer;
  margin-bottom: 16px;
  transition: background-color 0.2s;
}

.recharge-btn:hover {
  background: #333;
}

.recharge-btn:disabled {
  background: #ccc;
  cursor: not-allowed;
}

.agreement {
  text-align: center;
  color: #666;
  font-size: 0.9rem;
}

.agreement a {
  color: #333;
  text-decoration: none;
}

/* 意见反馈样式 */
.feedback-section {
  padding: 0 20px;
}

.feedback-types {
  display: flex;
  gap: 12px;
  margin-bottom: 20px;
}

.type-option {
  padding: 8px 16px;
  border-radius: 20px;
  border: 1px solid #eee;
  cursor: pointer;
  transition: all 0.2s;
  font-size: 0.9rem;
}

.type-option:hover {
  border-color: #333;
}

.type-option.active {
  background-color: #333;
  color: white;
  border-color: #333;
}

.feedback-content textarea {
  width: 100%;
  border: 1px solid #eee;
  border-radius: 12px;
  padding: 16px;
  font-size: 0.95rem;
  resize: none;
  margin-bottom: 16px;
  transition: border-color 0.2s;
}

.feedback-content textarea:focus {
  outline: none;
  border-color: #333;
}

.image-upload-section {
  margin-bottom: 24px;
}

.uploaded-images {
  display: flex;
  gap: 12px;
  margin-bottom: 8px;
}

.image-preview {
  position: relative;
  width: 80px;
  height: 80px;
  border-radius: 8px;
  overflow: hidden;
}

.image-preview img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.remove-btn {
  position: absolute;
  top: 4px;
  right: 4px;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.5);
  color: white;
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.8rem;
}

.upload-trigger {
  width: 80px;
  height: 80px;
  border: 1px dashed #ccc;
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s;
}

.upload-trigger:hover {
  border-color: #333;
}

.upload-trigger i {
  font-size: 1.5rem;
  color: #666;
  margin-bottom: 4px;
}

.upload-trigger span {
  font-size: 0.8rem;
  color: #666;
}

.upload-tip {
  font-size: 0.8rem;
  color: #999;
}

.submit-btn {
  width: 100%;
  background: #000;
  color: white;
  border: none;
  border-radius: 12px;
  padding: 16px;
  font-size: 1rem;
  cursor: pointer;
  transition: all 0.2s;
}

.submit-btn:hover {
  background: #333;
}

.submit-btn:disabled {
  background: #ccc;
  cursor: not-allowed;
}

/* 账户信息样式 */
.account-section {
  padding: 0 20px;
}

.avatar-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-bottom: 32px;
}

.avatar-wrapper {
  position: relative;
  width: 100px;
  height: 100px;
  border-radius: 50%;
  background: #f5f5f5;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 8px;
  cursor: pointer;
  overflow: hidden;
}

.avatar-wrapper i.fa-user {
  font-size: 2.5rem;
  color: #999;
}

.avatar-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.avatar-upload {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 32px;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  opacity: 0;
  transition: opacity 0.2s;
}

.avatar-wrapper:hover .avatar-upload {
  opacity: 1;
}

.avatar-upload i {
  color: white;
  font-size: 1.2rem;
}

.avatar-tip {
  font-size: 0.9rem;
  color: #666;
}

.info-section {
  margin-bottom: 32px;
}

.info-group {
  margin-bottom: 20px;
}

.info-group label {
  display: block;
  font-size: 0.9rem;
  color: #666;
  margin-bottom: 8px;
}

.info-content {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  background: #f5f5f5;
  border-radius: 8px;
}

.info-content input {
  border: none;
  background: transparent;
  font-size: 0.95rem;
  color: #333;
  width: 100%;
  margin-right: 12px;
}

.info-content input:focus {
  outline: none;
}

.info-content i {
  color: #666;
  cursor: pointer;
}

.info-content span {
  font-size: 0.95rem;
  color: #333;
}

.link-btn {
  background: none;
  border: none;
  color: #1677ff;
  font-size: 0.9rem;
  cursor: pointer;
  padding: 0;
}

.link-btn:hover {
  text-decoration: underline;
}

.save-btn {
  width: 100%;
  background: #000;
  color: white;
  border: none;
  border-radius: 12px;
  padding: 16px;
  font-size: 1rem;
  cursor: pointer;
  transition: background-color 0.2s;
}

.save-btn:hover {
  background: #333;
}

.points-rules {
  margin-top: 20px;
  padding: 16px;
  background: #f9f9f9;
  border-radius: 8px;
}

.points-rules h3 {
  margin: 0 0 16px;
  font-size: 1.1rem;
  color: #333;
}

.rules-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.rule-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px;
  background: white;
  border-radius: 6px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.rule-info {
  flex: 1;
}

.rule-title {
  font-weight: 500;
  color: #333;
}

.rule-value {
  color: #4CAF50;
  font-size: 0.9rem;
  margin-top: 4px;
}

.rule-amount {
  color: #666;
  font-size: 0.9rem;
  margin: 0 16px;
}

.rule-time {
  color: #999;
  font-size: 0.8rem;
}

.pagination {
  margin-top: 16px;
  display: flex;
  justify-content: center;
}

.qrcode-modal {
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

.qrcode-content {
  background: white;
  border-radius: 16px;
  width: 360px;
  padding: 24px;
}

.qrcode-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
}

.qrcode-header h4 {
  margin: 0;
  font-size: 1.1rem;
  color: #333;
}

.qrcode-body {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 16px 0;
}

.amount {
  font-size: 1.8rem;
  font-weight: 500;
  color: #333;
  margin-bottom: 24px;
}

.qrcode-wrapper {
  width: 200px;
  height: 200px;
  margin-bottom: 24px;
}

.qrcode-wrapper img {
  width: 100%;
  height: 100%;
}

.qrcode-tip {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #666;
  font-size: 0.9rem;
}

.qrcode-tip i {
  color: #1677ff;
  font-size: 1.2rem;
}

.qrcode-footer {
  text-align: center;
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid #eee;
}

.order-no {
  font-size: 0.9rem;
  color: #999;
}

/* 支付状态样式 */
.payment-status {
  margin-top: 16px;
  padding: 8px 16px;
  border-radius: 20px;
  font-size: 0.9rem;
  text-align: center;
}

.payment-status.pending {
  background-color: #f5f5f5;
  color: #666;
}

.payment-status.paid {
  background-color: #e6f7e6;
  color: #52c41a;
}

.payment-status.cancelled, .payment-status.expired {
  background-color: #fff2e8;
  color: #fa8c16;
}

.qrcode-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  color: #666;
}

.qrcode-loading i {
  font-size: 2rem;
  margin-bottom: 8px;
}

/* 按钮加载状态 */
.recharge-btn i {
  margin-right: 8px;
}

/* 添加积分高亮动画 */
@keyframes highlight-points {
  0% { color: #333; }
  50% { color: #1677ff; transform: scale(1.1); }
  100% { color: #333; }
}

.points-value.highlight {
  animation: highlight-points 1.5s ease;
}

/* 确保积分值有足够的视觉效果 */
.points-value {
  font-size: 2rem;
  font-weight: bold;
  color: #333;
  margin: 10px 0;
  transition: all 0.3s ease;
}

/* 软件包购买页面样式 */
.packages-header {
  margin-bottom: 24px;
}

.packages-header h3 {
  font-size: 1.5rem;
  margin-bottom: 8px;
  color: #333;
}

.packages-description {
  color: #666;
  font-size: 0.95rem;
}

.packages-container {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 24px;
  margin-top: 24px;
}

.package-card {
  background: white;
  border-radius: 12px;
  padding: 24px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);
  transition: all 0.3s ease;
  cursor: pointer;
  position: relative;
  overflow: hidden;
  border: 2px solid transparent;
}

.package-card:hover {
  transform: translateY(-5px);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
}

.package-card.selected {
  border-color: #1677ff;
}

.package-card.popular {
  box-shadow: 0 4px 20px rgba(22, 119, 255, 0.15);
}

.package-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.package-header h4 {
  font-size: 1.2rem;
  margin: 0;
  color: #333;
}

.popular-tag {
  background: #1677ff;
  color: white;
  font-size: 0.8rem;
  padding: 4px 8px;
  border-radius: 12px;
}

.package-price {
  font-size: 2rem;
  font-weight: bold;
  color: #333;
  margin-bottom: 16px;
}

.package-description {
  color: #666;
  font-size: 0.95rem;
  margin-bottom: 24px;
}

.package-features {
  list-style: none;
  padding: 0;
  margin: 0 0 24px 0;
}

.package-features li {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
  color: #333;
}

.package-features i {
  color: #52c41a;
  font-size: 0.9rem;
}

.purchase-btn {
  width: 100%;
  padding: 12px;
  border: none;
  border-radius: 8px;
  font-size: 1rem;
  cursor: pointer;
  transition: all 0.2s;
  background: #f5f5f5;
  color: #333;
}

.purchase-btn:hover {
  background: #e5e5e5;
}

.purchase-btn.primary {
  background: #1677ff;
  color: white;
}

.purchase-btn.primary:hover {
  background: #0e5ecc;
}
</style> 