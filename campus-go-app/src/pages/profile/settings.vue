<script setup lang="ts">
import { useAuthStore } from '@/stores/auth'
import { showSuccess } from '@/utils/ui'

const authStore = useAuthStore()

const groups = [
  {
    title: '个人',
    items: [
      {
        title: '个人资料',
        value: '',
        action: openProfileEditor,
      },
      {
        title: '个性化设置',
        value: '',
        action: openProfileEditor,
      },
      {
        title: '账号与安全',
        value: authStore.currentUser?.studentNo || '',
        action: showDeveloping,
      },
    ],
  },
  {
    title: '交易',
    items: [
      {
        title: '联系资料',
        value: authStore.currentUser?.contactName || '未填写',
        action: openProfileEditor,
      },
      {
        title: '收款方式',
        value: '暂未开启',
        action: showDeveloping,
      },
    ],
  },
  {
    title: '通用',
    items: [
      {
        title: '消息通知',
        value: '站内提醒',
        action: showDeveloping,
      },
      {
        title: '图片视频',
        value: '默认',
        action: showDeveloping,
      },
      {
        title: '关于校园购',
        value: '当前版本',
        action: showDeveloping,
      },
    ],
  },
]

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

function openProfileEditor() {
  uni.navigateTo({
    url: '/pages/profile/personalization',
  })
}

function showDeveloping() {
  showSuccess('该设置项稍后补充')
}
</script>

<template>
  <view class="settings-page">
    <view class="topbar">
      <view class="back-btn" @click="goBack">
        ‹
      </view>
      <view class="topbar-title">
        设置
      </view>
      <view class="topbar-space" />
    </view>

    <view class="settings-body">
      <view v-for="group in groups" :key="group.title" class="settings-group">
        <view class="group-title">
          {{ group.title }}
        </view>
        <view class="group-card">
          <view
            v-for="item in group.items"
            :key="item.title"
            class="setting-row"
            @click="item.action"
          >
            <view class="setting-title">
              {{ item.title }}
            </view>
            <view class="setting-side">
              <text v-if="item.value" class="setting-value">{{ item.value }}</text>
              <text class="setting-arrow">›</text>
            </view>
          </view>
        </view>
      </view>
    </view>
  </view>
</template>

<style scoped lang="scss">
.settings-page {
  min-height: 100vh;
  background: #f6f6f6;
}

.topbar {
  display: grid;
  grid-template-columns: 64rpx minmax(0, 1fr) 64rpx;
  align-items: center;
  padding: calc(22rpx + env(safe-area-inset-top)) 22rpx 10rpx;
}

.back-btn,
.topbar-space {
  width: 64rpx;
  height: 64rpx;
  display: flex;
  align-items: center;
  justify-content: center;
}

.back-btn {
  font-size: 54rpx;
  color: #111;
  line-height: 1;
}

.topbar-title {
  text-align: center;
  font-size: 34rpx;
  font-weight: 800;
  color: #111;
}

.settings-body {
  padding: 18rpx 16rpx 60rpx;
}

.settings-group + .settings-group {
  margin-top: 26rpx;
}

.group-title {
  margin: 0 8rpx 14rpx;
  font-size: 28rpx;
  font-weight: 700;
  color: #adadad;
}

.group-card {
  overflow: hidden;
  border-radius: 30rpx;
  background: #fff;
}

.setting-row {
  min-height: 124rpx;
  padding: 0 28rpx;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20rpx;
}

.setting-row + .setting-row {
  border-top: 1px solid #f0f0f0;
}

.setting-title {
  font-size: 30rpx;
  font-weight: 700;
  color: #111;
}

.setting-side {
  display: flex;
  align-items: center;
  gap: 10rpx;
  flex-shrink: 0;
}

.setting-value {
  font-size: 24rpx;
  color: #9d9d9d;
}

.setting-arrow {
  font-size: 36rpx;
  color: #d0d0d0;
}
</style>
