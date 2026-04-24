const TOKEN_KEY = 'campus_go_token'
const USER_KEY = 'campus_go_user'
const USER_SYNC_AT_KEY = 'campus_go_user_sync_at'

export function readToken() {
  return uni.getStorageSync(TOKEN_KEY) || ''
}

export function writeToken(token: string) {
  uni.setStorageSync(TOKEN_KEY, token)
}

export function clearToken() {
  uni.removeStorageSync(TOKEN_KEY)
}

export function readUser<T>() {
  return uni.getStorageSync(USER_KEY) as T | null
}

export function writeUser<T>(value: T) {
  uni.setStorageSync(USER_KEY, value)
}

export function clearUser() {
  uni.removeStorageSync(USER_KEY)
}

export function readUserSyncAt() {
  return Number(uni.getStorageSync(USER_SYNC_AT_KEY) || 0)
}

export function writeUserSyncAt(value: number) {
  uni.setStorageSync(USER_SYNC_AT_KEY, value)
}

export function clearUserSyncAt() {
  uni.removeStorageSync(USER_SYNC_AT_KEY)
}
