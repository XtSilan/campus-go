<script setup lang="ts">
defineProps<{
  title: string
  description?: string
}>()
</script>

<template>
  <view class="header">
    <view>
      <view class="title">
        {{ title }}
      </view>
      <view v-if="description" class="description">
        {{ description }}
      </view>
    </view>
    <slot />
  </view>
</template>

<style scoped lang="scss">
.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20rpx;
}

.title {
  font-size: 36rpx;
  font-weight: 800;
  letter-spacing: -0.6rpx;
  color: var(--campus-ink);
}

.description {
  margin-top: 8rpx;
  font-size: 24rpx;
  color: var(--campus-muted);
  line-height: 1.6;
}
</style>
