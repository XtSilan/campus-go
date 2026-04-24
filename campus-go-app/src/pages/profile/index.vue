<script setup lang="ts">
import { onShow } from '@dcloudio/uni-app'
import { computed, reactive, ref } from 'vue'
import AppTabbar from '@/components/AppTabbar.vue'
import SectionHeader from '@/components/SectionHeader.vue'
import { useAuthStore } from '@/stores/auth'
import { useMarketStore } from '@/stores/market'
import { showError, showSuccess } from '@/utils/ui'

const authStore = useAuthStore()
const marketStore = useMarketStore()

const mode = ref<'login' | 'register'>('login')
const studentNo = ref('')
const password = ref('')
const registerForm = reactive({
  nickname: '',
  campus: '',
  tagline: '',
})

const tradeItems = computed(() => ([
  {
    title: '我的交易',
    icon: '交',
    value: String((marketStore.summary?.activeSupplyCount || 0) + (marketStore.summary?.activeDemandCount || 0)),
    action: openTrades,
  },
]))

const toolItems = computed(() => ([
  {
    title: '我的关注',
    icon: '关',
    action: openFollows,
  },
  {
    title: '发布商品',
    icon: '发',
    action: goPublishSupply,
  },
  {
    title: '买家广场',
    icon: '逛',
    action: goBuyerPage,
  },
  {
    title: '系统通知',
    icon: '通',
    action: openNotifications,
  },
  {
    title: '退出登录',
    icon: '退',
    action: logout,
  },
]))

onShow(async () => {
  if (!authStore.isLoggedIn) {
    return
  }

  try {
    await authStore.ensureSession()
    await Promise.all([
      marketStore.loadDashboard({ useCache: true }),
      marketStore.loadCollections({ useCache: true }),
      marketStore.loadFollows({ useCache: true }),
      marketStore.loadNotifications({ useCache: true }),
    ])
  }
  catch (error) {
    showError((error as Error).message)
  }
})

async function submitAuth() {
  if (!studentNo.value.trim()) {
    showError('请输入学号')
    return
  }

  if (password.value.trim().length < 6) {
    showError('密码至少需要 6 位')
    return
  }

  try {
    if (mode.value === 'login') {
      await authStore.loginAccount({
        studentNo: studentNo.value.trim(),
        password: password.value.trim(),
      })
      showSuccess('登录成功')
    }
    else {
      if (!registerForm.nickname.trim() || !registerForm.campus.trim()) {
        showError('请完整填写昵称和校区')
        return
      }

      await authStore.registerAccount({
        nickname: registerForm.nickname.trim(),
        campus: registerForm.campus.trim(),
        studentNo: studentNo.value.trim(),
        tagline: registerForm.tagline.trim(),
        password: password.value.trim(),
      })
      showSuccess('注册成功')
    }

    await Promise.all([
      marketStore.loadDashboard({ refresh: true }),
      marketStore.loadCollections({ refresh: true }),
      marketStore.loadFollows({ refresh: true }),
      marketStore.loadNotifications({ refresh: true }),
    ])
  }
  catch (error) {
    showError((error as Error).message)
  }
}

function openSettings() {
  uni.navigateTo({
    url: '/pages/profile/settings',
  })
}

function goPublishSupply() {
  uni.navigateTo({
    url: '/pages/publish/index?type=supply',
  })
}

function openTrades() {
  uni.navigateTo({
    url: '/pages/profile/trades',
  })
}

function openFollows() {
  uni.navigateTo({
    url: '/pages/profile/follows',
  })
}

function goBuyerPage() {
  uni.reLaunch({
    url: '/pages/buyer/index',
  })
}

function openNotifications() {
  if (!marketStore.notifications.length) {
    showSuccess('暂时没有新的平台公告')
    return
  }

  uni.showModal({
    title: marketStore.notifications[0].title,
    content: marketStore.notifications[0].content,
    showCancel: false,
    confirmText: '知道了',
  })
}

async function logout() {
  await authStore.logout()
  showSuccess('已退出登录')
  marketStore.resetState()
}
</script>

