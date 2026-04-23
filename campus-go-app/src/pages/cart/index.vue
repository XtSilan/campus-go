<script setup lang="ts">
import type { Listing } from '@/types'
import { onShow } from '@dcloudio/uni-app'
import { computed, ref } from 'vue'
import { ensureConversationFromListing } from '@/api/chat'
import AppTabbar from '@/components/AppTabbar.vue'
import EmptyState from '@/components/EmptyState.vue'
import { useAuthStore } from '@/stores/auth'
import { useMarketStore } from '@/stores/market'
import { formatPrice, formatRelativeTime, getCategoryInitial, getListingTone } from '@/utils/format'
import { confirmAction, jumpToLogin, showError, showSuccess } from '@/utils/ui'

const authStore = useAuthStore()
const marketStore = useMarketStore()
const activeTab = ref<'cart' | 'history'>('cart')

const cartCount = computed(() => marketStore.cartListings.length)
const historyCount = computed(() => marketStore.historyListings.length)
const totalCount = computed(() => cartCount.value + historyCount.value)

const currentPanel = computed(() => {
  if (activeTab.value === 'cart') {
    return {
      title: '我的清单',
      emptyTitle: '清单还是空的',
      items: marketStore.cartListings,
    }
  }

  return {
    title: '最近浏览',
    emptyTitle: '还没有浏览记录',
    items: marketStore.historyListings,
  }
})

onShow(async () => {
  if (!authStore.isLoggedIn) {
    return
  }

  try {
    await marketStore.loadCollections({ useCache: true })
  }
  catch (error) {
    showError((error as Error).message)
  }
})

function openDetail(id: number) {
  uni.navigateTo({
    url: `/pages/detail/index?id=${id}`,
  })
}

async function openChat(listing: Listing) {
  if (!authStore.isLoggedIn) {
    jumpToLogin()
    return
  }

  try {
    const conversation = await ensureConversationFromListing(listing.id)
    uni.navigateTo({
      url: `/pages/seller/index?conversationId=${conversation.id}`,
    })
  }
  catch (error) {
    showError((error as Error).message)
  }
}

async function removeFromCart(listing: Listing) {
  const confirmed = await confirmAction('移出清单', `确认将“${listing.title}”从清单移出吗？`)
  if (!confirmed) {
    return
  }

  try {
    await marketStore.flipCart(listing.id)
    showSuccess('已移出清单')
  }
  catch (error) {
    showError((error as Error).message)
  }
}

async function addToCart(listing: Listing) {
  if (!authStore.isLoggedIn) {
    jumpToLogin()
    return
  }

  if (listing.isInCart) {
    activeTab.value = 'cart'
    showSuccess('商品已经在清单里')
    return
  }

  try {
    await marketStore.flipCart(listing.id)
    activeTab.value = 'cart'
    showSuccess('已加入清单')
  }
  catch (error) {
    showError((error as Error).message)
  }
}

function getCoverStyle(listing: Listing) {
  return {
    background: listing.imageUrl
      ? '#f3f0ea'
      : `linear-gradient(135deg, ${getListingTone(listing)}, #d9d2c9)`,
  }
}
</script>

