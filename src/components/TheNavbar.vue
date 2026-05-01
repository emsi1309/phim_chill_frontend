<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { API_BASE, currentUser, clearAuth } from '../auth'
import logoNoBg from '../assets/logo-no-bg.png'

const router = useRouter()
const query = ref('')
const genres = ref<string[]>([])

const search = () => {
  const q = query.value.trim()
  if (q) {
    router.push({ path: '/', query: { q } })
    query.value = ''
  }
}

const logout = () => {
  clearAuth()
  router.push('/')
}

const loadGenres = async () => {
  const res = await fetch(`${API_BASE}/movies/genres`)
  if (!res.ok) return
  const data = await res.json()
  genres.value = Array.isArray(data) ? data.slice(0, 2) : []
}

onMounted(loadGenres)
</script>

<template>
  <header class="navbar">
    <div class="nav-inner">
      <router-link to="/" class="logo">
        <img :src="logoNoBg" alt="PhimChill" class="logo-image" />
        <span>PhimChill</span>
      </router-link>

      <nav class="nav-links">
        <router-link to="/">Trang chủ</router-link>
        <router-link to="/?type=SERIES">Phim bộ</router-link>
        <router-link to="/?type=MOVIE">Phim lẻ</router-link>
        <router-link v-for="genre in genres" :key="genre" :to="{ path: '/', query: { genre } }">{{ genre }}</router-link>
      </nav>

      <div class="nav-search">
        <input
          v-model="query"
          placeholder="Tìm kiếm phim, diễn viên..."
          @keyup.enter="search"
        />
        <button class="search-btn" @click="search">🔍</button>
      </div>

      <div class="nav-auth">
        <template v-if="currentUser">
          <span class="btn-user">👤 {{ currentUser }}</span>
          <button class="btn-logout" @click="logout">Đăng xuất</button>
        </template>
        <router-link v-else to="/auth" class="btn-login">Thành viên</router-link>
      </div>
    </div>
  </header>
</template>
