<script setup lang="ts">
import { onMounted, ref, computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import HeroSlider from '../components/HeroSlider.vue'
import MovieCard from '../components/MovieCard.vue'
import MovieRow from '../components/MovieRow.vue'
import { API_BASE } from '../auth'

const route = useRoute()
const router = useRouter()
const allMovies = ref<any[]>([])
const allGenres = ref<string[]>([])
const loading = ref(false)

const colorPalette = ['#0f766e', '#7c3aed', '#9f1239', '#1e40af', '#92400e', '#065f46', '#854d0e', '#991b1b', '#0369a1', '#9d174d', '#164e63']
const iconPalette = ['🎬', '🔥', '✨', '🎭', '🚀', '💥', '🔮', '🎵', '👻', '❤️', '🧭']

const genreCards = computed(() =>
  allGenres.value.map((name, idx) => ({
    name,
    color: colorPalette[idx % colorPalette.length],
    icon: iconPalette[idx % iconPalette.length]
  }))
)

const fetchMovies = async (q?: string, type?: string, genre?: string) => {
  loading.value = true
  const params = new URLSearchParams()
  if (q) params.set('q', q)
  if (type) params.set('type', type)
  if (genre) params.set('genre', genre)
  const res = await fetch(`${API_BASE}/movies?${params}`)
  allMovies.value = await res.json()
  loading.value = false
}

const fetchGenres = async () => {
  const res = await fetch(`${API_BASE}/movies/genres`)
  if (!res.ok) return
  allGenres.value = await res.json()
}

const heroMovies = computed(() => allMovies.value.slice(0, 5))
const newMovies = computed(() => allMovies.value.slice(0, 8))
const seriesMovies = computed(() => allMovies.value.filter(m => m.type === 'SERIES'))
const singleMovies = computed(() => allMovies.value.filter(m => m.type === 'MOVIE'))
const isSearching = computed(() => !!(route.query.q || route.query.type || route.query.genre))
const pageTitle = computed(() => {
  if (route.query.q) return `Kết quả tìm: "${route.query.q}"`
  if (route.query.type === 'SERIES') return 'Phim bộ'
  if (route.query.type === 'MOVIE') return 'Phim lẻ'
  if (route.query.genre) return `Thể loại: ${route.query.genre}`
  return ''
})

watch(() => route.query, (q) => {
  fetchMovies(q.q as string, q.type as string, q.genre as string)
}, { immediate: true })

const goGenre = (name: string) => {
  router.push({ path: '/', query: { genre: name } })
}

onMounted(fetchGenres)
</script>

<template>
  <div>
    <!-- Hero chỉ hiển thị khi không tìm kiếm -->
    <HeroSlider v-if="!isSearching" :movies="heroMovies" />

    <div style="padding-top: 64px" v-if="isSearching" />

    <!-- Kết quả tìm kiếm / lọc -->
    <div v-if="isSearching">
      <div class="container">
        <section class="section">
          <div class="section-header">
            <h2 class="section-title">{{ pageTitle }}</h2>
            <router-link to="/" class="section-link">← Trang chủ</router-link>
          </div>
          <p v-if="loading" style="color: var(--text3)">Đang tải...</p>
          <p v-else-if="allMovies.length === 0" style="color: var(--text3)">Không tìm thấy phim phù hợp.</p>
          <div v-else class="movie-row">
            <div class="movie-row-inner" style="flex-wrap: wrap; min-width: unset">
              <MovieCard v-for="m in allMovies" :key="m.id" :movie="m" />
            </div>
          </div>
        </section>
      </div>
    </div>

    <!-- Trang chủ bình thường -->
    <template v-else>
      <!-- Genre grid -->
      <div class="container">
        <section class="section">
          <div class="section-header">
            <h2 class="section-title">Bạn đang quan tâm gì?</h2>
          </div>
          <div class="genre-grid">
            <button
              v-for="g in genreCards"
              :key="g.name"
              class="genre-card"
              :style="{ background: `linear-gradient(135deg, ${g.color}, ${g.color}99)` }"
              @click="goGenre(g.name)"
            >
              <span class="icon">{{ g.icon }}</span>
              <span>{{ g.name }}</span>
            </button>
          </div>
        </section>
      </div>

      <!-- Phim mới -->
      <MovieRow title="Phim mới cập nhật" :movies="newMovies" />
      <MovieRow title="Phim bộ đang chiếu" :movies="seriesMovies" link="/?type=SERIES" />
      <MovieRow title="Phim lẻ hay nhất" :movies="singleMovies" link="/?type=MOVIE" />
    </template>
  </div>
</template>
