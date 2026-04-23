<script setup lang="ts">
withDefaults(defineProps<{
  theme?: 'light' | 'dark'
  compact?: boolean
  showRight?: boolean
}>(), {
  theme: 'light',
  compact: false,
  showRight: true,
})

const emit = defineEmits<{
  menu: []
  search: []
  more: []
  profile: []
}>()
</script>

<template>
  <view class="topbar" :class="[theme, { compact }]">
    <view class="topbar-side left">
      <view class="icon-chip menu-chip" @click="emit('menu')">
        <text class="menu-line" />
        <text class="menu-line" />
        <text class="menu-line" />
      </view>
      <view class="icon-chip search-chip" @click="emit('search')">
        <text class="search-ring" />
        <text class="search-handle" />
      </view>
    </view>
    <view class="brand">
      <view class="brand-title">
        CAMPUS GO
      </view>
      <view class="brand-subtitle">
        SECONDHAND MARKET
      </view>
    </view>
    <view class="topbar-side right" :class="{ hidden: !showRight }">
      <view class="icon-chip" @click="emit('more')">
        ⋯
      </view>
      <view class="icon-chip" @click="emit('profile')">
        <text class="profile-ring" />
      </view>
    </view>
  </view>
</template>

<style scoped lang="scss">
.topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12rpx;
}

.topbar.compact {
  padding-top: 8rpx;
}

.topbar-side {
  display: flex;
  align-items: center;
  gap: 22rpx;
  min-width: 148rpx;
}

.topbar-side.right {
  justify-content: flex-end;
}

.topbar-side.right.hidden {
  visibility: hidden;
}

.icon-chip {
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  width: 52rpx;
  height: 52rpx;
  font-size: 34rpx;
  line-height: 1;
}

.brand {
  text-align: center;
}

.brand-title {
  font-size: 26rpx;
  font-weight: 800;
  letter-spacing: 3.4rpx;
}

.brand-subtitle {
  margin-top: 4rpx;
  font-size: 15rpx;
  letter-spacing: 1.8rpx;
  opacity: 0.72;
}

.menu-chip {
  flex-direction: column;
  gap: 6rpx;
}

.menu-line {
  display: block;
  width: 26rpx;
  height: 3rpx;
  border-radius: 999rpx;
  background: currentColor;
}

.search-ring {
  width: 20rpx;
  height: 20rpx;
  border: 3rpx solid currentColor;
  border-radius: 50%;
}

.search-handle {
  position: absolute;
  right: 8rpx;
  bottom: 10rpx;
  width: 12rpx;
  height: 3rpx;
  border-radius: 999rpx;
  background: currentColor;
  transform: rotate(45deg);
  transform-origin: center;
}

.profile-ring {
  width: 22rpx;
  height: 22rpx;
  border: 3rpx solid currentColor;
  border-radius: 50%;
}

.topbar.light {
  color: #fff;
}

.topbar.dark {
  color: var(--campus-ink);
}
</style>
