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
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import {
  createListing,
  deleteListing,
  fetchCollections,
  fetchDashboard,
  fetchListingDetail,
  fetchListings,
  fetchMyFollows,
  fetchPublicNotifications,
  recordHistory,
  toggleCart,
  toggleFavorite,
  toggleFollowUser,
  updateListing,
} from '@/api/listings'
import { clearCache, clearCacheByPrefix, readCache, writeCache } from '@/utils/cache'
import { readUser } from '@/utils/storage'

const BUYER_FEED_TTL = 2 * 60 * 1000
const DETAIL_TTL = 5 * 60 * 1000
const COLLECTION_TTL = 60 * 1000
const DASHBOARD_TTL = 60 * 1000
const FEATURED_TTL = 2 * 60 * 1000
const FOLLOWS_TTL = 60 * 1000

function emptyPage<T>(): PaginatedResult<T> {
  return {
    items: [],
    page: 1,
    pageSize: 10,
    total: 0,
    hasMore: false,
  }
}

function patchListing(list: Listing[], listingId: number, nextState: Partial<Listing>) {
  return list.map(item => (item.id === listingId ? { ...item, ...nextState } : item))
}

function feedCacheKey(type: ListingType, filters: ListingFilters) {
  const user = readUser<{ id?: number }>()
  const scope = user?.id ? `user:${user.id}` : 'guest'
  return `buyer-feed:${JSON.stringify({
    scope,
    type,
    keyword: filters.keyword || '',
    category: filters.category || '',
    sort: filters.sort || 'recent',
    page: filters.page || 1,
    pageSize: filters.pageSize || 10,
  })}`
}

function viewerScope() {
  const user = readUser<{ id?: number }>()
  return user?.id ? `user:${user.id}` : 'guest'
}

function scopedKey(base: string) {
  return `${base}:${viewerScope()}`
}

