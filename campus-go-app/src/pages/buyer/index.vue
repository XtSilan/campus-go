<script setup lang="ts">
import type { ListingType, SortValue } from '@/types'
import { onShow } from '@dcloudio/uni-app'
import { computed, ref } from 'vue'
import AppTabbar from '@/components/AppTabbar.vue'
import AppTopbar from '@/components/AppTopbar.vue'
import DemandListingCard from '@/components/DemandListingCard.vue'
import EmptyState from '@/components/EmptyState.vue'
import ListingCard from '@/components/ListingCard.vue'
import { useAuthStore } from '@/stores/auth'
import { useMarketStore } from '@/stores/market'
import { jumpToLogin, showError, showSuccess } from '@/utils/ui'

const authStore = useAuthStore()
const marketStore = useMarketStore()

const keyword = ref('')
const activeZone = ref<ListingType>('supply')
const searchOpen = ref(false)
const activeChannel = ref('all')

const zoneChannelMap: Record<ListingType, Array<{
  key: string
  title: string
  keyword: string
  tone: string
}>> = {
  supply: [
    {
      key: 'all',
      title: '全部',
      keyword: '',
      tone: 'linear-gradient(135deg, #f2ede5, #d8c9b8)',
    },
    {
      key: 'book',
      title: '教材',
      keyword: '书籍教材',
      tone: 'linear-gradient(135deg, #e6ede1, #b7c9a7)',
    },
    {
      key: 'digital',
      title: '数码',
      keyword: '电子产品',
      tone: 'linear-gradient(135deg, #dfe6ef, #b6c2d4)',
    },
    {
      key: 'dorm',
      title: '宿舍',
      keyword: '生活用品',
      tone: 'linear-gradient(135deg, #efe4dc, #d4b9aa)',
    },
    {
      key: 'service',
      title: '服务',
      keyword: '代拿',
      tone: 'linear-gradient(135deg, #e3efe9, #aec9b7)',
    },
  ],
  demand: [
    {
      key: 'all',
      title: '全部',
      keyword: '',
      tone: 'linear-gradient(135deg, #efe6dc, #d2bca5)',
    },
    {
      key: 'need-book',
      title: '求教材',
      keyword: '书籍教材',
      tone: 'linear-gradient(135deg, #edf1de, #c4d398)',
    },
    {
      key: 'need-digital',
      title: '求数码',
      keyword: '电子产品',
      tone: 'linear-gradient(135deg, #dbe6f8, #b5c8e8)',
    },
    {
      key: 'need-delivery',
      title: '求代拿',
      keyword: '代拿',
      tone: 'linear-gradient(135deg, #f2e3ec, #ddb5c8)',
    },
    {
      key: 'need-dorm',
      title: '宿舍急收',
      keyword: '宿舍',
      tone: 'linear-gradient(135deg, #ece6dd, #d4c4ad)',
    },
  ],
}

const feedListings = computed(() => marketStore.supplyListings)
const isDemandZone = computed(() => activeZone.value === 'demand')
const sectionTitle = computed(() => (isDemandZone.value ? '求购专区' : '闲置专区'))
const sectionAction = computed(() => (isDemandZone.value ? '发布求购' : '发布闲置'))
const channelItems = computed(() => zoneChannelMap[activeZone.value])

onShow(async () => {
  await hydratePage(false)
})

async function hydratePage(refresh: boolean) {
  const activeMeta = channelItems.value.find(item => item.key === activeChannel.value)
  try {
    await Promise.all([
      marketStore.loadBuyerFeed(activeZone.value, {
        keyword: keyword.value || activeMeta?.keyword || '',
        sort: 'recent' as SortValue,
        page: 1,
        pageSize: 10,
      }, { refresh, useCache: !refresh }),
      authStore.isLoggedIn ? marketStore.loadCollections({ refresh, useCache: !refresh }) : Promise.resolve(),
    ])
  }
  catch (error) {
    showError((error as Error).message)
  }
}

