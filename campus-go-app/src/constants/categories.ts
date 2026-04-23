export const listingCategories = [
  '书籍教材',
  '生活用品',
  '电子产品',
  '衣物鞋帽',
  '宿舍好物',
  '代拿快递',
  '代拿外卖',
  '票券周边',
  '运动器材',
  '乐器设备',
  '其他',
] as const

export const itemConditions = [
  '全新未拆',
  '九成新',
  '八成新',
  '有使用痕迹',
  '可正常使用',
] as const

export const sortOptions = [
  { label: '最新发布', value: 'recent' },
  { label: '价格从低到高', value: 'price_asc' },
  { label: '价格从高到低', value: 'price_desc' },
] as const

export const campusRules = [
  '平台仅提供信息展示，不参与付款、担保和配送。',
  '仅限校园相关二手物品与需求，禁止违规或校外无关内容。',
  '交易细节与价格由双方自行沟通，请优先选择线下当面核验。',
] as const
