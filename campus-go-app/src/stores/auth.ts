import type { UserProfile } from '@/types'
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { fetchMe, login, logout, register, updateProfile as requestUpdateProfile } from '@/api/auth'
import {
  clearToken,
  clearUser,
  clearUserSyncAt,
  readToken,
  readUser,
  readUserSyncAt,
  writeToken,
  writeUser,
  writeUserSyncAt,
} from '@/utils/storage'

const SESSION_CACHE_TTL = 2 * 60 * 1000

export const useAuthStore = defineStore('auth', () => {
  const token = ref(readToken())
  const currentUser = ref<UserProfile | null>(readUser<UserProfile>())
  const userSyncedAt = ref(readUserSyncAt())
  const pending = ref(false)

  const isLoggedIn = computed(() => Boolean(token.value && currentUser.value))

  function persistSession(nextToken: string, user: UserProfile) {
    token.value = nextToken
    currentUser.value = user
    userSyncedAt.value = Date.now()
    writeToken(nextToken)
    writeUser(user)
    writeUserSyncAt(userSyncedAt.value)
  }

  async function registerAccount(payload: {
    nickname: string
    campus: string
    studentNo: string
    tagline: string
    password: string
  }) {
    pending.value = true

    try {
      const result = await register(payload)
      persistSession(result.token, result.user)
      return result.user
    }
    finally {
      pending.value = false
    }
  }

  async function loginAccount(payload: { studentNo: string, password: string }) {
    pending.value = true

    try {
      const result = await login(payload)
      persistSession(result.token, result.user)
      return result.user
    }
    finally {
      pending.value = false
    }
  }

  async function ensureSession(force = false) {
    if (!token.value) {
      return null
    }

    const cacheIsFresh = currentUser.value && userSyncedAt.value && (Date.now() - userSyncedAt.value) < SESSION_CACHE_TTL
    if (!force && cacheIsFresh) {
      return currentUser.value
    }

    try {
      currentUser.value = await fetchMe()
      userSyncedAt.value = Date.now()
      writeUser(currentUser.value)
      writeUserSyncAt(userSyncedAt.value)
      return currentUser.value
    }
    catch {
      logoutAccount()
      return null
    }
  }

  async function updateProfile(payload: {
    nickname: string
    campus: string
    tagline: string
    contactName: string
    phone: string
    wechat: string
    qq: string
    avatarUrl: string
  }) {
    const user = await requestUpdateProfile(payload)
    currentUser.value = user
    userSyncedAt.value = Date.now()
    writeUser(user)
    writeUserSyncAt(userSyncedAt.value)
    return user
  }

  async function logoutAccount() {
    if (token.value) {
      try {
        await logout()
      }
      catch {}
    }

    token.value = ''
    currentUser.value = null
    userSyncedAt.value = 0
    clearToken()
    clearUser()
    clearUserSyncAt()
  }

  return {
    token,
    currentUser,
    pending,
    isLoggedIn,
    registerAccount,
    loginAccount,
    ensureSession,
    updateProfile,
    logout: logoutAccount,
  }
})
