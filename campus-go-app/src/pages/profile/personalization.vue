<script setup lang="ts">
import { onShow } from '@dcloudio/uni-app'
import { computed, reactive, ref } from 'vue'
import { uploadImageAsset } from '@/api/uploads'
import { useAuthStore } from '@/stores/auth'
import { chooseSingleImage } from '@/utils/image'
import { showError, showSuccess } from '@/utils/ui'

const authStore = useAuthStore()
const saving = ref(false)
const avatarUploading = ref(false)
const form = reactive({
  nickname: '',
  campus: '',
  tagline: '',
  contactName: '',
  phone: '',
  wechat: '',
  qq: '',
  avatarUrl: '',
})

const avatarPreview = computed(() => form.avatarUrl || '')

function syncForm() {
  if (!authStore.currentUser) {
    return
  }

  Object.assign(form, {
    nickname: authStore.currentUser.nickname || '',
    campus: authStore.currentUser.campus || '',
    tagline: authStore.currentUser.tagline || '',
    contactName: authStore.currentUser.contactName || authStore.currentUser.nickname || '',
    phone: authStore.currentUser.phone || '',
    wechat: authStore.currentUser.wechat || '',
    qq: authStore.currentUser.qq || '',
    avatarUrl: authStore.currentUser.avatarUrl || '',
  })
}

onShow(async () => {
  if (!authStore.isLoggedIn) {
    uni.reLaunch({
      url: '/pages/profile/index',
    })
    return
  }

  await authStore.ensureSession()
  syncForm()
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
    url: '/pages/profile/settings',
  })
}

async function chooseAvatar() {
  avatarUploading.value = true
  try {
    const image = await chooseSingleImage()
    const uploaded = await uploadImageAsset({
      fileName: image.fileName,
      filePath: image.filePath,
    })
    form.avatarUrl = uploaded.path
    showSuccess('头像已上传')
  }
  catch (error) {
    showError((error as Error).message)
  }
  finally {
    avatarUploading.value = false
  }
}

async function submitForm() {
  if (!form.nickname.trim()) {
    showError('请填写昵称')
    return
  }

  if (!form.campus.trim()) {
    showError('请填写校区或学校')
    return
  }

  saving.value = true
  try {
    await authStore.updateProfile({
      nickname: form.nickname.trim(),
      campus: form.campus.trim(),
      tagline: form.tagline.trim(),
      contactName: form.contactName.trim() || form.nickname.trim(),
      phone: form.phone.trim(),
      wechat: form.wechat.trim(),
      qq: form.qq.trim(),
      avatarUrl: form.avatarUrl.trim(),
    })
    showSuccess('资料已更新')
    setTimeout(() => {
      goBack()
    }, 320)
  }
  catch (error) {
    showError((error as Error).message)
  }
  finally {
    saving.value = false
  }
}
</script>

