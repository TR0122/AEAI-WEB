<script setup>
import { ref, reactive, onMounted, onBeforeUnmount } from 'vue';
import { sendVerificationCode as sendCode, loginRegister } from '../api/user';
import { ElMessage } from 'element-plus';

// 导入logo
import aeaiLogo from '../assets/AEAI_logo.png';

// 表单数据
const formData = reactive({
  phone: '',
  verificationCode: ''
});

// 表单验证状态
const formErrors = reactive({
  phone: '',
  verificationCode: ''
});

// 验证码按钮状态
const isSendingCode = ref(false);
const countdown = ref(0);
const countdownTimer = ref(null);

// 打字效果相关
const typewriterText = ref('');
const textPhrases = ['AEAI', '更懂你的AI', '开始吧'];
const currentPhraseIndex = ref(0);
const isTyping = ref(true); // true表示正在输入，false表示正在删除
const typewriterTimer = ref(null);
let typewriterIndex = 0;

// 打字效果函数
const startTypewriter = () => {
  typewriterIndex = 0;
  const currentPhrase = textPhrases[currentPhraseIndex.value];

  const typeNextCharacter = () => {
    if (isTyping.value) {
      // 正在输入文字
      if (typewriterIndex < currentPhrase.length) {
        // 每一帧更新typewriterText，确保平滑显示
        typewriterText.value = currentPhrase.slice(0, typewriterIndex + 1);
        typewriterIndex++;
        setTimeout(typeNextCharacter, 100); // 增加延时
      } else {
        // 输入完成，等待一段时间后开始删除
        setTimeout(() => {
          isTyping.value = false;
          startDeleting(); // 开始删除
        }, 1000);
      }
    }
  };
  setTimeout(typeNextCharacter, 100); // 增加延时
};

// 删除文字的函数
const startDeleting = () => {
  if (typewriterTimer.value) clearInterval(typewriterTimer.value);

  const deleteNextCharacter = () => {
    if (!isTyping.value) {
      if (typewriterText.value.length > 0) {
        typewriterText.value = typewriterText.value.slice(0, -1);
        setTimeout(deleteNextCharacter, 100); // 增加延时
      } else {
        // 删除完成，切换到下一个短语
        currentPhraseIndex.value = (currentPhraseIndex.value + 1) % textPhrases.length;
        isTyping.value = true;
        startTypewriter(); // 重新开始打字
      }
    }
  };
  setTimeout(deleteNextCharacter, 100); // 增加延时
};

// 组件挂载时启动打字效果
onMounted(() => {
  startTypewriter();
});

// 组件卸载前清除定时器
onBeforeUnmount(() => {
  if (countdownTimer.value) clearInterval(countdownTimer.value);
});

// 验证手机号格式
const validatePhone = () => {
  const phoneRegex = /^1[3-9]\d{9}$/;
  if (!formData.phone) {
    formErrors.phone = '请输入手机号';
    return false;
  } else if (!phoneRegex.test(formData.phone)) {
    formErrors.phone = '请输入正确的手机号';
    return false;
  }
  formErrors.phone = '';
  return true;
};

// 验证验证码
const validateVerificationCode = () => {
  if (!formData.verificationCode) {
    formErrors.verificationCode = '请输入验证码';
    return false;
  } else if (formData.verificationCode.length !== 6) {
    formErrors.verificationCode = '验证码应为6位数字';
    return false;
  }
  formErrors.verificationCode = '';
  return true;
};

// 发送验证码
const handleSendCode = async () => {
  if (!validatePhone()) return;

  try {
    // 开始发送验证码
    const response = await sendCode(formData.phone);
    
    // 发送成功，开始倒计时
    isSendingCode.value = true;
    countdown.value = response.data.remainingTime || 60;

    // 显示成功提示
    ElMessage({
      type: 'success',
      message: '验证码发送成功',
      duration: 2000
    });

    // 倒计时逻辑
    countdownTimer.value = setInterval(() => {
      countdown.value--;
      if (countdown.value <= 0) {
        clearInterval(countdownTimer.value);
        isSendingCode.value = false;
      }
    }, 1000);
  } catch (error) {
    // 处理错误情况
    if (error.code === 429) {
      // 请求过于频繁
      isSendingCode.value = true;
      countdown.value = error.data.remainingTime;
      ElMessage({
        type: 'warning',
        message: error.msg,
        duration: 3000
      });
    } else {
      // 其他错误
      ElMessage({
        type: 'error',
        message: error.msg || '发送验证码失败',
        duration: 3000
      });
    }
  }
};

