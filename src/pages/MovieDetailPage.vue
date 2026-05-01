<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import MovieCard from '../components/MovieCard.vue'
import { API_BASE, authHeaders, token, resolveMediaUrl } from '../auth'

const route = useRoute()
const movie = ref<any>(null)
const suggestions = ref<any[]>([])
const loading = ref(true)
const activeTab = ref('episodes')
const comments = ref<any[]>([])
const commentContent = ref('')
const commentMsg = ref('')
const ratingScore = ref(8)
const ratingMsg = ref('')

const tabs = [
  { id: 'episodes', label: 'Tập phim' },
  { id: 'overview', label: 'Tổng quan' },
  { id: 'cast', label: 'Diễn viên' },
  { id: 'suggest', label: 'Đề xuất' },
]

const genres = computed<string[]>(() => {
  if (!movie.value?.genres) return []
  return movie.value.genres.split(',').map((g: string) => g.trim()).filter(Boolean)
})

const actors = computed<string[]>(() => movie.value?.actors || [])

const posterSrc = computed(() => {
  const m = movie.value
  if (!m) return ''
  return resolveMediaUrl(m.thumbUrl || m.posterUrl) || `https://picsum.photos/seed/${m.slug}/300/450`
})

const backdropSrc = computed(() => {
  const m = movie.value
  if (!m) return ''
  return resolveMediaUrl(m.backdropUrl || m.posterUrl || m.thumbUrl) || `https://picsum.photos/seed/${m.slug}bg/1280/720`
})

const watchHref = computed(() => {
  if (!movie.value?.episodes?.length) return '#'
  if (movie.value.type === 'MOVIE') return `/phim/${movie.value.slug}/tap-full`
  const first = movie.value.episodes[0]
  return `/phim/${movie.value.slug}/tap-${first.episodeOrder}`
})

const epStatusLabel = computed(() => {
  const m = movie.value
  if (!m) return ''
  if (m.type === 'MOVIE') return 'Full'
  const eps = m.episodes?.length || 0
  return eps > 0 ? `Tập ${eps}/${m.totalEpisodes || eps}` : `${m.totalEpisodes || 0} tập`
})

const ratingStars = computed(() => {
  const s = Math.round((movie.value?.ratingAverage || movie.value?.imdbScore || 0) / 2)
  return '★'.repeat(Math.min(5, s)) + '☆'.repeat(Math.max(0, 5 - s))
})

const fetchMovie = async (slug: string) => {
  loading.value = true
  try {
    const res = await fetch(`${API_BASE}/movies/${slug}`)
    if (!res.ok) { loading.value = false; return }
    movie.value = await res.json()
    loadComments()
    loadSuggestions()
  } finally {
    loading.value = false
  }
}

const loadComments = async () => {
  if (!movie.value?.id) return
  const res = await fetch(`${API_BASE}/movies/${movie.value.id}/comments`)
  if (res.ok) comments.value = await res.json()
}

const loadSuggestions = async () => {
  const res = await fetch(`${API_BASE}/movies?genre=${encodeURIComponent(genres.value[0] || '')}`)
  if (!res.ok) return
  const all: any[] = await res.json()
  suggestions.value = all.filter(m => m.slug !== route.params.slug).slice(0, 12)
}

const submitComment = async () => {
  if (!token.value) { commentMsg.value = 'Vui lòng đăng nhập để bình luận'; return }
  if (!commentContent.value.trim()) return
  const res = await fetch(`${API_BASE}/movies/${movie.value.id}/comments`, {
    method: 'POST', headers: authHeaders(),
    body: JSON.stringify({ content: commentContent.value.trim() })
  })
  if (res.ok) { commentContent.value = ''; await loadComments() }
}

const submitRating = async () => {
  if (!token.value) { ratingMsg.value = 'Vui lòng đăng nhập để đánh giá'; return }
  const res = await fetch(`${API_BASE}/movies/${movie.value.id}/ratings`, {
    method: 'POST', headers: authHeaders(),
    body: JSON.stringify({ score: Number(ratingScore.value) })
  })
  if (res.ok) { ratingMsg.value = '✓ Đã gửi!'; fetchMovie(route.params.slug as string) }
}

