import { createRouter, createWebHistory } from 'vue-router'
import HomePage from './pages/HomePage.vue'
import WatchPage from './pages/WatchPage.vue'
import AuthPage from './pages/AuthPage.vue'

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', component: HomePage },
    { path: '/auth', component: AuthPage },
    { path: '/watch/:slug', component: WatchPage }
  ]
})