import { useRouter } from 'vue-router';

const router = useRouter();

// 提交表单
const submitForm = async () => {
  const isPhoneValid = validatePhone();
  const isCodeValid = validateVerificationCode();

  if (isPhoneValid && isCodeValid) {
    try {
      const response = await loginRegister(formData.phone, formData.verificationCode);
      
      // 登录成功，保存 token 和用户信息
      if (response.code === 200) {
        // 保存 token 到 localStorage
        localStorage.setItem('token', response.data.token);
        
        // 保存用户信息到 localStorage
        localStorage.setItem('userInfo', JSON.stringify(response.data.userInfo));
        
        // 显示成功提示
        ElMessage({
          type: 'success',
          message: '登录成功',
          duration: 2000
        });
        
        // 跳转到聊天页面
        setTimeout(() => {
          router.push('/chat');
        }, 1000);
      }
    } catch (error) {
      // 处理错误情况
      ElMessage({
        type: 'error',
        message: error.msg || '登录失败，请重试',
        duration: 3000,
        showClose: true
      });
    }
  }
};
</script>

<template>
  <div class="login-container">
    <div class="logo-outer-container">
      <img :src="aeaiLogo" alt="AEAI Logo" class="logo-image" />
      <div class="typewriter-container">
        <span class="typewriter-text">{{ typewriterText }}</span>
        <span class="cursor"></span>
      </div>
    </div>
    <div class="login-card">
      <h2>登录/注册</h2>
      <div class="form-group">
        <label for="phone">手机号</label>
        <div class="input-with-icon">
          <i class="fas fa-mobile-alt"></i>
          <input
            type="tel"
            id="phone"
            v-model="formData.phone"
            @blur="validatePhone"
            placeholder="请输入手机号"
            maxlength="11"
          />
        </div>
        <div class="error-message" v-if="formErrors.phone">{{ formErrors.phone }}</div>
      </div>

      <div class="form-group verification-code-group">
        <label for="verificationCode">验证码</label>
        <div class="verification-code-input">
          <div class="input-with-icon">
            <i class="fas fa-key"></i>
            <input
              type="text"
              id="verificationCode"
              v-model="formData.verificationCode"
              @blur="validateVerificationCode"
              placeholder="请输入验证码"
              maxlength="6"
            />
          </div>
          <button
            class="send-code-btn"
            @click="handleSendCode"
            :disabled="isSendingCode"
          >
            {{ isSendingCode ? `${countdown}秒后重发` : '发送验证码' }}
          </button>
        </div>
        <div class="error-message" v-if="formErrors.verificationCode">{{ formErrors.verificationCode }}</div>
      </div>

      <button class="login-btn" @click="submitForm">登录 / 注册</button>
    </div>
  </div>
</template>

<style scoped>
@keyframes fadeIn {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}

.login-container {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  height: 100%;
  background: linear-gradient(135deg, #f5f7fa 0%, #e4e8f0 100%);
  animation: fadeIn 0.6s ease-out;
}

.login-card {
  width: 100%;
  max-width: 380px;
  padding: 2.5rem;
  background-color: white;
  border-radius: 16px;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.08);
  transform: translateY(0);
  transition: transform 0.3s ease, box-shadow 0.3s ease;
  animation: fadeIn 0.8s ease-out;
}

.login-card:hover {
  transform: translateY(-5px);
  box-shadow: 0 15px 30px rgba(0, 0, 0, 0.12);
}

.logo-outer-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-bottom: 2rem;
  animation: fadeIn 0.8s ease-out;
}

.logo-image {
  width: 140px;
  height: auto;
  margin-bottom: 1rem;
}

.typewriter-container {
  display: flex;
  align-items: center;
  text-align: center;
  min-height: 1.5rem;
  position: relative;
  margin-bottom: 0.5rem;
  height: 2rem;
}

