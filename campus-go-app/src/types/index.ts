export type ListingType = 'supply' | 'demand'
export type ListingStatus = 'active' | 'archived'
export type SortValue = 'recent' | 'price_asc' | 'price_desc' | 'hot'
export type UserRole = 'user' | 'admin'
export type UserStatus = 'active' | 'disabled'
export type NotificationType = 'info' | 'warning' | 'success' | 'alert'
export type NotificationAudience = 'all' | 'buyers' | 'sellers'
export type NotificationStatus = 'active' | 'draft' | 'archived'

export interface UserProfile {
  id: number
  nickname: string
  campus: string
  studentNo: string
  tagline: string
  contactName: string
  phone: string
  wechat: string
  qq: string
  avatarColor: string
  avatarUrl: string
  role: UserRole
  status: UserStatus
  createdAt: string
}

export interface Listing {
  id: number
  type: ListingType
  title: string
  category: string
  condition: string
  description: string
  price: number | null
  imageUrl: string
  imageUrls: string[]
  location: string
  contactName: string
  phone: string
  wechat: string
  qq: string
  status: ListingStatus
  views: number
  favoriteCount: number
  cartCount: number
  createdAt: string
  updatedAt: string
  ownerId: number
  ownerNickname: string
  ownerCampus: string
  ownerAvatarColor: string
  ownerAvatarUrl: string
  isFavorite?: boolean
  isInCart?: boolean
  isFollowingOwner?: boolean
}

export interface ListingFilters {
  keyword?: string
  category?: string
  sort?: SortValue
  page?: number
  pageSize?: number
}

export interface ListingPayload {
  id?: number
  type: ListingType
  title: string
  category: string
  condition: string
  description: string
  price: number | null
  imageUrl: string
  imageUrls: string[]
  location: string
  contactName: string
  phone: string
  wechat: string
  qq: string
  status?: ListingStatus
}

export interface CollectionSet {
  favorites: Listing[]
  cart: Listing[]
  history: Listing[]
}

export interface SellerDashboard {
  activeSupplyCount: number
  activeDemandCount: number
  favoriteCount: number
  cartCount: number
  historyCount: number
}

export interface DashboardPayload {
  summary: SellerDashboard
  supplyListings: Listing[]
  demandListings: Listing[]
}

export interface AuthResult {
  token: string
  user: UserProfile
}

export interface NotificationItem {
  id: number
  title: string
  content: string
  type: NotificationType
  audience: NotificationAudience
  status: NotificationStatus
  pinned: boolean
  createdBy: number | null
  createdAt: string
  updatedAt: string
}

export interface FollowedUserSummary {
  id: number
  nickname: string
  campus: string
  studentNo: string
  tagline: string
  avatarColor: string
  avatarUrl: string
  createdAt: string
  isMutual: boolean
  activeListingCount: number
  activeSupplyCount: number
  activeDemandCount: number
  latestListingId: number | null
  latestListingTitle: string
  latestListingImageUrl: string
  latestListingUpdatedAt: string
}

export interface ChatPeerUser {
  id: number
  nickname: string
  campus: string
  avatarColor: string
  avatarUrl: string
}

export interface ChatConversation {
  id: number
  listingId: number
  listingTitle: string
  listingImageUrl: string
  listingPrice: number | null
  listingStatus: ListingStatus
  buyerId: number
  sellerId: number
  createdAt: string
  updatedAt: string
  lastMessageAt: string
  lastMessage: string
  unreadCount: number
  peerUser: ChatPeerUser
}

export interface ChatMessage {
  id: number
  conversationId: number
  senderId: number
  body: string
  kind: 'text'
  readAt: string | null
  createdAt: string
}

export interface ConversationMessagePayload {
  conversation: ChatConversation
  messages: ChatMessage[]
}

export interface PaginatedResult<T> {
  items: T[]
  page: number
  pageSize: number
  total: number
  hasMore: boolean
}
