<script setup lang="ts">
import type { FollowedUserSummary } from '@/types'
import { onShow } from '@dcloudio/uni-app'
import { computed, ref } from 'vue'
import EmptyState from '@/components/EmptyState.vue'
import { useMarketStore } from '@/stores/market'
import { formatRelativeTime, getCategoryInitial } from '@/utils/format'
import { showError, showSuccess } from '@/utils/ui'

const marketStore = useMarketStore()
const activeTab = ref<'all' | 'fresh' | 'mutual'>('all')

const tabItems = computed(() => ([
  {
    key: 'all',
    label: '全部',
    count: marketStore.followedUsers.length,
  },
  {
    key: 'fresh',
    label: '有上新',
    count: marketStore.followedUsers.filter(item => item.activeListingCount > 0).length,
  },
  {
    key: 'mutual',
    label: '互相关注',
    count: marketStore.followedUsers.filter(item => item.isMutual).length,
  },
]))

const visibleUsers = computed(() => {
  if (activeTab.value === 'fresh') {
    return marketStore.followedUsers.filter(item => item.activeListingCount > 0)
  }

  if (activeTab.value === 'mutual') {
    return marketStore.followedUsers.filter(item => item.isMutual)
  }

  return marketStore.followedUsers
})

const summaryText = computed(() => {
  const total = marketStore.followedUsers.length
  const fresh = marketStore.followedUsers.filter(item => item.activeListingCount > 0).length
  return total ? `共关注 ${total} 人，其中 ${fresh} 人最近有内容在挂售或求购。` : '关注感兴趣的人后，这里会开始沉淀他们的上新动态。'
})

onShow(async () => {
  try {
    await marketStore.loadFollows({ useCache: true })
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
    })
    return
  }

  uni.reLaunch({
    url: '/pages/profile/index',
  })
}

function openLatest(user: FollowedUserSummary) {
  if (!user.latestListingId) {
    return
  }

  uni.navigateTo({
    url: `/pages/detail/index?id=${user.latestListingId}`,
  })
}

async function toggleFollow(user: FollowedUserSummary) {
  try {
    const active = await marketStore.flipFollowUser(user.id)
    showSuccess(active ? '已关注' : '已取消关注')
  }
  catch (error) {
    showError((error as Error).message)
  }
}

function activityText(user: FollowedUserSummary) {
  if (user.latestListingTitle) {
    return `最近上新：${user.latestListingTitle}`
  }

  return '最近还没有新的上架内容'
}

function statsText(user: FollowedUserSummary) {
  return `${user.activeSupplyCount} 件闲置 · ${user.activeDemandCount} 条求购`
}
</script>

<template>
  <view class="follow-page">
    <view class="topbar">
      <view class="back-btn" @click="goBack">
        ‹
      </view>
      <view class="topbar-title">
        我的关注
      </view>
      <view class="topbar-side">
        {{ marketStore.followedUsers.length }}
      </view>
    </view>

    <view class="page-body">
      <view class="summary-card">
        <view class="summary-kicker">
          FOLLOWING
        </view>
        <view class="summary-title">
          关注的人
        </view>
        <view class="summary-desc">
          {{ summaryText }}
        </view>
      </view>

      <view class="tabs">
        <view
          v-for="item in tabItems"
          :key="item.key"
          class="tab-pill"
          :class="{ active: activeTab === item.key }"
          @click="activeTab = item.key as 'all' | 'fresh' | 'mutual'"
        >
          {{ item.label }} {{ item.count }}
        </view>
      </view>

      <view class="list-shell">
        <EmptyState
          v-if="!visibleUsers.length"
          title="还没有匹配的关注对象"
          description="先去商品详情里点一下关注，或者切换上面的筛选看看。"
        />

        <view
          v-for="item in visibleUsers"
          v-else
          :key="item.id"
          class="follow-card"
          @click="openLatest(item)"
        >
          <view class="follow-main">
            <view class="follow-avatar" :style="{ background: item.avatarColor || '#e3dbd1' }">
              {{ getCategoryInitial(item.nickname) }}
            </view>

            <view class="follow-copy">
              <view class="follow-name-row">
                <text class="follow-name">{{ item.nickname }}</text>
                <text v-if="item.isMutual" class="follow-chip mutual">互粉</text>
                <text v-else class="follow-chip">已关注</text>
              </view>

              <view class="follow-meta">
                {{ item.campus }}
              </view>

              <view class="follow-tagline">
                {{ item.tagline || '这个人还没有写个性签名' }}
              </view>

              <view class="follow-activity">
                {{ activityText(item) }}
              </view>

              <view class="follow-stats">
                <text>{{ statsText(item) }}</text>
                <text v-if="item.latestListingUpdatedAt">{{ formatRelativeTime(item.latestListingUpdatedAt) }}</text>
              </view>
            </view>
          </view>

          <view class="follow-side">
            <view
              v-if="item.latestListingImageUrl"
              class="thumb-cover"
              :style="{ backgroundImage: `url(${item.latestListingImageUrl})` }"
            />
            <view v-else class="thumb-cover fallback">
              {{ item.activeListingCount ? '上新' : '关注' }}
            </view>

            <view class="follow-action" @click.stop="toggleFollow(item)">
              {{ item.isMutual ? '互粉中' : '已关注' }}
            </view>
          </view>
        </view>
      </view>
    </view>
  </view>
