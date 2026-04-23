<template>
  <div>
    <Alert show-icon style="margin-bottom: 16px;">
      对象存储切换
      <template slot="desc">
        这里统一配置阿里云 OSS，并提供转入 OSS、切回本地两个入口。切换时会同步文件并批量改写数据库中的资源路径，且带二次确认。
      </template>
    </Alert>

    <Card title="当前状态" style="margin-bottom: 16px;">
      <p>
        <Tag :color="settings.provider === 'oss' ? 'green' : 'blue'">
          {{ settings.provider === 'oss' ? '当前使用 OSS' : '当前使用本地存储' }}
        </Tag>
      </p>
      <p style="margin-top: 12px;">Bucket：{{ settings.oss.bucket || '-' }}</p>
      <p style="margin-top: 8px;">Region：{{ settings.oss.region || '-' }}</p>
      <p style="margin-top: 8px;">对象前缀：{{ settings.oss.objectPrefix || '(空)' }}</p>
      <p style="margin-top: 8px;">最后同步：{{ lastSyncText }}</p>
      <p v-if="settings.lastSync && settings.lastSync.message" style="margin-top: 8px; color: #666;">
        {{ settings.lastSync.message }}
      </p>
    </Card>

    <Card title="OSS 配置">
      <Collapse simple>
        <Panel name="guide">
          填写说明
          <div slot="content" class="guide-panel">
            <p><strong>Region</strong>：推荐填写 `oss-cn-hangzhou` 这种完整格式。</p>
            <p><strong>Endpoint</strong>：留空时走默认官方地域节点；如果填写自定义域名，请勾选下面的 CNAME。</p>
            <p><strong>CNAME</strong>：只用于对外访问地址；后台会自动避免直接拿自定义域名做 SDK 上传，减少证书和签名报错。</p>
            <p><strong>测试说明</strong>：测试 OSS 会上传、读取再删除一个临时对象，所以控制台里通常看不到保留文件。</p>
          </div>
        </Panel>
      </Collapse>

      <Form :label-width="130" style="margin-top: 16px;">
        <FormItem label="存储驱动">
          <Tag color="blue">local</Tag>
          <Tag color="green">oss</Tag>
          <span style="margin-left: 8px; color: #666;">切换不会直接删除原文件，但新上传和媒体库会按当前驱动工作。</span>
        </FormItem>

        <FormItem label="Region">
          <Input v-model="form.oss.region" placeholder="例如：oss-cn-hangzhou 或 cn-hangzhou" />
        </FormItem>

        <FormItem label="Bucket">
          <Input v-model="form.oss.bucket" placeholder="Bucket 名称" />
        </FormItem>

        <FormItem label="AccessKeyId">
          <Input v-model="form.oss.accessKeyId" placeholder="RAM 用户 AccessKeyId" />
        </FormItem>

        <FormItem label="AccessKeySecret">
          <Input v-model="form.oss.accessKeySecret" type="password" placeholder="留空则保留已保存的密钥" />
          <div v-if="settings.oss.accessKeySecretMasked" class="field-hint">
            当前已保存：{{ settings.oss.accessKeySecretMasked }}
          </div>
        </FormItem>

        <FormItem label="Endpoint">
          <Input v-model="form.oss.endpoint" placeholder="可选：官方 Endpoint / 自定义域名" />
          <div class="field-hint">
            例如官方节点 `https://oss-cn-hangzhou.aliyuncs.com`，或自定义域名 `https://static.huoda.xyz`。
          </div>
        </FormItem>

        <FormItem label="对象前缀">
          <Input v-model="form.oss.objectPrefix" placeholder="例如：campus-go" />
        </FormItem>

        <FormItem label="高级选项">
          <Checkbox v-model="form.oss.secure">启用 HTTPS</Checkbox>
          <Checkbox v-model="form.oss.authorizationV4" style="margin-left: 16px;">启用 V4 签名</Checkbox>
          <Checkbox v-model="form.oss.cname" style="margin-left: 16px;">Endpoint 为 CNAME / 自定义域名</Checkbox>
        </FormItem>

        <FormItem>
          <Button type="primary" :loading="saving" @click="saveSettings">保存配置</Button>
          <Button style="margin-left: 8px;" :loading="validating" @click="validateSettings">测试 OSS</Button>
          <Button style="margin-left: 8px;" @click="loadData">重新加载</Button>
        </FormItem>
      </Form>
    </Card>

    <Card v-if="task" title="切换进度" style="margin-top: 16px;">
      <p>
        <Tag :color="task.status === 'success' ? 'green' : task.status === 'failed' ? 'red' : 'blue'">
          {{ taskStatusText }}
        </Tag>
      </p>
      <p style="margin-top: 10px;">目标：{{ task.target === 'oss' ? '转入 OSS' : '切回本地' }}</p>
      <p style="margin-top: 8px;">阶段：{{ taskStageText }}</p>
      <p v-if="task.currentItem" style="margin-top: 8px; word-break: break-all;">当前对象：{{ task.currentItem }}</p>
      <p style="margin-top: 8px;">进度：{{ task.current || 0 }} / {{ task.total || 0 }}</p>
      <Progress :percent="task.percent || 0" :status="task.status === 'failed' ? 'wrong' : task.status === 'success' ? 'success' : 'active'" style="margin-top: 12px;" />
      <Alert v-if="task.errorMessage" type="error" show-icon style="margin-top: 16px;">
        {{ task.errorMessage }}
      </Alert>
      <div v-if="task.logs && task.logs.length" class="log-panel">
        <div class="log-title">切换日志</div>
        <div class="log-list">
          <div v-for="(item, index) in task.logs" :key="`${item.time}-${index}`" class="log-item">
            <span class="log-time">{{ item.time }}</span>
            <Tag :color="item.level === 'error' ? 'red' : 'blue'">{{ item.level || 'info' }}</Tag>
            <span class="log-message">{{ item.message }}</span>
          </div>
        </div>
      </div>
    </Card>

    <Card title="切换操作" style="margin-top: 16px;">
      <Alert type="warning" show-icon>
        转入 OSS 会把本地 uploads 文件上传到 OSS，并批量把数据库里的图片路径切到 OSS 地址。
        <template slot="desc">
          切回本地会从 OSS 下载资源到 `server/data/uploads/`，并把图片路径改回本地 `/uploads/...`。
        </template>
      </Alert>

      <div style="margin-top: 16px;">
        <Button type="success" :loading="switching === 'oss'" :disabled="isTaskRunning && switching !== 'oss'" @click="openConfirmDialog('oss')">一键转入 OSS</Button>
        <Button style="margin-left: 8px;" :loading="switching === 'local'" :disabled="isTaskRunning && switching !== 'local'" @click="openConfirmDialog('local')">切回本地</Button>
      </div>
    </Card>

    <Modal v-model="confirmDialog.visible" :title="confirmDialog.title" :mask-closable="false">
      <p>{{ confirmDialog.content }}</p>
      <p style="margin-top: 12px; color: #666;">请输入 <strong>{{ confirmKeyword }}</strong> 进行二次确认。</p>
      <Input
        v-model="confirmDialog.input"
        style="margin-top: 12px;"
        :placeholder="`请输入：${confirmKeyword}`"
        @on-enter="submitSwitchConfirm"
      />
      <div slot="footer">
        <Button @click="resetConfirmDialog">取消</Button>
        <Button type="error" :loading="confirmDialog.submitting" @click="submitSwitchConfirm">确认切换</Button>
      </div>
    </Modal>
  </div>
