import { resolve } from 'node:path'

export const config = {
  host: process.env.API_HOST || '0.0.0.0',
  port: Number(process.env.API_PORT || 4000),
  corsOrigin: process.env.CORS_ORIGIN || '*',
  tokenTtlHours: Number(process.env.TOKEN_TTL_HOURS || 168),
  jsonBodyLimit: process.env.JSON_BODY_LIMIT || '20mb',
  imageMaxEdge: Number(process.env.IMAGE_MAX_EDGE || 1920),
  imageJpegQuality: Number(process.env.IMAGE_JPEG_QUALITY || 82),
  imageWebpQuality: Number(process.env.IMAGE_WEBP_QUALITY || 82),
  dbPath: resolve(process.cwd(), process.env.DB_PATH || './data/campus-go.sqlite'),
  uploadDir: resolve(process.cwd(), process.env.UPLOAD_DIR || './data/uploads'),
}