<template>
  <view class="page-shell cart-page">
    <view class="collection-shell">
      <view class="collection-head">
        <view class="head-title">
          清单
        </view>
        <view class="head-meta">
          共 {{ totalCount }} 条
        </view>
      </view>

      <view class="summary-row">
        <view class="summary-card">
          <text class="summary-value">{{ cartCount }}</text>
          <text class="summary-label">购物车</text>
        </view>
        <view class="summary-card">
          <text class="summary-value">{{ historyCount }}</text>
          <text class="summary-label">最近浏览</text>
        </view>
      </view>

      <view class="segment-row">
        <view class="segment" :class="{ active: activeTab === 'cart' }" @click="activeTab = 'cart'">
          购物车
        </view>
        <view class="segment" :class="{ active: activeTab === 'history' }" @click="activeTab = 'history'">
          浏览
        </view>
      </view>

      <view v-if="!authStore.isLoggedIn" class="section-card list-card">
        <EmptyState title="登录后查看清单" description="购物车和浏览记录都会跟着账号走，换设备也能继续看。">
          <view class="empty-action">
            <view class="action-btn dark" @click="jumpToLogin">
              前往登录
            </view>
          </view>
        </EmptyState>
      </view>

      <view v-else class="section-card list-card">
        <view class="list-head">
          <view>
            <view class="list-kicker">
              {{ activeTab === 'cart' ? 'Cart Items' : 'Recent Views' }}
            </view>
            <view class="list-title">
              {{ currentPanel.title }}
            </view>
            <view class="list-description">
              {{ currentPanel.description }}
            </view>
          </view>
          <view class="count-badge">
            {{ currentPanel.items.length }}
          </view>
        </view>

        <EmptyState
          v-if="!currentPanel.items.length"
          :title="currentPanel.emptyTitle"
          :description="currentPanel.emptyDescription"
        />

        <view v-else class="list-stack">
          <view
            v-for="item in currentPanel.items"
            :key="`${activeTab}-${item.id}`"
            class="listing-block"
          >
            <view class="listing-user-row">
              <view class="listing-user-main">
                <view class="listing-avatar" :style="{ background: item.ownerAvatarColor || '#d8cfc6' }">
                  {{ getCategoryInitial(item.ownerNickname) }}
                </view>
                <view class="listing-user-copy">
                  <view class="listing-user-name">
                    {{ item.ownerNickname }}
                  </view>
                  <view class="listing-user-meta">
                    {{ item.ownerCampus }} · {{ formatRelativeTime(item.updatedAt) }}
                  </view>
                </view>
              </view>
              <view class="listing-tag">
                {{ item.category }}
              </view>
            </view>

            <view class="listing-body" @click="openDetail(item.id)">
              <view class="listing-media" :style="getCoverStyle(item)">
                <image v-if="item.imageUrl" class="listing-image" :src="item.imageUrl" mode="aspectFill" />
                <view v-else class="listing-mark">
                  {{ getCategoryInitial(item.category) }}
                </view>
              </view>

              <view class="listing-copy">
                <view class="listing-title">
                  {{ item.title }}
                </view>
                <view class="listing-price">
                  {{ formatPrice(item.price, item.type) }}
                </view>
                <view class="listing-desc">
                  {{ item.description }}
                </view>
                <view class="listing-inline-meta">
                  <text>{{ item.condition }}</text>
                  <text>{{ item.location || '校内面交' }}</text>
                  <text>{{ item.views }} 浏览</text>
                </view>
              </view>
            </view>

            <view class="listing-actions">
              <view v-if="activeTab === 'cart'" class="line-btn" @click="removeFromCart(item)">
                移出清单
              </view>
              <view v-else class="line-btn" @click="addToCart(item)">
                {{ item.isInCart ? '已在清单' : '加入清单' }}
              </view>
              <view class="solid-btn" @click="openChat(item)">
                聊一聊
              </view>
            </view>
          </view>
        </view>
      </view>
    </view>

    <AppTabbar current="cart" />
  </view>
</template>

<style scoped lang="scss">
.cart-page {
  padding-top: 24rpx;
}

.collection-shell {
  padding: 18rpx 0 200rpx;
  background: #f9f9f7;
}

.collection-head {
  margin: 26rpx 24rpx 0;
  padding-bottom: 24rpx;
  border-bottom: 1px solid #eee6de;
}

.head-title {
  font-size: 48rpx;
  line-height: 1.12;
  font-weight: 800;
  color: var(--campus-ink);
}

.head-text {
  margin-top: 14rpx;
  font-size: 24rpx;
  line-height: 1.7;
  color: var(--campus-muted);
}

.head-meta {
  margin-top: 18rpx;
  font-size: 24rpx;
  font-weight: 700;
  color: var(--campus-ink);
}

.summary-row {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16rpx;
  margin: 18rpx 24rpx 0;
}

.summary-card {
  padding: 24rpx 20rpx;
  border-radius: 24rpx;
  background: #fff;
  border: 1px solid #eee6de;
}

.summary-value {
  display: block;
  font-size: 40rpx;
  font-weight: 800;
  color: var(--campus-ink);
}

.summary-label {
  margin-top: 10rpx;
  display: block;
  font-size: 22rpx;
  color: var(--campus-muted);
}

