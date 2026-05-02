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
const newMovies = computed(() => allMovies.value.slice(0, 12))
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

onMounted(fetchGenres)
</script>

<template>
  <div>
    <!-- ===== HERO SLIDER (full-width) ===== -->
    <HeroSlider v-if="!isSearching" :movies="heroMovies" />
    <div style="padding-top: 64px" v-if="isSearching" />

    <!-- ===== GENRE PILLS BAR ===== -->
    <div v-if="!isSearching && allGenres.length" class="genre-pills-section">
      <div class="container">
        <div class="genre-pills-wrap">
          <span class="genre-pills-label">Thể loại:</span>
          <div class="genre-pills-scroll">
            <button
              v-for="g in allGenres"
              :key="g"
              class="genre-pill-btn"
              @click="router.push({ path: '/', query: { genre: g } })"
            >{{ g }}</button>
          </div>
        </div>
      </div>
    </div>

    <!-- ===== SEARCH/FILTER RESULTS ===== -->
    <div v-if="isSearching">
      <div class="container">
        <section class="section">
          <div class="section-header">
            <h2 class="section-title">{{ pageTitle }}</h2>
            <router-link to="/" class="section-link">← Trang chủ</router-link>
          </div>
          <p v-if="loading" style="color: var(--text3)">Đang tải...</p>
          <p v-else-if="allMovies.length === 0" style="color: var(--text3)">Không tìm thấy phim phù hợp.</p>
          <div v-else class="search-results-grid">
            <MovieCard v-for="m in allMovies" :key="m.id" :movie="m" />
          </div>
        </section>
      </div>
    </div>

    <!-- ===== HOMEPAGE MOVIE ROWS ===== -->
    <template v-else>
      <!-- Phim mới cập nhật -->
      <MovieRow title="Phim mới cập nhật" :movies="newMovies" />

      <!-- Genre spotlight: show 2 rows for first 2 genres if available -->
      <template v-if="allGenres.length > 0">
        <MovieRow
          v-for="g in allGenres.slice(0, 3)"
          :key="g"
          :title="g"
          :movies="allMovies.filter(m => m.genres && m.genres.toLowerCase().includes(g.toLowerCase())).slice(0, 10)"
          :link="`/?genre=${encodeURIComponent(g)}`"
        />
      </template>

      <!-- Phim bộ -->
      <MovieRow
        v-if="seriesMovies.length"
        title="Phim bộ đang chiếu"
        :movies="seriesMovies"
        link="/?type=SERIES"
      />

      <!-- Phim lẻ -->
      <MovieRow
        v-if="singleMovies.length"
        title="Phim lẻ hay nhất"
        :movies="singleMovies"
        link="/?type=MOVIE"
      />
    </template>
  </div>
</template>

<style scoped>
/* Genre pills bar (below hero, slim horizontal strip) */
.genre-pills-section {
  background: var(--bg);
  border-bottom: 1px solid #1e1e33;
  padding: 10px 0;
  position: sticky;
  top: 64px;
  z-index: 90;
}

.genre-pills-wrap {
  display: flex;
  align-items: center;
  gap: 12px;
}

.genre-pills-label {
  font-size: 13px;
  font-weight: 600;
  color: #64748b;
  white-space: nowrap;
  flex-shrink: 0;
}

.genre-pills-scroll {
  display: flex;
  gap: 6px;
  overflow-x: auto;
  padding: 2px 0;
  scrollbar-width: none;
  -ms-overflow-style: none;
}
.genre-pills-scroll::-webkit-scrollbar { display: none; }

.genre-pill-btn {
  padding: 5px 14px;
  background: var(--bg2);
  border: 1px solid #2d2d45;
  border-radius: 999px;
  color: #94a3b8;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.2s;
  flex-shrink: 0;
}
.genre-pill-btn:hover {
  background: #e50914;
  border-color: #e50914;
  color: #fff;
}

/* Search results */
.search-results-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 14px;
  padding: 4px 0;
}
</style>
