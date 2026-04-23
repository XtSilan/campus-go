<script setup lang="ts">
import type { ListingPayload, ListingType } from '@/types'
import { onLoad, onUnload } from '@dcloudio/uni-app'
import { computed, reactive, ref } from 'vue'
import { uploadImageAsset } from '@/api/uploads'
import EmptyState from '@/components/EmptyState.vue'
import { campusRules, itemConditions, listingCategories } from '@/constants/categories'
import { useAuthStore } from '@/stores/auth'
import { useMarketStore } from '@/stores/market'
import { chooseImages } from '@/utils/image'
import { confirmAction, jumpToLogin, showError, showSuccess } from '@/utils/ui'

const DRAFT_KEY = 'campus_go_publish_draft'

const authStore = useAuthStore()
const marketStore = useMarketStore()

const categoryOptions = [...listingCategories]
const conditionOptions = [...itemConditions]

const submitting = ref(false)
const uploading = ref(false)
const priceText = ref('')
const editorPlaceholder = ref('描述一下宝贝的品牌型号、货品来源、使用感受...')
const draftCount = ref(0)

const form = reactive<ListingPayload>({
  type: 'supply',
  title: '',
  category: '',
  condition: '',
  description: '',
  price: null,
  imageUrl: '',
  imageUrls: [],
  location: '',
  contactName: '',
  phone: '',
  wechat: '',
  qq: '',
})

const pageTitle = computed(() => (form.type === 'supply' ? '发闲置' : '发求购'))
const priceLabel = computed(() => (form.type === 'supply' ? '价格' : '预算'))

const previewImages = computed(() => form.imageUrls.filter(Boolean))
const isEditing = computed(() => Boolean(form.id))

function createDraftSnapshot() {
  return {
    ...form,
    priceText: priceText.value,
  }
}

function updateDraftCount() {
  draftCount.value = uni.getStorageSync(DRAFT_KEY) ? 1 : 0
}

function syncPlaceholder() {
  editorPlaceholder.value = form.type === 'supply'
    ? '描述一下宝贝的品牌型号、货品来源、使用感受...'
    : '说清楚你想收什么、预算范围、成色要求和交接方式...'
}

function saveDraft() {
  if (!authStore.isLoggedIn || submitting.value || isEditing.value) {
    return
  }

  const snapshot = createDraftSnapshot()
  const hasContent = Object.values(snapshot).some(value => String(value || '').trim())
  if (!hasContent) {
    uni.removeStorageSync(DRAFT_KEY)
    updateDraftCount()
    return
  }

  uni.setStorageSync(DRAFT_KEY, snapshot)
  updateDraftCount()
}

async function restoreDraft(force = false) {
  const draft = uni.getStorageSync(DRAFT_KEY)
  if (!draft) {
    showError('草稿箱里还没有内容')
    return
  }

  if (!force) {
    const confirmed = await confirmAction('恢复草稿', '检测到本地草稿，是否恢复到当前发布页？')
    if (!confirmed) {
      return
    }
  }

  Object.assign(form, {
    ...form,
    ...draft,
  })
  priceText.value = draft.priceText || ''
  syncPlaceholder()
  showSuccess('草稿已恢复')
}

onLoad(async (query) => {
  syncPlaceholder()

  if (query?.type === 'supply' || query?.type === 'demand') {
    form.type = query.type as ListingType
    syncPlaceholder()
  }

  if (query?.id) {
    try {
      const detail = await marketStore.loadListingDetail(Number(query.id))
      Object.assign(form, {
        id: detail.id,
        type: detail.type,
        title: detail.title,
        category: detail.category,
        condition: detail.condition,
        description: detail.description,
        price: detail.price,
        imageUrl: detail.imageUrl,
        imageUrls: detail.imageUrls,
        location: detail.location,
        contactName: authStore.currentUser?.contactName || authStore.currentUser?.nickname || detail.contactName,
        phone: authStore.currentUser?.phone || '',
        wechat: authStore.currentUser?.wechat || '',
        qq: authStore.currentUser?.qq || '',
      })
      priceText.value = detail.price ? String(detail.price) : ''
      syncPlaceholder()
    }
    catch (error) {
      showError((error as Error).message)
    }
  }
  else if (uni.getStorageSync(DRAFT_KEY)) {
    await restoreDraft()
  }

  updateDraftCount()
})

onUnload(() => {
  saveDraft()
})

