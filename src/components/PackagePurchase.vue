<script setup>
import { ref, onMounted, onUnmounted } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { createPaymentOrder, queryPaymentResult } from '../api/payment';
import { getUserInfo } from '../api/user';
import { getUserOrders, getPackageDownloadLink } from '../api/orders';
import QRCode from 'qrcode';
import { useRouter } from 'vue-router';

const router = useRouter();

// 软件包列表
const softwarePackages = ref([
  {
    id: 1,
    name: 'Gemini软件包',
    description: '适合个人使用的Gemini功能包',
    price: 199,
    features: ['1年有效期', '软件工具', '相关教程', '咨询服务'],
    popular: false
  }
]);

// 支付相关状态
const showQRCode = ref(false);
const qrCodeUrl = ref('');
const qrCodeDataUrl = ref('');
const orderId = ref('');
const paymentStatus = ref('PENDING');
const paymentTimer = ref(null);
const isCreatingOrder = ref(false);
const downloadUrl = ref('');

// 登录提示弹窗状态
const showLoginModal = ref(false);

// 订单相关状态
const showOrdersModal = ref(false);
const userOrders = ref([]);
const isLoadingOrders = ref(false);
const selectedOrder = ref(null);
const downloadLinks = ref({});

// 获取用户订单列表
const fetchUserOrders = async () => {
  const userInfo = JSON.parse(localStorage.getItem('userInfo'));
  if (!userInfo?.id) {
    showLoginModal.value = true;
    return;
  }
  
  try {
    isLoadingOrders.value = true;
    const response = await getUserOrders({
      userId: userInfo.id,
      orderType: 'PACKAGE',
      page: 1,
      size: 10
    });
    
    if (response.code === 200) {
      userOrders.value = response.data.list || [];
    } else {
      ElMessage.error(response.msg || '获取订单列表失败');
    }
  } catch (error) {
    ElMessage.error(error.msg || '获取订单列表失败');
  } finally {
    isLoadingOrders.value = false;
  }
};

// 打开订单弹窗
const openOrdersModal = async () => {
  const userInfo = JSON.parse(localStorage.getItem('userInfo'));
  if (!userInfo?.id) {
    showLoginModal.value = true;
    return;
  }
  
  showOrdersModal.value = true;
  await fetchUserOrders();
};

// 关闭订单弹窗
const closeOrdersModal = () => {
  showOrdersModal.value = false;
  selectedOrder.value = null;
};

// 获取下载链接
const getDownloadLink = async (order) => {
  if (downloadLinks.value[order.id]) {
    return;
  }
  
  try {
    const response = await getPackageDownloadLink({
      orderId: order.id,
      packageId: order.packageId
    });
    
    if (response.code === 200) {
      downloadLinks.value[order.id] = response.data.downloadUrl;
    } else {
      ElMessage.error(response.msg || '获取下载链接失败');
    }
  } catch (error) {
    ElMessage.error(error.msg || '获取下载链接失败');
  }
};

// 格式化日期
const formatDate = (dateString) => {
  const date = new Date(dateString);
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
};

