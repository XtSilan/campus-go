import type {
  CollectionSet,
  DashboardPayload,
  FollowedUserSummary,
  Listing,
  ListingFilters,
  ListingPayload,
  ListingType,
  NotificationItem,
  PaginatedResult,
} from '@/types'
import { request } from './http'

function toQuery(filters: Record<string, string>) {
  const params = new URLSearchParams(filters)
  const query = params.toString()
  return query ? `?${query}` : ''
}

export function fetchListings(type: ListingType, filters: ListingFilters = {}) {
  const query = toQuery(
    Object.entries({
      type,
      keyword: filters.keyword || '',
      category: filters.category || '',
      sort: filters.sort || 'recent',
      page: String(filters.page || 1),
      pageSize: String(filters.pageSize || 10),
    }).reduce<Record<string, string>>((result, [key, value]) => {
      if (value) {
        result[key] = value
      }

      return result
    }, {}),
  )

  return request<PaginatedResult<Listing>>({
    url: `/listings${query}`,
    withAuth: true,
  })
}

export function fetchListingDetail(id: number) {
  return request<Listing>({
    url: `/listings/${id}`,
    withAuth: true,
  })
}

export function createListing(payload: ListingPayload) {
  return request<Listing>({
    url: '/listings',
    method: 'POST',
    data: payload,
    withAuth: true,
  })
}

export function updateListing(payload: ListingPayload) {
  return request<Listing>({
    url: `/listings/${payload.id}`,
    method: 'PUT',
    data: payload,
    withAuth: true,
  })
}

export function deleteListing(id: number) {
  return request<{ id: number }>({
    url: `/listings/${id}`,
    method: 'DELETE',
    withAuth: true,
  })
}

export function fetchDashboard() {
  return request<DashboardPayload>({
    url: '/me/dashboard',
    withAuth: true,
  })
}

export function fetchCollections() {
  return request<CollectionSet>({
    url: '/me/collections',
    withAuth: true,
  })
}

export function fetchMyFollows() {
  return request<FollowedUserSummary[]>({
    url: '/me/follows',
    withAuth: true,
  })
}

export function toggleFavorite(listingId: number) {
  return request<{ active: boolean }>({
    url: `/me/favorites/${listingId}`,
    method: 'POST',
    withAuth: true,
  })
}

export function toggleFollowUser(userId: number) {
  return request<{ active: boolean }>({
    url: `/me/follows/${userId}`,
    method: 'POST',
    withAuth: true,
  })
}

export function toggleCart(listingId: number) {
  return request<{ active: boolean }>({
    url: `/me/cart/${listingId}`,
    method: 'POST',
    withAuth: true,
  })
}

export function recordHistory(listingId: number) {
  return request<{ ok: boolean }>({
    url: `/me/history/${listingId}`,
    method: 'POST',
    withAuth: true,
  })
}

export function fetchPublicNotifications(limit = 5) {
  return request<NotificationItem[]>({
    url: `/notifications/public?limit=${limit}`,
  })
}