async function handleLoadMore() {
  if (!marketStore.hasMoreSupply || marketStore.loadingMore) {
    return
  }

  try {
    await marketStore.loadBuyerFeed(activeZone.value, {}, { append: true })
  }
  catch (error) {
    showError((error as Error).message)
  }
}

function handleSearch() {
  hydratePage(true)
  searchOpen.value = false
}

function toggleSearch() {
  searchOpen.value = !searchOpen.value
}

function switchZone(nextZone: ListingType) {
  if (activeZone.value === nextZone) {
    return
  }

  activeZone.value = nextZone
  activeChannel.value = 'all'
  hydratePage(true)
}

function switchChannel(channelKey: string) {
  if (activeChannel.value === channelKey) {
    return
  }

  activeChannel.value = channelKey
  if (!searchOpen.value) {
    keyword.value = ''
  }
  hydratePage(true)
}

function closeSearch() {
  searchOpen.value = false
}

function openDetail(id: number) {
  uni.navigateTo({
    url: `/pages/detail/index?id=${id}`,
  })
}

function goPublishDemand() {
  if (!authStore.isLoggedIn) {
    jumpToLogin()
    return
  }

  uni.navigateTo({
    url: '/pages/publish/index?type=demand',
  })
}

function goPublishSupply() {
  if (!authStore.isLoggedIn) {
    jumpToLogin()
    return
  }

  uni.navigateTo({
    url: '/pages/publish/index?type=supply',
  })
}

function handleZoneAction() {
  if (isDemandZone.value) {
    goPublishDemand()
    return
  }

  goPublishSupply()
}

async function toggleCart(id: number) {
  if (!authStore.isLoggedIn) {
    jumpToLogin()
    return
  }

  try {
    const active = await marketStore.flipCart(id)
    showSuccess(active ? '已加入购物车' : '已移出购物车')
  }
  catch (error) {
    showError((error as Error).message)
  }
}
</script>

<template>
  <view class="buyer-page">
    <view v-if="searchOpen" class="search-overlay" @click="closeSearch">
      <view class="search-panel" @click.stop>
        <view class="search-panel-head">
          <view class="search-panel-title">
            搜索商品
          </view>
          <view class="search-panel-close" @click="closeSearch">
            关闭
          </view>
        </view>
        <view class="search-panel-box">
          <input
            v-model="keyword"
            class="search-panel-input"
            confirm-type="search"
            focus
            placeholder="搜索商品、服务或关键词"
            @confirm="handleSearch"
          >
          <view class="search-panel-action" @click="handleSearch">
            搜索
          </view>
        </view>
      </view>
    </view>

    <scroll-view
      class="page-scroll"
      scroll-y
      enable-back-to-top
      :lower-threshold="120"
      @scrolltolower="handleLoadMore"
    >
      <view class="home-page">
        <view class="hero-stage">
          <AppTopbar theme="dark" :show-right="false" @search="toggleSearch" />
          <view class="zone-tabs">
            <view class="zone-tab" :class="{ active: activeZone === 'supply' }" @click="switchZone('supply')">
              闲置
            </view>
            <view class="zone-tab" :class="{ active: activeZone === 'demand' }" @click="switchZone('demand')">
              求购
            </view>
          </view>

          <scroll-view class="channel-strip" scroll-x :show-scrollbar="false">
            <view class="channel-row">
              <view
                v-for="item in channelItems"
                :key="item.key"
                class="channel-tag"
                :class="{ active: activeChannel === item.key }"
                @click="switchChannel(item.key)"
              >
                <text class="channel-tag-title">{{ item.title }}</text>
              </view>
            </view>
          </scroll-view>
        </view>

        <view class="catalog-shell">
          <view class="grid-head">
            <view class="grid-title">
              {{ sectionTitle }}
            </view>
            <view class="grid-action" @click="handleZoneAction">
              {{ sectionAction }}
            </view>
          </view>

          <view class="product-grid" :class="{ demand: isDemandZone }">
            <EmptyState
              v-if="!feedListings.length && !marketStore.loading"
              :title="isDemandZone ? '暂时没有求购内容' : '暂时没有匹配商品'"
              :description="isDemandZone ? '去发布一条求购，或者换个分区关键词看看。' : '换个分区内容或者搜索关键词看看。'"
            />
            <template v-else-if="isDemandZone">
              <DemandListingCard
                v-for="item in feedListings"
                :key="item.id"
                :listing="item"
                @detail="openDetail"
              />
            </template>
            <template v-else>
              <ListingCard
                v-for="item in feedListings"
                :key="item.id"
                :listing="item"
                mode="grid"
                @detail="openDetail"
                @cart="toggleCart"
              />
            </template>
          </view>

          <view v-if="marketStore.loadingMore" class="load-state">
            正在加载更多...
          </view>
        </view>
      </view>
    </scroll-view>

    <AppTabbar current="buyer" />
  </view>
