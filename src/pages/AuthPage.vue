<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { API_BASE, saveAuth } from '../auth'

const mode = ref<'login' | 'register'>('login')
const username = ref('')
const email = ref('')
const password = ref('')
const message = ref('')
const msgType = ref<'error' | 'success'>('error')
const loading = ref(false)

const router = useRouter()

const submit = async () => {
  loading.value = true
  message.value = ''
  const endpoint = mode.value === 'login' ? '/auth/login' : '/auth/register'
  const payload = mode.value === 'login'
    ? { username: username.value, password: password.value }
    : { username: username.value, email: email.value, password: password.value }

  const res = await fetch(`${API_BASE}${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  })
  const data = await res.json()
  loading.value = false

  if (!res.ok) {
    message.value = data.message || 'Có lỗi xảy ra'
    msgType.value = 'error'
    return
  }
  saveAuth(data.token, data.username)
  msgType.value = 'success'
  message.value = mode.value === 'login' ? 'Đăng nhập thành công!' : 'Đăng ký thành công!'
  setTimeout(() => router.push('/'), 800)
}

const switchMode = (m: 'login' | 'register') => {
  mode.value = m
  message.value = ''
}
</script>

<template>
  <div class="auth-page">
    <div class="auth-card">
      <!-- Logo -->
      <div class="auth-logo">
        <div class="logo-icon">▶</div>
        <span>PhimChill</span>
      </div>

      <!-- Tabs -->
      <div class="auth-tabs">
        <button :class="{ active: mode === 'login' }" @click="switchMode('login')">Đăng nhập</button>
        <button :class="{ active: mode === 'register' }" @click="switchMode('register')">Đăng ký</button>
      </div>

      <!-- Form -->
      <form class="auth-form" @submit.prevent="submit">
        <div class="field">
          <label>Tên đăng nhập</label>
          <input v-model="username" placeholder="Nhập username" autocomplete="username" required />
        </div>

        <div v-if="mode === 'register'" class="field">
          <label>Email</label>
          <input v-model="email" type="email" placeholder="Nhập email" autocomplete="email" required />
        </div>

        <div class="field">
          <label>Mật khẩu</label>
          <input
            v-model="password"
            type="password"
            placeholder="Nhập mật khẩu"
            :autocomplete="mode === 'login' ? 'current-password' : 'new-password'"
            required
          />
        </div>

        <button type="submit" class="btn-auth-submit" :disabled="loading">
          <span v-if="loading">Đang xử lý...</span>
          <span v-else>{{ mode === 'login' ? 'Đăng nhập' : 'Tạo tài khoản' }}</span>
        </button>

        <div v-if="message" class="auth-message" :class="msgType">{{ message }}</div>
      </form>

      <p style="text-align:center;font-size:13px;color:var(--text3);margin-top:20px">
        <router-link to="/" style="color:var(--text3)">← Quay về trang chủ</router-link>
      </p>
    </div>
  </div>
</template>
