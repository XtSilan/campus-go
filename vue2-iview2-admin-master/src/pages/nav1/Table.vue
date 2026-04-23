<template>
  <div>
    <Card>
      <div class="toolbar">
        <Input v-model="filters.keyword" placeholder="搜索标题、分类、发布人" style="width: 220px" />
        <Select v-model="filters.type" style="width: 140px">
          <Option value="all">全部类型</Option>
          <Option value="supply">供应</Option>
          <Option value="demand">求购</Option>
        </Select>
        <Select v-model="filters.status" style="width: 140px">
          <Option value="all">全部状态</Option>
          <Option value="active">上架中</Option>
          <Option value="archived">已下架</Option>
        </Select>
        <Button type="primary" @click="loadList">查询</Button>
        <Button @click="openModal()">新增商品</Button>
      </div>

      <Table :columns="columns" :data="rows" :loading="loading"></Table>
      <div class="pager">
        <Page
          :total="total"
          :current="page"
          :page-size="pageSize"
          show-total
          @on-change="handlePageChange"
        />
      </div>
    </Card>

    <Modal v-model="visible" :title="form.id ? '编辑商品' : '新增商品'" width="720" @on-ok="submitForm">
      <Form :model="form" :label-width="90">
        <Row :gutter="16">
          <i-col :span="12">
            <Form-item label="标题">
              <Input v-model="form.title" placeholder="请输入商品标题" />
            </Form-item>
          </i-col>
          <i-col :span="12">
            <Form-item label="分类">
              <Input v-model="form.category" placeholder="例如：书籍教材" />
            </Form-item>
          </i-col>
        </Row>
        <Row :gutter="16">
          <i-col :span="12">
            <Form-item label="类型">
              <Select v-model="form.type">
                <Option value="supply">供应</Option>
                <Option value="demand">求购</Option>
              </Select>
            </Form-item>
          </i-col>
          <i-col :span="12">
            <Form-item label="状态">
              <Select v-model="form.status">
                <Option value="active">上架中</Option>
                <Option value="archived">已下架</Option>
              </Select>
            </Form-item>
          </i-col>
        </Row>
        <Row :gutter="16">
          <i-col :span="12">
            <Form-item label="成色">
              <Input v-model="form.condition" placeholder="例如：九成新" />
            </Form-item>
          </i-col>
          <i-col :span="12">
            <Form-item label="价格/预算">
              <Input v-model="form.price" placeholder="为空则面议" />
            </Form-item>
          </i-col>
        </Row>
        <Form-item label="交接地点">
          <Input v-model="form.location" placeholder="例如：图书馆东门" />
        </Form-item>
        <Form-item label="联系方式">
          <Row :gutter="16">
            <i-col :span="8"><Input v-model="form.contactName" placeholder="联系人" /></i-col>
            <i-col :span="8"><Input v-model="form.phone" placeholder="手机号" /></i-col>
            <i-col :span="8"><Input v-model="form.wechat" placeholder="微信号" /></i-col>
          </Row>
        </Form-item>
        <Form-item label="QQ">
          <Input v-model="form.qq" placeholder="可选" />
        </Form-item>
        <Form-item label="封面链接">
          <div class="upload-row">
            <Button type="primary" :loading="uploading" @click="triggerImageSelect">
              {{ uploading ? '上传中...' : '上传图片' }}
            </Button>
            <span class="upload-tip">支持本地图片上传，也可以直接填写图片地址</span>
          </div>
          <input
            ref="imageInput"
            type="file"
            accept="image/png,image/jpeg,image/jpg,image/webp,image/gif"
            style="display: none;"
            @change="handleImageChange"
          />
          <Input v-model="form.imageUrl" style="margin-top: 12px;" placeholder="可选，网络图片地址" />
          <div v-if="previewImage" class="preview-panel">
            <img :src="previewImage" alt="preview" class="preview-image">
          </div>
        </Form-item>
        <Form-item label="描述">
          <Input v-model="form.description" type="textarea" :rows="4" placeholder="请输入商品描述" />
        </Form-item>
      </Form>
    </Modal>
  </div>
</template>

<script>
import { createAdminListing, deleteAdminListing, fetchAdminListings, updateAdminListing, uploadAdminImage } from '../../api'

const assetBase = process.env.ASSET_BASE_URL || ''

function createDefaultForm() {
  return {
    id: null,
    type: 'supply',
    title: '',
    category: '',
    condition: '',
    description: '',
    price: '',
    imageUrl: '',
    location: '',
    contactName: '',
    phone: '',
    wechat: '',
    qq: '',
    status: 'active',
  }
}

