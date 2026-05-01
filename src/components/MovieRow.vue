<script setup lang="ts">
import { ref } from 'vue'
import MovieCard from './MovieCard.vue'

const props = defineProps<{
  title: string
  movies: any[]
  link?: string
}>()

const rowRef = ref<HTMLElement | null>(null)

const scrollLeft = () => {
  rowRef.value?.scrollBy({ left: -600, behavior: 'smooth' })
}
const scrollRight = () => {
  rowRef.value?.scrollBy({ left: 600, behavior: 'smooth' })
}
</script>

<template>
  <section class="section" v-if="movies.length">
    <div class="container">
      <div class="section-header">
        <h2 class="section-title">{{ title }}</h2>
        <router-link v-if="link" :to="link" class="section-link">Xem thêm →</router-link>
      </div>
      <div class="row-wrapper">
        <button class="row-arrow row-arrow-left" @click="scrollLeft">‹</button>
        <div class="movie-row" ref="rowRef">
          <div class="movie-row-inner">
            <MovieCard v-for="m in movies" :key="m.id" :movie="m" />
          </div>
        </div>
        <button class="row-arrow row-arrow-right" @click="scrollRight">›</button>
      </div>
    </div>
  </section>
</template>

<style scoped>
.row-wrapper {
  position: relative;
  display: flex;
  align-items: center;
}

.row-arrow {
  position: absolute;
  z-index: 10;
  width: 40px;
  height: 70px;
  background: linear-gradient(to right, rgba(13,13,23,0.95), rgba(13,13,23,0.7));
  border: none;
  color: #e2e8f0;
  font-size: 28px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: opacity 0.2s;
  opacity: 0;
  border-radius: 4px;
}
.row-wrapper:hover .row-arrow { opacity: 1; }
.row-arrow:hover { background: rgba(229,9,20,0.6); }
.row-arrow-left { left: 0; background: linear-gradient(to right, rgba(13,13,23,0.98), rgba(13,13,23,0.5)); }
.row-arrow-right { right: 0; background: linear-gradient(to left, rgba(13,13,23,0.98), rgba(13,13,23,0.5)); }
</style>
