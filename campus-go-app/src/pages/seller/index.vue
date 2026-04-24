<script setup lang="ts">
import type { ChatConversation, ChatMessage } from '@/types'
import { onLoad, onShow, onUnload } from '@dcloudio/uni-app'
import { computed, nextTick, ref } from 'vue'
import { fetchChatConversations, fetchConversationMessages, markConversationAsRead, sendConversationMessage } from '@/api/chat'
import AppTabbar from '@/components/AppTabbar.vue'
import EmptyState from '@/components/EmptyState.vue'
import { socketBaseUrl } from '@/config/runtime'
import { useAuthStore } from '@/stores/auth'
import { formatPrice, formatRelativeTime, getCategoryInitial } from '@/utils/format'
import { readToken } from '@/utils/storage'
import { jumpToLogin, showError } from '@/utils/ui'

const authStore = useAuthStore()

const conversations = ref<ChatConversation[]>([])
const loading = ref(false)
const loadingMessages = ref(false)
const sending = ref(false)
const activeConversation = ref<ChatConversation | null>(null)
const messages = ref<ChatMessage[]>([])
const draftText = ref('')
const socketTask = ref<UniApp.SocketTask | null>(null)
const socketReady = ref(false)
const scrollIntoViewId = ref('')
const entryConversationId = ref(0)
const openedByDeepLink = ref(false)

const currentUserId = computed(() => authStore.currentUser?.id || 0)
const currentUserAvatarUrl = computed(() => authStore.currentUser?.avatarUrl || '')

const conversationTitle = computed(() => activeConversation.value?.peerUser.nickname || '消息')
const conversationSubtitle = computed(() => {
  if (!activeConversation.value) {
    return ''
  }

  return `${activeConversation.value.peerUser.campus} · ${formatRelativeTime(activeConversation.value.lastMessageAt)}`
})

onLoad((query) => {
  const conversationId = Number(query?.conversationId || 0)
  if (conversationId) {
    entryConversationId.value = conversationId
    openedByDeepLink.value = true
  }
})

onShow(async () => {
  if (!authStore.isLoggedIn) {
    return
  }

  connectSocket()

  try {
    await loadConversations()
    if (entryConversationId.value) {
      await openConversation(entryConversationId.value, { keepDeepLink: true })
    }
  }
  catch (error) {
    showError((error as Error).message)
  }
})

onUnload(() => {
  disconnectSocket()
})

function formatConversationTime(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value
  }

  const today = new Date()
  const sameDay = today.toDateString() === date.toDateString()
  if (sameDay) {
    return `${`${date.getHours()}`.padStart(2, '0')}:${`${date.getMinutes()}`.padStart(2, '0')}`
  }

  return `${date.getMonth() + 1}-${date.getDate()}`
}

function formatMessageTime(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value
  }

  return `${`${date.getHours()}`.padStart(2, '0')}:${`${date.getMinutes()}`.padStart(2, '0')}`
}

function isMine(message: ChatMessage) {
  return message.senderId === currentUserId.value
}

function upsertConversation(nextConversation: ChatConversation) {
  const nextList = conversations.value.filter(item => item.id !== nextConversation.id)
  nextList.unshift(nextConversation)
  conversations.value = nextList.sort((left, right) => {
    return new Date(right.lastMessageAt).getTime() - new Date(left.lastMessageAt).getTime()
  })
}

async function loadConversations() {
  loading.value = true
  try {
    conversations.value = await fetchChatConversations()
  }
  finally {
    loading.value = false
  }
}

function scrollToBottom() {
  nextTick(() => {
    const lastMessage = messages.value.at(-1)
    if (!lastMessage) {
      return
    }
    scrollIntoViewId.value = `msg-${lastMessage.id}`
  })
}

async function markCurrentConversationRead() {
  if (!activeConversation.value) {
    return
  }

  await markConversationAsRead(activeConversation.value.id)
  if (socketReady.value && socketTask.value) {
    socketTask.value.send({
      data: JSON.stringify({
        type: 'conversation:read',
        conversationId: activeConversation.value.id,
      }),
    })
  }
}