</template>

<style scoped lang="scss">
.buyer-page {
  min-height: 100vh;
  background: var(--campus-bg);
}

.page-scroll {
  height: 100vh;
}

.search-overlay {
  position: fixed;
  inset: 0;
  background: rgba(17, 17, 17, 0.22);
  z-index: 120;
  padding: 120rpx 24rpx 0;
}

.search-panel {
  padding: 28rpx 24rpx 24rpx;
  background: #fff;
  border-radius: 24rpx;
  box-shadow: 0 24rpx 60rpx rgba(0, 0, 0, 0.12);
}

.search-panel-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20rpx;
}

.search-panel-title {
  font-size: 28rpx;
  font-weight: 700;
  color: var(--campus-ink);
}

.search-panel-close {
  font-size: 22rpx;
  color: var(--campus-muted);
}

.search-panel-box {
  display: flex;
  align-items: center;
  gap: 12rpx;
  margin-top: 22rpx;
}

.search-panel-input {
  flex: 1;
  min-height: 76rpx;
  padding: 0 22rpx;
  background: var(--campus-card-soft);
  font-size: 24rpx;
  color: var(--campus-ink);
}

.search-panel-action {
  min-width: 108rpx;
  min-height: 76rpx;
  padding: 0 20rpx;
  background: #111;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-size: 22rpx;
}

.home-page {
  min-height: 100vh;
}

.hero-stage {
  position: relative;
  padding: 42rpx 24rpx 12rpx;
}

.zone-tabs {
  display: flex;
  align-items: center;
  gap: 42rpx;
  margin-top: 26rpx;
  padding: 0 6rpx;
  overflow-x: auto;
  white-space: nowrap;
}

.zone-tab {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 28rpx;
  color: #707070;
  font-weight: 800;
  flex-shrink: 0;
}

.zone-tab.active {
  color: #111;
}

.zone-tab.active::after {
  content: '';
  position: absolute;
  left: 0;
  right: 0;
  bottom: -16rpx;
  height: 6rpx;
  border-radius: 999rpx;
  background: #111;
}

.channel-strip {
  margin-top: 28rpx;
  white-space: nowrap;
}

.channel-row {
  display: inline-flex;
gap: 14rpx;
  padding-right: 24rpx;
}

.channel-tag {
  min-height: 72rpx;
  padding: 0 24rpx;
  border-radius: 999rpx;
  background: #efede8;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.channel-tag.active {
  background: #111;
}

.channel-tag-title {
  font-size: 24rpx;
  font-weight: 700;
  color: #111;
}
.channel-tag.active .channel-tag-title {
  color: #fff;
}

.catalog-shell {
  padding: 0 0 200rpx;
  background: #f9f9f7;
}

.grid-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin: 18rpx 24rpx 0;
  padding: 12rpx 0;
}

.grid-title {
  font-size: 24rpx;
  font-weight: 700;
  color: var(--campus-ink);
}

.grid-action {
  font-size: 20rpx;
  color: var(--campus-muted);
}

.product-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 15rpx;
  padding: 8rpx 15rpx 0;
}

.product-grid.demand {
  align-items: start;
}

.load-state {
  padding-top: 20rpx;
  text-align: center;
  font-size: 20rpx;
  color: var(--campus-muted);
}
</style>
