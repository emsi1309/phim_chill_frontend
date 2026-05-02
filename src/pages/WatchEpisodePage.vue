<script setup lang="ts">
import { computed, nextTick, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import VideoPlayer from '../components/VideoPlayer.vue'
import { API_BASE, authHeaders, token, resolveMediaUrl } from '../auth'

const route = useRoute()
const router = useRouter()

const movie = ref<any>(null)
const comments = ref<any[]>([])
const suggestions = ref<any[]>([])
const loading = ref(true)
const commentContent = ref('')
const commentMsg = ref('')
const ratingScore = ref(8)
const ratingMsg = ref('')
const reactions = reactive<Record<string, number>>({ FIRE: 0, LOVE: 0, FUNNY: 0, WOW: 0, SAD: 0, POO: 0 })
const myReaction = ref('')

// Episode panel toggle (like the reference site)
const showEpPanel = ref(false)
// Auto-next toggle, persisted in localStorage
const autoNext = ref(localStorage.getItem('autoNext') !== 'false')

watch(autoNext, (v) => localStorage.setItem('autoNext', String(v)))

const REACTIONS = [
  { type: 'LOVE', emoji: '❤️', label: 'Yêu thích' },
  { type: 'FUNNY', emoji: '😂', label: 'Vui nhộn' },
  { type: 'WOW', emoji: '😮', label: 'Thú vị' },
  { type: 'SAD', emoji: '😢', label: 'Buồn' },
  { type: 'FIRE', emoji: '🔥', label: 'Hấp dẫn' },
  { type: 'POO', emoji: '💩', label: 'Tệ' },
]

const episodeParam = computed(() => String(route.params.episode || '').toLowerCase())
const isMovieFullRoute = computed(() => movie.value?.type === 'MOVIE' && episodeParam.value === 'full')
const currentEpOrder = computed(() => {
  if (isMovieFullRoute.value) return 1
  const n = parseInt(episodeParam.value, 10)
  return Number.isFinite(n) ? n : 1
})

const activeEpisode = computed(() => {
  if (!movie.value?.episodes?.length) return null
  return movie.value.episodes.find((ep: any) => ep.episodeOrder === currentEpOrder.value)
    || movie.value.episodes[0]
})

const selectedServer = ref<any>(null)

/** Nhóm hiển thị giống RoPhim: "Vietsub #1 - ..." → "Vietsub #1" */
function streamLaneKey(serverName: string | undefined): string {
  if (!serverName) return ''
  const t = serverName.trim()
  const cut = t.indexOf(' - ')
  if (cut > 0) return t.slice(0, cut).trim()
  return t
}

/** Phần sau " - " (vd. Nguồn Phát #01) — dùng cho nút đổi nguồn trong cùng lane */
function streamSourceButtonLabel(serverName: string | undefined): string {
  if (!serverName) return ''
  const t = serverName.trim()
  const cut = t.indexOf(' - ')
  if (cut > 0) return t.slice(cut + 3).trim()
  return t
}

/** Query ?nguon= có thể không dấu (Thuyet) trong khi DB có dấu (Thuyết) */
function normalizeLaneForCompare(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
}

function lanesEquivalent(a: string, b: string): boolean {
  if (!a || !b) return false
  return normalizeLaneForCompare(a) === normalizeLaneForCompare(b)
}

function laneSortOrder(key: string): number {
  const k = key.toLowerCase()
  if (k.includes('thuyết') || k.includes('thuyet')) return 0
  if (k.includes('vietsub')) return 1
  if (k.includes('lồng') || k.includes('long')) return 2
  return 10
}

const laneKeys = computed(() => {
  if (!movie.value?.episodes?.length) return [] as string[]
  const set = new Set<string>()
  for (const ep of movie.value.episodes) {
    for (const s of ep.streams || []) {
      const k = streamLaneKey(s.serverName)
      if (k) set.add(k)
    }
  }
  return [...set].sort((a, b) => laneSortOrder(a) - laneSortOrder(b) || a.localeCompare(b, 'vi'))
})

/** Mỗi server (Thuyết minh / Vietsub) có số tập khác nhau — chỉ hiện tập thật sự có stream trong lane đó. */
function episodesInLane(laneKey: string) {
  if (!movie.value?.episodes?.length || !laneKey) return [] as any[]
  return movie.value.episodes.filter((ep: any) =>
    (ep.streams || []).some((s: any) => lanesEquivalent(streamLaneKey(s.serverName), laneKey))
  )
}

/** Lane đang xem: từ ?nguon= hoặc nguồn đã chọn / tập mặc định */
const activeLaneKey = computed(() => {
  const q = String(route.query.nguon || '').trim()
  if (q) return q
  const ep = activeEpisode.value as any
  if (!ep?.streams?.length) return ''
  if (selectedServer.value?.serverName) return streamLaneKey(selectedServer.value.serverName)
  return streamLaneKey(ep.streams[0].serverName)
})

/** Chỉ các nguồn thuộc lane hiện tại (Thuyết minh / Vietsub tách biệt) */
const streamsForCurrentLane = computed(() => {
  const ep = activeEpisode.value as any
  if (!ep?.streams?.length) return [] as any[]
  const lane = activeLaneKey.value
  if (!lane) return ep.streams as any[]
  const filtered = (ep.streams as any[]).filter((s: any) =>
    lanesEquivalent(streamLaneKey(s.serverName), lane)
  )
  return filtered.length ? filtered : (ep.streams as any[])
})

const laneFolded = reactive<Record<string, boolean>>({})

const streamUrl = computed(() => selectedServer.value?.streamUrl || '')

const LS_PLAYBACK_PREFIX = 'phimchill_playback_v1'

const playbackStorageKey = computed(() => {
  if (!movie.value?.id) return ''
  return `${LS_PLAYBACK_PREFIX}_${movie.value.id}_${currentEpOrder.value}`
})

function formatResumeTime(seconds: number): string {
  const s = Math.floor(seconds % 60)
  const m = Math.floor(seconds / 60) % 60
  const h = Math.floor(seconds / 3600)
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return `${m}:${String(s).padStart(2, '0')}`
}

function readOfferResume(key: string): number | null {
  if (!key) return null
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return null
    const o = JSON.parse(raw) as { seconds: number; duration?: number }
    const sec = o.seconds
    if (!Number.isFinite(sec) || sec < 20) return null
    if (o.duration && Number.isFinite(o.duration) && o.duration > 0 && sec >= o.duration - 50) {
      return null
    }
    return sec
  } catch {
    return null
  }
}