const timeAgo = (iso: string) => {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (diff < 60) return `${diff}s trước`
  if (diff < 3600) return `${Math.floor(diff / 60)} phút trước`
  if (diff < 86400) return `${Math.floor(diff / 3600)} giờ trước`
  return `${Math.floor(diff / 86400)} ngày trước`
}

watch(() => route.params.slug, s => s && fetchMovie(s as string), { immediate: true })
</script>

<template>
  <div class="movie-detail" v-if="!loading && movie">
    <!-- ===== HERO BACKDROP ===== -->
    <div class="detail-hero">
      <div
        class="detail-backdrop"
        :style="{ backgroundImage: `url(${backdropSrc})` }"
      >
        <div class="detail-backdrop-overlay" />
      </div>

      <div class="container detail-hero-body">
        <div class="detail-hero-poster">
          <img :src="posterSrc" :alt="movie.titleVi" />
          <div class="poster-status">{{ epStatusLabel }}</div>
        </div>

        <div class="detail-hero-info">
          <h1 class="detail-title">{{ movie.titleVi }}</h1>
          <p class="detail-original">{{ movie.titleOriginal }}</p>

          <div class="detail-badges">
            <span v-if="movie.imdbScore" class="badge-imdb">{{ movie.imdbScore }}</span>
            <span v-if="movie.year" class="badge-meta">{{ movie.year }}</span>
            <span v-if="movie.quality" class="badge-meta">{{ movie.quality }}</span>
            <span v-if="movie.language" class="badge-meta badge-green">{{ movie.language }}</span>
            <span v-if="movie.totalEpisodes" class="badge-meta">
              {{ movie.type === 'MOVIE' ? 'Full' : `HT (${movie.episodes?.length || 0}/${movie.totalEpisodes})` }}
            </span>
            <span v-if="movie.country" class="badge-meta">{{ movie.country }}</span>
          </div>

          <div class="detail-genres">
            <router-link
              v-for="g in genres"
              :key="g"
              :to="{ path: '/', query: { genre: g } }"
              class="genre-tag-link"
            >{{ g }}</router-link>
          </div>

          <p class="detail-desc-short">{{ movie.description?.slice(0, 200) }}{{ (movie.description?.length || 0) > 200 ? '...' : '' }}</p>

          <div class="detail-actions">
            <router-link :to="watchHref" class="btn-watch-now">
              ▶ Xem ngay
            </router-link>
            <button class="btn-action">♡ Yêu thích</button>
            <button class="btn-action">+ Thêm vào</button>
          </div>
        </div>

        <div class="detail-hero-rating">
          <div class="rating-big">{{ movie.ratingAverage?.toFixed(1) || movie.imdbScore || '—' }}</div>
          <div class="rating-stars-sm">{{ ratingStars }}</div>
          <div class="rating-count-sm">{{ movie.ratingCount || 0 }} lượt</div>
        </div>
      </div>
    </div>

    <!-- ===== TABS ===== -->
    <div class="detail-tabs-bar">
      <div class="container">
        <div class="detail-tabs">
          <button
            v-for="tab in tabs"
            :key="tab.id"
            :class="['tab-btn', { active: activeTab === tab.id }]"
            @click="activeTab = tab.id"
          >{{ tab.label }}</button>
        </div>
      </div>
    </div>

    <!-- ===== CONTENT ===== -->
    <div class="container detail-content-wrap">
      <div class="detail-main-col">

        <!-- Tab: Tập phim -->
        <div v-if="activeTab === 'episodes'" class="tab-pane">
          <div v-if="movie.episodes?.length" class="ep-grid-wrap">
            <div class="ep-compact-toggle">
              <span>Rút gọn</span>
            </div>
            <div class="ep-grid">
              <router-link
                v-for="ep in movie.episodes"
                :key="ep.id"
                :to="movie.type === 'MOVIE' ? `/phim/${movie.slug}/tap-full` : `/phim/${movie.slug}/tap-${ep.episodeOrder}`"
                class="ep-grid-btn"
              >{{ movie.type === 'MOVIE' ? 'Full' : ep.episodeOrder }}</router-link>
            </div>
          </div>
          <p v-else class="no-data">Chưa có tập phim nào.</p>
        </div>

        <!-- Tab: Tổng quan -->
        <div v-else-if="activeTab === 'overview'" class="tab-pane">
          <p class="overview-desc">{{ movie.description }}</p>
        </div>

        <!-- Tab: Diễn viên -->
        <div v-else-if="activeTab === 'cast'" class="tab-pane">
          <div v-if="actors.length" class="cast-grid">
            <div v-for="actor in actors" :key="actor" class="cast-card">
              <div class="cast-avatar">{{ actor[0]?.toUpperCase() }}</div>
              <div class="cast-name">{{ actor }}</div>
            </div>
          </div>
          <p v-else class="no-data">Chưa có thông tin diễn viên.</p>
        </div>

        <!-- Tab: Đề xuất -->
        <div v-else-if="activeTab === 'suggest'" class="tab-pane">
          <div class="suggest-grid">
            <MovieCard v-for="m in suggestions" :key="m.id" :movie="m" />
          </div>
        </div>
      </div>

      <!-- ===== INFO PANEL (right) ===== -->
      <div class="detail-info-panel">
        <div class="info-panel-title">Thông tin phim</div>
        <table class="info-table">
          <tr><td>Trạng thái</td><td>{{ movie.episodes?.length >= movie.totalEpisodes ? 'Hoàn thành' : 'Đang chiếu' }}</td></tr>
          <tr><td>Số tập</td><td>{{ movie.type === 'MOVIE' ? 'Full' : `${movie.episodes?.length || 0}/${movie.totalEpisodes || '?'}` }}</td></tr>
          <tr><td>Chất lượng</td><td>{{ movie.quality || '—' }}</td></tr>
          <tr><td>Ngôn ngữ</td><td>{{ movie.language || '—' }}</td></tr>
          <tr><td>Năm</td><td>{{ movie.year || '—' }}</td></tr>
          <tr><td>Quốc gia</td><td>{{ movie.country || '—' }}</td></tr>
          <tr v-if="genres.length">
            <td>Thể loại</td>
            <td>
              <router-link
                v-for="g in genres"
                :key="g"
                :to="{ path: '/', query: { genre: g } }"
                class="genre-tag-sm"
              >{{ g }}</router-link>
            </td>
          </tr>
          <tr v-if="actors.length">
            <td>Diễn viên</td>
            <td>{{ actors.slice(0, 4).join(', ') }}{{ actors.length > 4 ? '...' : '' }}</td>
          </tr>
        </table>
      </div>
    </div>

    <!-- ===== COMMENTS ===== -->
    <div class="container detail-comments">
      <div class="section-divider">
        <h3>Bình luận ({{ comments.length }})</h3>
      </div>
      <div class="comment-form-wrap">
        <textarea
          v-model="commentContent"
          :placeholder="token ? 'Nhập bình luận của bạn...' : 'Đăng nhập để bình luận'"
          :disabled="!token"
          class="comment-textarea"
        />
        <div class="comment-form-row">
          <span v-if="commentMsg" class="comment-msg">{{ commentMsg }}</span>
          <button class="btn-submit-cmt" :disabled="!token" @click="submitComment">Gửi bình luận</button>
        </div>
      </div>

      <div v-if="!comments.length" class="no-data" style="margin:20px 0">Chưa có bình luận nào.</div>
      <div v-for="c in comments" :key="c.id" class="comment-item">
        <div class="comment-ava">{{ c.username?.[0]?.toUpperCase() || '?' }}</div>
        <div class="comment-body">
          <div class="comment-name">{{ c.username }}</div>
          <div class="comment-text">{{ c.content }}</div>
          <div class="comment-time">{{ timeAgo(c.createdAt) }}</div>
        </div>
      </div>

      <!-- Rating -->
      <div class="rating-section">
        <h4>Đánh giá phim</h4>
        <div class="rating-display-row">
          <div class="rating-big-num">{{ movie.ratingAverage?.toFixed(1) || '—' }}</div>
          <div>
            <div style="font-size:20px;color:#f5c518">{{ ratingStars }}</div>
            <div style="font-size:12px;color:var(--text3)">{{ movie.ratingCount || 0 }} lượt đánh giá</div>
          </div>
        </div>
        <div class="rating-form">
          <label>Điểm của bạn: <strong>{{ ratingScore }}</strong></label>
          <input type="range" min="1" max="10" v-model="ratingScore" class="rating-slider" />
          <button class="btn-rate" :disabled="!token" @click="submitRating">Gửi đánh giá</button>
          <p v-if="ratingMsg" class="rating-msg">{{ ratingMsg }}</p>
          <p v-if="!token" class="rating-msg" style="color:var(--text3)">
            <router-link to="/auth" style="color:var(--accent)">Đăng nhập</router-link> để đánh giá
          </p>
        </div>
      </div>
    </div>
  </div>

  <!-- Loading -->
  <div v-else-if="loading" class="loading-center">
    <div class="loading-spinner" />
    <p>Đang tải...</p>
  </div>

  <!-- Not found -->
  <div v-else class="loading-center">
    <p>Không tìm thấy phim.</p>
    <router-link to="/" class="btn-watch-now" style="margin-top:16px">← Trang chủ</router-link>
  </div>
