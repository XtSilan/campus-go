<script setup lang="ts">
defineProps<{
  title: string
  description: string
}>()
</script>

<template>
  <view class="empty-card">
    <view class="empty-title">
      {{ title }}
    </view>
    <view class="empty-text">
      {{ description }}
    </view>
    <slot />
  </view>
</template>

<style scoped lang="scss">
.empty-card {
  margin-top: 24rpx;
  padding: 40rpx 28rpx;
  border-radius: 30rpx;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.92), rgba(245, 243, 237, 0.98));
  border: 1px dashed rgba(16, 16, 16, 0.14);
  text-align: center;
}

.empty-title {
  font-size: 32rpx;
  font-weight: 800;
  color: var(--campus-ink);
}

.empty-text {
  margin-top: 12rpx;
  font-size: 24rpx;
  line-height: 1.7;
  color: var(--campus-muted);
}
</style>