// 处理软件包购买
const handlePackagePurchase = async (pkg) => {
  try {
    const userInfo = JSON.parse(localStorage.getItem('userInfo'));
    if (!userInfo?.id) {
      // 显示自定义登录提示弹窗
      showLoginModal.value = true;
      return;
    }

    isCreatingOrder.value = true;
    showQRCode.value = true;
    qrCodeDataUrl.value = '';

    const response = await createPaymentOrder({
      userId: userInfo.id,
      amount: pkg.price,
      orderType: 'PACKAGE',
      value: pkg.id,
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

// 开始轮询支付结果
const startPollingPaymentResult = () => {
  if (paymentTimer.value) {
    clearInterval(paymentTimer.value);
  }
  
  paymentTimer.value = setInterval(async () => {
    try {
      const result = await queryPaymentResult(orderId.value);
      
      if (result.code === 200) {
        const status = result.data.payment_status;
        paymentStatus.value = status;
        
        if (status === 'PAID') {
          // 保存下载链接
          if (result.data.downloadUrl) {
            downloadUrl.value = result.data.downloadUrl;
          }
          
          ElMessage.success('支付成功！');
          clearInterval(paymentTimer.value);
          await refreshUserInfo();
          
          // 不要立即关闭二维码弹窗，而是显示下载按钮
          // closeQRCode();
        } else if (status === 'CANCELLED' || status === 'EXPIRED') {
          ElMessage.warning(status === 'CANCELLED' ? '支付已取消' : '支付已过期');
          clearInterval(paymentTimer.value);
        }
      }
    } catch (error) {
      console.error('查询支付结果失败:', error);
    }
  }, 3000);
};

// 处理下载
const handleDownload = () => {
  if (downloadUrl.value) {
    window.open(downloadUrl.value, '_blank');
    closeQRCode();
  }
};

// 刷新用户信息
const refreshUserInfo = async () => {
  try {
    const userInfo = JSON.parse(localStorage.getItem('userInfo'));
    if (!userInfo?.id) return;
    
    const response = await getUserInfo(userInfo.id);
    
    if (response.code === 200) {
      const updatedUserInfo = {
        ...userInfo,
        ...response.data
      };
      localStorage.setItem('userInfo', JSON.stringify(updatedUserInfo));
    }
  } catch (error) {
    console.error('刷新用户信息失败:', error);
  }
};

// 关闭二维码弹窗
const closeQRCode = () => {
  showQRCode.value = false;
  qrCodeUrl.value = '';
  orderId.value = '';
  
  if (paymentTimer.value) {
    clearInterval(paymentTimer.value);
    paymentTimer.value = null;
  }
};

// 关闭登录提示弹窗
const closeLoginModal = () => {
  showLoginModal.value = false;
};

// 跳转到登录页面
const goToLogin = () => {
  showLoginModal.value = false;
  router.push({
    path: '/package-login',
    query: { redirect: '/packages' }
  });
};

// 组件卸载时清除定时器
onUnmounted(() => {
  if (paymentTimer.value) {
    clearInterval(paymentTimer.value);
  }
});
</script>

<template>
  <div class="package-purchase">
    <div class="packages-header">
      <h3>软件包购买</h3>
      <div class="header-actions">
        <p class="packages-description">选择适合您需求的软件包，享受更多高级功能</p>
        <button class="my-orders-btn" @click="openOrdersModal">
          <i class="fas fa-list-alt"></i>
          我的订单
        </button>
      </div>
    </div>
    
    <div class="packages-container">
      <div 
        v-for="pkg in softwarePackages" 
        :key="pkg.id"
        class="package-card"
        :class="{ 'popular': pkg.popular }"
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
          class="purchase-btn primary"
          :disabled="isCreatingOrder"
          @click="handlePackagePurchase(pkg)"
        >
          <span v-if="!isCreatingOrder">立即购买</span>
          <span v-else>
            <i class="fas fa-spinner fa-spin"></i>
            处理中...
          </span>
        </button>
      </div>
    </div>

    <!-- 自定义登录提示弹窗 -->
    <div v-if="showLoginModal" class="login-modal" @click="closeLoginModal">
      <div class="login-modal-content" @click.stop>
        <div class="login-modal-header">
          <h4>提示</h4>
          <button class="close-btn" @click="closeLoginModal">
            <i class="fas fa-times"></i>
          </button>
        </div>
        <div class="login-modal-body">
          <div class="login-modal-icon">
            <i class="fas fa-exclamation-circle"></i>
          </div>
          <p class="login-modal-message">您还未登录</p>
          <p class="login-modal-message">需要登录后才能购买软件包</p>
        </div>
        <div class="login-modal-footer">
          <button class="cancel-btn" @click="closeLoginModal">取消</button>
          <button class="confirm-btn" @click="goToLogin">去登录</button>
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
          <!-- 支付成功状态 -->
          <div v-if="paymentStatus === 'PAID'" class="payment-success">
            <div class="success-icon">
              <i class="fas fa-check-circle"></i>
            </div>
            <h3>支付成功</h3>
            <p>您已成功购买软件包</p>
            
            <!-- 添加下载按钮 -->
            <button v-if="downloadUrl" class="download-btn" @click="handleDownload">
              <i class="fas fa-download"></i>
              立即下载
            </button>
            <p class="download-tip">请及时下载，链接有效期为24小时</p>
          </div>
          
          <!-- 支付中状态 -->
          <div v-else>
            <div class="amount">¥{{ softwarePackages[0].price }}</div>
            <div class="qrcode-wrapper">
              <img :src="qrCodeDataUrl" alt="支付二维码" v-if="qrCodeDataUrl">
              <div v-else class="qrcode-loading">
                <i class="fas fa-spinner fa-spin"></i>
                <span>二维码生成中...</span>
              </div>
            </div>
          
            <div class="qrcode-tip">
              <i class="fas fa-info-circle"></i>
              <span>请使用支付宝扫码完成支付</span>
            </div>
            <div class="payment-status" :class="paymentStatus.toLowerCase()">
              <span v-if="paymentStatus === 'PENDING'">等待支付...</span>
              <span v-else-if="paymentStatus === 'PAID'">支付成功！</span>
              <span v-else-if="paymentStatus === 'CANCELLED'">支付已取消</span>
              <span v-else-if="paymentStatus === 'EXPIRED'">支付已过期</span>
            </div>
          </div>
        </div>
        <div class="qrcode-footer">
          <div class="order-no">订单号: {{ orderId }}</div>
        </div>
      </div>
    </div>

    <!-- 订单列表弹窗 -->
    <div v-if="showOrdersModal" class="orders-modal" @click="closeOrdersModal">
      <div class="orders-modal-content" @click.stop>
        <div class="orders-modal-header">
          <h4>我的订单</h4>
          <button class="close-btn" @click="closeOrdersModal">
            <i class="fas fa-times"></i>
          </button>
        </div>
        <div class="orders-modal-body">
          <div v-if="isLoadingOrders" class="orders-loading">
            <i class="fas fa-spinner fa-spin"></i>
            <span>加载订单中...</span>
          </div>
          <div v-else-if="userOrders.length === 0" class="no-orders">
            <i class="fas fa-inbox"></i>
            <p>暂无订单记录</p>
          </div>
          <div v-else class="orders-list">
            <div 
              v-for="order in userOrders" 
              :key="order.id"
              class="order-item"
              :class="{ 'selected': selectedOrder && selectedOrder.id === order.id }"
              @click="selectedOrder = order"
            >
              <div class="order-header">
                <span class="order-name">{{ order.packageName }}</span>
                <span class="order-status" :class="order.status.toLowerCase()">
                  {{ order.status === 'PAID' ? '已支付' : 
                     order.status === 'PENDING' ? '待支付' : 
                     order.status === 'CANCELLED' ? '已取消' : '已过期' }}
                </span>
              </div>
              <div class="order-info">
                <div class="order-detail">
                  <span class="label">订单号:</span>
                  <span class="value">{{ order.id }}</span>
                </div>
                <div class="order-detail">
                  <span class="label">金额:</span>
                  <span class="value">¥{{ order.amount }}</span>
                </div>
                <div class="order-detail">
                  <span class="label">创建时间:</span>
                  <span class="value">{{ formatDate(order.createTime) }}</span>
                </div>
                <div class="order-detail" v-if="order.payTime">
                  <span class="label">支付时间:</span>
                  <span class="value">{{ formatDate(order.payTime) }}</span>
                </div>
              </div>
              <div class="order-actions" v-if="order.status === 'PAID'">
                <button 
                  class="download-btn"
                  @click.stop="getDownloadLink(order)"
                >
                  <i class="fas fa-download"></i>
                  {{ downloadLinks[order.id] ? '下载' : '获取下载链接' }}
                </button>
                <a 
                  v-if="downloadLinks[order.id]" 
                  :href="downloadLinks[order.id]"
                  target="_blank"
                  class="download-link"
                  @click.stop
                >
                  <i class="fas fa-external-link-alt"></i>
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.package-purchase {
  padding: 24px;
  max-width: 1200px;
  margin: 0 auto;
}

.packages-header {
  margin-bottom: 24px;
}

.packages-header h3 {
  font-size: 1.5rem;
  margin-bottom: 8px;
  color: #333;
}

.header-actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 8px;
}

.packages-description {
  color: #666;
  font-size: 0.95rem;
  margin: 0;
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
}

.purchase-btn.primary {
  background: #1677ff;
  color: white;
}

.purchase-btn.primary:hover {
  background: #0e5ecc;
}

.purchase-btn:disabled {
  background: #f5f5f5;
  color: #999;
  cursor: not-allowed;
}

/* 二维码弹窗样式 */
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

.qrcode-body {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 16px 0;
}

.amount {
  font-size: 2.2rem;
  font-weight: 700;
  color: #333;
  margin-bottom: 24px;
  text-align: center;
}

.qrcode-wrapper {
  width: 200px;
  height: 200px;
  margin-bottom: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.qrcode-wrapper img {
  width: 100%;
  height: 100%;
}

.qrcode-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  color: #666;
}

.qrcode-loading i {
  font-size: 2rem;
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

.payment-status.cancelled,
.payment-status.expired {
  background-color: #fff2e8;
  color: #fa8c16;
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

/* 自定义登录提示弹窗样式 */
.login-modal {
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
  animation: fadeIn 0.3s ease;
}

.login-modal-content {
  background: white;
  border-radius: 16px;
  width: 380px;
  overflow: hidden;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.15);
  animation: slideIn 0.3s ease;
}

.login-modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 24px;
  border-bottom: 1px solid #f0f0f0;
}

.login-modal-header h4 {
  margin: 0;
  font-size: 1.2rem;
  color: #333;
  font-weight: 600;
}

.login-modal-body {
  padding: 24px;
  text-align: center;
}

.login-modal-icon {
  font-size: 3rem;
  color: #faad14;
  margin-bottom: 16px;
}

.login-modal-message {
  font-size: 1.1rem;
  color: #333;
  margin: 0;
  line-height: 1.5;
  font-weight: 500;
}

.login-modal-footer {
  display: flex;
  padding: 16px 24px;
  border-top: 1px solid #f0f0f0;
  justify-content: flex-end;
  gap: 12px;
}

.cancel-btn, .confirm-btn {
  padding: 10px 20px;
  border-radius: 8px;
  font-size: 1rem;
  cursor: pointer;
  transition: all 0.3s;
  border: none;
}

.cancel-btn {
  background: #f5f5f5;
  color: #666;
}

.cancel-btn:hover {
  background: #e8e8e8;
}

.confirm-btn {
  background: linear-gradient(135deg, #646cff 0%, #5a51f9 100%);
  color: white;
  box-shadow: 0 4px 12px rgba(90, 81, 249, 0.2);
}

.confirm-btn:hover {
  background: linear-gradient(135deg, #5a51f9 0%, #4b44e3 100%);
  box-shadow: 0 6px 16px rgba(90, 81, 249, 0.3);
  transform: translateY(-2px);
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes slideIn {
  from { 
    opacity: 0;
    transform: translateY(-20px);
  }
  to { 
    opacity: 1;
    transform: translateY(0);
  }
}

/* 订单弹窗样式 */
.orders-modal {
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
  animation: fadeIn 0.3s ease;
}

.orders-modal-content {
  background: white;
  border-radius: 16px;
  width: 600px;
  max-width: 90vw;
  max-height: 80vh;
  overflow: hidden;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.15);
  animation: slideIn 0.3s ease;
  display: flex;
  flex-direction: column;
}

.orders-modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 24px;
  border-bottom: 1px solid #f0f0f0;
}

.orders-modal-header h4 {
  margin: 0;
  font-size: 1.2rem;
  color: #333;
  font-weight: 600;
}

.orders-modal-body {
  padding: 24px;
  overflow-y: auto;
  flex: 1;
}

.orders-loading, .no-orders {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 0;
  color: #666;
  gap: 16px;
}

.orders-loading i, .no-orders i {
  font-size: 3rem;
  color: #d9d9d9;
}

.no-orders p {
  font-size: 1.1rem;
  margin: 0;
}

.orders-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.order-item {
  background: #f9f9f9;
  border-radius: 12px;
  padding: 16px;
  cursor: pointer;
  transition: all 0.3s;
  border: 2px solid transparent;
}

.order-item:hover {
  background: #f5f5f5;
  transform: translateY(-2px);
}

.order-item.selected {
  border-color: #646cff;
  background: #f0f7ff;
}

.order-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.order-name {
  font-size: 1.1rem;
  font-weight: 600;
  color: #333;
}

.order-status {
  padding: 4px 10px;
  border-radius: 12px;
  font-size: 0.85rem;
  font-weight: 500;
}

.order-status.paid {
  background: #e6f7e6;
  color: #52c41a;
}

.order-status.pending {
  background: #f5f5f5;
  color: #666;
}

.order-status.cancelled, .order-status.expired {
  background: #fff2e8;
  color: #fa8c16;
}

.order-info {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
  margin-bottom: 16px;
}

.order-detail {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.order-detail .label {
  font-size: 0.85rem;
  color: #666;
}

.order-detail .value {
  font-size: 0.95rem;
  color: #333;
}

.order-actions {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 12px;
}

.download-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  background: linear-gradient(135deg, #646cff 0%, #5a51f9 100%);
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 0.9rem;
  cursor: pointer;
  transition: all 0.3s;
}

.download-btn:hover {
  background: linear-gradient(135deg, #5a51f9 0%, #4b44e3 100%);
}

.download-link {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  background: #f0f0f0;
  color: #333;
  border-radius: 8px;
  transition: all 0.3s;
}

.download-link:hover {
  background: #e0e0e0;
  color: #646cff;
}

.my-orders-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  background: linear-gradient(135deg, #646cff 0%, #5a51f9 100%);
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 0.95rem;
  cursor: pointer;
  transition: all 0.3s;
  box-shadow: 0 4px 12px rgba(90, 81, 249, 0.2);
}

.my-orders-btn:hover {
  background: linear-gradient(135deg, #5a51f9 0%, #4b44e3 100%);
  box-shadow: 0 6px 16px rgba(90, 81, 249, 0.3);
  transform: translateY(-2px);
}

@media (max-width: 768px) {
  .header-actions {
    flex-direction: column;
    align-items: flex-start;
    gap: 12px;
  }
  
  .my-orders-btn {
    align-self: flex-end;
  }
  
  .order-info {
    grid-template-columns: 1fr;
  }
}

/* 支付成功样式 */
.payment-success {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 20px 0;
}

.success-icon {
  font-size: 4rem;
  color: #52c41a;
  margin-bottom: 16px;
}

.payment-success h3 {
  font-size: 1.5rem;
  color: #333;
  margin: 0 0 8px 0;
}

.payment-success p {
  color: #666;
  margin: 0 0 20px 0;
}

.download-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 24px;
  background: linear-gradient(135deg, #646cff 0%, #5a51f9 100%);
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 1rem;
  cursor: pointer;
  transition: all 0.3s;
  margin-top: 16px;
  box-shadow: 0 4px 12px rgba(90, 81, 249, 0.2);
}

.download-btn:hover {
  background: linear-gradient(135deg, #5a51f9 0%, #4b44e3 100%);
  box-shadow: 0 6px 16px rgba(90, 81, 249, 0.3);
  transform: translateY(-2px);
}

.download-tip {
  font-size: 0.85rem;
  color: #999;
  margin-top: 12px !important;
}
</style> 