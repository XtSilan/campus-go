<script setup lang="ts">
import { onLoad } from '@dcloudio/uni-app'
import { computed } from 'vue'
import { ensureConversationFromListing } from '@/api/chat'
import EmptyState from '@/components/EmptyState.vue'
import { useAuthStore } from '@/stores/auth'
import { useMarketStore } from '@/stores/market'
import { formatPrice, formatRelativeTime, getCategoryInitial, getListingTone } from '@/utils/format'
import { jumpToLogin, showError, showSuccess } from '@/utils/ui'

const descriptionBreakPattern = /\n+/

const authStore = useAuthStore()
const marketStore = useMarketStore()

const listing = computed(() => marketStore.currentListing)
const listingImages = computed(() => listing.value?.imageUrls?.length ? listing.value.imageUrls : (listing.value?.imageUrl ? [listing.value.imageUrl] : []))
const isOwnListing = computed(() => Boolean(listing.value && authStore.currentUser?.id === listing.value.ownerId))
const sellerStatus = computed(() => (listing.value ? `${formatRelativeTime(listing.value.updatedAt)}活跃` : '最近活跃'))
const searchHint = computed(() => (listing.value ? listing.value.title.slice(0, 16) : '搜索校园闲置'))
const followLabel = computed(() => {
  if (!listing.value) {
    return '关注'
  }

  if (isOwnListing.value) {
    return '我的发布'
  }

  return listing.value.isFollowingOwner ? '已关注' : '关注'
})
const descBlocks = computed(() => {
  if (!listing.value) {
    return []
  }

  return listing.value.description
    .split(descriptionBreakPattern)
    .map(item => item.trim())
    .filter(Boolean)
})

const serviceCards = computed(() => {
  if (!listing.value) {
    return []
  }

  return [
    {
      note: '交易方式',
      title: listing.value.location || '校内面交',
      meta: '聊清时间地点后当面交易',
    },
    {
      note: '沟通方式',
      title: '平台即时聊天',
      meta: `和 ${listing.value.ownerNickname} 直接聊一聊`,
    },
    {
      note: '商品状态',
      title: listing.value.condition,
      meta: listing.value.category,
    },
  ]
})

const coverStyle = computed(() => ({
  background: listingImages.value.length
    ? '#f6f3ef'
    : `linear-gradient(135deg, ${listing.value ? getListingTone(listing.value) : '#8d7b6c'}, #d8d2c9)`,
}))

onLoad(async (query) => {
  if (!query?.id) {
    return
  }

  try {
    await marketStore.loadListingDetail(Number(query.id))
    if (authStore.isLoggedIn) {
      await marketStore.pushHistory(Number(query.id))
    }
  }
  catch (error) {
    showError((error as Error).message)
  }
})

function goBack() {
  const pages = getCurrentPages()

  if (pages.length > 1) {
    uni.navigateBack({
      delta: 1,
      fail: () => {
        uni.reLaunch({
          url: '/pages/buyer/index',
        })
      },
    })
    return
  }

  uni.reLaunch({
    url: '/pages/buyer/index',
  })
}

function previewListingImage(index: number) {
  if (!listingImages.value.length) {
    return
  }

  uni.previewImage({
    urls: listingImages.value,
    current: listingImages.value[index] || listingImages.value[0],
  })
}

async function openChat() {
  if (!listing.value) {
    return
  }

  if (!authStore.isLoggedIn) {
    jumpToLogin()
    return
  }

  try {
    const conversation = await ensureConversationFromListing(listing.value.id)
    uni.navigateTo({
      url: `/pages/seller/index?conversationId=${conversation.id}`,
    })
  }
  catch (error) {
    showError((error as Error).message)
  }
}

async function handleCartAction() {
  if (!listing.value) {
    return
  }

  if (!authStore.isLoggedIn) {
    jumpToLogin()
    return
  }

  if (listing.value.isInCart) {
    uni.reLaunch({
      url: '/pages/cart/index',
    })
    return
  }

  try {
    await marketStore.flipCart(listing.value.id)
    showSuccess('已加入清单')
  }
  catch (error) {
    showError((error as Error).message)
  }
}

async function toggleSellerFollow() {
  if (!listing.value || isOwnListing.value) {
    return
  }

  if (!authStore.isLoggedIn) {
    jumpToLogin()
    return
  }

  try {
    const active = await marketStore.flipFollowUser(listing.value.ownerId)
    showSuccess(active ? '已关注卖家' : '已取消关注')
  }
  catch (error) {
    showError((error as Error).message)
  }
}
</script>

