<script setup>
import { useRouter } from 'vue-router';

const router = useRouter();

const navigateToChat = () => {
  router.push('/chat');
};

const navigateToLogin = () => {
  router.push('/login');
};
</script>

<template>
  <div class="app-container">
    <main class="app-main">
      <router-view />
    </main>
  </div>
</template>

<style scoped>
.app-container {
  display: flex;
  flex-direction: column;
  height: 100vh;
  width: 100%;
}

.app-main {
  flex: 1;
  overflow: hidden;
  padding: 0;
}
</style>