/** Có mốc xem dở — hiện popup trước khi mount player */
const resumePrompt = ref<{ seconds: number } | null>(null)
const chosenResumeSeconds = ref(0)

watch(
  [() => movie.value?.id, currentEpOrder],
  () => {
    chosenResumeSeconds.value = 0
    resumePrompt.value = null
    nextTick(() => {
      const key = playbackStorageKey.value
      if (!key) return
      const sec = readOfferResume(key)
      if (sec != null) resumePrompt.value = { seconds: sec }
    })
  },
  { immediate: true }
)

watch(
  () => selectedServer.value?.id,
  (id, oldId) => {
    if (oldId != null && id != null && id !== oldId) {
      chosenResumeSeconds.value = 0
    }
  }
)

function onResumeContinue() {
  const p = resumePrompt.value
  if (!p) return
  chosenResumeSeconds.value = p.seconds
  resumePrompt.value = null
}

function onResumeFromStart() {
  const key = playbackStorageKey.value
  if (key) {
    try {
      localStorage.removeItem(key)
    } catch {
      /* ignore */
    }
  }
  chosenResumeSeconds.value = 0
  resumePrompt.value = null
}

const genres = computed<string[]>(() => {
  if (!movie.value?.genres) return []
  return movie.value.genres.split(',').map((g: string) => g.trim()).filter(Boolean)
})

const actors = computed<string[]>(() => movie.value?.actors || [])

const prevEp = computed(() => {
  if (!movie.value?.episodes?.length) return null
  return movie.value.episodes.find((ep: any) => ep.episodeOrder === currentEpOrder.value - 1) || null
})
const nextEp = computed(() => {
  if (!movie.value?.episodes?.length) return null
  return movie.value.episodes.find((ep: any) => ep.episodeOrder === currentEpOrder.value + 1) || null
})

const epNavPath = (ep: any) => {
  if (movie.value?.type === 'MOVIE') return `/phim/${route.params.slug}/tap-full`
  return `/phim/${route.params.slug}/tap-${ep.episodeOrder}`
}

function epRouteTo(ep: any, laneKey?: string) {
  const path = epNavPath(ep)
  if (movie.value?.type === 'MOVIE' || !laneKey) return { path }
  return { path, query: { nguon: laneKey } }
}

watch([activeEpisode, () => route.query.nguon], () => {
  const ep = activeEpisode.value as any
  if (!ep?.streams?.length) {
    selectedServer.value = null
    return
  }
  const q = String(route.query.nguon || '').trim()
  if (q) {
    const inLane = ep.streams.filter((s: any) => lanesEquivalent(streamLaneKey(s.serverName), q))
    if (inLane.length) {
      const cur = selectedServer.value
      if (cur && inLane.some((s: any) => s.id === cur.id)) {
        selectedServer.value = cur
        return
      }
      selectedServer.value = inLane[0]
      return
    }
  }
  selectedServer.value = ep.streams[0]
}, { immediate: true })

// Auto-next: navigate to next episode when video ends
const onVideoEnded = () => {
  if (autoNext.value && nextEp.value) {
    router.push(epRouteTo(nextEp.value, String(route.query.nguon || '')))
  }
}

const fetchAll = async (slug: string) => {
  loading.value = true
  try {
    const res = await fetch(`${API_BASE}/movies/${slug}`)
    if (!res.ok) return
    movie.value = await res.json()
    await Promise.all([loadComments(), loadReactions(), loadSuggestions()])
  } finally { loading.value = false }
}

const loadComments = async () => {
  if (!movie.value?.id) return
  const res = await fetch(`${API_BASE}/movies/${movie.value.id}/comments`)
  if (res.ok) comments.value = await res.json()
}

const loadReactions = async () => {
  if (!movie.value?.id) return
  const res = await fetch(`${API_BASE}/movies/${movie.value.id}/reactions`)
  if (res.ok) {
    const data: Record<string, number> = await res.json()
    Object.assign(reactions, { FIRE: 0, LOVE: 0, FUNNY: 0, WOW: 0, SAD: 0, POO: 0 }, data)
  }
}

const loadSuggestions = async () => {
  const g = genres.value[0] || ''
  const res = await fetch(`${API_BASE}/movies?genre=${encodeURIComponent(g)}`)
  if (!res.ok) return
  const all: any[] = await res.json()
  suggestions.value = all.filter((m: any) => m.slug !== route.params.slug).slice(0, 10)
}