<template>
  <view class="detail-page">
    <template v-if="listing">
      <view class="detail-topbar">
        <view class="back-btn" @click="goBack">
          <text class="back-arrow">‹</text>
        </view>
        <view class="search-pill">
          <text class="search-icon">⌕</text>
          <text class="search-text">{{ searchHint }}</text>
        </view>
        <view class="topbar-action">
          ⋯
        </view>
      </view>

      <scroll-view class="detail-scroll" scroll-y enable-back-to-top>
        <view class="seller-strip">
          <view class="seller-main">
            <view class="seller-avatar" :style="{ background: listing.ownerAvatarColor || '#d9d2ca' }">
              {{ getCategoryInitial(listing.ownerNickname) }}
            </view>
            <view class="seller-copy">
              <view class="seller-name-row">
                <text class="seller-name">{{ listing.ownerNickname }}</text>
                <text class="seller-badge" :class="{ active: listing.isFollowingOwner, self: isOwnListing }" @click.stop="toggleSellerFollow">
                  {{ followLabel }}
                </text>
              </view>
              <view class="seller-meta">
                {{ sellerStatus }} · {{ listing.ownerCampus }}
              </view>
            </view>
          </view>
          <view class="seller-stat">
            <text class="seller-stat-value">{{ listing.views }}</text>
            <text class="seller-stat-label">浏览</text>
          </view>
        </view>

        <view class="hero-card">
          <view class="hero-body">
            <view class="hero-title-row">
              <view class="hero-title-wrap">
                <view class="hero-price">
                  {{ formatPrice(listing.price, listing.type) }}
                </view>
                <view class="hero-title">
                  {{ listing.title }}
                </view>
                <view class="hero-meta-line">
                  <text>{{ `${listing.category}` }}</text>
                  <text>{{ `${listing.condition}` }}</text>
                  <text>{{ `浏览 ${listing.views}` }}</text>
                </view>
              </view>
              <view class="hero-side-card">
                <view class="hero-side-mark">
                  校园
                </view>
                <view class="hero-side-text">
                  闲置好物
                </view>
              </view>
            </view>

            <view class="service-row">
              <view v-for="item in serviceCards" :key="item.note" class="service-card">
                <view class="service-note">
                  {{ item.note }}
                </view>
                <view class="service-title">
                  {{ item.title }}
                </view>
                <view class="service-meta">
                  {{ item.meta }}
                </view>
              </view>
            </view>
          </view>
        </view>

        <view class="media-card" :style="coverStyle">
          <scroll-view v-if="listingImages.length" class="media-scroll" scroll-x show-scrollbar="false">
            <view class="media-row">
              <image
                v-for="(image, index) in listingImages"
                :key="`${image}-${index}`"
                class="media-image multi"
                :src="image"
                mode="aspectFill"
                @click="previewListingImage(index)"
              />
            </view>
          </scroll-view>
          <view v-else class="media-mark">
            {{ getCategoryInitial(listing.category) }}
          </view>
        </view>

        <view class="content-card">
          <view class="content-title">
            商品详情
          </view>
          <view v-for="(block, index) in descBlocks" :key="`${listing.id}-${index}`" class="content-paragraph">
            {{ block }}
          </view>
        </view>

        <view class="content-card trust-card">
          <view class="content-title">
            聊天交易提醒
          </view>
          <view class="trust-line">
            平台不托管支付，也不代收发货，建议优先校内当面验货。
          </view>
        </view>

        <view class="spacer" />
      </scroll-view>

      <view class="bottom-bar">
        <view class="bar-btn ghost" @click="handleCartAction">
          {{ listing.isInCart ? '去清单' : '加入购物车' }}
        </view>
        <view class="bar-btn solid" @click="openChat">
          聊一聊
        </view>
      </view>
    </template>

    <view v-else class="page-shell">
      <view class="section-card">
        <EmptyState title="没有找到这条信息" description="它可能已经被删除，或者当前网络请求失败。">
          <view class="empty-action">
            <view class="fallback-btn" @click="goBack">
              返回上一页
            </view>
          </view>
        </EmptyState>
      </view>
    </view>
  </view>
</template>

<style scoped lang="scss">
.detail-page {
  min-height: 100vh;
  background: #f6f6f6;
}

.detail-topbar {
  position: sticky;
  top: 0;
  z-index: 20;
  display: grid;
  grid-template-columns: 72rpx minmax(0, 1fr) 72rpx;
  align-items: center;
  gap: 16rpx;
  padding: 28rpx 24rpx 18rpx;
  background: rgba(246, 246, 246, 0.98);
}

.back-btn,
.topbar-action {
  width: 72rpx;
  height: 72rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #111;
}

.back-arrow {
  font-size: 52rpx;
  line-height: 1;
}

.topbar-action {
  font-size: 34rpx;
}

.search-pill {
  min-height: 72rpx;
  padding: 0 24rpx;
  border-radius: 999rpx;
  background: #fff;
  display: flex;
  align-items: center;
  gap: 14rpx;
  border: 1px solid rgba(17, 17, 17, 0.06);
}

.search-icon {
  font-size: 28rpx;
  color: #9d9d9d;
}

.search-text {
  flex: 1;
  font-size: 22rpx;
  color: #a5a5a5;
}

.detail-scroll {
  height: calc(100vh - 118rpx);
}

.seller-strip {
  margin: 0 24rpx;
  padding: 20rpx 0 18rpx;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20rpx;
}

.seller-main {
  display: flex;
  align-items: center;
  gap: 18rpx;
  min-width: 0;
}

.seller-avatar {
  width: 80rpx;
  height: 80rpx;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-size: 24rpx;
  font-weight: 700;
}

