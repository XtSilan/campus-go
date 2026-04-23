import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import { basename, dirname, extname, join, relative, resolve } from 'node:path'
import { randomBytes } from 'node:crypto'
import { createServer } from 'node:http'
import { WebSocketServer } from 'ws'
import OSS from 'ali-oss'
import express from 'express'
import multer from 'multer'
import { config } from './config.js'
import {
  archiveListingRecord,
  deleteListingRecord,
  cleanupExpiredSessions,
  createConversationForListing,
  createConversationMessage,
  createListingRecord,
  createNotificationRecord,
  createSession,
  createUser,
  deleteNotificationRecord,
  deleteUserRecord,
  destroySession,
  findListingOwner,
  findConversationById,
  findSession,
  findUserById,
  findUserByStudentNo,
  getAdminStats,
  getCollections,
  getDashboard,
  getListingById,
  getNotificationById,
  getStorageSettings as readStorageSettingsFromDb,
  db,
  incrementListingViews,
  listConversationMessages,
  listConversationsForUser,
  listAdminListingsPage,
  listFollowedUsers,
  listNotificationsPage,
  listPublicListings,
  listPublicNotifications,
  listUsersPage,
  markConversationRead,
  recordHistory,
  saveStorageSettings,
  seedDatabase,
  toggleCartRecord,
  toggleFollowRecord,
  toggleFavoriteRecord,
  updateListingRecord,
  updateNotificationRecord,
  updateUserRecord,
} from './db.js'
import { verifyPassword } from './security.js'

class HttpError extends Error {
  constructor(status, message) {
    super(message)
    this.status = status
  }
}

const app = express()
const httpServer = createServer(app)
const wsServer = new WebSocketServer({ server: httpServer, path: '/ws' })
const socketClientsByUser = new Map()
const STORAGE_SWITCH_CONFIRM_TEXT = '我同意'
let storageSwitchTask = null
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 20 * 1024 * 1024,
  },
})
mkdirSync(config.uploadDir, { recursive: true })

seedDatabase()
cleanupExpiredSessions()

app.use((request, response, next) => {
  response.setHeader('Access-Control-Allow-Origin', config.corsOrigin)
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  response.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS')

  if (request.method === 'OPTIONS') {
    response.status(204).end()
    return
  }

  next()
})
app.use(express.json({ limit: config.jsonBodyLimit }))
app.use('/uploads', express.static(config.uploadDir))

function send(response, data = null, message = 'ok', status = 200) {
  response.status(status).json({
    success: true,
    message,
    data,
  })
}

function getTokenFromHeader(request) {
  const header = request.headers.authorization || ''
  return header.startsWith('Bearer ') ? header.slice(7) : ''
}

function assert(condition, message, status = 400) {
  if (!condition) {
    throw new HttpError(status, message)
  }
}

function buildAssetUrl(request, publicPath) {
  const protocol = request.headers['x-forwarded-proto'] || 'http'
  const host = request.headers.host || `${config.host}:${config.port}`
  return `${protocol}://${host}${publicPath}`
}

function maskSecret(secret) {
  if (!secret) {
    return ''
  }

  if (secret.length <= 8) {
    return `${secret.slice(0, 2)}***${secret.slice(-1)}`
  }

  return `${secret.slice(0, 4)}***${secret.slice(-4)}`
}

function buildStorageSettingsResponse() {
  const settings = readStorageSettingsFromDb()
  return {
    ...settings,
    oss: {
      ...settings.oss,
      accessKeySecret: '',
      accessKeySecretMasked: maskSecret(settings.oss.accessKeySecret),
    },
  }
}

function normalizeOssRegion(region) {
  const nextRegion = String(region || '').trim()
  if (!nextRegion) {
    return ''
  }
  return nextRegion.startsWith('oss-') ? nextRegion : `oss-${nextRegion}`
}

function normalizeEndpoint(endpoint) {
  return String(endpoint || '').trim().replace(/\/+$/, '').replace(/\.+$/, '')
}

