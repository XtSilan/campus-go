import type { ChatConversation, ChatMessage, ConversationMessagePayload } from '@/types'
import { request } from './http'

export function fetchChatConversations() {
  return request<ChatConversation[]>({
    url: '/chat/conversations',
    withAuth: true,
  })
}

export function ensureConversationFromListing(listingId: number) {
  return request<ChatConversation>({
    url: '/chat/conversations/from-listing',
    method: 'POST',
    data: { listingId },
    withAuth: true,
  })
}

export function fetchConversation(conversationId: number) {
  return request<ChatConversation>({
    url: `/chat/conversations/${conversationId}`,
    withAuth: true,
  })
}

export function fetchConversationMessages(conversationId: number, limit = 80) {
  return request<ConversationMessagePayload>({
    url: `/chat/conversations/${conversationId}/messages?limit=${limit}`,
    withAuth: true,
  })
}

export function sendConversationMessage(conversationId: number, body: string) {
  return request<ChatMessage>({
    url: `/chat/conversations/${conversationId}/messages`,
    method: 'POST',
    data: { body },
    withAuth: true,
  })
}

export function markConversationAsRead(conversationId: number) {
  return request<{ readAt: string }>({
    url: `/chat/conversations/${conversationId}/read`,
    method: 'POST',
    withAuth: true,
  })
}
