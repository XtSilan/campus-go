import type { AuthResult, UserProfile } from '@/types'
import { request } from './http'

export function register(payload: {
  nickname: string
  campus: string
  studentNo: string
  tagline: string
  password: string
}) {
  return request<AuthResult>({
    url: '/auth/register',
    method: 'POST',
    data: payload,
  })
}

export function login(payload: { studentNo: string, password: string }) {
  return request<AuthResult>({
    url: '/auth/login',
    method: 'POST',
    data: payload,
  })
}

export function fetchMe() {
  return request<UserProfile>({
    url: '/auth/me',
    withAuth: true,
  })
}

export function updateProfile(payload: {
  nickname: string
  campus: string
  tagline: string
  contactName: string
  phone: string
  wechat: string
  qq: string
  avatarUrl: string
}) {
  return request<UserProfile>({
    url: '/auth/profile',
    method: 'PUT',
    data: payload,
    withAuth: true,
  })
}

export function logout() {
  return request<{ ok: boolean }>({
    url: '/auth/logout',
    method: 'POST',
    withAuth: true,
  })
}