<template>
  <view class="profile-page">
    <view class="page-top">
      <view class="top-actions">
        <view class="ghost-action" @click="openSettings">
          设置
        </view>
      </view>

      <view v-if="authStore.isLoggedIn" class="user-hero">
        <view class="avatar" :style="{ background: authStore.currentUser?.avatarColor || '#ffd84f' }">
          <image v-if="authStore.currentUser?.avatarUrl" class="avatar-image" :src="authStore.currentUser.avatarUrl" mode="aspectFill" />
          <template v-else>
            {{ authStore.currentUser?.nickname?.slice(0, 1) || '我' }}
          </template>
        </view>
        <view class="user-copy">
          <view class="user-name">
            {{ authStore.currentUser?.nickname }}
          </view>
          <view class="user-meta">
            {{ authStore.currentUser?.campus }} · {{ authStore.currentUser?.studentNo }}
          </view>
        </view>
      </view>

      <view v-else class="user-hero guest" @click="mode = 'login'">
        <view class="avatar guest-avatar">
          GO
        </view>
        <view class="user-copy">
          <view class="user-name">
            未登录
          </view>
          <view class="user-meta">
            登录后同步清单、消息和资料设置
          </view>
        </view>
        <view class="hero-arrow">
          ›
        </view>
      </view>
    </view>

    <view class="page-body">
      <view v-if="!authStore.isLoggedIn" class="group-card auth-card">
        <SectionHeader title="登录 / 注册" description="登录后再管理交易、发布和个人设置。" />
        <view class="switch-row">
          <view class="switch-pill" :class="{ active: mode === 'login' }" @click="mode = 'login'">
            登录
          </view>
          <view class="switch-pill" :class="{ active: mode === 'register' }" @click="mode = 'register'">
            注册
          </view>
        </view>
        <view class="form-stack">
          <wd-input v-if="mode === 'register'" v-model="registerForm.nickname" label="昵称" clearable placeholder="例如：计科小周" />
          <wd-input v-if="mode === 'register'" v-model="registerForm.campus" label="校区 / 学校" clearable placeholder="例如：本部校区" />
          <wd-input v-model="studentNo" label="学号" clearable placeholder="用于登录和身份标识" />
          <wd-input v-model="password" label="密码" clearable show-password placeholder="至少 6 位" />
          <wd-input
            v-if="mode === 'register'"
            v-model="registerForm.tagline"
            label="一句话介绍"
            clearable
            placeholder="例如：宿舍极简党，闲置流转优先"
          />
        </view>
        <view class="submit-btn" @click="submitAuth">
          {{ authStore.pending ? '处理中...' : (mode === 'login' ? '立即登录' : '注册并登录') }}
        </view>
      </view>

      <template v-else>
        <view class="section-label">
          我的交易
        </view>
        <view class="group-card">
          <view
            v-for="item in tradeItems"
            :key="item.title"
            class="menu-row"
            @click="item.action"
          >
            <view class="menu-main">
              <view class="menu-icon accent">
                {{ item.icon }}
              </view>
              <view class="menu-copy">
                <view class="menu-title">
                  {{ item.title }}
                </view>
                <view v-if="item.desc" class="menu-desc">
                  {{ item.desc }}
                </view>
              </view>
            </view>
            <view class="menu-side">
              <text class="menu-value">{{ item.value }}</text>
              <text class="menu-arrow">›</text>
            </view>
          </view>
        </view>

        <view class="section-label">
          常用工具
        </view>
        <view class="group-card">
          <view
            v-for="item in toolItems"
            :key="item.title"
            class="menu-row"
            @click="item.action"
          >
            <view class="menu-main">
              <view class="menu-icon">
                {{ item.icon }}
              </view>
              <view class="menu-copy">
                <view class="menu-title">
                  {{ item.title }}
                </view>
                <view v-if="item.desc" class="menu-desc">
                  {{ item.desc }}
                </view>
              </view>
            </view>
            <view class="menu-side">
              <text class="menu-arrow">›</text>
            </view>
          </view>
        </view>
      </template>
    </view>

    <AppTabbar current="profile" />
  </view>