</template>

<style scoped lang="scss">
.follow-page {
  min-height: 100vh;
  background: #f6f6f6;
}

.topbar {
  display: grid;
  grid-template-columns: 64rpx minmax(0, 1fr) 72rpx;
  align-items: center;
  gap: 16rpx;
  padding: calc(22rpx + env(safe-area-inset-top)) 22rpx 10rpx;
}

.back-btn {
  width: 64rpx;
  height: 64rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 54rpx;
  line-height: 1;
  color: #111;
}

.topbar-title {
  text-align: center;
  font-size: 36rpx;
  font-weight: 800;
  color: #111;
}

.topbar-side {
  text-align: right;
  font-size: 24rpx;
  color: #999;
}

.page-body {
  padding: 18rpx 16rpx 40rpx;
}

.summary-card,
.list-shell {
  border-radius: 30rpx;
  background: #fff;
}

.summary-card {
  padding: 28rpx;
}

.summary-kicker {
  font-size: 18rpx;
  letter-spacing: 2rpx;
  color: #9a9a9a;
}

.summary-title {
  margin-top: 8rpx;
  font-size: 46rpx;
  font-weight: 800;
  color: #111;
}

.summary-desc {
  margin-top: 14rpx;
  font-size: 24rpx;
  line-height: 1.7;
  color: #8f8f8f;
}

.tabs {
  display: flex;
  gap: 14rpx;
  margin: 20rpx 0 16rpx;
  overflow-x: auto;
  white-space: nowrap;
}

.tab-pill {
  min-width: 148rpx;
  height: 72rpx;
  padding: 0 22rpx;
  border-radius: 999rpx;
  background: #ececec;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: #8d8d8d;
  font-size: 24rpx;
  font-weight: 700;
  flex-shrink: 0;
}

.tab-pill.active {
  background: #111;
  color: #fff;
}

.list-shell {
  padding: 16rpx 24rpx;
}

.follow-card {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 20rpx;
  padding: 24rpx 0;
}

.follow-card + .follow-card {
  border-top: 1px solid #f0f0f0;
}

.follow-main {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: flex-start;
  gap: 18rpx;
}

.follow-avatar {
  width: 88rpx;
  height: 88rpx;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-size: 28rpx;
  font-weight: 800;
  flex-shrink: 0;
}

.follow-copy {
  min-width: 0;
}

.follow-name-row {
  display: flex;
  align-items: center;
  gap: 10rpx;
  flex-wrap: wrap;
}

.follow-name {
  font-size: 30rpx;
  font-weight: 800;
  color: #111;
}

.follow-chip {
  min-height: 40rpx;
  padding: 0 12rpx;
  border-radius: 999rpx;
  background: #f1f1f1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 18rpx;
  color: #777;
}

.follow-chip.mutual {
  background: #fff1b8;
  color: #111;
}

.follow-meta,
.follow-tagline,
.follow-activity,
.follow-stats {
  margin-top: 8rpx;
  font-size: 22rpx;
  line-height: 1.6;
}

.follow-meta {
  color: #9a9a9a;
}

.follow-tagline {
  color: #666;
}

.follow-activity {
  color: #111;
}

.follow-stats {
  display: flex;
  flex-wrap: wrap;
  gap: 14rpx;
  color: #a1a1a1;
}

.follow-side {
  width: 132rpx;
  flex-shrink: 0;
}

.thumb-cover {
  width: 132rpx;
  height: 132rpx;
  border-radius: 24rpx;
  background-color: #ebe4db;
  background-size: cover;
  background-position: center;
}

.thumb-cover.fallback {
  display: flex;
  align-items: center;
  justify-content: center;
  color: #111;
  font-size: 24rpx;
  font-weight: 700;
}

.follow-action {
  margin-top: 14rpx;
  min-height: 56rpx;
  border-radius: 999rpx;
  background: #111;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-size: 20rpx;
  font-weight: 700;
}
</style>