.seller-copy {
  min-width: 0;
}

.seller-name-row {
  display: flex;
  align-items: center;
  gap: 10rpx;
}

.seller-name {
  font-size: 28rpx;
  font-weight: 700;
  color: #111;
}

.seller-badge {
  padding: 6rpx 14rpx;
  border-radius: 999rpx;
  background: #111;
  font-size: 20rpx;
  color: #fff;
  font-weight: 700;
}

.seller-badge.active {
  background: #ece6dd;
  color: #111;
}

.seller-badge.self {
  background: #f2f2f2;
  color: #7f7f7f;
}

.seller-meta {
  margin-top: 8rpx;
  font-size: 22rpx;
  color: #8d8d8d;
}

.seller-stat {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.seller-stat-value {
  font-size: 30rpx;
  font-weight: 700;
  color: #111;
}

.seller-stat-label {
  margin-top: 6rpx;
  font-size: 20rpx;
  color: #8d8d8d;
}

.hero-card,
.content-card,
.media-card {
  margin: 0 24rpx;
  background: #fff;
  border-radius: 28rpx;
}

.hero-body {
  padding: 30rpx 24rpx;
}

.hero-title-row {
  display: flex;
  align-items: flex-start;
  gap: 18rpx;
}

.hero-title-wrap {
  flex: 1;
  min-width: 0;
}

.hero-price {
  font-size: 72rpx;
  line-height: 1;
  font-weight: 900;
  color: #ff4d3a;
}

.hero-title {
  margin-top: 18rpx;
  font-size: 42rpx;
  line-height: 1.24;
  font-weight: 800;
  color: #111;
}

.hero-meta-line {
  display: flex;
  flex-wrap: wrap;
  gap: 14rpx;
  margin-top: 18rpx;
  font-size: 22rpx;
  color: #8d8d8d;
}

.hero-side-card {
  width: 164rpx;
  padding: 20rpx 14rpx;
  border-radius: 24rpx;
  background: linear-gradient(135deg, #dbff3c, #baff20);
  text-align: center;
}

.hero-side-mark {
  font-size: 42rpx;
  line-height: 1;
  font-weight: 900;
  color: #111;
}

.hero-side-text {
  margin-top: 8rpx;
  font-size: 22rpx;
  color: rgba(17, 17, 17, 0.7);
  font-weight: 700;
}

.service-row {
  display: flex;
  gap: 16rpx;
  margin-top: 28rpx;
  overflow-x: auto;
  white-space: nowrap;
}

.service-card {
  flex: 0 0 220rpx;
  min-height: 136rpx;
  padding: 18rpx;
  border-radius: 22rpx;
  border: 1px solid rgba(17, 17, 17, 0.08);
  background: #fff;
}

.service-note {
  font-size: 20rpx;
  color: #8d8d8d;
}

.service-title {
  margin-top: 10rpx;
  font-size: 28rpx;
  line-height: 1.3;
  font-weight: 700;
  color: #111;
}

.service-meta {
  margin-top: 8rpx;
  font-size: 20rpx;
  color: #8d8d8d;
  white-space: normal;
}

.media-card {
  margin-top: 18rpx;
  overflow: hidden;
  min-height: 460rpx;
}

.media-scroll {
  width: 100%;
  white-space: nowrap;
}

.media-row {
  display: inline-flex;
  gap: 16rpx;
  padding: 20rpx;
}

.media-image {
  width: 100%;
  height: 460rpx;
}

.media-image.multi {
  width: 620rpx;
  height: 460rpx;
  border-radius: 24rpx;
  flex-shrink: 0;
}

.media-mark {
  min-height: 460rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 88rpx;
  font-weight: 800;
  color: rgba(255, 255, 255, 0.9);
  letter-spacing: 6rpx;
}

.content-card {
  margin-top: 18rpx;
  padding: 30rpx 24rpx;
}

.content-title {
  font-size: 40rpx;
  font-weight: 800;
  color: #111;
}

.content-paragraph,
.trust-line {
  margin-top: 24rpx;
  font-size: 28rpx;
  line-height: 1.9;
  color: #111;
}

.trust-card {
  margin-top: 18rpx;
}

.spacer {
  height: 180rpx;
}

.bottom-bar {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16rpx;
  align-items: center;
  padding: 18rpx 24rpx calc(18rpx + env(safe-area-inset-bottom));
  background: rgba(255, 255, 255, 0.98);
  border-top: 1px solid rgba(17, 17, 17, 0.06);
}

.bar-btn {
  min-height: 92rpx;
  border-radius: 999rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 30rpx;
  font-weight: 800;
}

.bar-btn.ghost {
  background: #fff6d6;
  color: #111;
  border: 1px solid rgba(255, 216, 26, 0.76);
}

.bar-btn.solid {
  background: #ffd81a;
  color: #111;
}

.empty-action {
  margin-top: 18rpx;
}

.fallback-btn {
  min-height: 88rpx;
  padding: 0 28rpx;
  background: var(--campus-card-soft);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--campus-ink);
  font-size: 24rpx;
  font-weight: 700;
}
</style>