<template>
  <view class="editor-page">
    <view class="topbar">
      <view class="back-btn" @click="goBack">
        ‹
      </view>
      <view class="topbar-title">
        编辑资料
      </view>
      <view class="topbar-space" />
    </view>

    <view class="editor-body">
      <view class="section-label">
        个人资料
      </view>
      <view class="editor-card">
        <view class="editor-row" @click="chooseAvatar">
          <view class="row-title">
            头像
          </view>
          <view class="row-side">
            <view class="avatar-preview" :style="{ background: authStore.currentUser?.avatarColor || '#c07d5c' }">
              <image v-if="avatarPreview" class="avatar-image" :src="avatarPreview" mode="aspectFill" />
              <template v-else>
                {{ authStore.currentUser?.nickname?.slice(0, 1) || '我' }}
              </template>
            </view>
            <text class="row-action">{{ avatarUploading ? '上传中...' : '更换' }}</text>
            <text class="row-arrow">›</text>
          </view>
        </view>
        <view class="editor-row">
          <view class="row-title">
            昵称
          </view>
          <input v-model="form.nickname" class="row-input" placeholder="去填写">
        </view>
        <view class="editor-row">
          <view class="row-title">
            校区 / 学校
          </view>
          <input v-model="form.campus" class="row-input" placeholder="去选择">
        </view>
        <view class="editor-row tall">
          <view class="row-title">
            简介
          </view>
          <textarea v-model="form.tagline" class="row-textarea" maxlength="80" placeholder="让大家更快认识你" />
        </view>
        <view class="editor-row">
          <view class="row-title">
            联系称呼
          </view>
          <input v-model="form.contactName" class="row-input" placeholder="默认使用昵称">
        </view>
      </view>

      <view class="section-label">
        联系方式
      </view>
      <view class="editor-card">
        <view class="editor-row">
          <view class="row-title">
            手机号
          </view>
          <input v-model="form.phone" class="row-input" placeholder="选填">
        </view>
        <view class="editor-row">
          <view class="row-title">
            微信
          </view>
          <input v-model="form.wechat" class="row-input" placeholder="选填">
        </view>
        <view class="editor-row">
          <view class="row-title">
            QQ
          </view>
          <input v-model="form.qq" class="row-input" placeholder="选填">
        </view>
      </view>

      <view class="tips-card">
        商品详情默认引导买家通过“聊一聊”联系你，这里的资料会作为账号统一信息保存，不再要求你在每次发布时重复填写。
      </view>
    </view>

    <view class="submit-bar">
      <view class="submit-btn" @click="submitForm">
        {{ saving ? '保存中...' : '保存资料' }}
      </view>
    </view>
  </view>
</template>

<style scoped lang="scss">
.editor-page {
  min-height: 100vh;
  background: #f6f6f6;
}

.topbar {
  display: grid;
  grid-template-columns: 64rpx minmax(0, 1fr) 64rpx;
  align-items: center;
  padding: calc(22rpx + env(safe-area-inset-top)) 22rpx 8rpx;
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

.editor-body {
  padding: 18rpx 16rpx 180rpx;
}

.section-label {
  margin: 18rpx 8rpx 14rpx;
  font-size: 28rpx;
  font-weight: 700;
  color: #adadad;
}

.editor-card,
.tips-card {
  overflow: hidden;
  border-radius: 30rpx;
  background: #fff;
}

.editor-row {
  min-height: 118rpx;
  padding: 0 28rpx;
  display: grid;
  grid-template-columns: 220rpx minmax(0, 1fr);
  align-items: center;
  gap: 18rpx;
}

.editor-row.tall {
  padding-top: 26rpx;
  padding-bottom: 26rpx;
  align-items: start;
}

.editor-row + .editor-row {
  border-top: 1px solid #f0f0f0;
}

.row-title {
  font-size: 30rpx;
  font-weight: 700;
  color: #111;
}

.row-input,
.row-textarea {
  width: 100%;
  font-size: 30rpx;
  color: #6f6f6f;
  text-align: right;
}

.row-side {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 14rpx;
}

.avatar-preview {
  width: 88rpx;
  height: 88rpx;
  border-radius: 50%;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #111;
  font-size: 28rpx;
  font-weight: 800;
  flex-shrink: 0;
}

.avatar-image {
  width: 100%;
  height: 100%;
}

.row-action {
  font-size: 24rpx;
  color: #8f8f8f;
}

.row-arrow {
  font-size: 34rpx;
  color: #d0d0d0;
}

.row-textarea {
  min-height: 132rpx;
  text-align: left;
  line-height: 1.7;
}

.tips-card {
  margin-top: 22rpx;
  padding: 24rpx 28rpx;
  font-size: 24rpx;
  line-height: 1.8;
  color: #8e8e8e;
}

.submit-bar {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  padding: 18rpx 24rpx calc(18rpx + env(safe-area-inset-bottom));
  background: rgba(255, 255, 255, 0.94);
  border-top: 1px solid rgba(17, 17, 17, 0.05);
}

.submit-btn {
  min-height: 92rpx;
  border-radius: 999rpx;
  background: #111;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-size: 28rpx;
  font-weight: 700;
}
</style>
