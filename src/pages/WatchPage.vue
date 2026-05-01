<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import MovieCard from '../components/MovieCard.vue'
import { API_BASE, authHeaders, currentUser, token, resolveMediaUrl } from '../auth'

const route = useRoute()
const router = useRouter()

const detail = reactive<any>({ episodes: [] })
const comments = ref<any[]>([])
const suggestions = ref<any[]>([])
const reactions = reactive<Record<string, number>>({
  FIRE: 0, LOVE: 0, FUNNY: 0, WOW: 0, SAD: 0, POO: 0
})
const selectedEpisode = ref<any>(null)
const selectedServer = ref<any>(null)
const commentContent = ref('')
const ratingScore = ref(8)
const ratingMsg = ref('')
const commentMsg = ref('')
const myReaction = ref('')

const REACTION_CONFIG = [
  { type: 'FIRE',  emoji: '🔥', label: 'Hấp dẫn' },
  { type: 'LOVE',  emoji: '❤️', label: 'Yêu thích' },
  { type: 'FUNNY', emoji: '😂', label: 'Vui nhộn' },
  { type: 'WOW',   emoji: '😮', label: 'Thú vị' },
  { type: 'SAD',   emoji: '😢', label: 'Buồn' },
  { type: 'POO',   emoji: '💩', label: 'Tệ' },
]

const streamUrl = computed(() => selectedServer.value?.streamUrl || '')

const genreList = (s: string) => s ? s.split(',').map(g => g.trim()) : []

const ratingStars = computed(() => {
  const s = Math.round((detail.ratingAverage || 0) / 2)
  return '★'.repeat(s) + '☆'.repeat(5 - s)
})

const selectEpisode = (ep: any) => {
  selectedEpisode.value = ep
  selectedServer.value = ep.streams?.[0] || null
}

const loadDetail = async () => {
  const res = await fetch(`${API_BASE}/movies/${route.params.slug}`)
  if (!res.ok) return
  const data = await res.json()
  Object.assign(detail, data)
  selectEpisode(data.episodes?.[0])
  await Promise.all([loadComments(), loadReactions(), loadSuggestions()])
}

const loadComments = async () => {
  if (!detail.id) return
  const res = await fetch(`${API_BASE}/movies/${detail.id}/comments`)
  comments.value = await res.json()
}

const loadReactions = async () => {
  if (!detail.id) return
  const res = await fetch(`${API_BASE}/movies/${detail.id}/reactions`)
  const data: Record<string, number> = await res.json()
  Object.assign(reactions, { FIRE: 0, LOVE: 0, FUNNY: 0, WOW: 0, SAD: 0, POO: 0 }, data)
}

const loadSuggestions = async () => {
  const res = await fetch(`${API_BASE}/movies`)
  const all: any[] = await res.json()
  suggestions.value = all.filter(m => m.slug !== route.params.slug).slice(0, 8)
}

const react = async (type: string) => {
  if (!detail.id) return
  const sid = localStorage.getItem('username') || 'anon-' + Math.random().toString(36).slice(2)
  const res = await fetch(`${API_BASE}/movies/${detail.id}/reactions/${type}?sessionId=${sid}`, {
    method: 'POST'
  })
  const data: Record<string, number> = await res.json()
  Object.assign(reactions, { FIRE: 0, LOVE: 0, FUNNY: 0, WOW: 0, SAD: 0, POO: 0 }, data)
  myReaction.value = type
}

const submitComment = async () => {
  if (!token.value) { commentMsg.value = 'Vui lòng đăng nhập để bình luận'; return }
  if (!commentContent.value.trim()) return
  const res = await fetch(`${API_BASE}/movies/${detail.id}/comments`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ content: commentContent.value.trim() })
  })
  if (res.ok) {
    commentContent.value = ''
    commentMsg.value = ''
    await loadComments()
  }
}

const submitRating = async () => {
  if (!token.value) { ratingMsg.value = 'Vui lòng đăng nhập để đánh giá'; return }
  const res = await fetch(`${API_BASE}/movies/${detail.id}/ratings`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ score: Number(ratingScore.value) })
  })
  if (res.ok) {
    ratingMsg.value = '✓ Đã gửi đánh giá!'
    await loadDetail()
  }
}

const timeAgo = (iso: string) => {
  const d = new Date(iso)
  const diff = Math.floor((Date.now() - d.getTime()) / 1000)
  if (diff < 60) return `${diff}s trước`
  if (diff < 3600) return `${Math.floor(diff/60)} phút trước`
  if (diff < 86400) return `${Math.floor(diff/3600)} giờ trước`
  return `${Math.floor(diff/86400)} ngày trước`
}

watch(() => route.params.slug, loadDetail, { immediate: true })
</script>