.typewriter-text {
  font-size: 2rem; /* 增大字体 */
  color: #000;
  font-weight: 800;
}

.cursor {
  display: inline-block;
  width: 1.5rem; /* 与 .typewriter-text 字体大小一致 */
  height: 1.5rem; /* 与 .typewriter-text 字体大小一致 */
  background-color: #000;
  border-radius: 50%;
  margin-left: 0.2em;
  justify-content: center;
  align-items: center;
  line-height: 1.5rem; /* 设置为与高度一致 */
}

h2 {
  text-align: center;
  margin-bottom: 2rem;
  color: #2d3748;
  font-size: 1.8rem;
  font-weight: 600;
  position: relative;
}

h2::after {
  content: '';
  position: absolute;
  bottom: -10px;
  left: 50%;
  width: 50px;
  height: 3px;
  background: linear-gradient(90deg, #646cff, #9089fc);
  transform: translateX(-50%);
  border-radius: 3px;
}

.form-group {
  margin-bottom: 1.8rem;
  position: relative;
}

label {
  display: block;
  margin-bottom: 0.6rem;
  font-weight: 500;
  color: #4a5568;
  font-size: 0.95rem;
  transition: color 0.3s;
}

input {
  width: 100%;
  padding: 0.9rem 1rem 0.9rem 2.8rem;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  font-size: 1rem;
  background-color: #f8fafc;
  transition: all 0.3s ease;
  box-sizing: border-box;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.02);
}

input:focus {
  outline: none;
  border-color: #646cff;
  background-color: #fff;
  box-shadow: 0 0 0 3px rgba(100, 108, 255, 0.15);
}

.input-with-icon {
  position: relative;
  width: 100%;
}

.input-with-icon i {
  position: absolute;
  left: 1rem;
  top: 50%;
  transform: translateY(-50%);
  font-size: 1.1rem;
  color: #a0aec0;
  pointer-events: none;
}

.verification-code-input {
  display: flex;
  gap: 0.8rem;
  width: 100%;
  max-width: 100%;
}

.verification-code-input .input-with-icon {
  flex: 1;
  max-width: 100%;
}

.send-code-btn {
  white-space: nowrap;
  padding: 0 1rem;
  background: linear-gradient(to right, #f0f4f9, #e6eaf0);
  color: #4a5568;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  cursor: pointer;
  font-weight: 500;
  transition: all 0.3s ease;
  min-width: 110px;
  max-width: 120px;
}

.send-code-btn:hover:not(:disabled) {
  background: linear-gradient(to right, #e6eaf0, #dde4ed);
  border-color: #cbd5e0;
}

.send-code-btn:disabled {
  opacity: 0.7;
  cursor: not-allowed;
  background: #f1f5f9;
}

.login-btn {
  width: 100%;
  padding: 0.9rem;
  background: linear-gradient(135deg, #646cff 0%, #5a51f9 100%);
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 1.05rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
  box-shadow: 0 4px 12px rgba(90, 81, 249, 0.2);
  position: relative;
  overflow: hidden;
}

.login-btn::before {
  content: '';
  position: absolute;
  top: 0;
  left: -100%;
  width: 100%;
  height: 100%;
  background: linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.2) 50%, rgba(255,255,255,0) 100%);
  transition: left 0.7s ease;
}

.login-btn:hover {
  background: linear-gradient(135deg, #5a51f9 0%, #4b44e3 100%);
  box-shadow: 0 6px 16px rgba(90, 81, 249, 0.3);
  transform: translateY(-2px);
}

.login-btn:hover::before {
  left: 100%;
}

.error-message {
  color: #e53e3e;
  font-size: 0.85rem;
  margin-top: 0.4rem;
  display: flex;
  align-items: center;
  animation: fadeIn 0.3s ease-out;
}

.error-message::before {
  content: '⚠️';
  margin-right: 0.4rem;
  font-size: 0.9rem;
}

@media (max-width: 480px) {
  .login-card {
    padding: 1.8rem;
    border-radius: 12px;
  }

  h2 {
    font-size: 1.6rem;
    margin-bottom: 2rem;
  }

  input, .login-btn {
    padding: 0.8rem;
    font-size: 0.95rem;
  }
}
</style>
