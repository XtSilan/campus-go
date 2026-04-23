<script setup lang="ts">
const props = defineProps<{
  current: string
}>()

const tabMap: Record<string, string> = {
  seller: '/pages/seller/index',
  buyer: '/pages/buyer/index',
  publish: '/pages/publish/index',
  cart: '/pages/cart/index',
  profile: '/pages/profile/index',
}

const items = [
  { name: 'buyer', label: '首页', glyph: '⌂' },
  { name: 'seller', label: '消息', glyph: '◫' },
  { name: 'publish', label: '发布', glyph: '+' },
  { name: 'cart', label: '清单', glyph: '◌' },
  { name: 'profile', label: '我的', glyph: '◐' },
]

function go(name: string) {
  if (props.current === name) {
    return
  }

  uni.reLaunch({
    url: tabMap[name],
  })
}
</script>

<template>
  <view class="nav-shell">
    <view
      v-for="item in items"
      :key="item.name"
      class="nav-item"
      :class="[{ active: current === item.name }, { publish: item.name === 'publish' }]"
      @click="go(item.name)"
    >
      <view class="nav-glyph">
        {{ item.glyph }}
      </view>
      <view class="nav-label">
        {{ item.label }}
      </view>
    </view>
  </view>
</template>

<style scoped lang="scss">
.nav-shell {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  align-items: center;
  height: 112rpx;
  padding: 0 10rpx 18rpx;
  background: rgba(255, 255, 255, 0.96);
  border-top: 1px solid rgba(17, 17, 17, 0.06);
  z-index: 90;
}

.nav-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8rpx;
  color: #c2bbb3;
}

.nav-glyph {
  font-size: 28rpx;
  line-height: 1;
}

.nav-label {
  font-size: 18rpx;
}

.nav-item.active {
  color: var(--campus-ink);
}

.nav-item.publish .nav-glyph {
  width: 58rpx;
  height: 58rpx;
  border-radius: 50%;
  background: var(--campus-dark);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-size: 38rpx;
  transform: translateY(-8rpx);
}
</style>
