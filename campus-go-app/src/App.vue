<script setup lang="ts">
import { onLaunch } from '@dcloudio/uni-app'
import { useAuthStore } from '@/stores/auth'

onLaunch(async () => {
  const authStore = useAuthStore()
  await authStore.ensureSession()
})
</script>

<style lang="scss">
@import './uni.scss';
</style>