.segment-row {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12rpx;
  margin: 18rpx 24rpx 0;
  padding: 12rpx;
  border-radius: 999rpx;
  background: #fff;
  border: 1px solid #eee6de;
}

.segment {
  min-height: 76rpx;
  border-radius: 999rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24rpx;
  font-weight: 700;
  color: var(--campus-muted);
}

.segment.active {
  background: #111;
  color: #fff;
}

.list-card {
  margin-top: 18rpx;
}

.list-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 20rpx;
}

.list-kicker {
  font-size: 20rpx;
  text-transform: uppercase;
  letter-spacing: 2rpx;
  color: var(--campus-muted);
}

.list-title {
  margin-top: 10rpx;
  font-size: 38rpx;
  font-weight: 700;
  color: var(--campus-ink);
}

.list-description {
  margin-top: 12rpx;
  max-width: 92%;
  font-size: 24rpx;
  line-height: 1.7;
  color: var(--campus-muted);
}

.count-badge {
  min-width: 82rpx;
  height: 72rpx;
  padding: 0 20rpx;
  border-radius: 999rpx;
  border: 1px solid #eee6de;
  background: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24rpx;
  font-weight: 700;
}

.list-stack {
  display: flex;
  flex-direction: column;
  gap: 22rpx;
  margin-top: 24rpx;
}

.listing-block {
  padding: 22rpx;
  border-radius: 28rpx;
  background: #fff;
  border: 1px solid rgba(17, 17, 17, 0.06);
}

.listing-user-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16rpx;
}

.listing-user-main {
  display: flex;
  align-items: center;
  gap: 16rpx;
  min-width: 0;
}

.listing-avatar {
  width: 72rpx;
  height: 72rpx;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-size: 24rpx;
  font-weight: 700;
  flex-shrink: 0;
}

.listing-user-copy {
  min-width: 0;
}

.listing-user-name {
  font-size: 26rpx;
  font-weight: 700;
  color: #111;
}

.listing-user-meta {
  margin-top: 8rpx;
  font-size: 20rpx;
  color: #8d8d8d;
}

.listing-tag {
  flex-shrink: 0;
  padding: 10rpx 16rpx;
  border-radius: 999rpx;
  background: #f5f0e8;
  font-size: 20rpx;
  color: #7a6d60;
}

.listing-body {
  display: grid;
  grid-template-columns: 220rpx minmax(0, 1fr);
  gap: 18rpx;
  margin-top: 18rpx;
}

.listing-media {
  position: relative;
  overflow: hidden;
  height: 220rpx;
  border-radius: 22rpx;
}

.listing-image {
  width: 100%;
  height: 100%;
}

.listing-mark {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 42rpx;
  font-weight: 800;
  color: rgba(255, 255, 255, 0.92);
}

.listing-copy {
  min-width: 0;
}

.listing-title {
  font-size: 28rpx;
  line-height: 1.45;
  font-weight: 800;
  color: #111;
}

.listing-price {
  margin-top: 10rpx;
  font-size: 34rpx;
  line-height: 1.1;
  font-weight: 900;
  color: #ff5a3c;
}

.listing-desc {
  margin-top: 12rpx;
  font-size: 22rpx;
  line-height: 1.7;
  color: #666;
  display: -webkit-box;
  overflow: hidden;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
}

.listing-inline-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 12rpx;
  margin-top: 14rpx;
  font-size: 20rpx;
  color: #8d8d8d;
}

.listing-actions {
  display: flex;
  justify-content: flex-end;
  gap: 14rpx;
  margin-top: 22rpx;
}

.line-btn,
.solid-btn {
  min-width: 156rpx;
  min-height: 72rpx;
  padding: 0 24rpx;
  border-radius: 999rpx;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 22rpx;
  font-weight: 700;
}

.line-btn {
  border: 1px solid rgba(17, 17, 17, 0.1);
  color: #666;
  background: #fff;
}

.solid-btn {
  background: #ffd81a;
  color: #111;
}

.empty-action {
  margin-top: 18rpx;
}

.action-btn {
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

.action-btn.dark {
  background: var(--campus-dark);
  color: #fff;
}
</style>
