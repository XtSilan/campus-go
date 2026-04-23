import { request } from './http'

export function uploadImageAsset(payload: { fileName: string, content: string }) {
  return request<{
    fileName: string
    mimeType: string
    size: number
    path: string
    storage: string
    objectKey?: string
  }>({
    url: '/uploads/image',
    method: 'POST',
    data: payload,
    withAuth: true,
  })
}
