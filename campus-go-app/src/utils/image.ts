function extToMime(fileName: string) {
  const extension = fileName.toLowerCase().split('.').pop() || ''
  return {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    webp: 'image/webp',
    gif: 'image/gif',
  }[extension] || 'image/jpeg'
}

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ''))
    reader.onerror = () => reject(new Error('读取图片失败'))
    reader.readAsDataURL(file)
  })
}

async function readUrlAsDataUrl(filePath: string) {
  if (typeof fetch !== 'function') {
    throw new Error('当前环境暂不支持读取本地图片')
  }

  const response = await fetch(filePath)
  if (!response.ok) {
    throw new Error('读取图片失败')
  }

  const blob = await response.blob()
  const fileName = filePath.split('/').pop() || `image-${Date.now()}.jpg`
  const file = new File([blob], fileName, {
    type: blob.type || extToMime(fileName),
  })
  return readFileAsDataUrl(file)
}

function readPathAsDataUrl(filePath: string) {
  return new Promise<string>((resolve, reject) => {
    const fileManager = uni.getFileSystemManager?.()
    if (!fileManager) {
      readUrlAsDataUrl(filePath).then(resolve).catch((error) => {
        reject(error instanceof Error ? error : new Error('读取图片失败'))
      })
      return
    }

    fileManager.readFile({
      filePath,
      encoding: 'base64',
      success: (result) => {
        const fileName = filePath.split('/').pop() || 'image.jpg'
        resolve(`data:${extToMime(fileName)};base64,${result.data}`)
      },
      fail: () => reject(new Error('读取图片失败')),
    })
  })
}

async function normalizePickedImage(filePath: string, file?: ChooseImageSuccessCallbackResultFile | File) {
  const fileName = (file as typeof file & { name?: string })?.name || filePath.split('/').pop() || `image-${Date.now()}.jpg`

  if (!filePath) {
    throw new Error('没有选择图片')
  }

  const rawFile = (file as typeof file & { file?: File })?.file
  const content = rawFile
    ? await readFileAsDataUrl(rawFile)
    : await readPathAsDataUrl(filePath)

  return {
    fileName,
    filePath,
    content,
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
