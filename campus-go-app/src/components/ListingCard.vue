<script setup lang="ts">
import type { Listing } from '@/types'
import { computed } from 'vue'
import { formatPrice, formatRelativeTime, getCategoryInitial, getListingTone } from '@/utils/format'

const props = withDefaults(defineProps<{
  listing: Listing
  ownerMode?: boolean
  mode?: 'grid' | 'row'
}>(), {
  ownerMode: false,
  mode: 'row',
})

const emit = defineEmits<{
  detail: [id: number]
  edit: [id: number]
  remove: [id: number]
  cart: [id: number]
}>()

const coverStyle = computed(() => ({
  background: props.listing.imageUrl
    ? '#f0f0f0'
    : `linear-gradient(160deg, ${getListingTone(props.listing)}, rgba(0,0,0,0.08))`,
}))
</script>

<template>
  <view class="listing-card" :class="[mode, { 'owner-layout': ownerMode }]" @click="emit('detail', listing.id)">
    <view class="card-img" :style="coverStyle">
      <image v-if="listing.imageUrl" class="cover-image" :src="listing.imageUrl" mode="aspectFill" />
      <view v-else class="cover-mark">
        {{ getCategoryInitial(listing.category) }}
      </view>
    </view>

    <view class="card-info">
      <view class="card-kicker">
        {{ listing.type === 'supply' ? '在售商品' : '求购需求' }}
      </view>
      <view class="card-title">
        {{ listing.title }}
      </view>
      <view class="card-desc">
        {{ listing.description }}
      </view>
      <view class="card-bottom">
        <view class="price-wrap">
          <text class="price-text">{{ formatPrice(listing.price, listing.type) }}</text>
          <text class="price-meta">{{ listing.ownerNickname }} · {{ formatRelativeTime(listing.createdAt) }}</text>
        </view>
        <view v-if="!ownerMode" class="bag-btn" @click.stop="emit('cart', listing.id)">
          {{ listing.isInCart ? '已加入' : '加入' }}
        </view>
      </view>

      <view v-if="ownerMode" class="owner-actions" @click.stop>
        <view class="line-btn" @click="emit('edit', listing.id)">
          编辑
        </view>
        <view class="line-btn warn" @click="emit('remove', listing.id)">
          删除
        </view>
      </view>
      <view v-else class="meta-actions" @click.stop>
        <view class="mini-link">
          {{ listing.category }}
        </view>
        <view class="mini-link">
          {{ formatRelativeTime(listing.updatedAt) }}
        </view>
      </view>
    </view>
  </view>
</template>

<style scoped lang="scss">
.listing-card {
  overflow: hidden;
  background: #fff;
  border-radius: 10rpx;
  border: 1px solid rgba(17, 17, 17, 0.06);
}

.listing-card.row {
  display: grid;
  grid-template-columns: 180rpx minmax(0, 1fr);
  margin-top: 18rpx;
  align-items: start;
}

.listing-card.row.owner-layout {
  grid-template-columns: minmax(0, 1fr);
}

.listing-card.grid {
  margin-top: 0;
}

.card-img {
  position: relative;
  overflow: hidden;
  aspect-ratio: 1 / 1;
}

.listing-card.row .card-img {
  height: 100%;
  min-height: 180rpx;
}

.listing-card.row.owner-layout .card-img {
  height: 320rpx;
  min-height: 320rpx;
  border-radius: 0;
}

.cover-image {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}

.cover-mark {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 42rpx;
  font-weight: 800;
  color: rgba(255, 255, 255, 0.92);
  letter-spacing: 2rpx;
}

.card-info {
  padding: 16rpx 16rpx 18rpx;
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.card-kicker {
  font-size: 18rpx;
  color: #999;
  letter-spacing: 1rpx;
}

.card-title {
  margin-top: 8rpx;
  font-size: 24rpx;
  line-height: 1.45;
  font-weight: 800;
  color: var(--campus-ink);
  word-break: break-all;
}

.card-desc {
  margin-top: 8rpx;
  font-size: 20rpx;
  line-height: 1.6;
  color: var(--campus-muted);
  display: -webkit-box;
  overflow: hidden;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  word-break: break-all;
}

.listing-card.owner-layout .card-desc {
  -webkit-line-clamp: 3;
}

.listing-card.owner-layout .card-bottom {
  align-items: flex-start;
}

.card-bottom {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 12rpx;
  margin-top: 14rpx;
  flex-wrap: wrap;
}

.price-wrap {
  display: flex;
  flex-direction: column;
  gap: 6rpx;
  min-width: 0;
}

.price-text {
  font-size: 22rpx;
  font-weight: 700;
  color: #ff4d3a;
}

.price-meta {
  font-size: 18rpx;
  color: var(--campus-muted);
  word-break: break-all;
}

.bag-btn {
  min-width: 72rpx;
  height: 48rpx;
  padding: 0 14rpx;
  border-radius: 999rpx;
  background: #111;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-size: 18rpx;
}

.meta-actions,
.owner-actions {
  display: flex;
  gap: 10rpx;
  margin-top: 14rpx;
  flex-wrap: wrap;
}

.mini-link,
.line-btn {
  min-height: 42rpx;
  padding: 0 14rpx;
  border-radius: 999rpx;
  border: 1px solid rgba(17, 17, 17, 0.08);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 18rpx;
  color: var(--campus-muted);
}

.owner-actions {
  margin-top: auto;
  padding-top: 16rpx;
}

.listing-card.owner-layout .line-btn {
  flex: 1;
  min-width: 0;
}

.listing-card.owner-layout .owner-actions {
  width: 100%;
  justify-content: stretch;
  gap: 14rpx;
}

.line-btn.warn {
  color: #b35d4c;
}
</style>
