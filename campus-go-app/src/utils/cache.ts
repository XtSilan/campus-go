interface CacheEnvelope<T> {
  value: T
  expiredAt: number
}

const CACHE_PREFIX = 'campus_go_cache:'

export function writeCache<T>(key: string, value: T, ttlMs: number) {
  const payload: CacheEnvelope<T> = {
    value,
    expiredAt: Date.now() + ttlMs,
  }

  uni.setStorageSync(`${CACHE_PREFIX}${key}`, payload)
}

export function readCache<T>(key: string) {
  const payload = uni.getStorageSync(`${CACHE_PREFIX}${key}`) as CacheEnvelope<T> | undefined

  if (!payload?.expiredAt || payload.expiredAt < Date.now()) {
    uni.removeStorageSync(`${CACHE_PREFIX}${key}`)
    return null
  }

  return payload.value
}

export function clearCache(key: string) {
  uni.removeStorageSync(`${CACHE_PREFIX}${key}`)
}

export function clearCacheByPrefix(prefix: string) {
  const info = uni.getStorageInfoSync()
  info.keys
    .filter(key => key.startsWith(`${CACHE_PREFIX}${prefix}`))
    .forEach(key => uni.removeStorageSync(key))
}
