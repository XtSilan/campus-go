import { apiBaseUrl, requestTimeout } from '@/config/runtime'
import { readToken } from '@/utils/storage'

interface ApiEnvelope<T> {
  success: boolean
  message: string
  data: T
}

interface RequestOptions {
  url: string
  method?: UniApp.RequestOptions['method']
  data?: Record<string, any>
  withAuth?: boolean
}

export function request<T>({ url, method = 'GET', data, withAuth = false }: RequestOptions) {
  return new Promise<T>((resolve, reject) => {
    const token = readToken()

    uni.request({
      url: `${apiBaseUrl}${url}`,
      method,
      data,
      timeout: requestTimeout,
      header: {
        'Content-Type': 'application/json',
        ...(withAuth && token ? { Authorization: `Bearer ${token}` } : {}),
      },
      success: (response) => {
        const payload = response.data as ApiEnvelope<T>

        if (response.statusCode >= 200 && response.statusCode < 300 && payload.success) {
          resolve(payload.data)
          return
        }

        reject(new Error(payload?.message || '请求失败'))
      },
      fail: (error) => {
        reject(error)
      },
    })
  })
}