function goBack() {
  saveDraft()
  const pages = getCurrentPages()
  if (pages.length > 1) {
    uni.navigateBack({
      delta: 1,
    })
    return
  }

  uni.reLaunch({
    url: '/pages/buyer/index',
  })
}

function handleCategoryChange(event: any) {
  form.category = categoryOptions[event.detail.value]
}

function handleConditionChange(event: any) {
  form.condition = conditionOptions[event.detail.value]
}

async function pickImages() {
  if (!authStore.isLoggedIn) {
    jumpToLogin()
    return
  }

  uploading.value = true
  try {
    const remainCount = Math.max(1, 9 - form.imageUrls.length)
    const pickedImages = await chooseImages(remainCount)
    const uploadedImages: string[] = []

    for (const image of pickedImages) {
      const uploaded = await uploadImageAsset({
        fileName: image.fileName,
        filePath: image.filePath,
      })
      uploadedImages.push(uploaded.path)
    }

    form.imageUrls = [...form.imageUrls, ...uploadedImages].slice(0, 9)
    form.imageUrl = form.imageUrls[0] || ''
    showSuccess(`已上传 ${uploadedImages.length} 张图片`)
  }
  catch (error) {
    showError((error as Error).message)
  }
  finally {
    uploading.value = false
  }
}

function removeImage(index: number) {
  form.imageUrls.splice(index, 1)
  form.imageUrl = form.imageUrls[0] || ''
}

function smartWriteDescription() {
  const fragments = [
    form.title ? `转一件 ${form.title}` : '',
    form.category ? `分类是 ${form.category}` : '',
    form.condition ? `整体状态 ${form.condition}` : '',
    priceText.value ? `${priceLabel.value}${priceText.value} 元` : '',
    form.location ? `校内可在 ${form.location} 面交` : '',
  ].filter(Boolean)

  form.description = fragments.length
    ? `${fragments.join('，')}。感兴趣可以直接聊一聊，细节都可以继续沟通。`
    : '东西都还在，校内可聊可约，感兴趣可以直接问我。'
}

function validateForm() {
  if (!form.title.trim()) {
    return '请先写标题'
  }

  if (!form.category) {
    return '请选择分类'
  }

  if (!form.condition) {
    return '请选择成色或需求状态'
  }

  if (!form.description.trim()) {
    return '请补充描述'
  }

  return ''
}

async function submitForm() {
  const message = validateForm()
  if (message) {
    showError(message)
    return
  }

  submitting.value = true
  try {
    form.contactName = authStore.currentUser?.contactName?.trim() || authStore.currentUser?.nickname?.trim() || ''
    form.phone = authStore.currentUser?.phone?.trim() || ''
    form.wechat = authStore.currentUser?.wechat?.trim() || ''
    form.qq = authStore.currentUser?.qq?.trim() || ''
    form.price = priceText.value ? Number(priceText.value) : null
    await marketStore.upsertListing({
      ...form,
      title: form.title.trim(),
      description: form.description.trim(),
      category: form.category.trim(),
      condition: form.condition.trim(),
      imageUrl: form.imageUrl.trim(),
      imageUrls: form.imageUrls.map(item => item.trim()).filter(Boolean),
      location: form.location.trim(),
      contactName: form.contactName.trim(),
      phone: form.phone.trim(),
      wechat: form.wechat.trim(),
      qq: form.qq.trim(),
    })
    uni.removeStorageSync(DRAFT_KEY)
    updateDraftCount()
    showSuccess(form.id ? '已更新' : '发布成功')
    setTimeout(() => {
      uni.reLaunch({
        url: '/pages/buyer/index',
      })
    }, 420)
  }
  catch (error) {
    showError((error as Error).message)
  }
  finally {
    submitting.value = false
  }
}
</script>

