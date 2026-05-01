import { createRouter, createWebHistory } from 'vue-router'
import HomePage from './pages/HomePage.vue'
import MovieDetailPage from './pages/MovieDetailPage.vue'
import WatchEpisodePage from './pages/WatchEpisodePage.vue'
import AuthPage from './pages/AuthPage.vue'

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', component: HomePage },
    { path: '/auth', component: AuthPage },
    // New SEO-friendly routes
    { path: '/phim/:slug', component: MovieDetailPage },
    { path: '/phim/:slug/tap-:episode', component: WatchEpisodePage },
    // Legacy redirect
    { path: '/watch/:slug', redirect: to => ({ path: `/phim/${to.params.slug}` }) },
  ],
  scrollBehavior: () => ({ top: 0 }),
})
