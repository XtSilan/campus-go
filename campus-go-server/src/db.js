import { existsSync, mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { config } from './config.js'
import { createSessionToken, futureHours, hashPassword, makeAvatarColor, now } from './security.js'

if (!existsSync(dirname(config.dbPath))) {
  mkdirSync(dirname(config.dbPath), { recursive: true })
}

export const db = new DatabaseSync(config.dbPath)

db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;

  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nickname TEXT NOT NULL,
    campus TEXT NOT NULL,
    student_no TEXT NOT NULL UNIQUE,
    tagline TEXT NOT NULL DEFAULT '',
    contact_name TEXT NOT NULL DEFAULT '',
    phone TEXT NOT NULL DEFAULT '',
    wechat TEXT NOT NULL DEFAULT '',
    qq TEXT NOT NULL DEFAULT '',
    avatar_color TEXT NOT NULL,
    avatar_url TEXT NOT NULL DEFAULT '',
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'user',
    status TEXT NOT NULL DEFAULT 'active',
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS sessions (
    token TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL,
    created_at TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS listings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    owner_id INTEGER NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('supply', 'demand')),
    title TEXT NOT NULL,
    category TEXT NOT NULL,
    condition TEXT NOT NULL,
    description TEXT NOT NULL,
    price REAL,
    image_url TEXT NOT NULL DEFAULT '',
    location TEXT NOT NULL DEFAULT '',
    contact_name TEXT NOT NULL,
    phone TEXT NOT NULL DEFAULT '',
    wechat TEXT NOT NULL DEFAULT '',
    qq TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
    views INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS favorites (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    listing_id INTEGER NOT NULL,
    created_at TEXT NOT NULL,
    UNIQUE(user_id, listing_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (listing_id) REFERENCES listings(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS follows (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    followed_user_id INTEGER NOT NULL,
    created_at TEXT NOT NULL,
    UNIQUE(user_id, followed_user_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (followed_user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS cart_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    listing_id INTEGER NOT NULL,
    created_at TEXT NOT NULL,
    UNIQUE(user_id, listing_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (listing_id) REFERENCES listings(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    listing_id INTEGER NOT NULL,
    viewed_at TEXT NOT NULL,
    UNIQUE(user_id, listing_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (listing_id) REFERENCES listings(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'info',
    audience TEXT NOT NULL DEFAULT 'all',
    status TEXT NOT NULL DEFAULT 'active',
    pinned INTEGER NOT NULL DEFAULT 0,
    created_by INTEGER,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
  );

  CREATE TABLE IF NOT EXISTS conversations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    listing_id INTEGER NOT NULL,
    buyer_id INTEGER NOT NULL,
    seller_id INTEGER NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    last_message_at TEXT NOT NULL,
    UNIQUE(listing_id, buyer_id, seller_id),
    FOREIGN KEY (listing_id) REFERENCES listings(id) ON DELETE CASCADE,
    FOREIGN KEY (buyer_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (seller_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    conversation_id INTEGER NOT NULL,
    sender_id INTEGER NOT NULL,
    body TEXT NOT NULL,
    kind TEXT NOT NULL DEFAULT 'text',
    read_at TEXT,
    created_at TEXT NOT NULL,
    FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
    FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS app_settings (
    key TEXT PRIMARY KEY,
    value_json TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
`)

function ensureColumn(tableName, columnName, definition) {
  const columns = db.prepare(`PRAGMA table_info(${tableName})`).all()
  const hasColumn = columns.some(column => column.name === columnName)

  if (!hasColumn) {
    db.exec(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition}`)
  }
}

ensureColumn('users', 'role', `TEXT NOT NULL DEFAULT 'user'`)
ensureColumn('users', 'status', `TEXT NOT NULL DEFAULT 'active'`)
ensureColumn('users', 'contact_name', `TEXT NOT NULL DEFAULT ''`)
ensureColumn('users', 'phone', `TEXT NOT NULL DEFAULT ''`)
ensureColumn('users', 'wechat', `TEXT NOT NULL DEFAULT ''`)
ensureColumn('users', 'qq', `TEXT NOT NULL DEFAULT ''`)
ensureColumn('users', 'avatar_url', `TEXT NOT NULL DEFAULT ''`)

function normalizePage(page = 1, pageSize = 10, maxPageSize = 30) {
  const safePage = Number.isFinite(Number(page)) ? Math.max(1, Number(page)) : 1
  const safePageSize = Number.isFinite(Number(pageSize)) ? Math.min(maxPageSize, Math.max(1, Number(pageSize))) : 10
  return {
    page: safePage,
    pageSize: safePageSize,
    offset: (safePage - 1) * safePageSize,
  }
}

function rowToUser(row) {
  if (!row) {
    return null
  }

  return {
    id: row.id,
    nickname: row.nickname,
    campus: row.campus,
    studentNo: row.student_no,
    tagline: row.tagline,
    contactName: row.contact_name,
    phone: row.phone,
    wechat: row.wechat,
    qq: row.qq,
    avatarColor: row.avatar_color,
    avatarUrl: row.avatar_url || '',
    role: row.role,
    status: row.status,
    createdAt: row.created_at,
  }
}

function rowToNotification(row) {
  if (!row) {
    return null
  }

  return {
    id: row.id,
    title: row.title,
    content: row.content,
    type: row.type,
    audience: row.audience,
    status: row.status,
    pinned: Boolean(row.pinned),
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function rowToListing(row) {
  if (!row) {
    return null
  }

  const imageUrls = parseListingImageUrls(row.image_url)

  return {
    id: row.id,
    type: row.type,
    title: row.title,
    category: row.category,
    condition: row.condition,
    description: row.description,
    price: row.price === null ? null : Number(row.price),
    imageUrl: imageUrls[0] || '',
    imageUrls,
    location: row.location,
    contactName: row.contact_name,
    phone: row.phone,
    wechat: row.wechat,
    qq: row.qq,
    status: row.status,
    views: row.views,
    favoriteCount: row.favorite_count ?? 0,
    cartCount: row.cart_count ?? 0,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    ownerId: row.owner_id,
    ownerNickname: row.owner_nickname,
    ownerCampus: row.owner_campus,
    ownerAvatarColor: row.owner_avatar_color,
    ownerAvatarUrl: row.owner_avatar_url || '',
    isFavorite: Boolean(row.is_favorite),
    isInCart: Boolean(row.is_in_cart),
    isFollowingOwner: Boolean(row.is_following_owner),
  }
}

function rowToFollowSummary(row) {
  if (!row) {
    return null
  }

  const latestListingImageUrls = parseListingImageUrls(row.latest_listing_image_url)

  return {
    id: row.followed_user_id,
    nickname: row.nickname,
    campus: row.campus,
    studentNo: row.student_no,
    tagline: row.tagline,
    avatarColor: row.avatar_color,
    avatarUrl: row.avatar_url || '',
    createdAt: row.followed_at,
    isMutual: Boolean(row.is_mutual),
    activeListingCount: row.active_listing_count ?? 0,
    activeSupplyCount: row.active_supply_count ?? 0,
    activeDemandCount: row.active_demand_count ?? 0,
    latestListingId: row.latest_listing_id ?? null,
    latestListingTitle: row.latest_listing_title || '',
    latestListingImageUrl: latestListingImageUrls[0] || '',
    latestListingUpdatedAt: row.latest_listing_updated_at || '',
  }
}

function rowToConversation(row, viewerId) {
  if (!row) {
    return null
  }

  const listingImageUrls = parseListingImageUrls(row.listing_image_url)

  const peerIsSeller = Number(viewerId) === Number(row.buyer_id)
  return {
    id: row.id,
    listingId: row.listing_id,
    listingTitle: row.listing_title,
    listingImageUrl: listingImageUrls[0] || '',
    listingPrice: row.listing_price === null ? null : Number(row.listing_price),
    listingStatus: row.listing_status,
    buyerId: row.buyer_id,
    sellerId: row.seller_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lastMessageAt: row.last_message_at,
    lastMessage: row.last_message || '',
    unreadCount: row.unread_count ?? 0,
    peerUser: {
      id: peerIsSeller ? row.seller_id : row.buyer_id,
      nickname: peerIsSeller ? row.seller_nickname : row.buyer_nickname,
      campus: peerIsSeller ? row.seller_campus : row.buyer_campus,
      avatarColor: peerIsSeller ? row.seller_avatar_color : row.buyer_avatar_color,
      avatarUrl: peerIsSeller ? (row.seller_avatar_url || '') : (row.buyer_avatar_url || ''),
    },
  }
}

function parseListingImageUrls(rawValue) {
  const raw = String(rawValue || '').trim()
  if (!raw) {
    return []
  }

  if (raw.startsWith('[')) {
    try {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) {
        return parsed.map(item => String(item || '').trim()).filter(Boolean)
      }
    }
    catch {}
  }

  return [raw]
}

function serializeListingImageUrls(imageUrls) {
  const cleaned = Array.isArray(imageUrls)
    ? imageUrls.map(item => String(item || '').trim()).filter(Boolean)
    : []

  if (!cleaned.length) {
    return ''
  }

  if (cleaned.length === 1) {
    return cleaned[0]
  }

  return JSON.stringify(cleaned)
}

function rowToMessage(row) {
  if (!row) {
    return null
  }

  return {
    id: row.id,
    conversationId: row.conversation_id,
    senderId: row.sender_id,
    body: row.body,
    kind: row.kind,
    readAt: row.read_at,
    createdAt: row.created_at,
  }
}

function listSelectSql(viewerId = null) {
  const safeViewerId = Number(viewerId || 0)
  return `
    SELECT
      l.*,
      u.nickname AS owner_nickname,
      u.campus AS owner_campus,
      u.avatar_color AS owner_avatar_color,
      u.avatar_url AS owner_avatar_url,
      (SELECT COUNT(*) FROM favorites f WHERE f.listing_id = l.id) AS favorite_count,
      (SELECT COUNT(*) FROM cart_items c WHERE c.listing_id = l.id) AS cart_count,
      EXISTS(SELECT 1 FROM favorites f2 WHERE f2.user_id = ${safeViewerId} AND f2.listing_id = l.id) AS is_favorite,
      EXISTS(SELECT 1 FROM cart_items c2 WHERE c2.user_id = ${safeViewerId} AND c2.listing_id = l.id) AS is_in_cart,
      EXISTS(SELECT 1 FROM follows fo WHERE fo.user_id = ${safeViewerId} AND fo.followed_user_id = l.owner_id) AS is_following_owner
    FROM listings l
    JOIN users u ON u.id = l.owner_id
  `
}

function buildListingFilters(filters, { admin = false } = {}) {
  const clauses = []
  const values = []

  if (!admin) {
    clauses.push(`l.status = 'active'`)
  }
  else if (filters.status && filters.status !== 'all') {
    clauses.push(`l.status = ?`)
    values.push(filters.status)
  }

  if (filters.type && filters.type !== 'all') {
    clauses.push(`l.type = ?`)
    values.push(filters.type)
  }

  if (filters.keyword) {
    clauses.push(`(l.title LIKE ? OR l.description LIKE ? OR l.category LIKE ? OR u.nickname LIKE ?)`)
    values.push(`%${filters.keyword}%`, `%${filters.keyword}%`, `%${filters.keyword}%`, `%${filters.keyword}%`)
  }

  if (filters.category) {
    clauses.push(`l.category = ?`)
    values.push(filters.category)
  }

  if (filters.ownerKeyword) {
    clauses.push(`(u.nickname LIKE ? OR u.student_no LIKE ?)`)
    values.push(`%${filters.ownerKeyword}%`, `%${filters.ownerKeyword}%`)
  }

  return {
    whereSql: clauses.length ? `WHERE ${clauses.join(' AND ')}` : '',
    values,
  }
}

function buildPaginatedResult(items, total, page, pageSize) {
  return {
    items,
    page,
    pageSize,
    total,
    hasMore: page * pageSize < total,
  }
}

function readJsonSetting(key, fallbackValue) {
  const row = db.prepare(`SELECT value_json FROM app_settings WHERE key = ?`).get(key)
  if (!row) {
    return fallbackValue
  }

  try {
    return JSON.parse(row.value_json)
  }
  catch {
    return fallbackValue
  }
}

function writeJsonSetting(key, value) {
  const valueJson = JSON.stringify(value)
  db.prepare(`
    INSERT INTO app_settings (key, value_json, updated_at)
    VALUES (?, ?, ?)
    ON CONFLICT(key)
    DO UPDATE SET value_json = excluded.value_json, updated_at = excluded.updated_at
  `).run(key, valueJson, now())
}

function conversationSelectSql(viewerId) {
  const safeViewerId = Number(viewerId)
  return `
    SELECT
      c.*,
      l.title AS listing_title,
      l.image_url AS listing_image_url,
      l.price AS listing_price,
      l.status AS listing_status,
      buyer.nickname AS buyer_nickname,
      buyer.campus AS buyer_campus,
      buyer.avatar_color AS buyer_avatar_color,
      buyer.avatar_url AS buyer_avatar_url,
      seller.nickname AS seller_nickname,
      seller.campus AS seller_campus,
      seller.avatar_color AS seller_avatar_color,
      seller.avatar_url AS seller_avatar_url,
      (
        SELECT m.body
        FROM messages m
        WHERE m.conversation_id = c.id
        ORDER BY m.created_at DESC, m.id DESC
        LIMIT 1
      ) AS last_message,
      (
        SELECT COUNT(*)
        FROM messages m2
        WHERE m2.conversation_id = c.id AND m2.sender_id != ${safeViewerId} AND m2.read_at IS NULL
      ) AS unread_count
    FROM conversations c
    JOIN listings l ON l.id = c.listing_id
    JOIN users buyer ON buyer.id = c.buyer_id
    JOIN users seller ON seller.id = c.seller_id
  `
}

export function cleanupExpiredSessions() {
  db.prepare(`DELETE FROM sessions WHERE expires_at <= ?`).run(now())
}

export function createUser({
  nickname,
  campus,
  studentNo,
  tagline,
  contactName = '',
  phone = '',
  wechat = '',
  qq = '',
  password,
  role = 'user',
  status = 'active',
}) {
  const createdAt = now()
  const avatarColor = makeAvatarColor(studentNo)
  const passwordHash = hashPassword(password)
  const result = db.prepare(`
    INSERT INTO users (
      nickname, campus, student_no, tagline, contact_name, phone, wechat, qq,
      avatar_color, avatar_url, password_hash, role, status, created_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    nickname,
    campus,
    studentNo,
    tagline,
    contactName || nickname,
    phone,
    wechat,
    qq,
    avatarColor,
    '',
    passwordHash,
    role,
    status,
    createdAt,
  )

  return findUserById(Number(result.lastInsertRowid))
}

export function updateUserRecord(userId, payload) {
  const current = findUserByStudentNo(payload.studentNo || '')
  if (payload.studentNo && current && current.id !== userId) {
    throw new Error('学号已存在')
  }

  const nextPasswordHash = payload.password
    ? hashPassword(payload.password)
    : db.prepare(`SELECT password_hash FROM users WHERE id = ?`).get(userId)?.password_hash

  db.prepare(`
    UPDATE users
    SET
      nickname = ?,
      campus = ?,
      student_no = ?,
      tagline = ?,
      contact_name = ?,
      phone = ?,
      wechat = ?,
      qq = ?,
      avatar_url = ?,
      role = ?,
      status = ?,
      password_hash = ?
    WHERE id = ?
  `).run(
    payload.nickname,
    payload.campus,
    payload.studentNo,
    payload.tagline,
    payload.contactName || payload.nickname,
    payload.phone || '',
    payload.wechat || '',
    payload.qq || '',
    payload.avatarUrl || '',
    payload.role,
    payload.status,
    nextPasswordHash,
    userId,
  )

  return findUserById(userId)
}

export function deleteUserRecord(userId) {
  db.prepare(`DELETE FROM users WHERE id = ?`).run(userId)
}

export function findUserByStudentNo(studentNo) {
  return db.prepare(`SELECT * FROM users WHERE student_no = ?`).get(studentNo)
}

export function findUserById(userId) {
  const row = db.prepare(`SELECT * FROM users WHERE id = ?`).get(userId)
  return rowToUser(row)
}

export function createSession(userId) {
  cleanupExpiredSessions()
  const token = createSessionToken()
  db.prepare(`
    INSERT INTO sessions (token, user_id, created_at, expires_at)
    VALUES (?, ?, ?, ?)
  `).run(token, userId, now(), futureHours(config.tokenTtlHours))
  return token
}

export function destroySession(token) {
  db.prepare(`DELETE FROM sessions WHERE token = ?`).run(token)
}

export function findSession(token) {
  cleanupExpiredSessions()
  return db.prepare(`
    SELECT
      s.*,
      u.nickname,
      u.campus,
      u.student_no,
      u.tagline,
      u.contact_name,
      u.phone,
      u.wechat,
      u.qq,
      u.avatar_color,
      u.avatar_url,
      u.role,
      u.status,
      u.created_at AS user_created_at
    FROM sessions s
    JOIN users u ON u.id = s.user_id
    WHERE s.token = ? AND s.expires_at > ?
  `).get(token, now())
}

export function findListingOwner(listingId) {
  return db.prepare(`SELECT owner_id, status FROM listings WHERE id = ?`).get(listingId)
}

export function listPublicListings(filters) {
  const { page, pageSize, offset } = normalizePage(filters.page, filters.pageSize)
  const { whereSql, values } = buildListingFilters(filters)
  const orderBy = {
    recent: 'l.created_at DESC',
    price_asc: `CASE WHEN l.price IS NULL THEN 1 ELSE 0 END, l.price ASC, l.created_at DESC`,
    price_desc: `CASE WHEN l.price IS NULL THEN 1 ELSE 0 END, l.price DESC, l.created_at DESC`,
    hot: 'l.views DESC, l.created_at DESC',
  }[filters.sort || 'recent'] || 'l.created_at DESC'

  const totalRow = db.prepare(`
    SELECT COUNT(*) AS total
    FROM listings l
    JOIN users u ON u.id = l.owner_id
    ${whereSql}
  `).get(...values)

  const rows = db.prepare(`
    ${listSelectSql(filters.viewerId)}
    ${whereSql}
    ORDER BY ${orderBy}
    LIMIT ? OFFSET ?
  `).all(...values, pageSize, offset)

  return buildPaginatedResult(rows.map(rowToListing), totalRow.total, page, pageSize)
}

export function listAdminListingsPage(filters) {
  const { page, pageSize, offset } = normalizePage(filters.page, filters.pageSize, 50)
  const { whereSql, values } = buildListingFilters(filters, { admin: true })
  const orderBy = 'l.updated_at DESC'

  const totalRow = db.prepare(`
    SELECT COUNT(*) AS total
    FROM listings l
    JOIN users u ON u.id = l.owner_id
    ${whereSql}
  `).get(...values)

  const rows = db.prepare(`
    ${listSelectSql(filters.viewerId)}
    ${whereSql}
    ORDER BY ${orderBy}
    LIMIT ? OFFSET ?
  `).all(...values, pageSize, offset)

  return buildPaginatedResult(rows.map(rowToListing), totalRow.total, page, pageSize)
}

export function getListingById(listingId, viewerId = null, allowArchivedOwnerId = null) {
  const row = db.prepare(`
    ${listSelectSql(viewerId)}
    WHERE l.id = ?
  `).get(listingId)

  if (!row) {
    return null
  }

  if (row.status !== 'active' && row.owner_id !== allowArchivedOwnerId) {
    return null
  }

  return rowToListing(row)
}

export function incrementListingViews(listingId) {
  db.prepare(`UPDATE listings SET views = views + 1 WHERE id = ?`).run(listingId)
}

export function createListingRecord(ownerId, payload) {
  const createdAt = now()
  const result = db.prepare(`
    INSERT INTO listings (
      owner_id, type, title, category, condition, description, price, image_url, location,
      contact_name, phone, wechat, qq, status, views, created_at, updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', 0, ?, ?)
  `).run(
    ownerId,
    payload.type,
    payload.title,
    payload.category,
    payload.condition,
    payload.description,
    payload.price,
    serializeListingImageUrls(payload.imageUrls || [payload.imageUrl].filter(Boolean)),
    payload.location,
    payload.contactName || '',
    payload.phone || '',
    payload.wechat || '',
    payload.qq || '',
    createdAt,
    createdAt,
  )

  return Number(result.lastInsertRowid)
}

export function updateListingRecord(listingId, payload) {
  db.prepare(`
    UPDATE listings
    SET
      type = ?,
      title = ?,
      category = ?,
      condition = ?,
      description = ?,
      price = ?,
      image_url = ?,
      location = ?,
      contact_name = ?,
      phone = ?,
      wechat = ?,
      qq = ?,
      status = ?,
      updated_at = ?
    WHERE id = ?
  `).run(
    payload.type,
    payload.title,
    payload.category,
    payload.condition,
    payload.description,
    payload.price,
    serializeListingImageUrls(payload.imageUrls || [payload.imageUrl].filter(Boolean)),
    payload.location,
    payload.contactName || '',
    payload.phone || '',
    payload.wechat || '',
    payload.qq || '',
    payload.status || 'active',
    now(),
    listingId,
  )
}

export function archiveListingRecord(listingId) {
  db.prepare(`UPDATE listings SET status = 'archived', updated_at = ? WHERE id = ?`).run(now(), listingId)
}

export function deleteListingRecord(listingId) {
  db.prepare(`DELETE FROM listings WHERE id = ?`).run(listingId)
}

export function getDashboard(userId) {
  const summary = db.prepare(`
    SELECT
      (SELECT COUNT(*) FROM listings WHERE owner_id = ? AND type = 'supply' AND status = 'active') AS active_supply_count,
      (SELECT COUNT(*) FROM listings WHERE owner_id = ? AND type = 'demand' AND status = 'active') AS active_demand_count,
      (SELECT COUNT(*) FROM favorites f JOIN listings l ON l.id = f.listing_id WHERE l.owner_id = ? AND l.status = 'active') AS favorite_count,
      (SELECT COUNT(*) FROM cart_items c JOIN listings l ON l.id = c.listing_id WHERE l.owner_id = ? AND l.status = 'active') AS cart_count,
      (SELECT COUNT(*) FROM history h JOIN listings l ON l.id = h.listing_id WHERE l.owner_id = ? AND l.status = 'active') AS history_count
  `).get(userId, userId, userId, userId, userId)

  const supplyRows = db.prepare(`
    ${listSelectSql(userId)}
    WHERE l.owner_id = ? AND l.type = 'supply' AND l.status = 'active'
    ORDER BY l.updated_at DESC
    LIMIT 20
  `).all(userId)

  const demandRows = db.prepare(`
    ${listSelectSql(userId)}
    WHERE l.owner_id = ? AND l.type = 'demand' AND l.status = 'active'
    ORDER BY l.updated_at DESC
    LIMIT 20
  `).all(userId)

  return {
    summary: {
      activeSupplyCount: summary.active_supply_count,
      activeDemandCount: summary.active_demand_count,
      favoriteCount: summary.favorite_count,
      cartCount: summary.cart_count,
      historyCount: summary.history_count,
    },
    supplyListings: supplyRows.map(rowToListing),
    demandListings: demandRows.map(rowToListing),
  }
}

export function getCollections(userId) {
  const favorites = db.prepare(`
    ${listSelectSql(userId)}
    JOIN favorites x ON x.listing_id = l.id
    WHERE x.user_id = ? AND l.status = 'active'
    ORDER BY x.created_at DESC
  `).all(userId)

  const cart = db.prepare(`
    ${listSelectSql(userId)}
    JOIN cart_items x ON x.listing_id = l.id
    WHERE x.user_id = ? AND l.status = 'active'
    ORDER BY x.created_at DESC
  `).all(userId)

  const history = db.prepare(`
    ${listSelectSql(userId)}
    JOIN history x ON x.listing_id = l.id
    WHERE x.user_id = ? AND l.status = 'active'
    ORDER BY x.viewed_at DESC
  `).all(userId)

  return {
    favorites: favorites.map(rowToListing),
    cart: cart.map(rowToListing),
    history: history.map(rowToListing),
  }
}

export function toggleFavoriteRecord(userId, listingId) {
  const existing = db.prepare(`SELECT id FROM favorites WHERE user_id = ? AND listing_id = ?`).get(userId, listingId)

  if (existing) {
    db.prepare(`DELETE FROM favorites WHERE id = ?`).run(existing.id)
    return false
  }

  db.prepare(`INSERT INTO favorites (user_id, listing_id, created_at) VALUES (?, ?, ?)`).run(userId, listingId, now())
  return true
}

export function toggleCartRecord(userId, listingId) {
  const existing = db.prepare(`SELECT id FROM cart_items WHERE user_id = ? AND listing_id = ?`).get(userId, listingId)

  if (existing) {
    db.prepare(`DELETE FROM cart_items WHERE id = ?`).run(existing.id)
    return false
  }

  db.prepare(`INSERT INTO cart_items (user_id, listing_id, created_at) VALUES (?, ?, ?)`).run(userId, listingId, now())
  return true
}

export function toggleFollowRecord(userId, followedUserId) {
  const existing = db.prepare(`SELECT id FROM follows WHERE user_id = ? AND followed_user_id = ?`).get(userId, followedUserId)

  if (existing) {
    db.prepare(`DELETE FROM follows WHERE id = ?`).run(existing.id)
    return false
  }

  db.prepare(`INSERT INTO follows (user_id, followed_user_id, created_at) VALUES (?, ?, ?)`).run(userId, followedUserId, now())
  return true
}

export function listFollowedUsers(userId) {
  const rows = db.prepare(`
    SELECT
      f.followed_user_id,
      f.created_at AS followed_at,
      u.nickname,
      u.campus,
      u.student_no,
      u.tagline,
      u.avatar_color,
      EXISTS(
        SELECT 1
        FROM follows back
        WHERE back.user_id = f.followed_user_id AND back.followed_user_id = ?
      ) AS is_mutual,
      (
        SELECT COUNT(*)
        FROM listings l
        WHERE l.owner_id = f.followed_user_id AND l.status = 'active'
      ) AS active_listing_count,
      (
        SELECT COUNT(*)
        FROM listings l
        WHERE l.owner_id = f.followed_user_id AND l.status = 'active' AND l.type = 'supply'
      ) AS active_supply_count,
      (
        SELECT COUNT(*)
        FROM listings l
        WHERE l.owner_id = f.followed_user_id AND l.status = 'active' AND l.type = 'demand'
      ) AS active_demand_count,
      (
        SELECT l.id
        FROM listings l
        WHERE l.owner_id = f.followed_user_id AND l.status = 'active'
        ORDER BY l.updated_at DESC, l.id DESC
        LIMIT 1
      ) AS latest_listing_id,
      (
        SELECT l.title
        FROM listings l
        WHERE l.owner_id = f.followed_user_id AND l.status = 'active'
        ORDER BY l.updated_at DESC, l.id DESC
        LIMIT 1
      ) AS latest_listing_title,
      (
        SELECT l.image_url
        FROM listings l
        WHERE l.owner_id = f.followed_user_id AND l.status = 'active'
        ORDER BY l.updated_at DESC, l.id DESC
        LIMIT 1
      ) AS latest_listing_image_url,
      (
        SELECT l.updated_at
        FROM listings l
        WHERE l.owner_id = f.followed_user_id AND l.status = 'active'
        ORDER BY l.updated_at DESC, l.id DESC
        LIMIT 1
      ) AS latest_listing_updated_at
    FROM follows f
    JOIN users u ON u.id = f.followed_user_id
    WHERE f.user_id = ?
    ORDER BY f.created_at DESC, f.id DESC
  `).all(userId, userId)

  return rows.map(rowToFollowSummary)
}

export function recordHistory(userId, listingId) {
  db.prepare(`
    INSERT INTO history (user_id, listing_id, viewed_at)
    VALUES (?, ?, ?)
    ON CONFLICT(user_id, listing_id)
    DO UPDATE SET viewed_at = excluded.viewed_at
  `).run(userId, listingId, now())
}

export function listUsersPage(filters = {}) {
  const { page, pageSize, offset } = normalizePage(filters.page, filters.pageSize, 50)
  const clauses = []
  const values = []

  if (filters.keyword) {
    clauses.push(`(nickname LIKE ? OR student_no LIKE ? OR campus LIKE ?)`)
    values.push(`%${filters.keyword}%`, `%${filters.keyword}%`, `%${filters.keyword}%`)
  }

  if (filters.role && filters.role !== 'all') {
    clauses.push(`role = ?`)
    values.push(filters.role)
  }

  if (filters.status && filters.status !== 'all') {
    clauses.push(`status = ?`)
    values.push(filters.status)
  }

  const whereSql = clauses.length ? `WHERE ${clauses.join(' AND ')}` : ''
  const totalRow = db.prepare(`SELECT COUNT(*) AS total FROM users ${whereSql}`).get(...values)
  const rows = db.prepare(`
    SELECT * FROM users
    ${whereSql}
    ORDER BY created_at DESC
    LIMIT ? OFFSET ?
  `).all(...values, pageSize, offset)

  return buildPaginatedResult(rows.map(rowToUser), totalRow.total, page, pageSize)
}

export function createNotificationRecord(payload, adminId) {
  const createdAt = now()
  const result = db.prepare(`
    INSERT INTO notifications (title, content, type, audience, status, pinned, created_by, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    payload.title,
    payload.content,
    payload.type,
    payload.audience,
    payload.status,
    payload.pinned ? 1 : 0,
    adminId,
    createdAt,
    createdAt,
  )

  return getNotificationById(Number(result.lastInsertRowid))
}

export function updateNotificationRecord(notificationId, payload) {
  db.prepare(`
    UPDATE notifications
    SET title = ?, content = ?, type = ?, audience = ?, status = ?, pinned = ?, updated_at = ?
    WHERE id = ?
  `).run(
    payload.title,
    payload.content,
    payload.type,
    payload.audience,
    payload.status,
    payload.pinned ? 1 : 0,
    now(),
    notificationId,
  )

  return getNotificationById(notificationId)
}

export function deleteNotificationRecord(notificationId) {
  db.prepare(`DELETE FROM notifications WHERE id = ?`).run(notificationId)
}

export function getNotificationById(notificationId) {
  const row = db.prepare(`SELECT * FROM notifications WHERE id = ?`).get(notificationId)
  return rowToNotification(row)
}

export function listPublicNotifications(limit = 5) {
  const rows = db.prepare(`
    SELECT * FROM notifications
    WHERE status = 'active'
    ORDER BY pinned DESC, created_at DESC
    LIMIT ?
  `).all(limit)

  return rows.map(rowToNotification)
}

export function listNotificationsPage(filters = {}) {
  const { page, pageSize, offset } = normalizePage(filters.page, filters.pageSize, 50)
  const clauses = []
  const values = []

  if (filters.keyword) {
    clauses.push(`(title LIKE ? OR content LIKE ?)`)
    values.push(`%${filters.keyword}%`, `%${filters.keyword}%`)
  }

  if (filters.status && filters.status !== 'all') {
    clauses.push(`status = ?`)
    values.push(filters.status)
  }

  const whereSql = clauses.length ? `WHERE ${clauses.join(' AND ')}` : ''
  const totalRow = db.prepare(`SELECT COUNT(*) AS total FROM notifications ${whereSql}`).get(...values)
  const rows = db.prepare(`
    SELECT * FROM notifications
    ${whereSql}
    ORDER BY pinned DESC, updated_at DESC
    LIMIT ? OFFSET ?
  `).all(...values, pageSize, offset)

  return buildPaginatedResult(rows.map(rowToNotification), totalRow.total, page, pageSize)
}

export function getStorageSettings() {
  return readJsonSetting('storage_settings', {
    provider: 'local',
    oss: {
      region: '',
      bucket: '',
      accessKeyId: '',
      accessKeySecret: '',
      endpoint: '',
      secure: true,
      authorizationV4: true,
      cname: false,
      objectPrefix: 'campus-go',
    },
    lastSync: {
      direction: '',
      status: '',
      message: '',
      stats: {},
      at: '',
    },
    updatedAt: '',
  })
}

export function saveStorageSettings(settings) {
  const next = {
    ...getStorageSettings(),
    ...settings,
    oss: {
      ...getStorageSettings().oss,
      ...(settings.oss || {}),
    },
    updatedAt: now(),
  }
  writeJsonSetting('storage_settings', next)
  return getStorageSettings()
}

export function findConversationById(conversationId, viewerId) {
  const row = db.prepare(`
    ${conversationSelectSql(viewerId)}
    WHERE c.id = ? AND (c.buyer_id = ? OR c.seller_id = ?)
  `).get(conversationId, viewerId, viewerId)

  return rowToConversation(row, viewerId)
}

export function listConversationsForUser(userId) {
  const rows = db.prepare(`
    ${conversationSelectSql(userId)}
    WHERE c.buyer_id = ? OR c.seller_id = ?
    ORDER BY c.last_message_at DESC, c.updated_at DESC, c.id DESC
  `).all(userId, userId)

  return rows.map(row => rowToConversation(row, userId))
}

export function createConversationForListing(listingId, buyerId) {
  const listing = db.prepare(`
    SELECT id, owner_id, status
    FROM listings
    WHERE id = ?
  `).get(listingId)

  if (!listing) {
    throw new Error('未找到对应信息')
  }

  if (listing.owner_id === buyerId) {
    throw new Error('不能和自己的商品发起聊天')
  }

  if (listing.status !== 'active') {
    throw new Error('该商品已下架，暂时不能发起聊天')
  }

  const existing = db.prepare(`
    SELECT id
    FROM conversations
    WHERE listing_id = ? AND buyer_id = ? AND seller_id = ?
  `).get(listingId, buyerId, listing.owner_id)

  if (existing) {
    return existing.id
  }

  const createdAt = now()
  const result = db.prepare(`
    INSERT INTO conversations (listing_id, buyer_id, seller_id, created_at, updated_at, last_message_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(listingId, buyerId, listing.owner_id, createdAt, createdAt, createdAt)

  return Number(result.lastInsertRowid)
}

export function listConversationMessages(conversationId, viewerId, limit = 80) {
  const conversation = findConversationById(conversationId, viewerId)
  if (!conversation) {
    return null
  }

  const rows = db.prepare(`
    SELECT *
    FROM messages
    WHERE conversation_id = ?
    ORDER BY created_at ASC, id ASC
    LIMIT ?
  `).all(conversationId, Math.max(1, Math.min(200, Number(limit) || 80)))

  return {
    conversation,
    messages: rows.map(rowToMessage),
  }
}

export function createConversationMessage(conversationId, senderId, body, kind = 'text') {
  const createdAt = now()
  const result = db.prepare(`
    INSERT INTO messages (conversation_id, sender_id, body, kind, created_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(conversationId, senderId, body, kind, createdAt)

  db.prepare(`
    UPDATE conversations
    SET updated_at = ?, last_message_at = ?
    WHERE id = ?
  `).run(createdAt, createdAt, conversationId)

  return rowToMessage(db.prepare(`SELECT * FROM messages WHERE id = ?`).get(Number(result.lastInsertRowid)))
}

export function markConversationRead(conversationId, viewerId) {
  const timestamp = now()
  db.prepare(`
    UPDATE messages
    SET read_at = ?
    WHERE conversation_id = ? AND sender_id != ? AND read_at IS NULL
  `).run(timestamp, conversationId, viewerId)

  return timestamp
}

export function getAdminStats() {
  const row = db.prepare(`
    SELECT
      (SELECT COUNT(*) FROM users) AS user_count,
      (SELECT COUNT(*) FROM users WHERE role = 'admin') AS admin_count,
      (SELECT COUNT(*) FROM listings) AS listing_count,
      (SELECT COUNT(*) FROM listings WHERE status = 'active') AS active_listing_count,
      (SELECT COUNT(*) FROM listings WHERE type = 'supply' AND status = 'active') AS supply_count,
      (SELECT COUNT(*) FROM listings WHERE type = 'demand' AND status = 'active') AS demand_count,
      (SELECT COUNT(*) FROM notifications WHERE status = 'active') AS active_notification_count
  `).get()

  return {
    userCount: row.user_count,
    adminCount: row.admin_count,
    listingCount: row.listing_count,
    activeListingCount: row.active_listing_count,
    supplyCount: row.supply_count,
    demandCount: row.demand_count,
    activeNotificationCount: row.active_notification_count,
  }
}

function hasAnyUsers() {
  const row = db.prepare(`SELECT COUNT(*) AS count FROM users`).get()
  return row.count > 0
}

function ensureAdminAccount() {
  const row = db.prepare(`SELECT id FROM users WHERE role = 'admin' LIMIT 1`).get()
  if (row) {
    return
  }

  createUser({
    nickname: '系统管理员',
    campus: '校园购运营后台',
    studentNo: 'admin',
    tagline: '负责商品审核、用户管理与通知发布',
    password: 'admin123',
    role: 'admin',
    status: 'active',
  })
}

export function seedDatabase() {
  ensureAdminAccount()
}
