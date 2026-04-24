<script setup lang="ts">
import type { Listing } from '@/types'
import { computed } from 'vue'
import { formatPrice, formatRelativeTime, getCategoryInitial } from '@/utils/format'

const props = defineProps<{
  listing: Listing
}>()

const emit = defineEmits<{
  detail: [id: number]
}>()

const demandPalette = [
  { outer: '#f6cfd2', accent: '#ffffff' },
  { outer: '#d8f4b7', accent: '#7be3ff' },
  { outer: '#d4e4ff', accent: '#ffd86e' },
  { outer: '#ffd7ee', accent: '#ff8fd0' },
  { outer: '#d9f6ef', accent: '#94f1cb' },
]

const palette = computed(() => demandPalette[props.listing.id % demandPalette.length])
const displayText = computed(() => props.listing.title.trim() || props.listing.description.trim())
const subtitleText = computed(() => {
  const raw = props.listing.description.trim()
  if (!raw || raw === displayText.value) {
    return ''
  }
  return raw
})
</script>

<template>
  <view class="demand-card" @click="emit('detail', listing.id)">
    <template v-if="listing.imageUrl">
      <view class="image-shell">
        <image class="cover-image" :src="listing.imageUrl" mode="widthFix" />
      </view>
      <view class="content-shell with-image">
        <view class="title-text">
          {{ listing.title }}
        </view>
        <view v-if="subtitleText" class="desc-text clamp">
          {{ subtitleText }}
        </view>
      </view>
    </template>

    <template v-else>
      <view class="poster-shell" :style="{ background: palette.outer }">
        <view class="poster-stage">
          <view class="poster-head">
            <view class="avatar-mark">
              {{ getCategoryInitial(listing.ownerNickname) }}
            </view>
            <view class="poster-user-copy">
              <view class="poster-user-name">
                @{{ listing.ownerNickname }}
              </view>
              <view class="poster-user-date">
                {{ formatRelativeTime(listing.createdAt) }}
              </view>
            </view>
          </view>
          <view class="poster-text">
            <text>{{ displayText }}</text>
            <text class="accent-word" :style="{ color: palette.accent }">{{ listing.category }}</text>
          </view>
        </view>
      </view>
      <view class="content-shell">
        <view class="title-text">
          {{ listing.title }}
        </view>
        <view v-if="subtitleText" class="desc-text">
          {{ subtitleText }}
        </view>
      </view>
    </template>

    <view class="meta-row">
      <view class="meta-main">
        <view class="meta-avatar" :style="{ background: listing.ownerAvatarColor || '#e2dbd3' }">
          {{ getCategoryInitial(listing.ownerNickname) }}
        </view>
        <view class="meta-copy">
          <view class="meta-name">
            {{ listing.ownerNickname }}
          </view>
          <view class="meta-time">
            {{ formatRelativeTime(listing.updatedAt) }}
          </view>
        </view>
      </view>
      <view class="meta-side">
        {{ formatPrice(listing.price, listing.type) }}
      </view>
    </view>
  </view>
</template>

<style scoped lang="scss">
.demand-card {
  overflow: hidden;
  border-radius: 24rpx;
  background: #fff;
  break-inside: avoid;
  box-shadow: 0 14rpx 30rpx rgba(17, 17, 17, 0.04);
}

.image-shell {
  background: #f4f4f4;
}

.cover-image {
  width: 100%;
  display: block;
}

.poster-shell {
  padding: 22rpx;
}

.poster-stage {
  min-height: 460rpx;
  padding: 26rpx 24rpx;
  border-radius: 34rpx;
  background: #050505;
}

.poster-head {
  display: flex;
  align-items: center;
  gap: 14rpx;
}

.avatar-mark {
  width: 66rpx;
  height: 66rpx;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.12);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-size: 22rpx;
  font-weight: 700;
  flex-shrink: 0;
}

.poster-user-copy {
  min-width: 0;
}

.poster-user-name {
  font-size: 24rpx;
  color: #fff;
  font-weight: 700;
}

.poster-user-date {
  margin-top: 6rpx;
  font-size: 18rpx;
  color: rgba(255, 255, 255, 0.55);
}

.poster-text {
  margin-top: 52rpx;
  font-size: 64rpx;
  line-height: 1.24;
  font-weight: 900;
  color: #fff;
  word-break: break-word;
}

.poster-text text {
  display: block;
}

.accent-word {
  margin-top: 10rpx;
}

.content-shell {
  padding: 0 22rpx;
}

.content-shell.with-image {
  padding-top: 18rpx;
}

.title-text {
  font-size: 30rpx;
  line-height: 1.45;
  font-weight: 800;
  color: #111;
}

.desc-text {
  margin-top: 10rpx;
  font-size: 22rpx;
  line-height: 1.7;
  color: #666;
}

.desc-text.clamp {
  display: -webkit-box;
  overflow: hidden;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.meta-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16rpx;
  padding: 22rpx;
}

.meta-main {
  display: flex;
  align-items: center;
  gap: 12rpx;
  min-width: 0;
}

.meta-avatar {
  width: 56rpx;
  height: 56rpx;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-size: 18rpx;
  font-weight: 700;
  flex-shrink: 0;
}

.meta-copy {
  min-width: 0;
}

.meta-name {
  font-size: 22rpx;
  color: #222;
  font-weight: 700;
}

.meta-time {
  margin-top: 4rpx;
  font-size: 18rpx;
  color: #999;
}

.meta-side {
  flex-shrink: 0;
  font-size: 22rpx;
  color: #ff4d3a;
  font-weight: 700;
}
</style>