</template>

<style scoped>
/* ===== HERO ===== */
.detail-hero {
  position: relative;
  margin-top: 64px;
  min-height: 420px;
  overflow: hidden;
}

.detail-backdrop {
  position: absolute;
  inset: 0;
  background-size: cover;
  background-position: center 20%;
}

.detail-backdrop-overlay {
  position: absolute;
  inset: 0;
  background:
    linear-gradient(to right, rgba(13,13,23,1) 0%, rgba(13,13,23,0.88) 45%, rgba(13,13,23,0.5) 100%),
    linear-gradient(to top, rgba(13,13,23,1) 0%, transparent 40%);
}

.detail-hero-body {
  position: relative;
  z-index: 2;
  display: flex;
  align-items: flex-end;
  gap: 32px;
  padding: 80px 20px 40px;
  min-height: 420px;
}

.detail-hero-poster {
  flex-shrink: 0;
  position: relative;
}
.detail-hero-poster img {
  width: 170px;
  border-radius: 10px;
  box-shadow: 0 8px 32px rgba(0,0,0,0.7);
  object-fit: cover;
  aspect-ratio: 2/3;
}
.poster-status {
  position: absolute;
  top: 8px; left: 8px;
  background: rgba(229,9,20,0.9);
  color: #fff;
  font-size: 11px;
  font-weight: 600;
  padding: 3px 8px;
  border-radius: 4px;
}