async function openConversation(conversationId: number, options: { keepDeepLink?: boolean } = {}) {
  loadingMessages.value = true
  try {
    const payload = await fetchConversationMessages(conversationId)
    activeConversation.value = payload.conversation
    messages.value = payload.messages
    upsertConversation(payload.conversation)
    await markCurrentConversationRead()
    scrollToBottom()
    if (!options.keepDeepLink) {
      entryConversationId.value = 0
      openedByDeepLink.value = false
    }
  }
  finally {
    loadingMessages.value = false
  }
}

function leaveConversation() {
  if (openedByDeepLink.value) {
    const pages = getCurrentPages()
    if (pages.length > 1) {
      uni.navigateBack({
        delta: 1,
      })
      return
    }
  }

  activeConversation.value = null
  messages.value = []
  draftText.value = ''
  entryConversationId.value = 0
  openedByDeepLink.value = false
}

async function handleSend() {
  if (!activeConversation.value) {
    return
  }

  const body = draftText.value.trim()
  if (!body) {
    return
  }

  sending.value = true
  try {
    const message = await sendConversationMessage(activeConversation.value.id, body)
    if (!messages.value.some(item => item.id === message.id)) {
      messages.value = [...messages.value, message]
    }
    draftText.value = ''
    scrollToBottom()
  }
  catch (error) {
    showError((error as Error).message)
  }
  finally {
    sending.value = false
  }
}

function handleSocketMessage(rawData: string) {
  try {
    const payload = JSON.parse(rawData)

    if (payload.type === 'socket:ready') {
      socketReady.value = true
      return
    }

    if (payload.type === 'conversation:update' && payload.conversation) {
      upsertConversation(payload.conversation as ChatConversation)
      if (activeConversation.value?.id === payload.conversation.id) {
        activeConversation.value = payload.conversation as ChatConversation
      }
      return
    }

    if (payload.type === 'message:new' && payload.message) {
      const message = payload.message as ChatMessage
      if (activeConversation.value?.id === message.conversationId && !messages.value.some(item => item.id === message.id)) {
        messages.value = [...messages.value, message]
        markCurrentConversationRead().catch(() => {})
        scrollToBottom()
      }
    }
  }
  catch {}
}

function connectSocket() {
  if (!authStore.isLoggedIn || socketTask.value) {
    return
  }

  const token = readToken()
  if (!token) {
    return
  }

  const task = uni.connectSocket({
    url: `${socketBaseUrl}?token=${encodeURIComponent(token)}`,
    complete: () => {},
  })

  socketTask.value = task
  task.onOpen(() => {
    socketReady.value = true
  })
  task.onMessage((event) => {
    handleSocketMessage(String(event.data || ''))
  })
  task.onClose(() => {
    socketReady.value = false
    socketTask.value = null
  })
  task.onError(() => {
    socketReady.value = false
  })
}

function disconnectSocket() {
  if (!socketTask.value) {
    return
  }

  socketTask.value.close({
    complete: () => {},
  })
  socketTask.value = null
  socketReady.value = false
}

function goBuyer() {
  uni.reLaunch({
    url: '/pages/buyer/index',
  })
}
</script>

