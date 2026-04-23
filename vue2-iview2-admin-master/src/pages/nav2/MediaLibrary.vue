<template>
  <div class="media-library">
    <div class="toolbar">
      <Input v-model="keyword" placeholder="搜索文件名或路径" style="width: 260px;" @on-enter="loadList" />
      <Button @click="loadList">查询</Button>
      <Button :loading="uploading" type="primary" @click="triggerUpload">{{ uploading ? '上传中...' : '上传文件' }}</Button>
      <input ref="fileInput" type="file" style="display: none;" @change="handleUpload" />
      <span class="toolbar-tip">支持本地 / OSS 当前存储驱动统一管理</span>
    </div>

    <Table border :columns="columns" :data="files" :loading="loading"></Table>

    <Modal v-model="previewVisible" :title="previewTitle" :footer-hide="true" width="820">
      <div class="preview-wrap">
        <img v-if="previewType === 'image'" :src="previewUrl" alt="" class="preview-image" />
        <iframe v-else-if="previewType === 'pdf'" :src="previewUrl" class="preview-frame"></iframe>
        <div v-else class="preview-fallback">
          <p>该文件暂不支持内嵌预览。</p>
          <a :href="previewUrl" target="_blank" rel="noopener noreferrer">点击新窗口打开</a>
        </div>
      </div>
    </Modal>
  </div>
</template>

<script>
import {
  fetchAdminMediaLibraryFiles,
  fetchAdminMediaLibraryDirectUrl,
  uploadAdminMediaLibraryFile,
  renameAdminMediaLibraryFile,
  deleteAdminMediaLibraryFile,
} from '../../api'