.detail-hero-info {
  flex: 1;
  min-width: 0;
}

.detail-title {
  font-size: clamp(22px, 3.5vw, 38px);
  font-weight: 800;
  line-height: 1.2;
  margin-bottom: 6px;
  text-shadow: 0 2px 12px rgba(0,0,0,0.5);
}
.detail-original {
  font-size: 15px;
  color: #94a3b8;
  margin-bottom: 14px;
}

.detail-badges {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 12px;
}
.badge-imdb {
  background: #f5c518;
  color: #000;
  font-weight: 700;
  font-size: 13px;
  padding: 3px 10px;
  border-radius: 4px;
}
.badge-meta {
  background: rgba(255,255,255,0.1);
  border: 1px solid rgba(255,255,255,0.15);
  color: #e2e8f0;
  font-size: 12px;
  padding: 3px 10px;
  border-radius: 4px;
  font-weight: 500;
}
.badge-green { background: rgba(34,197,94,0.15); border-color: rgba(34,197,94,0.3); color: #4ade80; }

.detail-genres {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 14px;
}
.genre-tag-link {
  padding: 4px 14px;
  border: 1px solid rgba(255,255,255,0.2);
  border-radius: 999px;
  font-size: 12px;
  color: #cbd5e1;
  text-decoration: none;
  transition: background 0.2s;
}
.genre-tag-link:hover { background: rgba(255,255,255,0.1); color: #fff; }

.detail-desc-short {
  font-size: 14px;
  line-height: 1.6;
  color: #94a3b8;
  margin-bottom: 20px;
  max-width: 600px;
}

.detail-actions {
  display: flex;
  gap: 10px;
  align-items: center;
  flex-wrap: wrap;
}
.btn-watch-now {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 12px 28px;
  background: #e50914;
  color: #fff;
  border-radius: 8px;
  font-weight: 700;
  font-size: 15px;
  text-decoration: none;
  border: none;
  cursor: pointer;
  transition: background 0.2s;
}
.btn-watch-now:hover { background: #c0070e; }
.btn-action {
  padding: 10px 18px;
  background: rgba(255,255,255,0.08);
  border: 1px solid rgba(255,255,255,0.15);
  color: #e2e8f0;
  border-radius: 8px;
  font-size: 14px;
  cursor: pointer;
  transition: background 0.2s;
}
.btn-action:hover { background: rgba(255,255,255,0.14); }

.detail-hero-rating {
  text-align: center;
  flex-shrink: 0;
}
.rating-big {
  font-size: 40px;
  font-weight: 800;
  color: #f5c518;
  line-height: 1;
}
.rating-stars-sm { font-size: 14px; color: #f5c518; margin: 4px 0; }
.rating-count-sm { font-size: 12px; color: #64748b; }

/* ===== TABS ===== */
.detail-tabs-bar {
  background: #13131f;
  border-bottom: 1px solid #2d2d45;
  position: sticky;
  top: 64px;
  z-index: 100;
}
.detail-tabs {
  display: flex;
  gap: 4px;
}
.tab-btn {
  padding: 14px 20px;
  background: none;
  border: none;
  border-bottom: 3px solid transparent;
  color: #64748b;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: color 0.2s;
}
.tab-btn:hover { color: #e2e8f0; }
.tab-btn.active { color: #e50914; border-bottom-color: #e50914; }

/* ===== CONTENT LAYOUT ===== */
.detail-content-wrap {
  display: grid;
  grid-template-columns: 1fr 280px;
  gap: 32px;
  padding-top: 24px;
  padding-bottom: 32px;
}
@media (max-width: 900px) {
  .detail-content-wrap { grid-template-columns: 1fr; }
  .detail-info-panel { order: -1; }
}

.tab-pane { min-height: 200px; }

/* Episode grid */
.ep-compact-toggle {
  display: flex;
  justify-content: flex-end;
  margin-bottom: 12px;
}
.ep-compact-toggle span {
  font-size: 12px;
  color: #64748b;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 4px;
}
.ep-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(52px, 1fr));
  gap: 8px;
}
.ep-grid-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 46px;
  background: #1a1a2e;
  border: 1px solid #2d2d45;
  border-radius: 8px;
  color: #e2e8f0;
  font-size: 14px;
  font-weight: 600;
  text-decoration: none;
  transition: all 0.15s;
}
.ep-grid-btn:hover {
  background: #e50914;
  border-color: #e50914;
  color: #fff;
}
.ep-grid-btn.router-link-active {
  background: #e50914;
  border-color: #e50914;
  color: #fff;
}

/* Overview */
.overview-desc {
  line-height: 1.8;
  color: #94a3b8;
  font-size: 15px;
}

/* Cast */
.cast-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
  gap: 16px;
}
.cast-card {
  text-align: center;
  cursor: pointer;
}
.cast-avatar {
  width: 70px;
  height: 70px;
  border-radius: 50%;
  background: linear-gradient(135deg, #e50914, #7c1c1c);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 26px;
  font-weight: 700;
  color: #fff;
  margin: 0 auto 8px;
}
.cast-name {
  font-size: 12px;
  font-weight: 600;
  color: #e2e8f0;
  text-align: center;
  line-height: 1.3;
}

/* Suggestions */
.suggest-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}

/* Info panel */
.detail-info-panel {
  background: #13131f;
  border: 1px solid #2d2d45;
  border-radius: 12px;
  padding: 20px;
  height: fit-content;
  position: sticky;
  top: 120px;
}
.info-panel-title {
  font-size: 15px;
  font-weight: 700;
  color: #e2e8f0;
  margin-bottom: 14px;
  padding-bottom: 10px;
  border-bottom: 1px solid #2d2d45;
}
.info-table {
  width: 100%;
  border-collapse: collapse;
}
.info-table td {
  padding: 8px 0;
  font-size: 13px;
  border-bottom: 1px solid rgba(255,255,255,0.04);
  vertical-align: top;
}
.info-table td:first-child {
  color: #64748b;
  width: 90px;
  flex-shrink: 0;
  font-weight: 500;
}
.info-table td:last-child {
  color: #e2e8f0;
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}
.genre-tag-sm {
  padding: 2px 8px;
  background: rgba(229,9,20,0.1);
  border: 1px solid rgba(229,9,20,0.25);
  color: #f87171;
  border-radius: 4px;
  font-size: 11px;
  text-decoration: none;
  margin-right: 4px;
}
.genre-tag-sm:hover { background: rgba(229,9,20,0.2); }

/* Comments */
.detail-comments {
  padding-top: 24px;
  padding-bottom: 48px;
}
.section-divider h3 {
  font-size: 18px;
  font-weight: 700;
  color: #e2e8f0;
  padding-bottom: 12px;
  border-bottom: 2px solid #2d2d45;
  margin-bottom: 20px;
}
.comment-textarea {
  width: 100%;
  background: #13131f;
  border: 1px solid #2d2d45;
  border-radius: 8px;
  padding: 12px;
  color: #e2e8f0;
  font-size: 14px;
  resize: vertical;
  min-height: 80px;
}
.comment-form-row {
  display: flex;
  justify-content: flex-end;
  margin-top: 8px;
}
.btn-submit-cmt {
  padding: 8px 20px;
  background: #e50914;
  color: #fff;
  border: none;
  border-radius: 6px;
  font-weight: 600;
  cursor: pointer;
}
.btn-submit-cmt:disabled { opacity: 0.5; cursor: not-allowed; }
.comment-item {
  display: flex;
  gap: 12px;
  padding: 14px 0;
  border-bottom: 1px solid rgba(255,255,255,0.05);
}
.comment-ava {
  width: 36px; height: 36px;
  border-radius: 50%;
  background: linear-gradient(135deg, #e50914, #7c1c1c);
  display: flex; align-items: center; justify-content: center;
  font-weight: 700; font-size: 14px; color: #fff;
  flex-shrink: 0;
}
.comment-body { flex: 1; }
.comment-name { font-size: 13px; font-weight: 600; color: #e2e8f0; margin-bottom: 4px; }
.comment-text { font-size: 14px; color: #94a3b8; line-height: 1.5; }
.comment-time { font-size: 11px; color: #64748b; margin-top: 4px; }
.comment-msg { font-size: 12px; color: #e50914; }

/* Rating section */
.rating-section {
  background: #13131f;
  border: 1px solid #2d2d45;
  border-radius: 12px;
  padding: 24px;
  margin-top: 32px;
}
.rating-section h4 { font-size: 16px; font-weight: 700; margin-bottom: 16px; }
.rating-display-row {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 20px;
}
.rating-big-num {
  font-size: 52px;
  font-weight: 800;
  color: #f5c518;
  line-height: 1;
}
.rating-form label { font-size: 14px; color: #94a3b8; display: block; margin-bottom: 8px; }
.rating-slider { width: 200px; accent-color: #e50914; }
.btn-rate {
  display: block;
  margin-top: 12px;
  padding: 8px 24px;
  background: #e50914;
  color: #fff;
  border: none;
  border-radius: 6px;
  font-weight: 600;
  cursor: pointer;
}
.btn-rate:disabled { opacity: 0.5; cursor: not-allowed; }
.rating-msg { font-size: 13px; color: #22c55e; margin-top: 6px; }

/* Misc */
.no-data { color: #64748b; font-size: 14px; text-align: center; padding: 40px 0; }
.loading-center {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 60vh;
  gap: 16px;
  color: #64748b;
  margin-top: 64px;
}
.loading-spinner {
  width: 40px; height: 40px;
  border: 3px solid #2d2d45;
  border-top-color: #e50914;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }
</style>
