export function showSuccess(title: string) {
  uni.showToast({
    title,
    icon: 'success',
  })
}

export function showError(title: string) {
  uni.showToast({
    title,
    icon: 'none',
    duration: 2400,
  })
}

export function confirmAction(title: string, content: string) {
  return new Promise<boolean>((resolve) => {
    uni.showModal({
      title,
      content,
      success: result => resolve(Boolean(result.confirm)),
      fail: () => resolve(false),
    })
  })
}

export function jumpToLogin() {
  uni.reLaunch({
    url: '/pages/profile/index',
  })
}