<template>
  <view class="page-shell message-page">
    <template v-if="!authStore.isLoggedIn">
      <view class="login-shell">
        <view class="message-header">
          <view class="message-title">
            消息
          </view>
          <view class="message-subtitle">
            登录后才能和发布者通过商品直接聊天
          </view>
        </view>

        <view class="section-card">
          <EmptyState title="登录后开启校园服务社区" description=" ">
            <view class="empty-action">
              <view class="action-btn dark" @click="jumpToLogin">
                前往登录
              </view>
            </view>
          </EmptyState>
        </view>
      </view>
    </template>

    <template v-else-if="activeConversation">
      <view class="chat-shell">
        <view class="chat-topbar">
          <view class="chat-back" @click="leaveConversation">
            ‹
          </view>
          <view class="chat-title-wrap">
            <view class="chat-title">
              {{ conversationTitle }}
            </view>
            <view class="chat-subtitle">
              {{ conversationSubtitle }}
            </view>
          </view>
          <view class="chat-more">
            ⋯
          </view>
        </view>

        <view class="chat-listing-card">
          <image v-if="activeConversation.listingImageUrl" class="chat-listing-image" :src="activeConversation.listingImageUrl" mode="aspectFill" />
          <view v-else class="chat-listing-fallback" :style="{ background: activeConversation.peerUser.avatarColor }">
            {{ getCategoryInitial(activeConversation.listingTitle) }}
          </view>
          <view class="chat-listing-copy">
            <view class="chat-listing-price">
              {{ formatPrice(activeConversation.listingPrice) }}
            </view>
            <view class="chat-listing-title">
              {{ activeConversation.listingTitle }}
            </view>
            <view class="chat-listing-meta">
              {{ activeConversation.listingStatus === 'active' ? '商品在售中' : '商品已下架' }}
            </view>
          </view>
        </view>

        <view class="chat-reminder">
          请先沟通清楚价格、成色、交接地点和时间，再决定是否成交。
        </view>

        <scroll-view
          class="chat-scroll"
          scroll-y
          :scroll-into-view="scrollIntoViewId"
        >
          <view v-if="loadingMessages" class="chat-empty">
            正在加载聊天记录...
          </view>

          <template v-else>
            <view
              v-for="message in messages"
              :id="`msg-${message.id}`"
              :key="message.id"
              class="message-row"
              :class="{ mine: isMine(message) }"
            >
              <view
                v-if="!isMine(message)"
                class="bubble-avatar"
                :style="{ background: activeConversation.peerUser.avatarColor }"
              >
                <image v-if="activeConversation.peerUser.avatarUrl" class="bubble-avatar-image" :src="activeConversation.peerUser.avatarUrl" mode="aspectFill" />
                <template v-else>
                  {{ getCategoryInitial(activeConversation.peerUser.nickname) }}
                </template>
              </view>
              <view class="bubble-wrap">
                <view class="bubble">
                  {{ message.body }}
                </view>
                <view class="bubble-time">
                  {{ formatMessageTime(message.createdAt) }}
                </view>
              </view>
              <view
                v-if="isMine(message)"
                class="bubble-avatar mine-avatar"
                :style="{ background: authStore.currentUser?.avatarColor || '#c07d5c' }"
              >
                <image v-if="currentUserAvatarUrl" class="bubble-avatar-image" :src="currentUserAvatarUrl" mode="aspectFill" />
                <template v-else>
                  {{ getCategoryInitial(authStore.currentUser?.nickname || '我') }}
                </template>
              </view>
            </view>
          </template>
        </scroll-view>

        <view class="chat-inputbar">
          <view class="chat-icon-btn">
            ⌁
          </view>
          <input
            v-model="draftText"
            class="chat-input"
            placeholder="想跟TA说点什么..."
            confirm-type="send"
            @confirm="handleSend"
          >
          <view class="chat-send" :class="{ disabled: !draftText.trim() || sending }" @click="handleSend">
            {{ sending ? '发送中' : '发送' }}
          </view>
        </view>
      </view>
    </template>

    <template v-else>
      <view class="inbox-shell">
        <view class="message-header">
          <view class="message-title">
            消息
          </view>
        </view>

        <view v-if="loading" class="section-card inbox-empty">
          正在加载会话...
        </view>

        <template v-else-if="conversations.length">
          <view
            v-for="conversation in conversations"
            :key="conversation.id"
            class="conversation-card"
            @click="openConversation(conversation.id)"
          >
            <view class="conversation-avatar" :style="{ background: conversation.peerUser.avatarColor }">
              {{ getCategoryInitial(conversation.peerUser.nickname) }}
            </view>
            <view class="conversation-main">
              <view class="conversation-head">
                <view class="conversation-name">
                  {{ conversation.peerUser.nickname }}
                </view>
                <view class="conversation-time">
                  {{ formatConversationTime(conversation.lastMessageAt) }}
                </view>
              </view>
              <view class="conversation-listing">
                {{ conversation.listingTitle }}
              </view>
              <view class="conversation-preview">
                {{ conversation.lastMessage || '点进来开始聊一聊' }}
              </view>
            </view>
            <view v-if="conversation.unreadCount" class="conversation-badge">
              {{ conversation.unreadCount > 99 ? '99+' : conversation.unreadCount }}
            </view>
          </view>
        </template>

        <view v-else class="section-card">
          <EmptyState title="还没有聊天会话" description=" ">
            <view class="empty-action">
              <view class="action-btn dark" @click="goBuyer">
                去首页看看
              </view>
            </view>
          </EmptyState>
        </view>
      </view>

      <AppTabbar current="seller" />
    </template>
  </view>