function formatFileSize(size) {
  const value = Number(size || 0)
  if (!value) return '0 B'
  if (value < 1024) return `${value} B`
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`
  if (value < 1024 * 1024 * 1024) return `${(value / (1024 * 1024)).toFixed(1)} MB`
  return `${(value / (1024 * 1024 * 1024)).toFixed(1)} GB`
}

export default {
  data() {
    return {
      loading: false,
      uploading: false,
      keyword: '',
      files: [],
      previewVisible: false,
      previewUrl: '',
      previewType: '',
      previewTitle: '',
      columns: [
        {
          title: '预览',
          minWidth: 120,
          render: (h, params) => {
            const row = params.row || {}
            if (row.isImage) {
              return h(
                'a',
                {
                  attrs: { href: 'javascript:;' },
                  on: { click: () => this.openPreview(row) },
                },
                [
                  h('img', {
                    attrs: { src: row.url, alt: row.name || 'image' },
                    style: {
                      width: '80px',
                      height: '52px',
                      objectFit: 'cover',
                      borderRadius: '4px',
                      background: '#f4f4f4',
                    },
                  }),
                ],
              )
            }
            return h(
              'a',
              {
                attrs: { href: 'javascript:;' },
                on: { click: () => this.openPreview(row) },
              },
              [h('Tag', { props: { color: 'blue' } }, row.mimeType || '文件')],
            )
          },
        },
        { title: '文件名', key: 'name', minWidth: 180 },
        { title: '路径', key: 'path', minWidth: 260 },
        {
          title: '大小',
          key: 'size',
          width: 120,
          render: (h, params) => h('span', formatFileSize(params.row.size)),
        },
        { title: '类型', key: 'mimeType', minWidth: 170 },
        {
          title: '更新时间',
          key: 'updatedAt',
          minWidth: 170,
          render: (h, params) => {
            const text = params.row.updatedAt ? new Date(params.row.updatedAt).toLocaleString() : '-'
            return h('span', text)
          },
        },
        {
          title: '操作',
          minWidth: 240,
          render: (h, params) =>
            h('div', [
              h(
                'Button',
                {
                  props: { size: 'small' },
                  on: { click: () => this.copyUrl(params.row) },
                },
                '复制链接',
              ),
              h(
                'Button',
                {
                  props: { size: 'small' },
                  style: { marginLeft: '8px' },
                  on: { click: () => this.renameFile(params.row) },
                },
                '重命名',
              ),
              h(
                'Button',
                {
                  props: { size: 'small', type: 'error' },
                  style: { marginLeft: '8px' },
                  on: { click: () => this.removeFile(params.row) },
                },
                '删除',
              ),
            ]),
        },
      ],
    }
  },
  mounted() {
    this.loadList()
  },
  methods: {
    async loadList() {
      this.loading = true
      try {
        const result = await fetchAdminMediaLibraryFiles({ keyword: this.keyword })
        this.files = result.data.list || []
      } catch (error) {
        this.$Message.error(error.message)
      } finally {
        this.loading = false
      }
    },
    triggerUpload() {
      if (this.$refs.fileInput) {
        this.$refs.fileInput.click()
      }
    },
    readFile(file) {
      return new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(String(reader.result || ''))
        reader.onerror = () => reject(new Error('读取文件失败'))
        reader.readAsDataURL(file)
      })
    },
    async handleUpload(event) {
      const file = event.target && event.target.files ? event.target.files[0] : null
      if (!file) {
        return
      }
      this.uploading = true
      try {
        const content = await this.readFile(file)
        await uploadAdminMediaLibraryFile({
          fileName: file.name,
          content,
        })
        this.$Message.success('上传成功')
        await this.loadList()
      } catch (error) {
        this.$Message.error(error.message)
      } finally {
        this.uploading = false
        if (event.target) {
          event.target.value = ''
        }
      }
    },
    async copyUrl(row) {
      let url = row && row.url ? row.url : ''
      if (row && row.path) {
        try {
          const result = await fetchAdminMediaLibraryDirectUrl({ path: row.path })
          if (result.data && result.data.url) {
            url = result.data.url
          }
        } catch (_error) {
          // Keep fallback URL.
        }
      }
      if (!url) {
        this.$Message.warning('文件地址不可用')
        return
      }
      if (navigator && navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(url).then(() => {
          this.$Message.success('已复制链接')
        }).catch(() => this.fallbackCopy(url))
        return
      }
      this.fallbackCopy(url)
    },
    fallbackCopy(text) {
      const input = document.createElement('textarea')
      input.value = text
      document.body.appendChild(input)
      input.select()
      document.execCommand('copy')
      document.body.removeChild(input)
      this.$Message.success('已复制链接')
    },
    openPreview(row) {
      const url = row && row.url ? row.url : ''
      if (!url) {
        this.$Message.warning('预览地址不可用')
        return
      }
      const mime = String((row && row.mimeType) || '').toLowerCase()
      let type = 'other'
      if (row && row.isImage) {
        type = 'image'
      } else if (mime.indexOf('application/pdf') === 0 || /\.pdf$/i.test(String(row && row.name))) {
        type = 'pdf'
      }
      this.previewTitle = row && row.name ? row.name : '文件预览'
      this.previewUrl = url
      this.previewType = type
      this.previewVisible = true
    },
    async renameFile(row) {
      const currentName = row && row.name ? row.name : ''
      const nextName = window.prompt('请输入新文件名（包含后缀）', currentName)
      if (!nextName || nextName === currentName) {
        return
      }
      try {
        await renameAdminMediaLibraryFile({
          path: row.path,
          newName: nextName,
        })
        this.$Message.success('重命名成功')
        await this.loadList()
      } catch (error) {
        this.$Message.error(error.message)
      }
    },
    removeFile(row) {
      this.$Modal.confirm({
        title: '删除文件',
        content: `确定删除文件“${row.name}”吗？已引用该文件的商品图片路径也会一并清理。`,
        onOk: async () => {
          try {
            await deleteAdminMediaLibraryFile({ path: row.path })
            this.$Message.success('删除成功')
            await this.loadList()
          } catch (error) {
            this.$Message.error(error.message)
          }
        },
      })
    },
  },
}
</script>

<style scoped>
.toolbar {
  margin-bottom: 12px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.toolbar-tip {
  margin-left: 8px;
  color: #888;
  font-size: 12px;
}

.preview-wrap {
  min-height: 360px;
}

.preview-image {
  width: 100%;
  max-height: 70vh;
  object-fit: contain;
  display: block;
  background: #f8f8f8;
}

.preview-frame {
  width: 100%;
  height: 70vh;
  border: 0;
}

.preview-fallback {
  padding: 24px;
}
</style>