const react = async (type: string) => {
  if (!movie.value?.id) return
  const sid = localStorage.getItem('username') || 'anon-' + Math.random().toString(36).slice(2)
  const res = await fetch(`${API_BASE}/movies/${movie.value.id}/reactions/${type}?sessionId=${sid}`, { method: 'POST' })
  if (res.ok) {
    const data: Record<string, number> = await res.json()
    Object.assign(reactions, { FIRE: 0, LOVE: 0, FUNNY: 0, WOW: 0, SAD: 0, POO: 0 }, data)
    myReaction.value = type
  }
}

const submitComment = async () => {
  if (!token.value) { commentMsg.value = 'Vui lòng đăng nhập để bình luận'; return }
  if (!commentContent.value.trim()) return
  const res = await fetch(`${API_BASE}/movies/${movie.value.id}/comments`, {
    method: 'POST', headers: authHeaders(),
    body: JSON.stringify({ content: commentContent.value.trim() })
  })
  if (res.ok) { commentContent.value = ''; commentMsg.value = ''; await loadComments() }
}

const submitRating = async () => {
  if (!token.value) { ratingMsg.value = 'Vui lòng đăng nhập để đánh giá'; return }
  const res = await fetch(`${API_BASE}/movies/${movie.value.id}/ratings`, {
    method: 'POST', headers: authHeaders(),
    body: JSON.stringify({ score: Number(ratingScore.value) })
  })
  if (res.ok) ratingMsg.value = '✓ Đã gửi đánh giá!'
}

const timeAgo = (iso: string) => {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (diff < 60) return `${diff}s trước`
  if (diff < 3600) return `${Math.floor(diff / 60)} phút trước`
  if (diff < 86400) return `${Math.floor(diff / 3600)} giờ trước`
  return `${Math.floor(diff / 86400)} ngày trước`
}

watch(() => route.params.slug, (s) => s && fetchAll(s as string), { immediate: true })
</script>