</template>

<style scoped lang="scss">
.message-page {
  height: 100vh;
  min-height: 100vh;
  background: #f7f7f5;
  padding: 0;
  overflow: hidden;
}

.login-shell,
.inbox-shell {
  padding: 34rpx 24rpx 200rpx;
}

.message-header {
  padding: 10rpx 0 24rpx;
}

.message-title {
  font-size: 50rpx;
  line-height: 1.1;
  font-weight: 800;
  color: #111;
}

.message-subtitle {
  margin-top: 14rpx;
  font-size: 24rpx;
  line-height: 1.7;
  color: #8b8b86;
}

.conversation-card {
  position: relative;
  display: flex;
  align-items: center;
  gap: 18rpx;
  margin-top: 18rpx;
  padding: 24rpx;
  border-radius: 28rpx;
  background: #fff;
}

.conversation-avatar {
  width: 92rpx;
  height: 92rpx;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-size: 24rpx;
  font-weight: 700;
  flex-shrink: 0;
}

.conversation-main {
  flex: 1;
  min-width: 0;
}

.conversation-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16rpx;
}

.conversation-name {
  font-size: 30rpx;
  font-weight: 700;
  color: #111;
}

.conversation-time {
  font-size: 22rpx;
  color: #999;
}

.conversation-listing {
  margin-top: 10rpx;
  font-size: 24rpx;
  color: #444;
  font-weight: 600;
}

