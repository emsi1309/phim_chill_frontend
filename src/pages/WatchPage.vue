<script setup lang="ts">
import { onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'

const route = useRoute()
const router = useRouter()

onMounted(() => {
  router.replace(`/phim/${route.params.slug}`)
})
</script>

<template>
  <div style="display:flex;align-items:center;justify-content:center;height:100vh;color:#64748b">
    Đang chuyển hướng...
  </div>
</template>
