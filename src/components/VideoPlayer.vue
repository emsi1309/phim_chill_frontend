<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted, computed, nextTick } from 'vue'

const props = defineProps<{ src: string }>()
const emit = defineEmits<{ ended: [] }>()

const videoEl = ref<HTMLVideoElement | null>(null)
let hlsInstance: any = null

const isHls = computed(() =>
  !!props.src && (props.src.includes('.m3u8') || props.src.includes('m3u8'))
)

const isEmbed = computed(() => !!props.src && !isHls.value)

const onEnded = () => emit('ended')

const loadHls = async (url: string) => {
  await nextTick()
  if (!videoEl.value) return
  const HlsLib = (await import('hls.js')).default
  if (HlsLib.isSupported()) {
    if (hlsInstance) { hlsInstance.destroy(); hlsInstance = null }
    hlsInstance = new HlsLib({ enableWorker: true, lowLatencyMode: false })
    hlsInstance.loadSource(url)
    hlsInstance.attachMedia(videoEl.value)
    hlsInstance.on(HlsLib.Events.MANIFEST_PARSED, () => {
      videoEl.value?.play().catch(() => {})
    })
  } else if (videoEl.value.canPlayType('application/vnd.apple.mpegurl')) {
    videoEl.value.src = url
    videoEl.value.play().catch(() => {})
  }
}

watch(() => props.src, async (newSrc) => {
  if (!newSrc) return
  if (isHls.value) {
    await loadHls(newSrc)
  } else if (hlsInstance) {
    hlsInstance.destroy(); hlsInstance = null
  }
}, { flush: 'post' })

onMounted(async () => {
  if (props.src && isHls.value) await loadHls(props.src)
})

onUnmounted(() => {
  if (hlsInstance) { hlsInstance.destroy(); hlsInstance = null }
  videoEl.value?.removeEventListener('ended', onEnded)
})
</script>

<template>
  <div class="video-player-wrap">
    <video
      v-if="isHls"
      ref="videoEl"
      controls
      @ended="onEnded"
      style="width:100%;height:100%;background:#000;display:block"
    />
    <iframe
      v-else-if="isEmbed"
      :src="src"
      allow="autoplay; encrypted-media; fullscreen"
      allowfullscreen
      referrerpolicy="no-referrer"
      style="width:100%;height:100%;border:none;display:block"
    />
    <div
      v-else
      class="no-src-placeholder"
    >
      Chọn nguồn phát để xem
    </div>
  </div>
</template>

<style scoped>
.video-player-wrap {
  width: 100%;
  aspect-ratio: 16/9;
  background: #000;
  overflow: hidden;
}
.no-src-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #64748b;
  font-size: 15px;
  background: var(--bg);
}
</style>