.conversation-preview {
  margin-top: 12rpx;
  font-size: 24rpx;
  color: #909090;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.conversation-badge {
  min-width: 42rpx;
  height: 42rpx;
  padding: 0 12rpx;
  border-radius: 999rpx;
  background: #ff4d3a;
  color: #fff;
  font-size: 22rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.chat-shell {
  height: 100vh;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background: linear-gradient(180deg, #ffffff, #faf8f3 56%, #f7f7f5);
  overflow: hidden;
}

.chat-topbar {
  display: grid;
  grid-template-columns: 72rpx minmax(0, 1fr) 72rpx;
  align-items: center;
  gap: 16rpx;
  padding: calc(22rpx + env(safe-area-inset-top)) 24rpx 18rpx;
  flex-shrink: 0;
}

.chat-back,
.chat-more {
  width: 72rpx;
  height: 72rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #111;
}

.chat-back {
  font-size: 52rpx;
}

.chat-more {
  font-size: 36rpx;
}

.chat-title-wrap {
  text-align: center;
}

.chat-title {
  font-size: 34rpx;
  font-weight: 800;
  color: #111;
}

.chat-subtitle {
  margin-top: 8rpx;
  font-size: 20rpx;
  color: #999;
}

.chat-listing-card {
  display: grid;
  grid-template-columns: 112rpx minmax(0, 1fr);
  align-items: center;
  gap: 18rpx;
  margin: 0 24rpx;
  padding: 20rpx;
  border-radius: 30rpx;
  background: #fff;
  flex-shrink: 0;
}

.chat-listing-image,
.chat-listing-fallback {
  width: 112rpx;
  height: 112rpx;
  border-radius: 22rpx;
}

.chat-listing-fallback {
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-size: 24rpx;
  font-weight: 700;
}

.chat-listing-copy {
  min-width: 0;
}

.chat-listing-price {
  font-size: 40rpx;
  font-weight: 900;
  color: #ff4d3a;
}

.chat-listing-title {
  margin-top: 10rpx;
  font-size: 26rpx;
  color: #111;
  font-weight: 700;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.chat-listing-meta {
  margin-top: 10rpx;
  font-size: 22rpx;
  color: #8b8b86;
}

.chat-reminder {
  margin: 18rpx 24rpx 0;
  padding: 18rpx 24rpx;
  border-radius: 24rpx;
  background: #fff0c8;
  font-size: 24rpx;
  line-height: 1.7;
  color: #7a5a00;
  flex-shrink: 0;
}

.chat-scroll {
  flex: 1;
  height: 0;
  min-height: 0;
  padding: 24rpx 24rpx 36rpx;
  overflow: hidden;
}

.chat-empty {
  padding: 80rpx 0;
  text-align: center;
  font-size: 24rpx;
  color: #999;
}

.message-row {
  display: flex;
  align-items: flex-end;
  gap: 16rpx;
  margin-top: 22rpx;
  width: 100%;
  overflow: hidden;
}

.message-row.mine {
  justify-content: flex-end;
}

.message-row:not(.mine) {
  padding-right: 120rpx;
}

.message-row.mine {
  padding-left: 120rpx;
}

.bubble-avatar {
  width: 72rpx;
  height: 72rpx;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-size: 20rpx;
  font-weight: 700;
  flex-shrink: 0;
  overflow: hidden;
}

.bubble-avatar-image {
  width: 100%;
  height: 100%;
}

.mine-avatar {
  margin-left: 8rpx;
}

.bubble-wrap {
  max-width: 100%;
  min-width: 0;
  display: flex;
  flex-direction: column;
  flex-shrink: 1;
}

.message-row.mine .bubble-wrap {
  align-items: flex-end;
  margin-left: auto;
}

.bubble {
  max-width: 100%;
  padding: 22rpx 24rpx;
  border-radius: 30rpx;
  background: #fff;
  font-size: 30rpx;
  line-height: 1.58;
  color: #111;
  word-break: break-all;
  overflow-wrap: anywhere;
}

.message-row.mine .bubble {
  background: #ffe125;
}

.bubble-time {
  margin-top: 10rpx;
  padding: 0 10rpx;
  font-size: 20rpx;
  color: #999;
}

.message-row.mine .bubble-time {
  text-align: right;
}

.chat-inputbar {
  display: grid;
  grid-template-columns: 72rpx minmax(0, 1fr) 110rpx;
  gap: 16rpx;
  align-items: center;
  padding: 18rpx 24rpx calc(18rpx + env(safe-area-inset-bottom));
  background: rgba(255, 255, 255, 0.98);
  border-top: 1px solid rgba(17, 17, 17, 0.06);
  flex-shrink: 0;
}

.chat-icon-btn {
  width: 72rpx;
  height: 72rpx;
  border-radius: 50%;
  background: #f1f1ef;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #666;
  font-size: 28rpx;
}

.chat-input {
  min-height: 88rpx;
  padding: 0 28rpx;
  border-radius: 999rpx;
  background: #f4f4f2;
  font-size: 28rpx;
  color: #111;
}

.chat-send {
  min-height: 88rpx;
  border-radius: 999rpx;
  background: #ffe125;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #111;
  font-size: 26rpx;
  font-weight: 800;
}

.chat-send.disabled {
  opacity: 0.45;
}

.empty-action {
  margin-top: 18rpx;
}

.action-btn {
  min-height: 88rpx;
  padding: 0 30rpx;
  border-radius: 999rpx;
  background: #ece9e1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: #111;
  font-size: 24rpx;
  font-weight: 700;
}

.action-btn.dark {
  background: #111;
  color: #fff;
}

.inbox-empty {
  margin-top: 18rpx;
  text-align: center;
  font-size: 24rpx;
  color: #999;
}
</style>
