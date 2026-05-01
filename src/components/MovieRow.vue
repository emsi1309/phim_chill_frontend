<script setup lang="ts">
import MovieCard from './MovieCard.vue'

defineProps<{
  title: string
  movies: any[]
  link?: string
}>()
</script>

<template>
  <section class="section" v-if="movies.length">
    <div class="container">
      <div class="section-header">
        <h2 class="section-title">{{ title }}</h2>
        <router-link v-if="link" :to="link" class="section-link">Xem thêm →</router-link>
      </div>
      <div class="movie-row">
        <div class="movie-row-inner">
          <MovieCard v-for="m in movies" :key="m.id" :movie="m" />
        </div>
      </div>
    </div>
  </section>
</template>
