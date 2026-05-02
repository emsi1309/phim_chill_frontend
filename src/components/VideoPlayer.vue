<script setup lang="ts">
import { ref, watch, onUnmounted, computed, nextTick } from 'vue'

const VOL_KEY = 'phimchill_player_volume_v1'

const props = withDefaults(
  defineProps<{
    src: string
    /** localStorage key để lưu tiến độ (tập / phim) */
    progressKey?: string | null
    /** Sau khi user chọn "Tiếp tục" — nhảy tới giây này, không tự phát */
    resumeSeconds?: number
    /** Tắt khi đang chờ popup tiếp tục (không ghi đè progress) */
    saveProgress?: boolean
  }>(),
  {
    progressKey: null,
    resumeSeconds: 0,
    saveProgress: true,
  }
)

const emit = defineEmits<{ ended: [] }>()

const videoEl = ref<HTMLVideoElement | null>(null)
let hlsInstance: any = null
let lastProgressWrite = 0

const isHls = computed(() =>
  !!props.src && (props.src.includes('.m3u8') || props.src.includes('m3u8'))
)

const isEmbed = computed(() => !!props.src && !isHls.value)

function readSavedVolume(): number {
  const v = parseFloat(localStorage.getItem(VOL_KEY) || '1')
  return Number.isFinite(v) && v >= 0 && v <= 1 ? v : 1
}

function applyVolume(el: HTMLVideoElement) {
  el.volume = readSavedVolume()
}

function saveProgressSnapshot(el: HTMLVideoElement) {
  if (!props.progressKey || !props.saveProgress || !isHls.value) return
  const dur = el.duration
  const payload = {
    seconds: el.currentTime,
    duration: Number.isFinite(dur) ? dur : undefined,
    updatedAt: Date.now(),
  }
  try {
    localStorage.setItem(props.progressKey, JSON.stringify(payload))
  } catch {
    /* quota */
  }
}

function clearSavedProgress() {
  if (!props.progressKey) return
  try {
    localStorage.removeItem(props.progressKey)
  } catch {
    /* ignore */
  }
}

function bindVideoProgressEvents(el: HTMLVideoElement) {
  if (el.dataset.phimchillBound === '1') return
  el.dataset.phimchillBound = '1'
  el.addEventListener('volumechange', () => {
    try {
      localStorage.setItem(VOL_KEY, String(el.volume))
    } catch {
      /* ignore */
    }
  })
  el.addEventListener('timeupdate', () => {
    if (!props.progressKey || !props.saveProgress) return
    const now = Date.now()
    if (now - lastProgressWrite < 2800) return
    lastProgressWrite = now
    saveProgressSnapshot(el)
  })
  el.addEventListener('seeked', () => {
    if (!props.progressKey || !props.saveProgress) return
    saveProgressSnapshot(el)
  })
}

function applyResumeSeek(el: HTMLVideoElement, seconds: number) {
  if (!seconds || seconds <= 0) return
  const apply = () => {
    const dur = el.duration
    let t = seconds
    if (Number.isFinite(dur) && dur > 0) t = Math.min(seconds, Math.max(0, dur - 0.5))
    el.currentTime = t
  }
  if (el.readyState >= 1) apply()
  else el.addEventListener('loadedmetadata', apply, { once: true })
}

function onPlaybackEnded() {
  clearSavedProgress()
  emit('ended')
}

const loadHls = async (url: string) => {
  await nextTick()
  if (!videoEl.value) return
  const el = videoEl.value
  applyVolume(el)
  bindVideoProgressEvents(el)

  const HlsLib = (await import('hls.js')).default
  if (HlsLib.isSupported()) {
    if (hlsInstance) {
      hlsInstance.destroy()
      hlsInstance = null
    }
    hlsInstance = new HlsLib({ enableWorker: true, lowLatencyMode: false })
    hlsInstance.loadSource(url)
    hlsInstance.attachMedia(el)
    hlsInstance.on(HlsLib.Events.MANIFEST_PARSED, () => {
      applyVolume(el)
      if (props.resumeSeconds > 0) applyResumeSeek(el, props.resumeSeconds)
    })
  } else if (el.canPlayType('application/vnd.apple.mpegurl')) {
    el.src = url
    el.addEventListener(
      'loadedmetadata',
      () => {
        applyVolume(el)
        if (props.resumeSeconds > 0) applyResumeSeek(el, props.resumeSeconds)
      },
      { once: true }
    )
  }
}

watch(
  () => props.resumeSeconds,
  async (sec) => {
    if (!isHls.value || !videoEl.value || sec == null || sec <= 0) return
    await nextTick()
    applyResumeSeek(videoEl.value, sec)
  }
)

watch(
  () => props.src,
  async (newSrc) => {
    if (!newSrc) return
    if (isHls.value) {
      await loadHls(newSrc)
    } else if (hlsInstance) {
      hlsInstance.destroy()
      hlsInstance = null
    }
  },
  { flush: 'post', immediate: true }
)

onUnmounted(() => {
  if (hlsInstance) {
    hlsInstance.destroy()
    hlsInstance = null
  }
})
</script>

<template>
  <div class="video-player-wrap">
    <video
      v-if="isHls"
      ref="videoEl"
      controls
      playsinline
      preload="metadata"
      @ended="onPlaybackEnded"
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
    <div v-else class="no-src-placeholder">Chọn nguồn phát để xem</div>
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