<template>
  <div class="watch-page">
    <div class="container">
      <!-- Breadcrumb -->
      <div class="breadcrumb">
        <router-link to="/">Trang chủ</router-link>
        <span> / </span>
        <span>{{ detail.titleVi }}</span>
      </div>

      <!-- Layout chính -->
      <div class="watch-layout">
        <!-- Cột trái: Player + Info -->
        <div>
          <!-- Player -->
          <div class="player-box">
            <iframe
              v-if="streamUrl"
              :src="streamUrl"
              allow="autoplay; encrypted-media; fullscreen"
              allowfullscreen
            />
            <div v-else style="aspect-ratio:16/9;display:flex;align-items:center;justify-content:center;color:var(--text3)">
              Chọn tập để xem
            </div>
          </div>

          <!-- Server + Tập -->
          <div class="player-controls">
            <div class="server-row">
              <label>Nguồn phát:</label>
              <button
                v-for="srv in (selectedEpisode?.streams || [])"
                :key="srv.id"
                class="server-btn"
                :class="{ active: selectedServer?.id === srv.id }"
                @click="selectedServer = srv"
              >{{ srv.serverName }}</button>
            </div>
            <div class="episode-row" v-if="detail.episodes?.length > 1">
              <label>Tập:</label>
              <div class="episode-list">
                <button
                  v-for="ep in detail.episodes"
                  :key="ep.id"
                  class="ep-btn"
                  :class="{ active: selectedEpisode?.id === ep.id }"
                  @click="selectEpisode(ep)"
                >{{ ep.name }}</button>
              </div>
            </div>
          </div>

          <!-- Info phim -->
          <div class="movie-info-box">
            <h1 class="movie-title-main">{{ detail.titleVi }}</h1>
            <p class="movie-original">{{ detail.titleOriginal }}</p>
            <div class="info-badges">
              <span v-if="detail.imdbScore" class="badge badge-imdb">⭐ IMDb {{ detail.imdbScore }}</span>
              <span v-if="detail.quality" class="badge badge-quality">{{ detail.quality }}</span>
              <span v-if="detail.language" class="badge badge-lang">{{ detail.language }}</span>
              <span v-if="detail.year" class="badge badge-year">{{ detail.year }}</span>
              <span v-if="detail.type === 'SERIES' && detail.totalEpisodes" class="badge badge-ep">{{ detail.totalEpisodes }} tập</span>
              <span v-if="detail.type === 'MOVIE'" class="badge badge-ep">Full</span>
              <span v-if="detail.country" class="badge badge-quality">{{ detail.country }}</span>
            </div>
            <div v-if="detail.genres" style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px">
              <span
                v-for="g in genreList(detail.genres)"
                :key="g"
                class="hero-genre-tag"
              >{{ g }}</span>
            </div>
            <p class="movie-desc">{{ detail.description }}</p>
          </div>

          <!-- Reactions -->
          <div class="reactions-box">
            <h4>Cảm xúc của bạn</h4>
            <div class="reactions-row">
              <button
                v-for="r in REACTION_CONFIG"
                :key="r.type"
                class="reaction-btn"
                :class="{ reacted: myReaction === r.type }"
                @click="react(r.type)"
              >
                <span class="emoji">{{ r.emoji }}</span>
                <span class="count">{{ reactions[r.type] || 0 }}</span>
                <span class="label">{{ r.label }}</span>
              </button>
            </div>
          </div>

          <!-- Đánh giá -->
          <div class="rating-box">
            <h4>Đánh giá phim</h4>
            <div class="rating-display">
              <div class="rating-score">{{ detail.ratingAverage || 0 }}</div>
              <div class="rating-info">
                <div class="rating-stars">{{ ratingStars }}</div>
                <div>{{ detail.ratingCount || 0 }} lượt đánh giá</div>
              </div>
            </div>
            <div class="rating-form">
              <label>Điểm của bạn:</label>
              <input type="range" min="1" max="10" v-model="ratingScore" />
              <span class="score-display">{{ ratingScore }}</span>
              <button
                class="btn-submit"
                :disabled="!token"
                @click="submitRating"
              >Gửi</button>
            </div>
            <p v-if="ratingMsg" style="font-size:13px;color:var(--green);margin-top:6px">{{ ratingMsg }}</p>
          </div>

          <!-- Bình luận -->
          <div class="comments-box">
            <h4>Bình luận ({{ comments.length }})</h4>
            <div class="comment-form">
              <textarea
                v-model="commentContent"
                :placeholder="token ? 'Nhập bình luận của bạn...' : 'Đăng nhập để bình luận'"
                :disabled="!token"
              />
              <div class="form-row">
                <span v-if="commentMsg" style="font-size:12px;color:var(--accent);margin-right:auto">{{ commentMsg }}</span>
                <button class="btn-submit" :disabled="!token" @click="submitComment">Gửi bình luận</button>
              </div>
            </div>

            <div v-if="comments.length === 0" style="text-align:center;padding:20px;color:var(--text3)">
              Chưa có bình luận nào. Hãy là người đầu tiên!
            </div>

            <div v-for="c in comments" :key="c.id" class="comment-item">
              <div class="comment-avatar">{{ c.username?.[0]?.toUpperCase() || '?' }}</div>
              <div class="comment-body">
                <div class="name">{{ c.username }}</div>
                <div class="text">{{ c.content }}</div>
                <div class="time">{{ timeAgo(c.createdAt) }}</div>
              </div>
            </div>
          </div>
        </div>

        <!-- Sidebar: Đề xuất -->
        <aside class="watch-sidebar">
          <div class="sidebar-title">Đề xuất cho bạn</div>
          <div
            v-for="m in suggestions"
            :key="m.id"
            class="sidebar-movie"
            @click="router.push('/watch/' + m.slug)"
          >
            <img
              :src="resolveMediaUrl(m.thumbUrl || m.posterUrl) || 'https://picsum.photos/seed/' + m.slug + '/120/180'"
              :alt="m.titleVi"
            />
            <div class="sidebar-info">
              <div class="title">{{ m.titleVi }}</div>
              <div class="meta">
                {{ m.year }}
                <span v-if="m.imdbScore"> · ⭐ {{ m.imdbScore }}</span>
                <span v-if="m.type === 'MOVIE'"> · Full</span>
                <span v-else-if="m.totalEpisodes"> · {{ m.totalEpisodes }} tập</span>
              </div>
              <div class="meta" style="margin-top:3px">
                <span v-if="m.quality" class="card-badge card-badge-q" style="font-size:9px">{{ m.quality }}</span>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  </div>
</template>