</template>

<style scoped lang="scss">
.profile-page {
  min-height: 100vh;
  background: #f6f6f6;
  padding-bottom: 150rpx;
}

.page-top {
  padding: calc(22rpx + env(safe-area-inset-top)) 22rpx 0;
}

.top-actions {
  display: flex;
  justify-content: flex-end;
  gap: 16rpx;
}

.ghost-action {
  min-width: 88rpx;
  height: 64rpx;
  padding: 0 22rpx;
  border-radius: 999rpx;
  background: #fff;
  border: 1px solid rgba(17, 17, 17, 0.05);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: #111;
  font-size: 24rpx;
  font-weight: 600;
}

.user-hero {
  display: flex;
  align-items: center;
  gap: 24rpx;
  margin-top: 34rpx;
  padding: 12rpx 2rpx 4rpx;
}

.user-hero.guest {
  justify-content: space-between;
}

.avatar {
  width: 116rpx;
  height: 116rpx;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 42rpx;
  font-weight: 800;
  color: #111;
  flex-shrink: 0;
  overflow: hidden;
}

.avatar-image {
  width: 100%;
  height: 100%;
}

.guest-avatar {
  background: linear-gradient(135deg, #ffd84f, #ff9c21);
  color: #fff;
}

.user-copy {
  min-width: 0;
  flex: 1;
}

.user-name {
  font-size: 52rpx;
  line-height: 1.12;
  font-weight: 800;
  color: #111;
}

.user-meta {
  margin-top: 12rpx;
  font-size: 24rpx;
  color: #8a8a8a;
}

.user-tagline {
  margin-top: 10rpx;
  font-size: 22rpx;
  color: #9b9b9b;
}

.hero-arrow {
  font-size: 44rpx;
  color: #c1c1c1;
}

.page-body {
  padding: 26rpx 16rpx 0;
}

.section-label {
  margin: 20rpx 8rpx 16rpx;
  font-size: 28rpx;
  font-weight: 700;
  color: #a1a1a1;
}

.group-card {
  overflow: hidden;
  border-radius: 30rpx;
  background: #fff;
}

.auth-card {
  padding: 26rpx;
}

.switch-row {
  display: flex;
  gap: 14rpx;
  margin-top: 20rpx;
}

.switch-pill {
  flex: 1;
  min-height: 76rpx;
  border-radius: 999rpx;
  background: #f2f2f2;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #8c8c8c;
  font-size: 22rpx;
}

.switch-pill.active {
  background: #111;
  color: #fff;
}

.form-stack {
  display: flex;
  flex-direction: column;
  gap: 14rpx;
  margin-top: 20rpx;
}

.submit-btn {
  margin-top: 22rpx;
  min-height: 88rpx;
  border-radius: 999rpx;
  background: #111;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-size: 24rpx;
  font-weight: 700;
}

.menu-row {
  min-height: 136rpx;
  padding: 0 28rpx;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20rpx;
}

.menu-row + .menu-row {
  border-top: 1px solid #f0f0f0;
}

.menu-main {
  display: flex;
  align-items: center;
  gap: 20rpx;
  min-width: 0;
}

.menu-icon {
  width: 64rpx;
  height: 64rpx;
  border-radius: 50%;
  background: #f4f4f4;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 22rpx;
  color: #111;
  font-weight: 700;
  flex-shrink: 0;
}

.menu-icon.accent {
  background: #fff2b6;
}

.menu-copy {
  min-width: 0;
}

.menu-title {
  font-size: 32rpx;
  font-weight: 800;
  color: #111;
}

.menu-desc {
  margin-top: 8rpx;
  font-size: 22rpx;
  color: #999;
}

.menu-side {
  display: flex;
  align-items: center;
  gap: 14rpx;
  flex-shrink: 0;
}

.menu-value {
  font-size: 24rpx;
  color: #9b9b9b;
}

.menu-arrow {
  font-size: 36rpx;
  color: #d1d1d1;
}
</style>
