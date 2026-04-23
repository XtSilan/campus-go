var fs = require('fs')
var path = require('path')

function parseEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return {}
  }

  var content = fs.readFileSync(filePath, 'utf8')
  var lines = content.split(/\r?\n/)
  var env = {}

  lines.forEach(function (line) {
    var trimmed = String(line || '').trim()
    if (!trimmed || trimmed.indexOf('#') === 0) {
      return
    }

    var equalIndex = trimmed.indexOf('=')
    if (equalIndex === -1) {
      return
    }

    var key = trimmed.slice(0, equalIndex).trim()
    var value = trimmed.slice(equalIndex + 1).trim()

    if ((value[0] === '"' && value[value.length - 1] === '"') || (value[0] === '\'' && value[value.length - 1] === '\'')) {
      value = value.slice(1, -1)
    }

    env[key] = value
  })

  return env
}

function joinUrl(origin, pathName) {
  var cleanOrigin = String(origin || '').replace(/\/+$/, '')
  var cleanPath = String(pathName || '').replace(/^\/?/, '/')
  return cleanOrigin + cleanPath
}

function buildOrigin(protocol, host, port) {
  var safeProtocol = protocol || 'http'
  var safeHost = host || '127.0.0.1'
  var safePort = String(port || '').trim()
  return safePort ? safeProtocol + '://' + safeHost + ':' + safePort : safeProtocol + '://' + safeHost
}

function stringifyEnv(rawEnv) {
  var env = rawEnv || {}
  var hasApiProtocol = Object.prototype.hasOwnProperty.call(env, 'API_PROTOCOL')
  var hasApiHost = Object.prototype.hasOwnProperty.call(env, 'API_HOST')
  var hasApiPort = Object.prototype.hasOwnProperty.call(env, 'API_PORT')
  var hasApiPrefix = Object.prototype.hasOwnProperty.call(env, 'API_PREFIX')
  var hasApiBaseUrl = Object.prototype.hasOwnProperty.call(env, 'API_BASE_URL')
  var hasAssetBaseUrl = Object.prototype.hasOwnProperty.call(env, 'ASSET_BASE_URL')

  var protocol = hasApiProtocol ? env.API_PROTOCOL : 'http'
  var host = hasApiHost ? env.API_HOST : '127.0.0.1'
  var port = hasApiPort ? env.API_PORT : '4000'
  var prefix = hasApiPrefix ? env.API_PREFIX : '/api'
  var origin = buildOrigin(protocol, host, port)
  var apiBaseUrl = hasApiBaseUrl ? env.API_BASE_URL : joinUrl(origin, prefix)
  var assetBaseUrl = hasAssetBaseUrl ? env.ASSET_BASE_URL : origin

  return {
    API_PROTOCOL: JSON.stringify(protocol),
    API_HOST: JSON.stringify(host),
    API_PORT: JSON.stringify(port),
    API_PREFIX: JSON.stringify(prefix),
    API_BASE_URL: JSON.stringify(apiBaseUrl),
    ASSET_BASE_URL: JSON.stringify(assetBaseUrl),
  }
}

function loadClientEnv(nodeEnv) {
  var envPath = path.resolve(__dirname, '../.env')
  var fileEnv = parseEnvFile(envPath)
  return Object.assign({
    NODE_ENV: JSON.stringify(nodeEnv),
  }, stringifyEnv(fileEnv))
}

module.exports = {
  loadClientEnv: loadClientEnv,
}