export default {
  data() {
    return {
      loading: false,
      uploading: false,
      visible: false,
      page: 1,
      pageSize: 10,
      total: 0,
      filters: {
        keyword: '',
        type: 'all',
        status: 'all',
      },
      rows: [],
      form: createDefaultForm(),
      columns: [
        {
          title: '封面',
          key: 'imageUrl',
          width: 90,
          render: (h, params) => {
            if (!params.row.imageUrl) {
              return h('span', '-')
            }
            return h('img', {
              attrs: {
                src: this.resolveAssetUrl(params.row.imageUrl),
                alt: params.row.title,
              },
              style: {
                width: '48px',
                height: '48px',
                objectFit: 'cover',
                borderRadius: '10px',
                border: '1px solid #ebeef5',
              },
            })
          },
        },
        { title: '标题', key: 'title', minWidth: 180 },
        { title: '分类', key: 'category', width: 110 },
        { title: '类型', key: 'type', width: 90 },
        { title: '价格/预算', key: 'price', width: 110, render: (h, params) => h('span', params.row.price === null ? '面议' : `¥${params.row.price}`) },
        { title: '发布人', key: 'ownerNickname', width: 120 },
        { title: '状态', key: 'status', width: 100 },
        {
          title: '操作',
          key: 'action',
          width: 220,
          render: (h, params) => {
            return h('div', [
              h('Button', {
                props: { size: 'small', type: 'primary' },
                style: { marginRight: '8px' },
                on: { click: () => this.openModal(params.row) },
              }, '编辑'),
              h('Button', {
                props: { size: 'small' },
                style: { marginRight: '8px' },
                on: { click: () => this.toggleStatus(params.row) },
              }, params.row.status === 'active' ? '下架' : '上架'),
              h('Button', {
                props: { size: 'small', type: 'error' },
                on: { click: () => this.removeRow(params.row) },
              }, '删除'),
            ])
          },
        },
      ],
    }
  },
  computed: {
    previewImage() {
      if (!this.form.imageUrl) {
        return ''
      }
      return this.resolveAssetUrl(this.form.imageUrl)
    },
  },
  async mounted() {
    await this.loadList()
  },
  methods: {
    resolveAssetUrl(value) {
      if (!value) {
        return ''
      }
      if (/^(https?:)?\/\//.test(value) || value.startsWith('data:')) {
        return value
      }
      return `${assetBase}${value.startsWith('/') ? value : `/${value}`}`
    },
    normalizePayload() {
      return {
        type: this.form.type,
        title: this.form.title.trim(),
        category: this.form.category.trim(),
        condition: this.form.condition.trim(),
        description: this.form.description.trim(),
        price: this.form.price === '' ? null : Number(this.form.price),
        imageUrl: this.form.imageUrl.trim(),
        location: this.form.location.trim(),
        contactName: this.form.contactName.trim(),
        phone: this.form.phone.trim(),
        wechat: this.form.wechat.trim(),
        qq: this.form.qq.trim(),
        status: this.form.status,
      }
    },
    async loadList() {
      this.loading = true
      try {
        const result = await fetchAdminListings({
          page: this.page,
          pageSize: this.pageSize,
          keyword: this.filters.keyword,
          type: this.filters.type,
          status: this.filters.status,
        })
        this.rows = result.data.items
        this.total = result.data.total
      } catch (error) {
        this.$Message.error(error.message)
      } finally {
        this.loading = false
      }
    },
    handlePageChange(page) {
      this.page = page
      this.loadList()
    },
    openModal(row) {
      this.form = row ? { ...row } : createDefaultForm()
      this.visible = true
    },
    triggerImageSelect() {
      if (this.$refs.imageInput) {
        this.$refs.imageInput.click()
      }
    },
    readFile(file) {
      return new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(String(reader.result || ''))
        reader.onerror = () => reject(new Error('读取图片失败'))
        reader.readAsDataURL(file)
      })
    },
    async handleImageChange(event) {
      const file = event.target && event.target.files && event.target.files[0]
      if (!file) {
        return
      }

      if (!/^image\//i.test(file.type || '')) {
        this.$Message.warning('请选择图片文件')
        event.target.value = ''
        return
      }

      this.uploading = true
      try {
        const content = await this.readFile(file)
        const uploaded = await uploadAdminImage({
          fileName: file.name,
          content,
        })
        this.form.imageUrl = uploaded.data.path || ''
        this.$Message.success('图片上传成功')
      } catch (error) {
        this.$Message.error(error.message)
      } finally {
        this.uploading = false
        if (event.target) {
          event.target.value = ''
        }
      }
    },
    async submitForm() {
      try {
        const payload = this.normalizePayload()
        if (this.form.id) {
          await updateAdminListing(this.form.id, payload)
          this.$Message.success('商品更新成功')
        } else {
          await createAdminListing(payload)
          this.$Message.success('商品创建成功')
        }
        this.visible = false
        this.loadList()
      } catch (error) {
        this.$Message.error(error.message)
      }
    },
    async toggleStatus(row) {
      try {
        await updateAdminListing(row.id, {
          ...row,
          status: row.status === 'active' ? 'archived' : 'active',
        })
        this.$Message.success('状态已更新')
        this.loadList()
      } catch (error) {
        this.$Message.error(error.message)
      }
    },
    async removeRow(row) {
      this.$Modal.confirm({
        title: '确认删除商品',
        content: `确认删除“${row.title}”吗？删除后该商品会被下架。`,
        onOk: async () => {
          try {
            await deleteAdminListing(row.id)
            this.$Message.success('商品已下架')
            this.loadList()
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
  display: flex;
  gap: 12px;
  margin-bottom: 16px;
}

.pager {
  display: flex;
  justify-content: flex-end;
  margin-top: 16px;
}

.upload-row {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.upload-tip {
  color: #666;
}

.preview-panel {
  margin-top: 12px;
  padding: 12px;
  background: #f8fafc;
  border-radius: 6px;
}

.preview-image {
  display: block;
  max-width: 220px;
  width: 100%;
  border-radius: 12px;
}
</style>