<template>
  <div class="wep" v-if="!loading && movie">
    <!-- ===== FULL-WIDTH PLAYER SECTION ===== -->
    <div class="wep-player-section">
      <div class="wep-player-shell">
      <!-- Top bar: breadcrumb + title + toggle -->
      <div class="wep-topbar">
        <div class="wep-topbar-left">
          <router-link to="/" class="wep-back">← Trang chủ</router-link>
          <span class="wep-sep">›</span>
          <router-link :to="`/phim/${movie.slug}`" class="wep-back">{{ movie.titleVi }}</router-link>
        </div>
        <h1 class="wep-title">Xem phim {{ movie.titleVi }} - {{ movie.type === 'MOVIE' ? 'Tập Full' : `Tập ${activeEpisode?.episodeOrder}` }}</h1>
        <button class="wep-ep-toggle" @click="showEpPanel = !showEpPanel">
          <span class="toggle-icon">☰</span>
          Danh sách tập
          <span class="ep-count-badge">{{ movie.episodes?.length }} tập</span>
        </button>
      </div>

      <!-- Player + Episode panel row -->
      <div class="wep-player-row" :class="{ 'panel-open': showEpPanel }">
        <!-- Player column -->
        <div class="wep-player-col wep-player-col--stack">
          <div v-if="resumePrompt" class="wep-resume-overlay" role="dialog" aria-modal="true" aria-labelledby="wep-resume-title">
            <div class="wep-resume-card">
              <p id="wep-resume-title" class="wep-resume-text">
                Bạn đang xem dở tới <strong>{{ formatResumeTime(resumePrompt.seconds) }}</strong>. Bạn muốn tiếp tục hay xem lại từ đầu?
              </p>
              <div class="wep-resume-actions">
                <button type="button" class="wep-resume-btn wep-resume-btn-primary" @click="onResumeContinue">
                  Tiếp tục xem
                </button>
                <button type="button" class="wep-resume-btn" @click="onResumeFromStart">
                  Xem lại từ đầu
                </button>
              </div>
            </div>
          </div>
          <VideoPlayer
            v-if="!resumePrompt"
            :key="`${currentEpOrder}-${streamUrl}`"
            :src="streamUrl"
            :progress-key="playbackStorageKey || undefined"
            :resume-seconds="chosenResumeSeconds"
            :save-progress="true"
            @ended="onVideoEnded"
          />
        </div>

        <!-- Episode side panel -->
        <Transition name="ep-slide">
          <div class="wep-ep-panel" v-if="showEpPanel">
            <div class="ep-panel-header">
              <div class="ep-panel-title">
                <span class="ep-panel-movie">{{ movie.titleVi }}</span>
                <span class="ep-panel-count">{{ movie.episodes?.length }} tập</span>
              </div>
              <button class="ep-panel-close" @click="showEpPanel = false">✕</button>
            </div>
            <div class="ep-panel-list">
              <router-link
                v-for="ep in movie.episodes"
                :key="ep.id"
                :to="epNavPath(ep)"
                class="ep-panel-item"
                :class="{ active: ep.episodeOrder === currentEpOrder }"
              >
                <div class="ep-panel-num">{{ movie.type === 'MOVIE' ? 'F' : ep.episodeOrder }}</div>
                <div class="ep-panel-label">
                  <span class="ep-panel-ep-title">{{ movie.type === 'MOVIE' ? 'Tập Full' : `Tập ${ep.episodeOrder}` }}</span>
                  <span class="ep-panel-ep-name" v-if="ep.name && ep.name !== String(ep.episodeOrder)">{{ ep.name }}</span>
                </div>
                <span v-if="ep.episodeOrder === currentEpOrder" class="ep-panel-playing">▶</span>
              </router-link>
            </div>
          </div>
        </Transition>
      </div>

      </div>
    </div>
    <div class="wep-options-shell">
      <!-- Controls below player -->
      <div class="wep-controls">
        <!-- Reaction emoji bar -->
        <div class="wep-reactions">
          <button
            v-for="r in REACTIONS"
            :key="r.type"
            class="wep-react-btn"
            :class="{ reacted: myReaction === r.type }"
            @click="react(r.type)"
          >
            {{ r.emoji }} {{ r.label }}
            <span class="wep-react-cnt">{{ reactions[r.type] || 0 }}</span>
          </button>
          <div class="wep-reactions-right">
            <button class="wep-bar-btn">📤 Chia sẻ</button>
            <button class="wep-bar-btn">⚠ Báo lỗi</button>
          </div>
        </div>

        <!-- Phim lẻ / Full: chọn bản phát (nhiều stream trên cùng tập) -->
        <div class="wep-movie-source-row" v-if="movie.type === 'MOVIE' && streamsForCurrentLane.length > 1">
          <span class="wep-nav-label">Bản phát:</span>
          <div class="wep-sources">
            <button
              v-for="srv in streamsForCurrentLane"
              :key="srv.id"
              type="button"
              class="wep-source-btn"
              :class="{ active: selectedServer?.id === srv.id }"
              @click="selectedServer = srv"
            >{{ streamSourceButtonLabel(srv.serverName) }}</button>
          </div>
        </div>

        <!-- Tập trước / sau + tự động — tách khỏi lưới server -->
        <div class="wep-toolbar-row" v-if="movie.type !== 'MOVIE'">
          <router-link
            v-if="prevEp"
            :to="epRouteTo(prevEp, String(route.query.nguon || ''))"
            class="wep-nav-btn"
          >‹ Tập {{ prevEp.episodeOrder }}</router-link>
          <span v-else class="wep-nav-btn disabled">‹ Trước</span>

          <router-link
            v-if="nextEp"
            :to="epRouteTo(nextEp, String(route.query.nguon || ''))"
            class="wep-nav-btn"
          >Tập {{ nextEp.episodeOrder }} ›</router-link>
          <span v-else class="wep-nav-btn disabled">Tiếp ›</span>

          <label class="wep-autonext-toggle wep-toolbar-autonext">
            <div class="toggle-switch" :class="{ on: autoNext }" @click.prevent="autoNext = !autoNext">
              <div class="toggle-knob" />
            </div>
            <span>Chuyển tập tự động</span>
          </label>
        </div>

        <!-- Server / lane giống RoPhim: mỗi Vietsub #n / Thuyết minh #n một khối, lưới tập bên dưới -->
        <div class="wep-lane-stack" v-if="movie.type !== 'MOVIE' && laneKeys.length">
          <section
            v-for="lane in laneKeys"
            :key="lane"
            class="wep-lane"
          >
            <div class="wep-lane-head">
              <div class="wep-lane-head-left">
                <span class="wep-lane-dot" aria-hidden="true" />
                <span class="wep-lane-title">{{ lane }}</span>
              </div>
              <label class="wep-lane-fold">
                <span>Rút gọn</span>
                <input type="checkbox" v-model="laneFolded[lane]" class="wep-lane-fold-input" />
                <span class="wep-lane-switch" :class="{ on: laneFolded[lane] }"><i /></span>
              </label>
            </div>
            <div v-show="!laneFolded[lane]" class="wep-lane-grid">
              <router-link
                v-for="ep in episodesInLane(lane)"
                :key="`${lane}-${ep.id}`"
                :to="epRouteTo(ep, lane)"
                class="wep-lane-ep"
                :class="{
                  active: ep.episodeOrder === currentEpOrder
                    && lanesEquivalent(streamLaneKey(selectedServer?.serverName), lane),
                }"
              >{{ ep.episodeOrder }}</router-link>
            </div>
          </section>
        </div>

        <div class="wep-inline-source" v-if="movie.type !== 'MOVIE' && streamsForCurrentLane.length > 1">
          <span class="wep-nav-label">Nguồn phát:</span>
          <div class="wep-sources">
            <button
              v-for="srv in streamsForCurrentLane"
              :key="srv.id"
              type="button"
              class="wep-source-btn"
              :class="{ active: selectedServer?.id === srv.id }"
              @click="selectedServer = srv"
            >{{ streamSourceButtonLabel(srv.serverName) }}</button>
          </div>
        </div>
      </div>
    </div>

    <!-- ===== CONTENT BELOW PLAYER ===== -->
    <div class="container wep-below">
      <div class="wep-below-main">
        <!-- Movie info -->
        <div class="wep-movie-info">
          <router-link :to="`/phim/${movie.slug}`" class="wep-movie-title-link">
            <h2>{{ movie.titleVi }}</h2>
          </router-link>
          <p class="wep-original">{{ movie.titleOriginal }}</p>

          <div class="wep-badges">
            <span v-if="movie.imdbScore" class="badge-y">⭐ {{ movie.imdbScore }}</span>
            <span v-if="movie.quality" class="badge-q">{{ movie.quality }}</span>
            <span v-if="movie.language" class="badge-q" style="color:#4ade80">{{ movie.language }}</span>
            <span v-if="movie.year" class="badge-q">{{ movie.year }}</span>
            <span v-if="movie.type === 'MOVIE'" class="badge-q">Full</span>
            <span v-else-if="movie.totalEpisodes" class="badge-q">{{ movie.episodes?.length }}/{{ movie.totalEpisodes }} tập</span>
            <span v-if="movie.country" class="badge-q">{{ movie.country }}</span>
          </div>

          <div class="wep-genres">
            <router-link
              v-for="g in genres" :key="g"
              :to="{ path: '/', query: { genre: g } }"
              class="wep-genre-pill"
            >{{ g }}</router-link>
          </div>

          <p class="wep-desc">{{ movie.description }}</p>
        </div>

        <!-- Rating -->
        <div class="wep-rating-box">
          <h4>Đánh giá phim</h4>
          <div class="wep-rating-row">
            <div class="wep-rating-num">{{ movie.ratingAverage?.toFixed(1) || '—' }}</div>
            <div>
              <div style="color:#f5c518;font-size:18px">★★★★☆</div>
              <div style="font-size:12px;color:#64748b">{{ movie.ratingCount || 0 }} lượt</div>
            </div>
          </div>
          <div class="wep-rating-form">
            <label>Điểm của bạn: <strong>{{ ratingScore }}</strong></label>
            <input type="range" min="1" max="10" v-model="ratingScore" style="accent-color:#e50914" />
            <button class="wep-btn-rate" :disabled="!token" @click="submitRating">Gửi</button>
          </div>
          <p v-if="ratingMsg" style="font-size:13px;color:#22c55e;margin-top:6px">{{ ratingMsg }}</p>
        </div>

        <!-- Comments -->
        <div class="wep-comments">
          <h4>Bình luận ({{ comments.length }})</h4>
          <div class="wep-cmt-form">
            <textarea
              v-model="commentContent"
              :placeholder="token ? 'Nhập bình luận của bạn...' : 'Đăng nhập để bình luận'"
              :disabled="!token"
              class="wep-textarea"
            />
            <div style="display:flex;justify-content:flex-end;margin-top:8px">
              <span v-if="commentMsg" style="font-size:12px;color:#f87171;margin-right:auto">{{ commentMsg }}</span>
              <button class="wep-btn-cmt" :disabled="!token" @click="submitComment">Gửi bình luận</button>
            </div>
          </div>
          <div v-if="!comments.length" style="text-align:center;padding:24px;color:#64748b">Chưa có bình luận nào.</div>
          <div v-for="c in comments" :key="c.id" class="wep-cmt-item">
            <div class="wep-cmt-ava">{{ c.username?.[0]?.toUpperCase() || '?' }}</div>
            <div>
              <div class="wep-cmt-name">{{ c.username }}</div>
              <div class="wep-cmt-text">{{ c.content }}</div>
              <div class="wep-cmt-time">{{ timeAgo(c.createdAt) }}</div>
            </div>
          </div>
        </div>
      </div>

      <!-- Sidebar: cast + suggestions -->
      <aside class="wep-sidebar">
        <div class="wep-sidebar-block" v-if="actors.length">
          <div class="wep-sidebar-title">Diễn viên</div>
          <div v-for="actor in actors.slice(0, 8)" :key="actor" class="wep-actor-item">
            <div class="wep-actor-ava">{{ actor[0]?.toUpperCase() }}</div>
            <span class="wep-actor-name">{{ actor }}</span>
          </div>
        </div>

        <div class="wep-sidebar-block">
          <div class="wep-sidebar-title">Đề xuất cho bạn</div>
          <div
            v-for="m in suggestions"
            :key="m.id"
            class="wep-suggest-item"
            @click="router.push(`/phim/${m.slug}`)"
          >
            <img
              :src="resolveMediaUrl(m.thumbUrl || m.posterUrl) || `https://picsum.photos/seed/${m.slug}/120/180`"
              :alt="m.titleVi"
              class="wep-suggest-thumb"
            />
            <div class="wep-suggest-info">
              <div class="wep-suggest-title">{{ m.titleVi }}</div>
              <div class="wep-suggest-meta">
                {{ m.year }}
                <span v-if="m.type === 'MOVIE'"> · Full</span>
                <span v-else-if="m.totalEpisodes"> · {{ m.totalEpisodes }} tập</span>
              </div>
              <div style="display:flex;gap:4px;flex-wrap:wrap;margin-top:2px">
                <span v-if="m.imdbScore" style="font-size:10px;color:#f5c518">⭐ {{ m.imdbScore }}</span>
                <span v-if="m.quality" style="font-size:10px;color:#94a3b8">{{ m.quality }}</span>
              </div>
            </div>
          </div>
        </div>
      </aside>
    </div>
  </div>

  <!-- Loading -->
  <div v-else-if="loading" class="wep-loading">
    <div class="wep-spinner" />
    <p>Đang tải...</p>
  </div>
