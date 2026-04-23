<script setup lang="ts">
import { onShow } from '@dcloudio/uni-app'
import { computed, ref } from 'vue'
import EmptyState from '@/components/EmptyState.vue'
import ListingCard from '@/components/ListingCard.vue'
import { useMarketStore } from '@/stores/market'
import { confirmAction, showError, showSuccess } from '@/utils/ui'

const marketStore = useMarketStore()
const activeTab = ref<'supply' | 'demand'>('supply')

const tabItems = computed(() => ([
  {
    key: 'supply',
    label: '闲置',
    count: marketStore.mySupplyListings.length,
  },
  {
    key: 'demand',
    label: '求购',
    count: marketStore.myDemandListings.length,
  },
]))

const currentItems = computed(() => (
  activeTab.value === 'supply'
    ? marketStore.mySupplyListings
    : marketStore.myDemandListings
))

const currentEmptyTitle = computed(() => (
  activeTab.value === 'supply' ? '还没有发布闲置' : '还没有发布求购'
))

const currentEmptyDesc = computed(() => (
  activeTab.value === 'supply'
    ? '把想转出的商品发出来后，这里就会开始显示。'
    : '把正在找的东西发出来后，这里就会开始显示。'
))

onShow(async () => {
  try {
    await marketStore.loadDashboard({ useCache: true })
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

function openDetail(id: number) {
  uni.navigateTo({
    url: `/pages/detail/index?id=${id}`,
  })
}

function editListing(id: number) {
  uni.navigateTo({
    url: `/pages/publish/index?id=${id}`,
  })
}

async function handleRemove(id: number) {
  const confirmed = await confirmAction(
    activeTab.value === 'supply' ? '删除闲置' : '删除求购',
    '删除后将不再对外展示，确认继续吗？',
  )
  if (!confirmed) {
    return
  }

  try {
    await marketStore.removeListing(id)
    await marketStore.loadDashboard({ refresh: true })
    showSuccess('删除成功')
  }
  catch (error) {
    showError((error as Error).message)
  }
}

function goPublish() {
  uni.navigateTo({
    url: `/pages/publish/index?type=${activeTab.value}`,
  })
}
</script>

<template>
  <view class="trade-page">
    <view class="topbar">
      <view class="back-btn" @click="goBack">
        ‹
      </view>
      <view class="topbar-title">
        我的交易
      </view>
      <view class="topbar-action" @click="goPublish">
        发布
      </view>
    </view>

    <view class="page-body">
      <view class="summary-card">
        <view class="summary-title">
          我发布的
        </view>
        <view class="summary-subtitle">
          闲置和求购统一在这里管理，支持继续编辑和删除。
        </view>
        <view class="summary-stats">
          <view class="summary-item">
            <text class="summary-value">{{ marketStore.mySupplyListings.length }}</text>
            <text class="summary-label">闲置</text>
          </view>
          <view class="summary-item">
            <text class="summary-value">{{ marketStore.myDemandListings.length }}</text>
            <text class="summary-label">求购</text>
          </view>
        </view>
      </view>

      <view class="tabs">
        <view
          v-for="item in tabItems"
          :key="item.key"
          class="tab-pill"
          :class="{ active: activeTab === item.key }"
          @click="activeTab = item.key as 'supply' | 'demand'"
        >
          {{ item.label }} {{ item.count }}
        </view>
      </view>

      <view class="list-card">
        <EmptyState
          v-if="!currentItems.length"
          :title="currentEmptyTitle"
          :description="currentEmptyDesc"
        >
          <view class="empty-action">
            <view class="publish-btn" @click="goPublish">
              {{ activeTab === 'supply' ? '发布闲置' : '发布求购' }}
            </view>
          </view>
        </EmptyState>

        <ListingCard
          v-for="item in currentItems"
          v-else
          :key="item.id"
          :listing="item"
          owner-mode
          @detail="openDetail"
          @edit="editListing"
          @remove="handleRemove"
        />
      </view>
    </view>
  </view>
</template>

<style scoped lang="scss">
.trade-page {
  min-height: 100vh;
  background: #f6f6f6;
}

.topbar {
  display: grid;
  grid-template-columns: 64rpx minmax(0, 1fr) auto;
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

.topbar-action {
  min-width: 92rpx;
  height: 64rpx;
  padding: 0 22rpx;
  border-radius: 999rpx;
  background: #111;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-size: 22rpx;
  font-weight: 700;
}

.page-body {
  padding: 18rpx 16rpx 40rpx;
}

.summary-card,
.list-card {
  border-radius: 30rpx;
  background: #fff;
}

.summary-card {
  padding: 28rpx;
}

.summary-title {
  font-size: 48rpx;
  font-weight: 800;
  color: #111;
}

.summary-subtitle {
  margin-top: 14rpx;
  font-size: 24rpx;
  line-height: 1.7;
  color: #949494;
}

.summary-stats {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14rpx;
  margin-top: 26rpx;
}

.summary-item {
  min-height: 132rpx;
  border-radius: 24rpx;
  background: #faf7ef;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.summary-value {
  font-size: 42rpx;
  font-weight: 800;
  color: #111;
}

.summary-label {
  margin-top: 10rpx;
  font-size: 22rpx;
  color: #8d8d8d;
}

.tabs {
  display: flex;
  gap: 14rpx;
  margin: 20rpx 0 16rpx;
}

.tab-pill {
  min-width: 144rpx;
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
}

.tab-pill.active {
  background: #111;
  color: #fff;
}

.list-card {
  padding: 24rpx;
}

.empty-action {
  margin-top: 18rpx;
}

.publish-btn {
  min-height: 84rpx;
  padding: 0 28rpx;
  border-radius: 999rpx;
  background: #111;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-size: 24rpx;
  font-weight: 700;
}
</style>