export const useMarketStore = defineStore('market', () => {
  const supplyPage = ref<PaginatedResult<Listing>>(emptyPage())
  const featuredListings = ref<Listing[]>([])
  const demandHighlights = ref<Listing[]>([])
  const notifications = ref<NotificationItem[]>([])
  const followedUsers = ref<FollowedUserSummary[]>([])
  const favoriteListings = ref<Listing[]>([])
  const cartListings = ref<Listing[]>([])
  const historyListings = ref<Listing[]>([])
  const mySupplyListings = ref<Listing[]>([])
  const myDemandListings = ref<Listing[]>([])
  const summary = ref<DashboardPayload['summary'] | null>(null)
  const currentListing = ref<Listing | null>(null)
  const loading = ref(false)
  const loadingMore = ref(false)
  const currentFilters = ref<ListingFilters>({
    keyword: '',
    category: '',
    sort: 'recent',
    page: 1,
    pageSize: 10,
  })

  const supplyListings = computed(() => supplyPage.value.items)
  const hasMoreSupply = computed(() => supplyPage.value.hasMore)

  function syncListing(listingId: number, nextState: Partial<Listing>) {
    supplyPage.value = {
      ...supplyPage.value,
      items: patchListing(supplyPage.value.items, listingId, nextState),
    }
    demandHighlights.value = patchListing(demandHighlights.value, listingId, nextState)
    featuredListings.value = patchListing(featuredListings.value, listingId, nextState)
    favoriteListings.value = patchListing(favoriteListings.value, listingId, nextState)
    cartListings.value = patchListing(cartListings.value, listingId, nextState)
    historyListings.value = patchListing(historyListings.value, listingId, nextState)
    mySupplyListings.value = patchListing(mySupplyListings.value, listingId, nextState)
    myDemandListings.value = patchListing(myDemandListings.value, listingId, nextState)

    if (currentListing.value?.id === listingId) {
      currentListing.value = { ...currentListing.value, ...nextState }
    }
  }

  function syncOwnerFollow(ownerId: number, active: boolean) {
    const patchList = (list: Listing[]) => list.map(item => (
      item.ownerId === ownerId ? { ...item, isFollowingOwner: active } : item
    ))

    supplyPage.value = {
      ...supplyPage.value,
      items: patchList(supplyPage.value.items),
    }
    demandHighlights.value = patchList(demandHighlights.value)
    featuredListings.value = patchList(featuredListings.value)
    favoriteListings.value = patchList(favoriteListings.value)
    cartListings.value = patchList(cartListings.value)
    historyListings.value = patchList(historyListings.value)
    mySupplyListings.value = patchList(mySupplyListings.value)
    myDemandListings.value = patchList(myDemandListings.value)

    if (currentListing.value?.ownerId === ownerId) {
      currentListing.value = {
        ...currentListing.value,
        isFollowingOwner: active,
      }
    }
  }

  function invalidateListCaches() {
    clearCacheByPrefix('buyer-feed:')
    clearCacheByPrefix('featured-listings:')
    clearCacheByPrefix('demand-highlights:')
    clearCache('public-notifications')
    clearCacheByPrefix('follows:')
    clearCacheByPrefix('dashboard:')
    clearCacheByPrefix('collections:')
    clearCacheByPrefix('detail:')
  }

  async function loadBuyerFeed(type: ListingType = 'supply', filters: ListingFilters = {}, options: { refresh?: boolean, append?: boolean, useCache?: boolean } = {}) {
    const mergedFilters: ListingFilters = {
      keyword: filters.keyword ?? currentFilters.value.keyword ?? '',
      category: filters.category ?? currentFilters.value.category ?? '',
      sort: filters.sort ?? currentFilters.value.sort ?? 'recent',
      page: filters.page ?? (options.append ? (supplyPage.value.page + 1) : 1),
      pageSize: filters.pageSize ?? currentFilters.value.pageSize ?? 10,
    }
    const cacheKey = feedCacheKey(type, mergedFilters)

    currentFilters.value = mergedFilters

    if (options.useCache && !options.refresh && !options.append) {
      const cached = readCache<PaginatedResult<Listing>>(cacheKey)
      if (cached) {
        supplyPage.value = cached
        return cached
      }
    }

    if (options.append) {
      loadingMore.value = true
    }
    else {
      loading.value = true
    }

    try {
      const payload = await fetchListings(type, mergedFilters)
      supplyPage.value = options.append
        ? {
            ...payload,
            items: [...supplyPage.value.items, ...payload.items],
          }
        : payload

      if (!options.append) {
        writeCache(cacheKey, supplyPage.value, BUYER_FEED_TTL)
      }

      return supplyPage.value
    }
    finally {
      loading.value = false
      loadingMore.value = false
    }
  }

  async function loadDemandHighlights(options: { refresh?: boolean, useCache?: boolean } = {}) {
    if (options.useCache && !options.refresh) {
      const cached = readCache<Listing[]>(scopedKey('demand-highlights'))
      if (cached) {
        demandHighlights.value = cached
        return cached
      }
    }

    const payload = await fetchListings('demand', {
      page: 1,
      pageSize: 6,
      sort: 'recent',
    })
    demandHighlights.value = payload.items
    writeCache(scopedKey('demand-highlights'), payload.items, BUYER_FEED_TTL)
    return demandHighlights.value
  }

  async function loadFeaturedListings(options: { refresh?: boolean, useCache?: boolean } = {}) {
    const key = scopedKey('featured-listings')

    if (options.useCache && !options.refresh) {
      const cached = readCache<Listing[]>(key)
      if (cached) {
        featuredListings.value = cached
        return cached
      }
    }

    const payload = await fetchListings('supply', {
      page: 1,
      pageSize: 3,
      sort: 'hot',
    })
    featuredListings.value = payload.items
    writeCache(key, featuredListings.value, FEATURED_TTL)
    return featuredListings.value
  }

  async function loadNotifications(options: { refresh?: boolean, useCache?: boolean } = {}) {
    if (options.useCache && !options.refresh) {
      const cached = readCache<NotificationItem[]>('public-notifications')
      if (cached) {
        notifications.value = cached
        return cached
      }
    }

    notifications.value = await fetchPublicNotifications(5)
    writeCache('public-notifications', notifications.value, BUYER_FEED_TTL)
    return notifications.value
  }

  async function loadDashboard(options: { refresh?: boolean, useCache?: boolean } = {}) {
    if (options.useCache && !options.refresh) {
      const cached = readCache<DashboardPayload>(scopedKey('dashboard'))
      if (cached) {
        summary.value = cached.summary
        mySupplyListings.value = cached.supplyListings
        myDemandListings.value = cached.demandListings
        return cached
      }
    }

    const payload = await fetchDashboard()
    summary.value = payload.summary
    mySupplyListings.value = payload.supplyListings
    myDemandListings.value = payload.demandListings
    writeCache(scopedKey('dashboard'), payload, DASHBOARD_TTL)
    return payload
  }

  async function loadCollections(options: { refresh?: boolean, useCache?: boolean } = {}) {
    if (options.useCache && !options.refresh) {
      const cached = readCache<CollectionSet>(scopedKey('collections'))
      if (cached) {
        favoriteListings.value = cached.favorites
        cartListings.value = cached.cart
        historyListings.value = cached.history
        return cached
      }
    }

    const payload = await fetchCollections()
    favoriteListings.value = payload.favorites
    cartListings.value = payload.cart
    historyListings.value = payload.history
    writeCache(scopedKey('collections'), payload, COLLECTION_TTL)
    return payload
  }

  async function loadFollows(options: { refresh?: boolean, useCache?: boolean } = {}) {
    const key = scopedKey('follows')

    if (options.useCache && !options.refresh) {
      const cached = readCache<FollowedUserSummary[]>(key)
      if (cached) {
        followedUsers.value = cached
        return cached
      }
    }

    followedUsers.value = await fetchMyFollows()
    writeCache(key, followedUsers.value, FOLLOWS_TTL)
    return followedUsers.value
  }

  async function loadListingDetail(id: number, options: { refresh?: boolean, useCache?: boolean } = {}) {
    const key = `${scopedKey('detail')}:${id}`
    if (options.useCache && !options.refresh) {
      const cached = readCache<Listing>(key)
      if (cached) {
        currentListing.value = cached
        return cached
      }
    }

    currentListing.value = await fetchListingDetail(id)
    writeCache(key, currentListing.value, DETAIL_TTL)
    return currentListing.value
  }

  async function upsertListing(payload: ListingPayload) {
    const saved = payload.id ? await updateListing(payload) : await createListing(payload)

    if (saved.type === 'supply') {
      mySupplyListings.value = [saved, ...mySupplyListings.value.filter(item => item.id !== saved.id)]
    }
    else {
      myDemandListings.value = [saved, ...myDemandListings.value.filter(item => item.id !== saved.id)]
    }

    syncListing(saved.id, saved)
    invalidateListCaches()
    return saved
  }

  async function removeListing(id: number) {
    await deleteListing(id)
    const clean = (list: Listing[]) => list.filter(item => item.id !== id)
    supplyPage.value = {
      ...supplyPage.value,
      items: clean(supplyPage.value.items),
      total: Math.max(0, supplyPage.value.total - 1),
    }
    demandHighlights.value = clean(demandHighlights.value)
    featuredListings.value = clean(featuredListings.value)
    favoriteListings.value = clean(favoriteListings.value)
    cartListings.value = clean(cartListings.value)
    historyListings.value = clean(historyListings.value)
    mySupplyListings.value = clean(mySupplyListings.value)
    myDemandListings.value = clean(myDemandListings.value)
    if (currentListing.value?.id === id) {
      currentListing.value = null
    }
    invalidateListCaches()
  }

  async function flipFavorite(listingId: number) {
    const result = await toggleFavorite(listingId)
    syncListing(listingId, { isFavorite: result.active })
    clearCache(scopedKey('collections'))
    clearCache(scopedKey('dashboard'))
    clearCache(`${scopedKey('detail')}:${listingId}`)
    await loadCollections({ refresh: true })
    return result.active
  }

  async function flipCart(listingId: number) {
    const result = await toggleCart(listingId)
    syncListing(listingId, { isInCart: result.active })
    clearCache(scopedKey('collections'))
    clearCache(scopedKey('dashboard'))
    clearCache(`${scopedKey('detail')}:${listingId}`)
    await loadCollections({ refresh: true })
    return result.active
  }

  async function flipFollowUser(userId: number) {
    const result = await toggleFollowUser(userId)
    syncOwnerFollow(userId, result.active)
    clearCache(scopedKey('follows'))

    if (result.active) {
      await loadFollows({ refresh: true })
    }
    else {
      followedUsers.value = followedUsers.value.filter(item => item.id !== userId)
    }

    return result.active
  }

  async function pushHistory(listingId: number) {
    await recordHistory(listingId)
    clearCache(scopedKey('collections'))
  }

  function resetState() {
    supplyPage.value = emptyPage()
    demandHighlights.value = []
    featuredListings.value = []
    notifications.value = []
    followedUsers.value = []
    favoriteListings.value = []
    cartListings.value = []
    historyListings.value = []
    mySupplyListings.value = []
    myDemandListings.value = []
    summary.value = null
    currentListing.value = null
    loading.value = false
    loadingMore.value = false
    currentFilters.value = {
      keyword: '',
      category: '',
      sort: 'recent',
      page: 1,
      pageSize: 10,
    }
  }

  return {
    supplyPage,
    supplyListings,
    featuredListings,
    demandHighlights,
    notifications,
    favoriteListings,
    cartListings,
    historyListings,
    mySupplyListings,
    myDemandListings,
    summary,
    currentListing,
    loading,
    loadingMore,
    currentFilters,
    hasMoreSupply,
    loadBuyerFeed,
    loadDemandHighlights,
    loadFeaturedListings,
    loadNotifications,
    loadDashboard,
    loadCollections,
    loadFollows,
    loadListingDetail,
    upsertListing,
    removeListing,
    flipFavorite,
    flipCart,
    flipFollowUser,
    pushHistory,
    resetState,
    invalidateListCaches,
    followedUsers,
  }
})
