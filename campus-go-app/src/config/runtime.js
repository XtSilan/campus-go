const runtimeConfig = {
  protocol: 'http',
  host: '127.0.0.1',
  port: 4000,
  prefix: '/api',
}

export const requestTimeout = 12000

export const apiBaseUrl = `${runtimeConfig.protocol}://${runtimeConfig.host}:${runtimeConfig.port}${runtimeConfig.prefix}`
export const socketBaseUrl = `${runtimeConfig.protocol === 'https' ? 'wss' : 'ws'}://${runtimeConfig.host}:${runtimeConfig.port}/ws`

export default runtimeConfig