<template>
  <view class="publish-page">
    <template v-if="!authStore.isLoggedIn">
      <view class="publish-shell">
        <view class="publish-topbar">
          <view class="top-icon" @click="goBack">
            ×
          </view>
          <view class="top-title">
            {{ pageTitle }}
          </view>
          <view class="top-action ghost" @click="jumpToLogin">
            登录
          </view>
        </view>

        <view class="section-card">
          <EmptyState title="登录后才能发布闲置" description="登录后可以保存草稿、上传图片、编辑自己的商品信息。">
            <view class="empty-action">
              <view class="publish-btn" @click="jumpToLogin">
                前往登录
              </view>
            </view>
          </EmptyState>
        </view>
      </view>
    </template>

    <template v-else>
      <view class="publish-shell">
        <view class="publish-topbar">
          <view class="top-icon" @click="goBack">
            ×
          </view>
          <view class="top-title">
            {{ pageTitle }}
          </view>
          <view class="top-actions">
            <view class="draft-link" @click="restoreDraft(true)">
              草稿箱 · {{ draftCount }}
            </view>
            <view class="top-action" @click="submitForm">
              {{ submitting ? '发布中' : (isEditing ? '保存' : '发布') }}
            </view>
          </view>
        </view>

        <view class="editor-card">
          <view class="editor-head">
            <view class="media-tile" @click="pickImages">
              <image v-if="previewImages.length" class="media-preview" :src="previewImages[0]" mode="aspectFill" />
              <template v-else>
                <text class="media-plus">{{ uploading ? '...' : '+' }}</text>
                <text class="media-copy">最多上传 9 张图</text>
              </template>
            </view>

            <view class="type-switch">
              <view class="type-pill" :class="{ active: form.type === 'supply' }" @click="form.type = 'supply'; syncPlaceholder()">
                闲置
              </view>
              <view class="type-pill" :class="{ active: form.type === 'demand' }" @click="form.type = 'demand'; syncPlaceholder()">
                求购
              </view>
            </view>
          </view>

          <input
            v-model="form.title"
            class="title-input"
            placeholder="给这件宝贝起个标题"
          >
          <textarea
            v-model="form.description"
            class="desc-input"
            :placeholder="editorPlaceholder"
            maxlength="300"
          />

          <view class="smart-write" @click="smartWriteDescription">
            智能帮写 ›
          </view>

          <view v-if="previewImages.length" class="gallery-strip">
            <view
              v-for="(image, index) in previewImages"
              :key="`${image}-${index}`"
              class="gallery-item"
            >
              <image class="gallery-image" :src="image" mode="aspectFill" />
              <view class="gallery-remove" @click.stop="removeImage(index)">
                ×
              </view>
              <view v-if="index === 0" class="gallery-badge">
                首图
              </view>
            </view>
            <view
              v-if="previewImages.length < 9"
              class="gallery-add"
              @click="pickImages"
            >
              +继续添加
            </view>
          </view>
        </view>

        <view class="meta-card">
          <view class="meta-row">
            <text class="meta-label">{{ priceLabel }}</text>
            <input
              v-model="priceText"
              class="meta-input price"
              type="digit"
              :placeholder="form.type === 'supply' ? '¥0.00' : '预算金额'"
            >
          </view>

          <picker mode="selector" :range="categoryOptions" @change="handleCategoryChange">
            <view class="meta-row picker-row">
              <text class="meta-label">分类</text>
              <text class="meta-value">{{ form.category || '选择分类' }}</text>
            </view>
          </picker>

          <picker mode="selector" :range="conditionOptions" @change="handleConditionChange">
            <view class="meta-row picker-row">
              <text class="meta-label">{{ form.type === 'supply' ? '成色' : '需求状态' }}</text>
              <text class="meta-value">{{ form.condition || '请选择' }}</text>
            </view>
          </picker>

          <view class="meta-row">
            <text class="meta-label">所在位置</text>
            <input
              v-model="form.location"
              class="meta-input"
              placeholder="例如：图书馆门口"
            >
          </view>
        </view>

        <view class="meta-card compact">
        </view>

        <view class="rules-card">
          <view v-for="rule in campusRules" :key="rule" class="rule-line">
            {{ rule }}
          </view>
        </view>
      </view>
    </template>
  </view>
</template>

<style scoped lang="scss">
.publish-page {
  min-height: 100vh;
  background: #f6f6f4;
}

.publish-shell {
  padding: calc(24rpx + env(safe-area-inset-top)) 24rpx 48rpx;
}

.publish-topbar {
  display: grid;
  grid-template-columns: 64rpx minmax(0, 1fr) auto;
  align-items: center;
  gap: 18rpx;
}

.top-icon {
  width: 64rpx;
  height: 64rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 58rpx;
  line-height: 1;
  color: #111;
}

.top-title {
  font-size: 50rpx;
  font-weight: 800;
  color: #111;
}

.top-actions {
  display: flex;
  align-items: center;
  gap: 18rpx;
}

.draft-link {
  font-size: 26rpx;
  color: #333;
}

.top-action {
  min-width: 132rpx;
  height: 78rpx;
  padding: 0 26rpx;
  border-radius: 999rpx;
  background: #ffe125;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 30rpx;
  font-weight: 800;
  color: #111;
}

