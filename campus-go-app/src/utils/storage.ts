const TOKEN_KEY = 'campus_go_token'
const USER_KEY = 'campus_go_user'

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
