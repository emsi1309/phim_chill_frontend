<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import TheNavbar from './components/TheNavbar.vue'
import logoNoBg from './assets/logo-no-bg.png'

const route = useRoute()
const showNavbar = computed(() => route.path !== '/auth')
</script>

<template>
  <TheNavbar v-if="showNavbar" />
  <router-view />
  <footer v-if="showNavbar" class="footer">
    <div class="container footer-inner">
      <div class="footer-logo">
        <img :src="logoNoBg" alt="PhimChill" class="logo-image" />
        <span>PhimChill</span>
      </div>
      <p>© 2026 PhimChill · Xem phim online miễn phí</p>
    </div>
  </footer>
</template>