.top-action.ghost {
  background: #ece9e1;
}

.editor-card,
.meta-card,
.rules-card {
  margin-top: 22rpx;
  background: #fff;
  border-radius: 34rpx;
}

.editor-card {
  padding: 28rpx;
}

.editor-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 20rpx;
}

.media-tile {
  width: 172rpx;
  height: 172rpx;
  border-radius: 28rpx;
  background: #f5f5f3;
  padding: 18rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  color: #8f8f8a;
  overflow: hidden;
}

.media-preview {
  width: 100%;
  height: 100%;
  border-radius: 20rpx;
}

.media-plus {
  font-size: 48rpx;
  line-height: 1;
}

.media-copy {
  margin-top: 12rpx;
  font-size: 22rpx;
  line-height: 1.45;
}

.type-switch {
  display: flex;
  gap: 12rpx;
}

.type-pill {
  min-width: 110rpx;
  height: 62rpx;
  padding: 0 20rpx;
  border-radius: 999rpx;
  background: #f3f3f0;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #7d7d78;
  font-size: 24rpx;
  font-weight: 700;
}

.type-pill.active {
  background: #111;
  color: #fff;
}

.title-input {
  width: 100%;
  margin-top: 28rpx;
  font-size: 38rpx;
  font-weight: 700;
  color: #111;
}

.desc-input {
  width: 100%;
  min-height: 420rpx;
  margin-top: 22rpx;
  font-size: 32rpx;
  line-height: 1.65;
  color: #111;
}

.smart-write {
  margin-top: 18rpx;
  display: inline-flex;
  align-items: center;
  color: #4264ff;
  font-size: 28rpx;
  font-weight: 700;
}

.gallery-strip {
  display: flex;
  gap: 14rpx;
  margin-top: 26rpx;
  overflow-x: auto;
  white-space: nowrap;
}

.gallery-item,
.gallery-add {
  position: relative;
  width: 168rpx;
  height: 168rpx;
  border-radius: 24rpx;
  flex-shrink: 0;
  overflow: hidden;
}

.gallery-item {
  background: #f3f1ec;
}

.gallery-image {
  width: 100%;
  height: 100%;
}

.gallery-remove {
  position: absolute;
  top: 10rpx;
  right: 10rpx;
  width: 40rpx;
  height: 40rpx;
  border-radius: 50%;
  background: rgba(17, 17, 17, 0.66);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-size: 24rpx;
}

.gallery-badge {
  position: absolute;
  left: 10rpx;
  bottom: 10rpx;
  min-height: 36rpx;
  padding: 0 12rpx;
  border-radius: 999rpx;
  background: rgba(255, 255, 255, 0.88);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: #111;
  font-size: 18rpx;
  font-weight: 700;
}

.gallery-add {
  background: #f5f5f3;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #7d7d78;
  font-size: 24rpx;
  font-weight: 700;
}

.meta-card {
  padding: 6rpx 28rpx;
}

.meta-card.compact {
  margin-top: 18rpx;
}

.profile-note {
  padding: 28rpx 0;
  font-size: 24rpx;
  line-height: 1.8;
  color: #7d7d78;
}

.meta-row {
  min-height: 112rpx;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20rpx;
  border-bottom: 1px solid rgba(17, 17, 17, 0.06);
}

.meta-row:last-child {
  border-bottom: 0;
}

.meta-label {
  font-size: 30rpx;
  font-weight: 700;
  color: #111;
}

.meta-input,
.meta-value {
  flex: 1;
  text-align: right;
  font-size: 30rpx;
  color: #8f8f8a;
}

.meta-input.price {
  color: #ff4d3a;
  font-size: 34rpx;
  font-weight: 800;
}

.picker-row {
  position: relative;
}

.picker-row::after {
  content: '›';
  margin-left: 12rpx;
  color: #b3b3af;
  font-size: 30rpx;
}

.rules-card {
  padding: 24rpx 28rpx;
}

.rule-line {
  font-size: 24rpx;
  line-height: 1.8;
  color: #888;
}

.rule-line + .rule-line {
  margin-top: 10rpx;
}

.empty-action {
  margin-top: 18rpx;
}

.publish-btn {
  min-height: 88rpx;
  padding: 0 34rpx;
  border-radius: 999rpx;
  background: #ffe125;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: #111;
  font-size: 26rpx;
  font-weight: 800;
}
</style>
