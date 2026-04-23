import { apiBaseUrl, requestTimeout } from '@/config/runtime'
import { readToken } from '@/utils/storage'

interface UploadResponse {
  success: boolean
  message: string
  data: {
    fileName: string
    mimeType: string
    size: number
    path: string
    storage: string
    objectKey?: string
  }
}

export function uploadImageAsset(payload: { filePath: string, fileName?: string }) {
  return new Promise<UploadResponse['data']>((resolve, reject) => {
    const token = readToken()

    uni.uploadFile({
      url: `${apiBaseUrl}/uploads/image`,
      filePath: payload.filePath,
      name: 'file',
      timeout: Math.max(requestTimeout, 10 * 60 * 1000),
      formData: payload.fileName ? { fileName: payload.fileName } : {},
      header: token ? { Authorization: `Bearer ${token}` } : {},
      success: (response) => {
        try {
          const parsed = JSON.parse(String(response.data || '{}')) as UploadResponse
          if (response.statusCode >= 200 && response.statusCode < 300 && parsed.success) {
            resolve(parsed.data)
            return
          }
          reject(new Error(parsed?.message || '上传失败'))
        }
        catch {
          reject(new Error('上传失败'))
        }
      },
      fail: (error) => {
        reject(error)
      },
    })
  })
}
