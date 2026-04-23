import type { Listing } from '@/types'

export function formatPrice(price: number | null, type?: Listing['type']) {
  if (price === null || Number.isNaN(price)) {
    return type === 'demand' ? '预算待议' : '面议'
  }

  return `¥${Number(price).toFixed(2)}`
}

export function formatRelativeTime(input: string) {
  const target = new Date(input).getTime()
  const diff = Date.now() - target
  const minute = 60 * 1000
  const hour = 60 * minute
  const day = 24 * hour

  if (diff < hour) {
    return `${Math.max(1, Math.floor(diff / minute))} 分钟前`
  }

  if (diff < day) {
    return `${Math.floor(diff / hour)} 小时前`
  }

  if (diff < day * 7) {
    return `${Math.floor(diff / day)} 天前`
  }

  return input.slice(0, 10)
}

export function getCategoryInitial(value: string) {
  return value.slice(0, 2)
}

export function getListingTone(listing: Listing) {
  if (listing.type === 'demand') {
    return '#4a5c6a'
  }

  if (listing.category.includes('电子')) {
    return '#11212d'
  }

  if (listing.category.includes('书')) {
    return '#253745'
  }

  if (listing.category.includes('生活') || listing.category.includes('宿舍')) {
    return '#4a5c6a'
  }

  return '#06141b'
}

export function buildContactSummary(listing: Listing) {
  const lines = [
    `联系人：${listing.contactName}`,
    listing.phone ? `手机号：${listing.phone}` : '',
    listing.wechat ? `微信：${listing.wechat}` : '',
    listing.qq ? `QQ：${listing.qq}` : '',
  ].filter(Boolean)

  return lines.join('\n')
}