function getEndpointHost(endpoint) {
  const normalized = normalizeEndpoint(endpoint)
  return normalized.replace(/^https?:\/\//i, '').split('/')[0].trim().replace(/\.+$/, '')
}

function isAliyunOssHost(host) {
  const value = String(host || '').toLowerCase()
  return value.includes('aliyuncs.com') || value.includes('osscloud.cn')
}

function isCustomCnameHost(host) {
  return Boolean(host) && !isAliyunOssHost(host)
}

function normalizeStoragePayload(body, existingSettings = readStorageSettingsFromDb()) {
  const nextProvider = String(body.provider || existingSettings.provider || 'local').trim() || 'local'
  assert(['local', 'oss'].includes(nextProvider), '存储驱动不正确')

  const previousOss = existingSettings.oss || {}
  const incomingOss = body.oss || {}
  const normalizedOss = {
    region: normalizeOssRegion(incomingOss.region ?? previousOss.region ?? ''),
    bucket: String(incomingOss.bucket ?? previousOss.bucket ?? '').trim(),
    accessKeyId: String(incomingOss.accessKeyId ?? previousOss.accessKeyId ?? '').trim(),
    accessKeySecret: String(incomingOss.accessKeySecret || '').trim() || previousOss.accessKeySecret || '',
    endpoint: normalizeEndpoint(incomingOss.endpoint ?? previousOss.endpoint ?? ''),
    secure: incomingOss.secure === undefined ? previousOss.secure !== false : Boolean(incomingOss.secure),
    authorizationV4: incomingOss.authorizationV4 === undefined ? previousOss.authorizationV4 !== false : Boolean(incomingOss.authorizationV4),
    cname: incomingOss.cname === undefined ? Boolean(previousOss.cname) : Boolean(incomingOss.cname),
    objectPrefix: String(incomingOss.objectPrefix ?? previousOss.objectPrefix ?? 'campus-go').trim(),
  }

  return {
    provider: nextProvider,
    oss: normalizedOss,
  }
}

function assertOssReady(settings) {
  const oss = settings.oss || {}
  assert(oss.region, '请填写 OSS Region')
  assert(oss.bucket, '请填写 OSS Bucket')
  assert(oss.accessKeyId, '请填写 OSS AccessKeyId')
  assert(oss.accessKeySecret, '请填写 OSS AccessKeySecret')
}

function createOssClient(settings) {
  const oss = settings.oss || {}
  assertOssReady(settings)
  const endpointHost = getEndpointHost(oss.endpoint)
  const shouldUseCustomDomainAsPublicHost = isCustomCnameHost(endpointHost)

  const options = {
    region: normalizeOssRegion(oss.region),
    bucket: oss.bucket,
    accessKeyId: oss.accessKeyId,
    accessKeySecret: oss.accessKeySecret,
    secure: oss.secure !== false,
    authorizationV4: oss.authorizationV4 !== false,
    cname: Boolean(oss.cname) && !shouldUseCustomDomainAsPublicHost,
  }

  if (oss.endpoint && !shouldUseCustomDomainAsPublicHost) {
    options.endpoint = normalizeEndpoint(oss.endpoint)
  }

  return new OSS(options)
}

function buildOssObjectKey(settings, extension) {
  const prefix = String(settings.oss?.objectPrefix || '').trim().replace(/^\/+|\/+$/g, '')
  const filename = `${Date.now()}-${randomBytes(5).toString('hex')}${extension}`
  return prefix ? `${prefix}/uploads/${filename}` : `uploads/${filename}`
}

function stripProtocol(value) {
  return String(value || '').replace(/^https?:\/\//, '').replace(/\/+$/, '')
}

function isSignatureCompatibilityError(error) {
  const message = String(error?.message || '')
  return message.includes('The request signature we calculated does not match the signature you provided')
    || message.includes('Please use V2 signature')
    || message.includes('authorization v4 is not supported')
}

async function withOssFallback(settings, handler) {
  const initialSettings = {
    ...settings,
    oss: {
      ...(settings.oss || {}),
    },
  }

  try {
    const client = createOssClient(initialSettings)
    return {
      ...await handler(client, initialSettings),
      usedCompatibilitySignature: false,
      authorizationV4: initialSettings.oss.authorizationV4 !== false,
    }
  }
  catch (error) {
    if (initialSettings.oss.authorizationV4 === false || !isSignatureCompatibilityError(error)) {
      throw error
    }

    const fallbackSettings = {
      ...initialSettings,
      oss: {
        ...initialSettings.oss,
        authorizationV4: false,
      },
    }
    const client = createOssClient(fallbackSettings)
    return {
      ...await handler(client, fallbackSettings),
      usedCompatibilitySignature: true,
      authorizationV4: false,
    }
  }
}

function buildOssObjectKeyFromRelativePath(settings, relativePath) {
  const prefix = String(settings.oss?.objectPrefix || '').trim().replace(/^\/+|\/+$/g, '')
  const normalizedRelativePath = String(relativePath || '').replace(/\\/g, '/').replace(/^\/+/, '')
  return prefix ? `${prefix}/uploads/${normalizedRelativePath}` : `uploads/${normalizedRelativePath}`
}

function relativePathFromOssObjectKey(settings, objectKey) {
  const prefix = String(settings.oss?.objectPrefix || '').trim().replace(/^\/+|\/+$/g, '')
  const normalizedKey = String(objectKey || '').replace(/^\/+/, '')
  const expectedPrefix = prefix ? `${prefix}/uploads/` : 'uploads/'

  if (!normalizedKey.startsWith(expectedPrefix)) {
    return ''
  }

  return normalizedKey.slice(expectedPrefix.length)
}

function createMediaUrlFromPath(request, pathValue, settings = readStorageSettingsFromDb()) {
  const normalizedPath = String(pathValue || '').trim()
  if (!normalizedPath) {
    return ''
  }

  if (/^(https?:)?\/\//i.test(normalizedPath) || normalizedPath.startsWith('data:')) {
    return normalizedPath
  }

  if (normalizedPath.startsWith('oss://')) {
    return buildOssPublicUrl(settings, normalizedPath.slice(6))
  }

  if (normalizedPath.startsWith('/uploads/')) {
    return buildAssetUrl(request, normalizedPath)
  }

  return normalizedPath
}

function buildOssPublicUrl(settings, objectKey, uploadResult) {
  const endpointHost = getEndpointHost(settings.oss?.endpoint)
  const useCustomPublicHost = isCustomCnameHost(endpointHost)

  if (useCustomPublicHost) {
    const protocol = settings.oss?.secure !== false ? 'https' : 'http'
    return `${protocol}://${endpointHost}/${objectKey}`
  }

  if (uploadResult?.url) {
    return uploadResult.url
  }

  const secure = settings.oss?.secure !== false
  const protocol = secure ? 'https' : 'http'

  if (settings.oss?.endpoint) {
    const host = stripProtocol(settings.oss.endpoint)
    return `${protocol}://${host}/${objectKey}`
  }

  const region = normalizeOssRegion(settings.oss?.region)
  return `${protocol}://${settings.oss.bucket}.${region}.aliyuncs.com/${objectKey}`
}

function extensionFromUpload(fileName, mimeType) {
  const safeExt = extname(String(fileName || '')).toLowerCase()
  if (safeExt) {
    return safeExt
  }

  return {
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/webp': '.webp',
    'image/gif': '.gif',
    'image/svg+xml': '.svg',
  }[mimeType] || '.jpg'
}

function decodeAnyDataUrl(dataUrl) {
  const match = String(dataUrl || '').match(/^data:([^;]+);base64,(.+)$/)
  assert(match, '文件内容格式不正确')

  return {
    mimeType: match[1],
    buffer: Buffer.from(match[2], 'base64'),
  }
}

function ensureUploadRoot() {
  mkdirSync(config.uploadDir, { recursive: true })
  return config.uploadDir
}

function ensurePathInsideUploadDir(targetPath) {
  const uploadRoot = resolve(config.uploadDir)
  const resolvedTarget = resolve(targetPath)
  assert(resolvedTarget === uploadRoot || resolvedTarget.startsWith(`${uploadRoot}\\`) || resolvedTarget.startsWith(`${uploadRoot}/`), '文件路径不安全')
  return resolvedTarget
}

function listLocalFilesRecursive(rootDir, currentDir = rootDir) {
  if (!existsSync(currentDir)) {
    return []
  }

  const entries = readdirSync(currentDir, { withFileTypes: true })
  const files = []

  for (const entry of entries) {
    const absolutePath = join(currentDir, entry.name)
    if (entry.isDirectory()) {
      files.push(...listLocalFilesRecursive(rootDir, absolutePath))
      continue
    }
    files.push(absolutePath)
  }

  return files
}

function guessMimeType(fileName) {
  const ext = extname(String(fileName || '')).toLowerCase()
  return {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.svg': 'image/svg+xml',
    '.pdf': 'application/pdf',
    '.txt': 'text/plain',
    '.json': 'application/json',
  }[ext] || 'application/octet-stream'
}

function isImageMimeType(mimeType) {
  return String(mimeType || '').toLowerCase().startsWith('image/')
}

function normalizeMediaQueryKeyword(keyword) {
  return String(keyword || '').trim().toLowerCase()
}

function toUploadRelativePath(absolutePath) {
  return relative(config.uploadDir, absolutePath).replace(/\\/g, '/')
}

function updateListingImageReferences(oldReference, newReference = '') {
  const exact = String(oldReference || '').trim()
  if (!exact) {
    return
  }

  const rows = db.prepare(`
    SELECT id, image_url
    FROM listings
    WHERE image_url = ? OR image_url LIKE ?
  `).all(exact, `%${exact}%`)

  for (const row of rows) {
    const currentRaw = String(row.image_url || '').trim()
    const currentImages = currentRaw.startsWith('[')
      ? (() => {
          try {
            const parsed = JSON.parse(currentRaw)
            return Array.isArray(parsed) ? parsed.map(item => String(item || '').trim()).filter(Boolean) : [currentRaw]
          }
          catch {
            return [currentRaw]
          }
        })()
      : (currentRaw ? [currentRaw] : [])

    const nextImages = currentImages
      .map(item => (item === exact ? newReference : item))
      .filter(Boolean)

    const nextValue = !nextImages.length
      ? ''
      : nextImages.length === 1
        ? nextImages[0]
        : JSON.stringify(nextImages)

    if (nextValue !== currentRaw) {
      db.prepare(`
        UPDATE listings
        SET image_url = ?
        WHERE id = ?
      `).run(nextValue, row.id)
    }
  }
}

async function uploadBufferToCurrentStorage(request, fileName, buffer, mimeType) {
  const storageSettings = readStorageSettingsFromDb()
  const extension = extensionFromUpload(fileName, mimeType)

  if (storageSettings.provider === 'oss') {
    const objectKey = buildOssObjectKey(storageSettings, extension)
    const uploadResult = await withOssFallback(storageSettings, async (client) => {
      const result = await client.put(objectKey, buffer, {
        headers: {
          'Content-Type': mimeType,
        },
      })
      return { result }
    })

    return {
      name: fileName,
      path: `oss://${objectKey}`,
      url: buildOssPublicUrl(storageSettings, objectKey, uploadResult.result),
      size: buffer.length,
      mimeType,
      isImage: isImageMimeType(mimeType),
      updatedAt: new Date().toISOString(),
    }
  }

  const storedName = `${Date.now()}-${randomBytes(5).toString('hex')}${extension}`
  ensureUploadRoot()
  const absolutePath = ensurePathInsideUploadDir(join(config.uploadDir, storedName))
  writeFileSync(absolutePath, buffer)
  const publicPath = `/uploads/${storedName}`

  return {
    name: basename(storedName),
    path: publicPath,
    url: buildAssetUrl(request, publicPath),
    size: buffer.length,
    mimeType,
    isImage: isImageMimeType(mimeType),
    updatedAt: new Date().toISOString(),
  }
}

async function saveUploadedImage(request, file, maxSize = 5 * 1024 * 1024) {
  assert(file, '请选择图片文件')

  const fileName = String(file.originalname || file.fieldname || '').trim()
  const mimeType = String(file.mimetype || '').trim().toLowerCase()
  const buffer = file.buffer

  assert(fileName, '请提供文件名')
  assert(buffer && buffer.length > 0, '图片内容不能为空')
  assert(mimeType.startsWith('image/'), '仅支持图片文件')
  assert(buffer.length <= maxSize, `图片不能超过 ${Math.floor(maxSize / 1024 / 1024)}MB`)

  const savedFile = await uploadBufferToCurrentStorage(request, fileName, buffer, mimeType)

  return {
    fileName,
    mimeType,
    size: buffer.length,
    path: savedFile.url,
    storage: savedFile.path.startsWith('oss://') ? 'oss' : 'local',
    objectKey: savedFile.path.startsWith('oss://') ? savedFile.path.replace(/^oss:\/\//, '') : undefined,
  }
}

async function listMediaLibraryFiles(request, keyword = '') {
  const settings = readStorageSettingsFromDb()
  const normalizedKeyword = normalizeMediaQueryKeyword(keyword)

  if (settings.provider === 'oss') {
    const prefix = buildOssObjectKeyFromRelativePath(settings, '')
    const objects = []
    let continuationToken = ''

    const response = await withOssFallback(settings, async (client) => {
      while (true) {
        const result = await client.listV2({
          prefix,
          'continuation-token': continuationToken || undefined,
          'max-keys': 100,
        })
        const currentObjects = Array.isArray(result.objects) ? result.objects : []
        objects.push(...currentObjects)
        if (!result.isTruncated || !result.nextContinuationToken) {
          break
        }
        continuationToken = result.nextContinuationToken
      }
      return {}
    })

    void response

    return objects
      .filter(item => item && item.name)
      .map((item) => {
        const relativePath = relativePathFromOssObjectKey(settings, item.name)
        const name = basename(relativePath || item.name)
        const mimeType = guessMimeType(name)
        return {
          name,
          path: `oss://${item.name}`,
          url: buildOssPublicUrl(settings, item.name),
          size: Number(item.size || 0),
          mimeType,
          isImage: isImageMimeType(mimeType),
          updatedAt: item.lastModified || '',
        }
      })
      .filter(item => !normalizedKeyword || item.name.toLowerCase().includes(normalizedKeyword) || item.path.toLowerCase().includes(normalizedKeyword))
      .sort((a, b) => new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime())
  }

  const files = listLocalFilesRecursive(ensureUploadRoot())
  return files
    .map((absolutePath) => {
      const stats = statSync(absolutePath)
      const relativePath = toUploadRelativePath(absolutePath)
      const publicPath = `/uploads/${relativePath}`
      const mimeType = guessMimeType(publicPath)
      return {
        name: basename(absolutePath),
        path: publicPath,
        url: buildAssetUrl(request, publicPath),
        size: stats.size,
        mimeType,
        isImage: isImageMimeType(mimeType),
        updatedAt: stats.mtime.toISOString(),
      }
    })
    .filter(item => !normalizedKeyword || item.name.toLowerCase().includes(normalizedKeyword) || item.path.toLowerCase().includes(normalizedKeyword))
    .sort((a, b) => new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime())
}

function parseMediaLibraryPath(pathValue) {
  const normalized = String(pathValue || '').trim()
  assert(normalized, '文件路径不能为空')

  if (normalized.startsWith('oss://')) {
    return {
      storage: 'oss',
      objectKey: normalized.slice(6),
    }
  }

  const uploadsIndex = normalized.indexOf('/uploads/')
  if (uploadsIndex >= 0) {
    const relativePath = normalized.slice(uploadsIndex + '/uploads/'.length)
    return {
      storage: 'local',
      relativePath,
      publicPath: `/uploads/${relativePath}`,
    }
  }

  throw new Error('无法识别文件路径')
}

async function renameMediaLibraryFileEntry(request, pathValue, nextName) {
  const parsed = parseMediaLibraryPath(pathValue)
  const targetName = String(nextName || '').trim()
  assert(targetName, '新文件名不能为空')
  assert(!targetName.includes('/') && !targetName.includes('\\'), '新文件名不能包含路径')

  if (parsed.storage === 'local') {
    const sourceAbsolutePath = ensurePathInsideUploadDir(join(config.uploadDir, parsed.relativePath))
    assert(existsSync(sourceAbsolutePath), '文件不存在', 404)
    const targetRelativePath = join(dirname(parsed.relativePath), targetName).replace(/\\/g, '/')
    const targetAbsolutePath = ensurePathInsideUploadDir(join(config.uploadDir, targetRelativePath))
    mkdirSync(dirname(targetAbsolutePath), { recursive: true })
    renameSync(sourceAbsolutePath, targetAbsolutePath)

    const oldPublicPath = parsed.publicPath
    const newPublicPath = `/uploads/${targetRelativePath}`
    updateListingImageReferences(oldPublicPath, newPublicPath)

    return {
      path: newPublicPath,
      url: buildAssetUrl(request, newPublicPath),
    }
  }

  const settings = readStorageSettingsFromDb()
  const oldObjectKey = parsed.objectKey
  const targetObjectKey = join(dirname(oldObjectKey), targetName).replace(/\\/g, '/')

  await withOssFallback(settings, async (client) => {
    await client.copy(targetObjectKey, oldObjectKey)
    await client.delete(oldObjectKey)
    return {}
  })

  const oldUrl = buildOssPublicUrl(settings, oldObjectKey)
  const newUrl = buildOssPublicUrl(settings, targetObjectKey)
  updateListingImageReferences(oldUrl, newUrl)
  updateListingImageReferences(`oss://${oldObjectKey}`, `oss://${targetObjectKey}`)

  return {
    path: `oss://${targetObjectKey}`,
    url: newUrl,
  }
}

async function deleteMediaLibraryFileEntry(pathValue) {
  const parsed = parseMediaLibraryPath(pathValue)

  if (parsed.storage === 'local') {
    const absolutePath = ensurePathInsideUploadDir(join(config.uploadDir, parsed.relativePath))
    if (existsSync(absolutePath)) {
      rmSync(absolutePath, { force: true })
    }
    updateListingImageReferences(parsed.publicPath, '')
    return
  }

  const settings = readStorageSettingsFromDb()
  await withOssFallback(settings, async (client) => {
    await client.delete(parsed.objectKey)
    return {}
  })
  updateListingImageReferences(buildOssPublicUrl(settings, parsed.objectKey), '')
  updateListingImageReferences(`oss://${parsed.objectKey}`, '')
}

function createStorageSwitchTask(target) {
  return {
    id: `${Date.now()}-${randomBytes(4).toString('hex')}`,
    target,
    status: 'running',
    stage: 'preparing',
    current: 0,
    total: 0,
    percent: 0,
    currentItem: '',
    errorMessage: '',
    logs: [],
    startedAt: new Date().toISOString(),
    finishedAt: '',
  }
}

function pushStorageTaskLog(level, message) {
  if (!storageSwitchTask) {
    return
  }

  storageSwitchTask.logs = storageSwitchTask.logs || []
  storageSwitchTask.logs.unshift({
    time: new Date().toISOString(),
    level,
    message,
  })
  storageSwitchTask.logs = storageSwitchTask.logs.slice(0, 120)
}

function setStorageTaskProgress(patch) {
  if (!storageSwitchTask) {
    return
  }

  storageSwitchTask = {
    ...storageSwitchTask,
    ...patch,
  }

  const total = Number(storageSwitchTask.total || 0)
  const current = Number(storageSwitchTask.current || 0)
  storageSwitchTask.percent = total > 0 ? Math.min(100, Math.round(current / total * 100)) : 0
}

function listRawLocalUploadFiles() {
  return listLocalFilesRecursive(ensureUploadRoot())
}

function saveStorageSyncResult(target, status, message, stats = {}) {
  return saveStorageSettings({
    provider: target,
    lastSync: {
      direction: target === 'oss' ? 'local-to-oss' : 'oss-to-local',
      status,
      message,
      stats,
      at: new Date().toISOString(),
    },
  })
}

async function runStorageSwitchTask(task) {
  const settings = readStorageSettingsFromDb()
  try {
    if (task.target === 'oss') {
      assertOssReady(settings)
      const files = listRawLocalUploadFiles()
      setStorageTaskProgress({
        stage: 'uploading',
        total: files.length,
        current: 0,
      })
      pushStorageTaskLog('info', `准备上传 ${files.length} 个本地文件到 OSS`)

      for (const absolutePath of files) {
        const relativePath = toUploadRelativePath(absolutePath)
        const objectKey = buildOssObjectKeyFromRelativePath(settings, relativePath)
        const mimeType = guessMimeType(relativePath)
        setStorageTaskProgress({
          currentItem: relativePath,
        })
        await withOssFallback(settings, async (client) => {
          await client.put(objectKey, readFileSync(absolutePath), {
            headers: {
              'Content-Type': mimeType,
            },
          })
          return {}
        })

        updateListingImageReferences(`/uploads/${relativePath}`, buildOssPublicUrl(settings, objectKey))
        setStorageTaskProgress({
          current: Number(storageSwitchTask.current || 0) + 1,
        })
      }

      const nextSettings = saveStorageSyncResult('oss', 'success', '本地文件已转入 OSS', {
        uploadedFiles: files.length,
      })
      setStorageTaskProgress({
        stage: 'completed',
        status: 'success',
        finishedAt: new Date().toISOString(),
      })
      pushStorageTaskLog('info', '转入 OSS 完成')
      return nextSettings
    }

    assertOssReady(settings)
    const objects = await withOssFallback(settings, async (client) => {
      const allObjects = []
      const prefix = buildOssObjectKeyFromRelativePath(settings, '')
      let continuationToken = ''
      while (true) {
        const result = await client.listV2({
          prefix,
          'continuation-token': continuationToken || undefined,
          'max-keys': 100,
        })
        const currentObjects = Array.isArray(result.objects) ? result.objects : []
        allObjects.push(...currentObjects)
        if (!result.isTruncated || !result.nextContinuationToken) {
          break
        }
        continuationToken = result.nextContinuationToken
      }
      return { allObjects }
    })

    setStorageTaskProgress({
      stage: 'downloading',
      total: objects.allObjects.length,
      current: 0,
    })
    pushStorageTaskLog('info', `准备下载 ${objects.allObjects.length} 个 OSS 文件到本地`)

    for (const item of objects.allObjects) {
      if (!item || !item.name) {
        continue
      }

      const relativePath = relativePathFromOssObjectKey(settings, item.name)
      if (!relativePath) {
        continue
      }

      setStorageTaskProgress({
        currentItem: relativePath,
      })

      const downloadResult = await withOssFallback(settings, async (client) => {
        const result = await client.get(item.name)
        return { result }
      })
      const targetAbsolutePath = ensurePathInsideUploadDir(join(config.uploadDir, relativePath))
      mkdirSync(dirname(targetAbsolutePath), { recursive: true })
      writeFileSync(targetAbsolutePath, downloadResult.result.content)

      updateListingImageReferences(buildOssPublicUrl(settings, item.name), `/uploads/${relativePath}`)
      updateListingImageReferences(`oss://${item.name}`, `/uploads/${relativePath}`)
      setStorageTaskProgress({
        current: Number(storageSwitchTask.current || 0) + 1,
      })
    }

    const nextSettings = saveStorageSyncResult('local', 'success', 'OSS 文件已同步回本地', {
      downloadedFiles: objects.allObjects.length,
    })
    setStorageTaskProgress({
      stage: 'completed',
      status: 'success',
      finishedAt: new Date().toISOString(),
    })
    pushStorageTaskLog('info', '切回本地完成')
    return nextSettings
  }
  catch (error) {
    const nextSettings = saveStorageSyncResult(task.target === 'oss' ? settings.provider : settings.provider, 'failed', String(error?.message || '切换失败'))
    setStorageTaskProgress({
      status: 'failed',
      errorMessage: String(error?.message || '切换失败'),
      finishedAt: new Date().toISOString(),
    })
    pushStorageTaskLog('error', String(error?.message || '切换失败'))
    return nextSettings
  }
}

function parseChatBody(body) {
  const payload = {
    body: String(body.body || '').trim(),
  }

  assert(payload.body.length >= 1, '消息内容不能为空')
  assert(payload.body.length <= 1000, '单条消息不能超过 1000 字')
  return payload
}

function parseListingPayload(body, { keepStatus = false } = {}) {
  const rawImageUrls = Array.isArray(body.imageUrls)
    ? body.imageUrls
    : String(body.imageUrl || '').trim()
      ? [body.imageUrl]
      : []

  const imageUrls = rawImageUrls
    .map(item => String(item || '').trim())
    .filter(Boolean)
    .slice(0, 9)

  const payload = {
    type: String(body.type || '').trim(),
    title: String(body.title || '').trim(),
    category: String(body.category || '').trim(),
    condition: String(body.condition || '').trim(),
    description: String(body.description || '').trim(),
    price: body.price === null || body.price === '' || body.price === undefined ? null : Number(body.price),
    imageUrl: imageUrls[0] || '',
    imageUrls,
    location: String(body.location || '').trim(),
    contactName: String(body.contactName || '').trim(),
    phone: String(body.phone || '').trim(),
    wechat: String(body.wechat || '').trim(),
    qq: String(body.qq || '').trim(),
    ...(keepStatus ? { status: String(body.status || 'active').trim() || 'active' } : {}),
  }

  assert(payload.type === 'supply' || payload.type === 'demand', '信息类型不正确')
  assert(payload.title.length >= 2, '标题至少 2 个字')
  assert(payload.category, '请选择分类')
  assert(payload.condition, '请选择成色或需求状态')
  assert(payload.description.length >= 6, '详细描述至少 6 个字')
  if (payload.price !== null) {
    assert(Number.isFinite(payload.price) && payload.price >= 0, '价格或预算不能为负数')
  }
  if (keepStatus) {
    assert(payload.status === 'active' || payload.status === 'archived', '状态不正确')
  }

  return payload
}

function parseProfilePayload(body, currentUser) {
  const payload = {
    nickname: String(body.nickname ?? currentUser.nickname ?? '').trim(),
    campus: String(body.campus ?? currentUser.campus ?? '').trim(),
    tagline: String(body.tagline ?? currentUser.tagline ?? '').trim(),
    contactName: String(body.contactName ?? currentUser.contactName ?? currentUser.nickname ?? '').trim(),
    phone: String(body.phone ?? currentUser.phone ?? '').trim(),
    wechat: String(body.wechat ?? currentUser.wechat ?? '').trim(),
    qq: String(body.qq ?? currentUser.qq ?? '').trim(),
  }

  assert(payload.nickname.length >= 2, '昵称至少 2 个字')
  assert(payload.campus.length >= 2, '请填写校区或学校')
  return payload
}

function parseNotificationPayload(body) {
  const payload = {
    title: String(body.title || '').trim(),
    content: String(body.content || '').trim(),
    type: String(body.type || 'info').trim() || 'info',
    audience: String(body.audience || 'all').trim() || 'all',
    status: String(body.status || 'active').trim() || 'active',
    pinned: Boolean(body.pinned),
  }

  assert(payload.title.length >= 2, '通知标题至少 2 个字')
  assert(payload.content.length >= 4, '通知内容至少 4 个字')
  assert(['info', 'warning', 'success', 'alert'].includes(payload.type), '通知类型不正确')
  assert(['all', 'buyers', 'sellers'].includes(payload.audience), '通知面向对象不正确')
  assert(['active', 'draft', 'archived'].includes(payload.status), '通知状态不正确')
  return payload
}

app.use((request, _response, next) => {
  const token = getTokenFromHeader(request)
  if (!token) {
    request.viewer = null
    next()
    return
  }

  const session = findSession(token)
  if (!session || session.status !== 'active') {
    request.viewer = null
    next()
    return
  }

    request.viewer = {
      id: session.user_id,
      token: session.token,
      user: {
        id: session.user_id,
        nickname: session.nickname,
        campus: session.campus,
        studentNo: session.student_no,
        tagline: session.tagline,
        contactName: session.contact_name,
        phone: session.phone,
        wechat: session.wechat,
        qq: session.qq,
        avatarColor: session.avatar_color,
        role: session.role,
        status: session.status,
        createdAt: session.user_created_at,
      },
  }
  next()
})

function requireAuth(request, _response, next) {
  if (!request.viewer) {
    next(new HttpError(401, '请先登录'))
    return
  }

  next()
}

function requireAdmin(request, _response, next) {
  if (!request.viewer) {
    next(new HttpError(401, '请先登录'))
    return
  }

  if (request.viewer.user.role !== 'admin') {
    next(new HttpError(403, '需要管理员权限'))
    return
  }

  next()
}

function addSocketClient(userId, socket) {
  const userKey = Number(userId)
  const pool = socketClientsByUser.get(userKey) || new Set()
  pool.add(socket)
  socketClientsByUser.set(userKey, pool)
}

function removeSocketClient(userId, socket) {
  const userKey = Number(userId)
  const pool = socketClientsByUser.get(userKey)
  if (!pool) {
    return
  }

  pool.delete(socket)
  if (!pool.size) {
    socketClientsByUser.delete(userKey)
  }
}

function broadcastToUser(userId, payload) {
  const pool = socketClientsByUser.get(Number(userId))
  if (!pool) {
    return
  }

  const message = JSON.stringify(payload)
  for (const socket of pool) {
    if (socket.readyState === 1) {
      socket.send(message)
    }
  }
}

function pushConversationSnapshot(conversationId, userId) {
  const conversation = findConversationById(conversationId, userId)
  if (!conversation) {
    return
  }

  broadcastToUser(userId, {
    type: 'conversation:update',
    conversation,
  })
}

function pushMessageCreated(conversationId, message) {
  const conversation = findConversationById(conversationId, message.senderId)
  if (!conversation) {
    return
  }

  const targets = new Set([conversation.buyerId, conversation.sellerId])
  for (const userId of targets) {
    pushConversationSnapshot(conversationId, userId)
    broadcastToUser(userId, {
      type: 'message:new',
      conversationId,
      message,
    })
  }
}

app.get('/api/health', (_request, response) => {
  send(response, {
    service: 'campus-go-server',
    dbPath: config.dbPath,
    now: new Date().toISOString(),
  })
})

app.post('/api/auth/register', (request, response, next) => {
  try {
    const nickname = String(request.body.nickname || '').trim()
    const campus = String(request.body.campus || '').trim()
    const studentNo = String(request.body.studentNo || '').trim()
    const tagline = String(request.body.tagline || '').trim()
    const password = String(request.body.password || '').trim()

    assert(nickname.length >= 2, '昵称至少 2 个字')
    assert(campus.length >= 2, '请填写校区或学校')
    assert(studentNo.length >= 4, '学号格式不正确')
    assert(password.length >= 6, '密码至少 6 位')
    assert(!findUserByStudentNo(studentNo), '该学号已注册')

    const user = createUser({
      nickname,
      campus,
      studentNo,
      tagline,
      password,
      role: 'user',
      status: 'active',
    })
    const token = createSession(user.id)
    send(response, { token, user }, '注册成功', 201)
  }
  catch (error) {
    next(error)
  }
})

app.post('/api/auth/login', (request, response, next) => {
  try {
    const studentNo = String(request.body.studentNo || '').trim()
    const password = String(request.body.password || '').trim()
    assert(studentNo, '请输入学号')
    assert(password, '请输入密码')

    const userRow = findUserByStudentNo(studentNo)
    assert(userRow, '账号或密码错误', 401)
    assert(userRow.status === 'active', '账号已被禁用', 403)
    assert(verifyPassword(password, userRow.password_hash), '账号或密码错误', 401)

    const token = createSession(userRow.id)
    send(response, { token, user: findUserById(userRow.id) }, '登录成功')
  }
  catch (error) {
    next(error)
  }
})

app.post('/api/auth/logout', requireAuth, (request, response) => {
  destroySession(request.viewer.token)
  send(response, { ok: true }, '退出成功')
})

app.get('/api/auth/me', requireAuth, (request, response) => {
  send(response, request.viewer.user)
})

app.put('/api/auth/profile', requireAuth, (request, response, next) => {
  try {
    const currentUser = findUserById(request.viewer.id)
    assert(currentUser, '用户不存在', 404)
    const payload = parseProfilePayload(request.body, currentUser)
    const user = updateUserRecord(request.viewer.id, {
      ...currentUser,
      ...payload,
      studentNo: currentUser.studentNo,
      password: '',
      role: currentUser.role,
      status: currentUser.status,
    })
    send(response, user, '资料已更新')
  }
  catch (error) {
    next(error)
  }
})

app.get('/api/notifications/public', (request, response) => {
  const limit = Math.min(10, Math.max(1, Number(request.query.limit || 5)))
  send(response, listPublicNotifications(limit))
})

app.get('/api/listings', (request, response, next) => {
  try {
    const type = String(request.query.type || 'supply')
    assert(type === 'supply' || type === 'demand', '列表类型不正确')

    const result = listPublicListings({
      type,
      keyword: String(request.query.keyword || '').trim(),
      category: String(request.query.category || '').trim(),
      sort: String(request.query.sort || 'recent').trim(),
      page: Number(request.query.page || 1),
      pageSize: Number(request.query.pageSize || 10),
      viewerId: request.viewer?.id ?? null,
    })
    send(response, result)
  }
  catch (error) {
    next(error)
  }
})

app.get('/api/listings/:id', (request, response, next) => {
  try {
    const listingId = Number(request.params.id)
    assert(Number.isInteger(listingId), '信息编号不正确')

    const item = getListingById(listingId, request.viewer?.id ?? null, request.viewer?.id ?? null)
    assert(item, '未找到对应信息', 404)
    incrementListingViews(listingId)
    send(response, getListingById(listingId, request.viewer?.id ?? null, request.viewer?.id ?? null))
  }
  catch (error) {
    next(error)
  }
})

app.post('/api/listings', requireAuth, (request, response, next) => {
  try {
    const payload = parseListingPayload(request.body)
    const owner = findUserById(request.viewer.id)
    assert(owner, '用户不存在', 404)
    const listingId = createListingRecord(request.viewer.id, {
      ...payload,
      contactName: owner.contactName || owner.nickname,
      phone: owner.phone || '',
      wechat: owner.wechat || '',
      qq: owner.qq || '',
    })
    send(response, getListingById(listingId, request.viewer.id, request.viewer.id), '发布成功', 201)
  }
  catch (error) {
    next(error)
  }
})

app.put('/api/listings/:id', requireAuth, (request, response, next) => {
  try {
    const listingId = Number(request.params.id)
    const ownerRow = findListingOwner(listingId)
    assert(ownerRow, '未找到对应信息', 404)
    assert(ownerRow.owner_id === request.viewer.id, '只能编辑自己的信息', 403)
    const owner = findUserById(request.viewer.id)
    assert(owner, '用户不存在', 404)

    updateListingRecord(listingId, {
      ...parseListingPayload(request.body),
      contactName: owner.contactName || owner.nickname,
      phone: owner.phone || '',
      wechat: owner.wechat || '',
      qq: owner.qq || '',
      status: ownerRow.status,
    })
    send(response, getListingById(listingId, request.viewer.id, request.viewer.id), '修改成功')
  }
  catch (error) {
    next(error)
  }
})

app.delete('/api/listings/:id', requireAuth, (request, response, next) => {
  try {
    const listingId = Number(request.params.id)
    const ownerRow = findListingOwner(listingId)
    assert(ownerRow, '未找到对应信息', 404)
    assert(ownerRow.owner_id === request.viewer.id, '只能删除自己的信息', 403)
    archiveListingRecord(listingId)
    send(response, { id: listingId }, '删除成功')
  }
  catch (error) {
    next(error)
  }
})

app.get('/api/me/dashboard', requireAuth, (request, response) => {
  send(response, getDashboard(request.viewer.id))
})

app.get('/api/me/collections', requireAuth, (request, response) => {
  send(response, getCollections(request.viewer.id))
})

app.get('/api/me/follows', requireAuth, (request, response) => {
  send(response, listFollowedUsers(request.viewer.id))
})

app.post('/api/me/favorites/:id', requireAuth, (request, response, next) => {
  try {
    const listingId = Number(request.params.id)
    assert(getListingById(listingId, request.viewer.id, request.viewer.id), '未找到对应信息', 404)
    const active = toggleFavoriteRecord(request.viewer.id, listingId)
    send(response, { active }, active ? '已加入收藏' : '已取消收藏')
  }
  catch (error) {
    next(error)
  }
})

app.post('/api/me/follows/:userId', requireAuth, (request, response, next) => {
  try {
    const followedUserId = Number(request.params.userId)
    assert(Number.isInteger(followedUserId), '用户编号不正确')
    assert(followedUserId !== request.viewer.id, '不能关注自己')
    assert(findUserById(followedUserId), '用户不存在', 404)
    const active = toggleFollowRecord(request.viewer.id, followedUserId)
    send(response, { active }, active ? '已关注' : '已取消关注')
  }
  catch (error) {
    next(error)
  }
})

app.post('/api/me/cart/:id', requireAuth, (request, response, next) => {
  try {
    const listingId = Number(request.params.id)
    assert(getListingById(listingId, request.viewer.id, request.viewer.id), '未找到对应信息', 404)
    const active = toggleCartRecord(request.viewer.id, listingId)
    send(response, { active }, active ? '已加入购物车' : '已移出购物车')
  }
  catch (error) {
    next(error)
  }
})

app.post('/api/me/history/:id', requireAuth, (request, response, next) => {
  try {
    const listingId = Number(request.params.id)
    assert(getListingById(listingId, request.viewer.id, request.viewer.id), '未找到对应信息', 404)
    recordHistory(request.viewer.id, listingId)
    send(response, { ok: true }, '浏览记录已保存')
  }
  catch (error) {
    next(error)
  }
})

app.post('/api/uploads/image', requireAuth, upload.single('file'), async (request, response, next) => {
  try {
    send(response, await saveUploadedImage(request, request.file), '图片上传成功', 201)
  }
  catch (error) {
    next(error)
  }
})

app.get('/api/chat/conversations', requireAuth, (request, response) => {
  send(response, listConversationsForUser(request.viewer.id))
})

app.post('/api/chat/conversations/from-listing', requireAuth, (request, response, next) => {
  try {
    const listingId = Number(request.body.listingId)
    assert(Number.isInteger(listingId), '商品编号不正确')
    const conversationId = createConversationForListing(listingId, request.viewer.id)
    send(response, findConversationById(conversationId, request.viewer.id), '会话已准备好', 201)
  }
  catch (error) {
    next(error)
  }
})

app.get('/api/chat/conversations/:id', requireAuth, (request, response, next) => {
  try {
    const conversationId = Number(request.params.id)
    assert(Number.isInteger(conversationId), '会话编号不正确')
    const conversation = findConversationById(conversationId, request.viewer.id)
    assert(conversation, '未找到会话', 404)
    send(response, conversation)
  }
  catch (error) {
    next(error)
  }
})

app.get('/api/chat/conversations/:id/messages', requireAuth, (request, response, next) => {
  try {
    const conversationId = Number(request.params.id)
    assert(Number.isInteger(conversationId), '会话编号不正确')
    const payload = listConversationMessages(conversationId, request.viewer.id, Number(request.query.limit || 80))
    assert(payload, '未找到会话', 404)
    send(response, payload)
  }
  catch (error) {
    next(error)
  }
})

app.post('/api/chat/conversations/:id/messages', requireAuth, (request, response, next) => {
  try {
    const conversationId = Number(request.params.id)
    assert(Number.isInteger(conversationId), '会话编号不正确')
    const conversation = findConversationById(conversationId, request.viewer.id)
    assert(conversation, '未找到会话', 404)
    const payload = parseChatBody(request.body)
    const message = createConversationMessage(conversationId, request.viewer.id, payload.body)
    pushMessageCreated(conversationId, message)
    send(response, message, '发送成功', 201)
  }
  catch (error) {
    next(error)
  }
})

app.post('/api/chat/conversations/:id/read', requireAuth, (request, response, next) => {
  try {
    const conversationId = Number(request.params.id)
    assert(Number.isInteger(conversationId), '会话编号不正确')
    const conversation = findConversationById(conversationId, request.viewer.id)
    assert(conversation, '未找到会话', 404)
    const readAt = markConversationRead(conversationId, request.viewer.id)
    pushConversationSnapshot(conversationId, conversation.buyerId)
    pushConversationSnapshot(conversationId, conversation.sellerId)
    send(response, { readAt }, '已标记为已读')
  }
  catch (error) {
    next(error)
  }
})

app.post('/api/admin/auth/login', (request, response, next) => {
  try {
    const username = String(request.body.username || '').trim()
    const password = String(request.body.password || '').trim()
    assert(username, '请输入管理员账号')
    assert(password, '请输入密码')

    const userRow = findUserByStudentNo(username)
    assert(userRow, '账号或密码错误', 401)
    assert(userRow.role === 'admin', '该账号不是管理员', 403)
    assert(userRow.status === 'active', '管理员账号已被禁用', 403)
    assert(verifyPassword(password, userRow.password_hash), '账号或密码错误', 401)

    const token = createSession(userRow.id)
    send(response, { token, user: findUserById(userRow.id) }, '登录成功')
  }
  catch (error) {
    next(error)
  }
})

app.get('/api/admin/me', requireAdmin, (request, response) => {
  send(response, request.viewer.user)
})

app.get('/api/admin/stats', requireAdmin, (request, response) => {
  send(response, {
    summary: getAdminStats(),
    recentNotifications: listPublicNotifications(5),
    latestListings: listAdminListingsPage({
      page: 1,
      pageSize: 6,
      status: 'all',
      type: 'all',
      viewerId: request.viewer.id,
    }).items,
  })
})

app.get('/api/admin/listings', requireAdmin, (request, response) => {
  send(response, listAdminListingsPage({
    page: Number(request.query.page || 1),
    pageSize: Number(request.query.pageSize || 10),
    keyword: String(request.query.keyword || '').trim(),
    status: String(request.query.status || 'all').trim(),
    type: String(request.query.type || 'all').trim(),
    ownerKeyword: String(request.query.ownerKeyword || '').trim(),
    viewerId: request.viewer.id,
  }))
})

app.post('/api/admin/listings', requireAdmin, (request, response, next) => {
  try {
    const ownerId = Number(request.body.ownerId || request.viewer.id)
    assert(findUserById(ownerId), '发布人不存在')
    const payload = parseListingPayload(request.body)
    const listingId = createListingRecord(ownerId, payload)
    send(response, getListingById(listingId, request.viewer.id, ownerId), '新增商品成功', 201)
  }
  catch (error) {
    next(error)
  }
})

app.put('/api/admin/listings/:id', requireAdmin, (request, response, next) => {
  try {
    const listingId = Number(request.params.id)
    const ownerRow = findListingOwner(listingId)
    assert(ownerRow, '未找到对应信息', 404)
    const payload = parseListingPayload(request.body)
    updateListingRecord(listingId, payload)
    send(response, getListingById(listingId, request.viewer.id, ownerRow.owner_id), '商品更新成功')
  }
  catch (error) {
    next(error)
  }
})

app.delete('/api/admin/listings/:id', requireAdmin, (request, response, next) => {
  try {
    const listingId = Number(request.params.id)
    const ownerRow = findListingOwner(listingId)
    assert(ownerRow, '未找到对应信息', 404)
    deleteListingRecord(listingId)
    send(response, { id: listingId }, '商品已删除')
  }
  catch (error) {
    next(error)
  }
})

app.get('/api/admin/users', requireAdmin, (request, response) => {
  send(response, listUsersPage({
    page: Number(request.query.page || 1),
    pageSize: Number(request.query.pageSize || 10),
    keyword: String(request.query.keyword || '').trim(),
    role: String(request.query.role || 'all').trim(),
    status: String(request.query.status || 'all').trim(),
  }))
})

app.post('/api/admin/users', requireAdmin, (request, response, next) => {
  try {
    const nickname = String(request.body.nickname || '').trim()
    const campus = String(request.body.campus || '').trim()
    const studentNo = String(request.body.studentNo || '').trim()
    const tagline = String(request.body.tagline || '').trim()
    const password = String(request.body.password || '').trim()
    const role = String(request.body.role || 'user').trim() || 'user'
    const status = String(request.body.status || 'active').trim() || 'active'

    assert(nickname.length >= 2, '昵称至少 2 个字')
    assert(campus.length >= 2, '请填写校区或学校')
    assert(studentNo.length >= 2, '学号或账号至少 2 位')
    assert(password.length >= 6, '密码至少 6 位')
    assert(['user', 'admin'].includes(role), '角色不正确')
    assert(['active', 'disabled'].includes(status), '状态不正确')
    assert(!findUserByStudentNo(studentNo), '学号已存在')

    const user = createUser({ nickname, campus, studentNo, tagline, password, role, status })
    send(response, user, '用户创建成功', 201)
  }
  catch (error) {
    next(error)
  }
})

app.put('/api/admin/users/:id', requireAdmin, (request, response, next) => {
  try {
    const userId = Number(request.params.id)
    assert(findUserById(userId), '用户不存在', 404)
    const payload = {
      nickname: String(request.body.nickname || '').trim(),
      campus: String(request.body.campus || '').trim(),
      studentNo: String(request.body.studentNo || '').trim(),
      tagline: String(request.body.tagline || '').trim(),
      password: String(request.body.password || '').trim(),
      role: String(request.body.role || 'user').trim() || 'user',
      status: String(request.body.status || 'active').trim() || 'active',
    }

    assert(payload.nickname.length >= 2, '昵称至少 2 个字')
    assert(payload.campus.length >= 2, '请填写校区或学校')
    assert(payload.studentNo.length >= 2, '学号或账号至少 2 位')
    assert(['user', 'admin'].includes(payload.role), '角色不正确')
    assert(['active', 'disabled'].includes(payload.status), '状态不正确')
    if (payload.password) {
      assert(payload.password.length >= 6, '密码至少 6 位')
    }

    const user = updateUserRecord(userId, payload)
    send(response, user, '用户更新成功')
  }
  catch (error) {
    next(error)
  }
})

app.delete('/api/admin/users/:id', requireAdmin, (request, response, next) => {
  try {
    const userId = Number(request.params.id)
    const user = findUserById(userId)
    assert(user, '用户不存在', 404)
    assert(user.id !== request.viewer.id, '不能删除当前登录管理员', 400)
    deleteUserRecord(userId)
    send(response, { id: userId }, '用户删除成功')
  }
  catch (error) {
    next(error)
  }
})

app.get('/api/admin/notifications', requireAdmin, (request, response) => {
  send(response, listNotificationsPage({
    page: Number(request.query.page || 1),
    pageSize: Number(request.query.pageSize || 10),
    keyword: String(request.query.keyword || '').trim(),
    status: String(request.query.status || 'all').trim(),
  }))
})

app.post('/api/admin/notifications', requireAdmin, (request, response, next) => {
  try {
    const payload = parseNotificationPayload(request.body)
    send(response, createNotificationRecord(payload, request.viewer.id), '通知创建成功', 201)
  }
  catch (error) {
    next(error)
  }
})

app.put('/api/admin/notifications/:id', requireAdmin, (request, response, next) => {
  try {
    const notificationId = Number(request.params.id)
    assert(getNotificationById(notificationId), '通知不存在', 404)
    const payload = parseNotificationPayload(request.body)
    send(response, updateNotificationRecord(notificationId, payload), '通知更新成功')
  }
  catch (error) {
    next(error)
  }
})

app.delete('/api/admin/notifications/:id', requireAdmin, (request, response, next) => {
  try {
    const notificationId = Number(request.params.id)
    assert(getNotificationById(notificationId), '通知不存在', 404)
    deleteNotificationRecord(notificationId)
    send(response, { id: notificationId }, '通知删除成功')
  }
  catch (error) {
    next(error)
  }
})

app.get('/api/admin/storage', requireAdmin, (_request, response) => {
  send(response, {
    settings: buildStorageSettingsResponse(),
  })
})

app.put('/api/admin/storage', requireAdmin, (request, response, next) => {
  try {
    const settings = saveStorageSettings(normalizeStoragePayload(request.body))
    send(response, {
      settings: {
        ...settings,
        oss: {
          ...settings.oss,
          accessKeySecret: '',
          accessKeySecretMasked: maskSecret(settings.oss.accessKeySecret),
        },
      },
    }, '存储配置已保存')
  }
  catch (error) {
    next(error)
  }
})

app.post('/api/admin/storage/validate', requireAdmin, async (request, response, next) => {
  try {
    const settings = normalizeStoragePayload({
      provider: 'oss',
      oss: request.body?.oss || {},
    })
    const testKey = buildOssObjectKey(settings, '.txt')
    const testBody = Buffer.from(`campus-go-oss-test-${Date.now()}`)
    const result = await withOssFallback(settings, async (client, runtimeSettings) => {
      await client.put(testKey, testBody, {
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
        },
      })
      await client.head(testKey)
      await client.delete(testKey)
      return {
        runtimeSettings,
      }
    })

    send(response, {
      result: {
        bucket: settings.oss.bucket,
        region: settings.oss.region,
        sampleObject: testKey,
        authorizationV4: result.authorizationV4,
        usedCompatibilitySignature: result.usedCompatibilitySignature,
        endpoint: result.runtimeSettings.oss.endpoint || '',
        publicHost: getEndpointHost(settings.oss.endpoint) || '',
      },
    }, 'OSS 测试通过')
  }
  catch (error) {
    next(error)
  }
})

app.post('/api/admin/uploads/image', requireAdmin, upload.single('file'), async (request, response, next) => {
  try {
    send(response, await saveUploadedImage(request, request.file), '图片上传成功', 201)
  }
  catch (error) {
    next(error)
  }
})

app.get('/api/admin/media-library', requireAdmin, async (request, response, next) => {
  try {
    send(response, {
      list: await listMediaLibraryFiles(request, request.query.keyword),
    })
  }
  catch (error) {
    next(error)
  }
})

app.get('/api/admin/media-library/direct-url', requireAdmin, (request, response, next) => {
  try {
    const pathValue = String(request.query.path || '').trim()
    assert(pathValue, '文件路径不能为空')
    send(response, {
      url: createMediaUrlFromPath(request, pathValue),
    })
  }
  catch (error) {
    next(error)
  }
})

app.post('/api/admin/media-library/upload', requireAdmin, upload.single('file'), async (request, response, next) => {
  try {
    const file = request.file
    assert(file, '请选择文件')
    assert(file.buffer && file.buffer.length > 0, '文件内容不能为空')
    assert(file.buffer.length <= 20 * 1024 * 1024, '文件不能超过 20MB')

    send(response, {
      file: await uploadBufferToCurrentStorage(
        request,
        String(file.originalname || file.fieldname || 'upload.bin'),
        file.buffer,
        String(file.mimetype || 'application/octet-stream'),
      ),
    }, '文件上传成功', 201)
  }
  catch (error) {
    next(error)
  }
})

app.post('/api/admin/media-library/rename', requireAdmin, async (request, response, next) => {
  try {
    const pathValue = String(request.body.path || '').trim()
    const newName = String(request.body.newName || '').trim()
    assert(pathValue, '文件路径不能为空')
    assert(newName, '新文件名不能为空')
    send(response, {
      file: await renameMediaLibraryFileEntry(request, pathValue, newName),
    }, '重命名成功')
  }
  catch (error) {
    next(error)
  }
})

app.post('/api/admin/media-library/delete', requireAdmin, async (request, response, next) => {
  try {
    const pathValue = String(request.body.path || '').trim()
    assert(pathValue, '文件路径不能为空')
    await deleteMediaLibraryFileEntry(pathValue)
    send(response, { path: pathValue }, '删除成功')
  }
  catch (error) {
    next(error)
  }
})

app.get('/api/admin/storage/progress', requireAdmin, (_request, response) => {
  send(response, {
    task: storageSwitchTask,
    settings: buildStorageSettingsResponse(),
  })
})

app.post('/api/admin/storage/switch', requireAdmin, (request, response, next) => {
  try {
    const target = String(request.body.target || '').trim()
    const confirmText = String(request.body.confirmText || '').trim()
    assert(target === 'oss' || target === 'local', '切换目标不正确')
    assert(confirmText === STORAGE_SWITCH_CONFIRM_TEXT, `请输入“${STORAGE_SWITCH_CONFIRM_TEXT}”确认切换`)

    if (storageSwitchTask && storageSwitchTask.status === 'running') {
      send(response, {
        result: {
          started: false,
        },
        task: storageSwitchTask,
      }, '已有切换任务在执行')
      return
    }

    storageSwitchTask = createStorageSwitchTask(target)
    pushStorageTaskLog('info', target === 'oss' ? '开始执行转入 OSS' : '开始执行切回本地')

    void runStorageSwitchTask(storageSwitchTask)

    send(response, {
      result: {
        started: true,
      },
      task: storageSwitchTask,
    }, '切换任务已启动', 202)
  }
  catch (error) {
    next(error)
  }
})

app.use((request, response) => {
  response.status(404).json({
    success: false,
    message: `未找到接口 ${request.method} ${request.path}`,
    data: null,
  })
})

app.use((error, _request, response, _next) => {
  const isMulterLimit = error?.code === 'LIMIT_FILE_SIZE'
  const status = error instanceof HttpError ? error.status : (isMulterLimit ? 400 : 500)
  response.status(status).json({
    success: false,
    message: isMulterLimit ? '文件超过上传大小限制' : (error.message || '服务器内部错误'),
    data: null,
  })
})

wsServer.on('connection', (socket, request) => {
  const requestUrl = new URL(request.url || '/ws', `http://${request.headers.host || `${config.host}:${config.port}`}`)
  const token = requestUrl.searchParams.get('token') || ''
  const session = findSession(token)

  if (!session || session.status !== 'active') {
    socket.close(1008, 'unauthorized')
    return
  }

  const userId = Number(session.user_id)
  addSocketClient(userId, socket)
  socket.send(JSON.stringify({
    type: 'socket:ready',
    userId,
    connectedAt: new Date().toISOString(),
  }))

  socket.on('message', (raw) => {
    try {
      const payload = JSON.parse(String(raw || '{}'))
      if (payload.type === 'conversation:read' && Number.isInteger(Number(payload.conversationId))) {
        const conversationId = Number(payload.conversationId)
        const conversation = findConversationById(conversationId, userId)
        if (!conversation) {
          return
        }

        markConversationRead(conversationId, userId)
        pushConversationSnapshot(conversationId, conversation.buyerId)
        pushConversationSnapshot(conversationId, conversation.sellerId)
      }
    }
    catch {}
  })

  socket.on('close', () => {
    removeSocketClient(userId, socket)
  })

  socket.on('error', () => {
    removeSocketClient(userId, socket)
  })
})

httpServer.listen(config.port, config.host, () => {
  console.log(`Campus Go API running at http://${config.host}:${config.port}`)
})
