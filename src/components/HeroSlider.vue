<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { resolveMediaUrl } from '../auth'

const props = defineProps<{ movies: any[] }>()

const router = useRouter()
const current = ref(0)
let timer: ReturnType<typeof setInterval> | null = null

const next = () => {
  current.value = (current.value + 1) % props.movies.length
}

const goTo = (i: number) => {
  current.value = i
  resetTimer()
}

const resetTimer = () => {
  if (timer) clearInterval(timer)
  timer = setInterval(next, 5500)
}

const genreList = (genres: string) =>
  genres ? genres.split(',').map(g => g.trim()).slice(0, 3) : []

onMounted(() => { if (props.movies.length > 1) timer = setInterval(next, 5500) })
onUnmounted(() => { if (timer) clearInterval(timer) })
</script>

<template>
  <div class="hero" v-if="movies.length">
    <div
      v-for="(m, i) in movies"
      :key="m.id"
      class="hero-slide"
      :class="{ active: i === current }"
    >
      <div
        class="bg"
        :style="{ backgroundImage: `url(${resolveMediaUrl(m.backdropUrl) || resolveMediaUrl(m.posterUrl) || resolveMediaUrl(m.thumbUrl) || 'https://picsum.photos/seed/' + m.slug + 'bg/1280/720'})` }"
      />
      <div class="hero-content">
        <div class="container">
          <h1>{{ m.titleVi }}</h1>
          <p v-if="m.titleOriginal" class="hero-original">{{ m.titleOriginal }}</p>
          <div class="hero-meta">
            <span v-if="m.imdbScore" class="badge badge-imdb">⭐ IMDb {{ m.imdbScore }}</span>
            <span v-if="m.year" class="badge badge-year">{{ m.year }}</span>
            <span v-if="m.quality" class="badge badge-quality">{{ m.quality }}</span>
            <span v-if="m.language" class="badge badge-lang">{{ m.language }}</span>
            <span v-if="m.type === 'SERIES' && m.totalEpisodes" class="badge badge-ep">{{ m.totalEpisodes }} tập</span>
            <span v-if="m.type === 'MOVIE'" class="badge badge-ep">Full</span>
          </div>
          <div v-if="m.genres" class="hero-genres">
            <span v-for="g in genreList(m.genres)" :key="g" class="hero-genre-tag">{{ g }}</span>
          </div>
          <div class="hero-actions">
            <button class="btn-play" @click="router.push('/watch/' + m.slug)">
              ▶ Xem ngay
            </button>
            <button class="btn-fav">♡ Yêu thích</button>
          </div>
        </div>
      </div>
    </div>

    <div class="hero-dots">
      <button
        v-for="(_, i) in movies"
        :key="i"
        class="dot"
        :class="{ active: i === current }"
        @click="goTo(i)"
      />
    </div>
  </div>
</template>
