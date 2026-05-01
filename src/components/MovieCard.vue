<script setup lang="ts">
import { useRouter } from 'vue-router'
import { resolveMediaUrl } from '../auth'

const props = defineProps<{
  movie: any
}>()

const router = useRouter()

const go = () => {
  router.push('/phim/' + props.movie.slug)
}

const epLabel = (m: any) => {
  if (m.type === 'MOVIE') return 'Full'
  if (m.totalEpisodes) return `${m.totalEpisodes} tập`
  return ''
}
</script>

<template>
  <div class="movie-card" @click="go">
    <img
      :src="resolveMediaUrl(movie.thumbUrl || movie.posterUrl) || 'https://picsum.photos/seed/' + movie.slug + '/300/450'"
      :alt="movie.titleVi"
      class="poster"
      loading="lazy"
    />
    <div class="card-badges">
      <span class="card-badge card-badge-q">{{ movie.quality || 'HD' }}</span>
      <span v-if="epLabel(movie)" class="card-badge card-badge-ep">{{ epLabel(movie) }}</span>
    </div>
    <div class="card-overlay">
      <button class="card-play-btn">▶</button>
    </div>
    <div class="card-info">
      <div class="card-title">{{ movie.titleVi }}</div>
      <div class="card-meta">
        <span>{{ movie.year }}</span>
        <span v-if="movie.imdbScore" class="dot-sep">·</span>
        <span v-if="movie.imdbScore">⭐ {{ movie.imdbScore }}</span>
        <span v-if="movie.language" class="dot-sep">·</span>
        <span v-if="movie.language">{{ movie.language }}</span>
      </div>
    </div>
  </div>
</template>
