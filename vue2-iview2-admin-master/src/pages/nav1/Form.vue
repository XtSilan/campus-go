<template>
  <div>
    <Card>
      <div class="toolbar">
        <Input v-model="filters.keyword" placeholder="搜索通知标题或内容" style="width: 240px" />
        <Select v-model="filters.status" style="width: 160px">
          <Option value="all">全部状态</Option>
          <Option value="active">已发布</Option>
          <Option value="draft">草稿</Option>
          <Option value="archived">已归档</Option>
        </Select>
        <Button type="primary" @click="loadList">查询</Button>
        <Button @click="openModal()">新增通知</Button>
      </div>

      <Table :columns="columns" :data="rows" :loading="loading" />
      <div class="pager">
        <Page :total="total" :current="page" :page-size="pageSize" show-total @on-change="handlePageChange" />
      </div>
    </Card>

    <Modal v-model="visible" :title="form.id ? '编辑通知' : '新增通知'" width="680" @on-ok="submitForm">
      <Form :model="form" :label-width="90">
        <Form-item label="标题">
          <Input v-model="form.title" placeholder="请输入通知标题" />
        </Form-item>
        <Row :gutter="16">
          <i-col :span="8">
            <Form-item label="类型">
              <Select v-model="form.type">
                <Option value="info">普通</Option>
                <Option value="warning">提醒</Option>
                <Option value="success">推荐</Option>
                <Option value="alert">警告</Option>
              </Select>
            </Form-item>
          </i-col>
          <i-col :span="8">
            <Form-item label="面向对象">
              <Select v-model="form.audience">
                <Option value="all">全部用户</Option>
                <Option value="buyers">买家</Option>
                <Option value="sellers">卖家</Option>
              </Select>
            </Form-item>
          </i-col>
          <i-col :span="8">
            <Form-item label="状态">
              <Select v-model="form.status">
                <Option value="active">已发布</Option>
                <Option value="draft">草稿</Option>
                <Option value="archived">已归档</Option>
              </Select>
            </Form-item>
          </i-col>
        </Row>
        <Form-item label="置顶">
          <i-switch v-model="form.pinned"></i-switch>
        </Form-item>
        <Form-item label="内容">
          <Input v-model="form.content" type="textarea" :rows="5" placeholder="请输入通知内容" />
        </Form-item>
      </Form>
    </Modal>
  </div>
</template>

<script>
import {
  createAdminNotification,
  deleteAdminNotification,
  fetchAdminNotifications,
  updateAdminNotification,
} from '../../api'

function createDefaultForm() {
  return {
    id: null,
    title: '',
    content: '',
    type: 'info',
    audience: 'all',
    status: 'active',
    pinned: false,
  }
}

export default {
  data() {
    return {
      loading: false,
      visible: false,
      page: 1,
      pageSize: 10,
      total: 0,
      filters: {
        keyword: '',
        status: 'all',
      },
      rows: [],
      form: createDefaultForm(),
      columns: [
        { title: '标题', key: 'title', minWidth: 160 },
        { title: '类型', key: 'type', width: 90 },
        { title: '对象', key: 'audience', width: 100 },
        { title: '状态', key: 'status', width: 100 },
        { title: '置顶', key: 'pinned', width: 80, render: (h, params) => h('span', params.row.pinned ? '是' : '否') },
        {
          title: '操作',
          key: 'action',
          width: 180,
          render: (h, params) => h('div', [
            h('Button', {
              props: { size: 'small', type: 'primary' },
              style: { marginRight: '8px' },
              on: { click: () => this.openModal(params.row) },
            }, '编辑'),
            h('Button', {
              props: { size: 'small', type: 'error' },
              on: { click: () => this.removeRow(params.row) },
            }, '删除'),
          ]),
        },
      ],
    }
  },
  async mounted() {
    await this.loadList()
  },
  methods: {
    async loadList() {
      this.loading = true
      try {
        const result = await fetchAdminNotifications({
          page: this.page,
          pageSize: this.pageSize,
          keyword: this.filters.keyword,
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
    async submitForm() {
      try {
        const payload = { ...this.form }
        if (this.form.id) {
          await updateAdminNotification(this.form.id, payload)
          this.$Message.success('通知更新成功')
        } else {
          await createAdminNotification(payload)
          this.$Message.success('通知创建成功')
        }
        this.visible = false
        this.loadList()
      } catch (error) {
        this.$Message.error(error.message)
      }
    },
    async removeRow(row) {
      this.$Modal.confirm({
        title: '确认删除通知',
        content: `确认删除通知“${row.title}”吗？`,
        onOk: async () => {
          try {
            await deleteAdminNotification(row.id)
            this.$Message.success('通知删除成功')
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
</style>
