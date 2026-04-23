import axios from 'axios'

const base = process.env.API_BASE_URL || '/api'

const service = axios.create({
  baseURL: base,
  timeout: 12000,
})

service.interceptors.request.use((config) => {
  const token = sessionStorage.getItem('admin_token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

service.interceptors.response.use(
  response => response.data,
  error => {
    const message = error.response && error.response.data && error.response.data.message
      ? error.response.data.message
      : '请求失败'
    return Promise.reject(new Error(message))
  },
)

export const adminLogin = params => service.post('/admin/auth/login', params)
export const fetchAdminMe = () => service.get('/admin/me')
export const fetchAdminStats = () => service.get('/admin/stats')

export const fetchAdminListings = params => service.get('/admin/listings', { params })
export const createAdminListing = params => service.post('/admin/listings', params)
export const updateAdminListing = (id, params) => service.put(`/admin/listings/${id}`, params)
export const deleteAdminListing = id => service.delete(`/admin/listings/${id}`)

export const fetchAdminUsers = params => service.get('/admin/users', { params })
export const createAdminUser = params => service.post('/admin/users', params)
export const updateAdminUser = (id, params) => service.put(`/admin/users/${id}`, params)
export const deleteAdminUser = id => service.delete(`/admin/users/${id}`)

export const fetchAdminNotifications = params => service.get('/admin/notifications', { params })
export const createAdminNotification = params => service.post('/admin/notifications', params)
export const updateAdminNotification = (id, params) => service.put(`/admin/notifications/${id}`, params)
export const deleteAdminNotification = id => service.delete(`/admin/notifications/${id}`)
export const uploadAdminImage = params => service.post('/admin/uploads/image', params, {
  timeout: 10 * 60 * 1000,
})
export const fetchAdminStorageSettings = () => service.get('/admin/storage')
export const updateAdminStorageSettings = params => service.put('/admin/storage', params)
export const validateAdminStorageSettings = params => service.post('/admin/storage/validate', params)
export const switchAdminStorageProvider = params => service.post('/admin/storage/switch', params)
export const fetchAdminStorageSwitchProgress = () => service.get('/admin/storage/progress')
export const fetchAdminMediaLibraryFiles = params => service.get('/admin/media-library', { params })
export const fetchAdminMediaLibraryDirectUrl = params => service.get('/admin/media-library/direct-url', { params })
export const uploadAdminMediaLibraryFile = params => service.post('/admin/media-library/upload', params, {
  timeout: 10 * 60 * 1000,
})
export const renameAdminMediaLibraryFile = params => service.post('/admin/media-library/rename', params)
export const deleteAdminMediaLibraryFile = params => service.post('/admin/media-library/delete', params)