</template>

<style scoped>
.wep {
  padding-top: 64px;
  min-height: 100vh;
}

/* ===== PLAYER SECTION (full-width, no container) ===== */
.wep-player-section {
  background: var(--bg);
  padding: 10px 0 0;
}

.wep-player-shell {
  width: min(1580px, calc(100% - 40px));
  margin: 0 auto;
}

.wep-options-shell {
  width: min(1580px, calc(100% - 40px));
  margin: 10px auto 0;
}

.wep-topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 20px;
  background: var(--bg2);
  border-bottom: 1px solid var(--bg3);
  gap: 12px;
  flex-wrap: wrap;
  border: 1px solid var(--border);
  border-radius: 10px 10px 0 0;
}
.wep-topbar-left {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: #64748b;
}
.wep-back { color: #94a3b8; transition: color 0.2s; }
.wep-back:hover { color: #e2e8f0; }
.wep-sep { color: #4a4a6a; }

.wep-title {
  flex: 1;
  text-align: center;
  font-size: clamp(13px, 2vw, 18px);
  font-weight: 700;
  color: #e2e8f0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.wep-ep-toggle {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  background: var(--bg3);
  border: 1px solid var(--border);
  border-radius: 8px;
  color: #e2e8f0;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
  transition: background 0.2s;
  flex-shrink: 0;
}
.wep-ep-toggle:hover { background: var(--border); }
.toggle-icon { font-size: 16px; }
.ep-count-badge {
  padding: 2px 8px;
  background: rgba(229,9,20,0.15);
  border-radius: 999px;
  font-size: 11px;
  color: #f87171;
}

/* Player row */
.wep-player-row {
  display: block;
  width: 100%;
  border-left: 1px solid var(--border);
  border-right: 1px solid var(--border);
  background: #000;
  position: relative;
  overflow: hidden;
}
.wep-player-col {
  width: 100%;
  background: #000;
}
.wep-player-col--stack {
  position: relative;
  min-height: 200px;
}
.wep-resume-overlay {
  position: absolute;
  inset: 0;
  z-index: 4;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.88);
  padding: 24px;
}
.wep-resume-card {
  max-width: 420px;
  padding: 24px;
  border-radius: 12px;
  background: var(--bg2, #1e293b);
  border: 1px solid var(--border, #334155);
  box-shadow: 0 16px 48px rgba(0, 0, 0, 0.45);
}
.wep-resume-text {
  margin: 0 0 20px;
  font-size: 15px;
  line-height: 1.5;
  color: #e2e8f0;
}
.wep-resume-text strong {
  color: #fbbf24;
}
.wep-resume-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}
.wep-resume-btn {
  padding: 10px 18px;
  border-radius: 8px;
  font-size: 14px;
  cursor: pointer;
  border: 1px solid var(--border, #334155);
  background: var(--bg3, #0f172a);
  color: #e2e8f0;
}
.wep-resume-btn:hover {
  filter: brightness(1.08);
}
.wep-resume-btn-primary {
  background: #e50914;
  border-color: #b91c1c;
  color: #fff;
}

/* Episode side panel */
.wep-ep-panel {
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  width: 340px;
  background: var(--bg2);
  border-left: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  height: 100%;
  z-index: 5;
  box-shadow: -8px 0 20px rgba(0, 0, 0, 0.35);
}
.ep-slide-enter-active, .ep-slide-leave-active {
  transition: transform 0.25s ease, opacity 0.25s ease;
}
.ep-slide-enter-from, .ep-slide-leave-to {
  transform: translateX(100%);
  opacity: 0;
}
.ep-slide-enter-to, .ep-slide-leave-from {
  transform: translateX(0);
  opacity: 1;
}

.ep-panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid var(--border);
  background: var(--bg);
  flex-shrink: 0;
}
.ep-panel-title {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.ep-panel-movie {
  font-size: 13px;
  font-weight: 700;
  color: #e2e8f0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 230px;
}
.ep-panel-count {
  font-size: 11px;
  color: #64748b;
}
.ep-panel-close {
  width: 28px; height: 28px;
  background: var(--bg3);
  border: 1px solid var(--border);
  border-radius: 6px;
  color: #94a3b8;
  font-size: 12px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.ep-panel-close:hover { background: #e50914; border-color: #e50914; color: #fff; }

.ep-panel-list {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-height: 0;
}
.ep-panel-list::-webkit-scrollbar { width: 4px; }
.ep-panel-list::-webkit-scrollbar-track { background: var(--bg); }
.ep-panel-list::-webkit-scrollbar-thumb { background: #4a4a6a; border-radius: 2px; }

.ep-panel-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  background: var(--bg3);
  border: 1px solid var(--border);
  border-radius: 8px;
  text-decoration: none;
  transition: all 0.15s;
}
.ep-panel-item:hover { background: var(--border); border-color: #4a4a6a; }
.ep-panel-item.active { background: rgba(229,9,20,0.12); border-color: rgba(229,9,20,0.3); }

.ep-panel-num {
  width: 36px; height: 36px;
  background: var(--border);
  border-radius: 6px;
  display: flex; align-items: center; justify-content: center;
  font-size: 14px; font-weight: 700;
  color: #94a3b8;
  flex-shrink: 0;
}
.ep-panel-item.active .ep-panel-num {
  background: #e50914;
  color: #fff;
}
.ep-panel-label { flex: 1; min-width: 0; }
.ep-panel-ep-title { display: block; font-size: 13px; font-weight: 600; color: #e2e8f0; }
.ep-panel-ep-name { display: block; font-size: 11px; color: #64748b; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.ep-panel-playing { font-size: 12px; color: #e50914; flex-shrink: 0; }

/* Controls */
.wep-controls {
  background: var(--bg2);
  border: 1px solid var(--border);
  border-top: none;
  border-radius: 0 0 10px 10px;
  padding: 10px 20px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

@media (max-width: 900px) {
  .wep-player-shell {
    width: calc(100% - 16px);
  }
  .wep-options-shell {
    width: calc(100% - 16px);
  }
}

.wep-reactions {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}
.wep-react-btn {
  padding: 6px 12px;
  background: var(--bg2);
  border: 1px solid var(--border);
  border-radius: 999px;
  font-size: 13px;
  color: #94a3b8;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 4px;
  transition: all 0.15s;
}
.wep-react-btn:hover { background: var(--bg3); color: #e2e8f0; }
.wep-react-btn.reacted { background: rgba(229,9,20,0.12); border-color: rgba(229,9,20,0.3); color: #f87171; }
.wep-react-cnt { font-size: 11px; color: #64748b; }
.wep-reactions-right { margin-left: auto; display: flex; gap: 6px; }
.wep-bar-btn {
  padding: 6px 12px;
  background: var(--bg2);
  border: 1px solid var(--border);
  border-radius: 999px;
  font-size: 13px;
  color: #94a3b8;
  cursor: pointer;
}

.wep-toolbar-row {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  padding-top: 4px;
}
.wep-toolbar-autonext { margin-left: auto; }

.wep-movie-source-row,
.wep-inline-source {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  padding-top: 4px;
}

.wep-lane-stack {
  display: flex;
  flex-direction: column;
  gap: 14px;
  margin-top: 8px;
  width: 100%;
}
.wep-lane {
  background: rgba(0, 0, 0, 0.25);
  border: 1px solid var(--border);
  border-radius: 10px;
  overflow: hidden;
}
.wep-lane-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 14px;
  background: var(--bg);
  border-bottom: 1px solid var(--border);
}
.wep-lane-head-left {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}
.wep-lane-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: linear-gradient(135deg, #f5c518, #e5a00d);
  flex-shrink: 0;
}
.wep-lane-title {
  font-size: 14px;
  font-weight: 700;
  color: #e2e8f0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.wep-lane-fold {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: #64748b;
  cursor: pointer;
  user-select: none;
  flex-shrink: 0;
}
.wep-lane-fold-input {
  position: absolute;
  opacity: 0;
  width: 0;
  height: 0;
}
.wep-lane-switch {
  width: 36px;
  height: 20px;
  border-radius: 999px;
  background: var(--border);
  position: relative;
  transition: background 0.2s;
}
.wep-lane-switch.on {
  background: #e5a00d;
}
.wep-lane-switch i {
  position: absolute;
  top: 2px;
  left: 2px;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: #fff;
  transition: transform 0.2s;
  display: block;
}
.wep-lane-switch.on i {
  transform: translateX(16px);
}

.wep-lane-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(44px, 1fr));
  gap: 8px;
  padding: 12px 14px 14px;
  max-width: 100%;
}
.wep-lane-ep {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 40px;
  padding: 0 6px;
  background: var(--bg3);
  border: 1px solid var(--border);
  border-radius: 8px;
  color: #cbd5e1;
  font-size: 13px;
  font-weight: 700;
  text-decoration: none;
  transition: background 0.15s, border-color 0.15s, color 0.15s;
}
.wep-lane-ep:hover {
  background: var(--border);
  color: #fff;
}
.wep-lane-ep.active {
  background: linear-gradient(180deg, #f5c518 0%, #e5a00d 100%);
  border-color: #f5c518;
  color: #0f172a;
}

.wep-nav-label { font-size: 13px; color: #64748b; white-space: nowrap; }
.wep-sources {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.wep-source-btn {
  padding: 6px 14px;
  background: var(--bg2);
  border: 1px solid var(--border);
  border-radius: 6px;
  color: #94a3b8;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.15s;
}
.wep-source-btn:hover { background: var(--border); color: #e2e8f0; }
.wep-source-btn.active { background: #e50914; border-color: #e50914; color: #fff; font-weight: 600; }

.wep-nav-btn {
  padding: 6px 12px;
  background: var(--bg2);
  border: 1px solid var(--border);
  border-radius: 6px;
  color: #94a3b8;
  font-size: 12px;
  white-space: nowrap;
  text-decoration: none;
  cursor: pointer;
  flex-shrink: 0;
  transition: all 0.15s;
}
.wep-nav-btn:hover { background: var(--border); color: #e2e8f0; }
.wep-nav-btn.disabled { opacity: 0.4; pointer-events: none; }

/* Auto-next toggle */
.wep-autonext-toggle {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  white-space: nowrap;
  font-size: 13px;
  color: #94a3b8;
  flex-shrink: 0;
}
.toggle-switch {
  width: 38px; height: 20px;
  background: var(--border);
  border-radius: 999px;
  position: relative;
  cursor: pointer;
  transition: background 0.2s;
  flex-shrink: 0;
}
.toggle-switch.on { background: #e50914; }
.toggle-knob {
  position: absolute;
  top: 2px; left: 2px;
  width: 16px; height: 16px;
  background: #fff;
  border-radius: 50%;
  transition: transform 0.2s;
}
.toggle-switch.on .toggle-knob { transform: translateX(18px); }

/* ===== BELOW PLAYER ===== */
.wep-below {
  display: grid;
  grid-template-columns: 1fr 320px;
  gap: 28px;
  padding-top: 24px;
  padding-bottom: 48px;
  align-items: start;
}
@media (max-width: 1024px) {
  .wep-below { grid-template-columns: 1fr; }
  .wep-sidebar { order: -1; }
}

.wep-below-main { display: flex; flex-direction: column; gap: 20px; }

/* Movie info */
.wep-movie-info { padding: 0; }
.wep-movie-title-link { text-decoration: none; }
.wep-movie-title-link h2 { font-size: clamp(18px, 3vw, 28px); font-weight: 800; color: #e2e8f0; margin-bottom: 4px; }
.wep-movie-title-link h2:hover { color: #f87171; }
.wep-original { font-size: 14px; color: #64748b; margin-bottom: 12px; }

.wep-badges { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 10px; }
.badge-y { background: rgba(245,197,24,0.12); border: 1px solid rgba(245,197,24,0.3); color: #f5c518; padding: 3px 10px; border-radius: 4px; font-size: 12px; font-weight: 600; }
.badge-q { background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1); color: #94a3b8; padding: 3px 10px; border-radius: 4px; font-size: 12px; }

.wep-genres { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 14px; }
.wep-genre-pill { padding: 4px 12px; background: rgba(229,9,20,0.1); border: 1px solid rgba(229,9,20,0.2); color: #f87171; border-radius: 999px; font-size: 12px; text-decoration: none; }
.wep-genre-pill:hover { background: rgba(229,9,20,0.2); }
.wep-desc { font-size: 14px; line-height: 1.7; color: #64748b; }

/* Rating */
.wep-rating-box { background: var(--bg2); border: 1px solid var(--border); border-radius: 10px; padding: 20px; }
.wep-rating-box h4 { font-size: 15px; font-weight: 700; margin-bottom: 14px; }
.wep-rating-row { display: flex; align-items: center; gap: 16px; margin-bottom: 16px; }
.wep-rating-num { font-size: 44px; font-weight: 800; color: #f5c518; line-height: 1; }
.wep-rating-form { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.wep-rating-form label { font-size: 13px; color: #94a3b8; }
.wep-btn-rate { padding: 6px 18px; background: #e50914; color: #fff; border: none; border-radius: 6px; font-weight: 600; cursor: pointer; font-size: 13px; }
.wep-btn-rate:disabled { opacity: 0.5; cursor: not-allowed; }

/* Comments */
.wep-comments { background: var(--bg2); border: 1px solid var(--border); border-radius: 10px; padding: 20px; }
.wep-comments h4 { font-size: 15px; font-weight: 700; margin-bottom: 16px; }
.wep-textarea { width: 100%; background: var(--bg); border: 1px solid var(--border); border-radius: 8px; padding: 10px; color: #e2e8f0; font-size: 14px; resize: vertical; min-height: 72px; }
.wep-btn-cmt { padding: 7px 18px; background: #e50914; color: #fff; border: none; border-radius: 6px; font-weight: 600; cursor: pointer; font-size: 13px; }
.wep-btn-cmt:disabled { opacity: 0.5; cursor: not-allowed; }
.wep-cmt-item { display: flex; gap: 10px; padding: 12px 0; border-bottom: 1px solid rgba(255,255,255,0.04); }
.wep-cmt-ava { width: 32px; height: 32px; border-radius: 50%; background: linear-gradient(135deg,#e50914,#7c1c1c); display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 13px; color: #fff; flex-shrink: 0; }
.wep-cmt-name { font-size: 13px; font-weight: 600; color: #e2e8f0; margin-bottom: 3px; }
.wep-cmt-text { font-size: 14px; color: #94a3b8; line-height: 1.5; }
.wep-cmt-time { font-size: 11px; color: #64748b; margin-top: 3px; }

/* Sidebar */
.wep-sidebar { display: flex; flex-direction: column; gap: 16px; }
.wep-sidebar-block { background: var(--bg2); border: 1px solid var(--border); border-radius: 10px; overflow: hidden; }
.wep-sidebar-title { padding: 12px 16px; font-size: 14px; font-weight: 700; color: #e2e8f0; border-bottom: 1px solid var(--border); background: var(--bg); }

.wep-actor-item { display: flex; align-items: center; gap: 10px; padding: 10px 16px; border-bottom: 1px solid rgba(255,255,255,0.04); }
.wep-actor-ava { width: 34px; height: 34px; border-radius: 50%; background: linear-gradient(135deg,#e50914,#7c1c1c); display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 13px; color: #fff; flex-shrink: 0; }
.wep-actor-name { font-size: 13px; color: #e2e8f0; }

.wep-suggest-item { display: flex; gap: 10px; padding: 10px 12px; cursor: pointer; border-bottom: 1px solid rgba(255,255,255,0.04); transition: background 0.15s; }
.wep-suggest-item:hover { background: rgba(255,255,255,0.04); }
.wep-suggest-item:last-child { border-bottom: none; }
.wep-suggest-thumb { width: 56px; aspect-ratio: 2/3; object-fit: cover; border-radius: 6px; flex-shrink: 0; }
.wep-suggest-info { flex: 1; min-width: 0; }
.wep-suggest-title { font-size: 13px; font-weight: 600; color: #e2e8f0; margin-bottom: 4px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.wep-suggest-meta { font-size: 11px; color: #64748b; }

/* Loading */
.wep-loading { display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 60vh; gap: 16px; color: #64748b; margin-top: 64px; }
.wep-spinner { width: 40px; height: 40px; border: 3px solid var(--border); border-top-color: #e50914; border-radius: 50%; animation: spin 0.8s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
</style>
