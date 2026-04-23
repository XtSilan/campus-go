async function normalizePickedImage(filePath: string, file?: ChooseImageSuccessCallbackResultFile | File) {
  if (!filePath) {
    throw new Error('没有选择图片')
  }

  return {
    fileName: (file as typeof file & { name?: string })?.name || filePath.split('/').pop() || `image-${Date.now()}.jpg`,
    filePath,
  }
}

export async function chooseImages(count = 9) {
  const picked = await uni.chooseImage({
    count,
    sizeType: ['compressed'],
    sourceType: ['album', 'camera'],
  })

  const filePaths = picked.tempFilePaths || []
  const files = Array.isArray(picked.tempFiles) ? picked.tempFiles : []

  if (!filePaths.length) {
    throw new Error('没有选择图片')
  }

  const results = []
  for (let index = 0; index < filePaths.length; index += 1) {
    results.push(await normalizePickedImage(filePaths[index], files[index]))
  }

  return results
}

export async function chooseSingleImage() {
  const [image] = await chooseImages(1)
  return image
}