</template>

<script>
import {
  fetchAdminStorageSettings,
  updateAdminStorageSettings,
  validateAdminStorageSettings,
  switchAdminStorageProvider,
  fetchAdminStorageSwitchProgress,
} from '../../api'

const CONFIRM_KEYWORD = '我同意'

function createEmptySettings() {
  return {
    provider: 'local',
    oss: {
      region: '',
      bucket: '',
      accessKeyId: '',
      accessKeySecret: '',
      accessKeySecretMasked: '',
      endpoint: '',
      cname: false,
      secure: true,
      authorizationV4: true,
      objectPrefix: 'campus-go',
    },
    lastSync: {
      direction: '',
      status: '',
      message: '',
      stats: {},
      at: '',
    },
  }
}

function createEmptyConfirmDialog() {
  return {
    visible: false,
    title: '',
    content: '',
    target: '',
    input: '',
    submitting: false,
  }
}

function formatDateTime(value) {
  if (!value) {
    return '暂无'
  }
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value
  }
  const pad = item => `${item}`.padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
}

export default {
  data() {
    return {
      saving: false,
      validating: false,
      switching: '',
      pollTimer: null,
      confirmKeyword: CONFIRM_KEYWORD,
      confirmDialog: createEmptyConfirmDialog(),
      settings: createEmptySettings(),
      form: createEmptySettings(),
      task: null,
    }
  },
  computed: {
    lastSyncText() {
      const lastSync = this.settings.lastSync || {}
      if (!lastSync.at) {
        return '暂无记录'
      }
      return `${formatDateTime(lastSync.at)}${lastSync.status ? ` (${lastSync.status})` : ''}`
    },
    isTaskRunning() {
      return Boolean(this.task && this.task.status === 'running')
    },
    taskStatusText() {
      if (!this.task) {
        return ''
      }
      if (this.task.status === 'success') {
        return '已完成'
      }
      if (this.task.status === 'failed') {
        return '失败'
      }
      return '执行中'
    },
    taskStageText() {
      const map = {
        preparing: '准备中',
        listing: '列举 OSS 对象',
        uploading: '上传文件到 OSS',
        downloading: '从 OSS 下载文件',
        migrating: '改写数据库路径',
        completed: '已完成',
      }
      return this.task ? (map[this.task.stage] || this.task.stage || '-') : '-'
    },
  },
  mounted() {
    this.loadData()
    this.fetchSwitchProgress(true)
  },
  beforeDestroy() {
    this.stopPolling()
  },
  methods: {
    async loadData() {
      try {
        const result = await fetchAdminStorageSettings()
        const next = {
          ...createEmptySettings(),
          ...(result.data.settings || {}),
          oss: {
            ...createEmptySettings().oss,
            ...(((result.data.settings || {}).oss) || {}),
          },
          lastSync: {
            ...createEmptySettings().lastSync,
            ...(((result.data.settings || {}).lastSync) || {}),
          },
        }
        this.settings = next
        this.form = {
          ...next,
          oss: {
            ...next.oss,
            accessKeySecret: '',
          },
        }
      } catch (error) {
        this.$Message.error(error.message)
      }
    },
    async fetchSwitchProgress(silent) {
      try {
        const result = await fetchAdminStorageSwitchProgress()
        this.task = result.data.task || null
        if (this.task && this.task.status === 'running') {
          this.switching = this.task.target || ''
          this.startPolling()
          return
        }
        this.switching = ''
        this.stopPolling()
        if (result.data.settings) {
          this.settings = {
            ...createEmptySettings(),
            ...(result.data.settings || {}),
            oss: {
              ...createEmptySettings().oss,
              ...(((result.data.settings || {}).oss) || {}),
            },
            lastSync: {
              ...createEmptySettings().lastSync,
              ...(((result.data.settings || {}).lastSync) || {}),
            },
          }
        }
      } catch (error) {
        if (!silent) {
          this.$Message.error(error.message)
        }
      }
    },
    startPolling() {
      if (this.pollTimer) {
        return
      }
      this.pollTimer = setInterval(() => {
        this.fetchSwitchProgress(true)
      }, 1000)
    },
    stopPolling() {
      if (!this.pollTimer) {
        return
      }
      clearInterval(this.pollTimer)
      this.pollTimer = null
    },
    async saveSettings() {
      this.saving = true
      try {
        await updateAdminStorageSettings({
          provider: this.settings.provider,
          oss: { ...this.form.oss },
        })
        this.$Message.success('存储配置已保存')
        await this.loadData()
      } catch (error) {
        this.$Message.error(error.message)
      } finally {
        this.saving = false
      }
    },
    async validateSettings() {
      this.validating = true
      try {
        const result = await validateAdminStorageSettings({
          provider: 'oss',
          oss: { ...this.form.oss },
        })
        const detail = result.data.result || {}
        const signatureText = detail.usedCompatibilitySignature
          ? '已自动回退到兼容签名，建议关闭「启用 V4 签名」后重新保存'
          : (detail.authorizationV4 === false ? '当前使用兼容签名' : '当前使用 V4 签名')
        this.$Modal.success({
          title: 'OSS 测试通过',
          content: `Bucket：${detail.bucket || '-'}<br>Region：${detail.region || '-'}<br>测试对象：${detail.sampleObject || '-'}<br>签名模式：${signatureText}`,
        })
      } catch (error) {
        this.$Message.error(error.message)
      } finally {
        this.validating = false
      }
    },
    openConfirmDialog(target) {
      const title = target === 'oss' ? '确认转入 OSS' : '确认切回本地'
      const content = target === 'oss'
        ? '即将把本地 uploads 文件上传到 OSS，并批量把数据库里的商品图片地址改到 OSS。'
        : '即将从 OSS 下载资源到本地，并把商品图片地址改回 /uploads/...。'

      this.confirmDialog = {
        visible: true,
        title,
        content,
        target,
        input: '',
        submitting: false,
      }
    },
    resetConfirmDialog() {
      if (this.confirmDialog.submitting) {
        return
      }
      this.confirmDialog = createEmptyConfirmDialog()
    },
    async submitSwitchConfirm() {
      if (this.confirmDialog.submitting) {
        return
      }
      const confirmText = String(this.confirmDialog.input || '').trim()
      if (confirmText !== this.confirmKeyword) {
        this.$Message.error(`请输入“${this.confirmKeyword}”后再执行切换`)
        return
      }
      this.confirmDialog.submitting = true
      const started = await this.switchProvider(this.confirmDialog.target, confirmText)
      if (started) {
        this.confirmDialog = createEmptyConfirmDialog()
      } else {
        this.confirmDialog.submitting = false
      }
    },
    async switchProvider(target, confirmText) {
      this.switching = target
      try {
        const result = await switchAdminStorageProvider({ target, confirmText })
        if (result.data.task) {
          this.task = result.data.task
        }
        if (result.data.result && result.data.result.started === false) {
          this.$Message.warning('已有存储切换任务正在执行')
        } else {
          this.$Message.success(target === 'oss' ? '已开始转入 OSS' : '已开始切回本地')
        }
        this.startPolling()
        return true
      } catch (error) {
        this.switching = ''
        this.$Message.error(error.message)
        return false
      } finally {
        this.confirmDialog.submitting = false
      }
    },
  },
}
</script>

<style scoped>
.field-hint {
  margin-top: 6px;
  color: #999;
  line-height: 1.7;
}

.guide-panel p {
  margin: 0 0 10px;
  line-height: 1.8;
  color: #555;
}

.guide-panel p:last-child {
  margin-bottom: 0;
}

.log-panel {
  margin-top: 16px;
}

.log-title {
  margin-bottom: 8px;
  font-weight: 600;
  color: #333;
}

.log-list {
  max-height: 260px;
  overflow: auto;
  padding: 10px 12px;
  background: #f7f9fc;
  border: 1px solid #e8eaec;
  border-radius: 6px;
}

.log-item + .log-item {
  margin-top: 8px;
}

.log-time {
  display: inline-block;
  width: 160px;
  color: #999;
  font-size: 12px;
}

.log-message {
  margin-left: 8px;
  color: #444;
  word-break: break-all;
}
</style>
