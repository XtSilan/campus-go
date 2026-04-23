<template>
  <div>
    <Card>
      <div class="toolbar">
        <Input v-model="filters.keyword" placeholder="搜索昵称、学号、校区" style="width: 240px" />
        <Select v-model="filters.role" style="width: 140px">
          <Option value="all">全部角色</Option>
          <Option value="user">普通用户</Option>
          <Option value="admin">管理员</Option>
        </Select>
        <Select v-model="filters.status" style="width: 140px">
          <Option value="all">全部状态</Option>
          <Option value="active">启用</Option>
          <Option value="disabled">禁用</Option>
        </Select>
        <Button type="primary" @click="loadList">查询</Button>
        <Button @click="openModal()">新增用户</Button>
      </div>

      <Table :columns="columns" :data="rows" :loading="loading" />
      <div class="pager">
        <Page :total="total" :current="page" :page-size="pageSize" show-total @on-change="handlePageChange" />
      </div>
    </Card>

    <Modal v-model="visible" :title="form.id ? '编辑用户' : '新增用户'" width="680" @on-ok="submitForm">
      <Form :model="form" :label-width="88">
        <Row :gutter="16">
          <i-col :span="12">
            <Form-item label="昵称">
              <Input v-model="form.nickname" placeholder="请输入昵称" />
            </Form-item>
          </i-col>
          <i-col :span="12">
            <Form-item label="学号/账号">
              <Input v-model="form.studentNo" placeholder="请输入学号或账号" />
            </Form-item>
          </i-col>
        </Row>
        <Row :gutter="16">
          <i-col :span="12">
            <Form-item label="校区">
              <Input v-model="form.campus" placeholder="请输入校区" />
            </Form-item>
          </i-col>
          <i-col :span="12">
            <Form-item label="密码">
              <Input v-model="form.password" placeholder="新增必填，编辑可留空" />
            </Form-item>
          </i-col>
        </Row>
        <Row :gutter="16">
          <i-col :span="12">
            <Form-item label="角色">
              <Select v-model="form.role">
                <Option value="user">普通用户</Option>
                <Option value="admin">管理员</Option>
              </Select>
            </Form-item>
          </i-col>
          <i-col :span="12">
            <Form-item label="状态">
              <Select v-model="form.status">
                <Option value="active">启用</Option>
                <Option value="disabled">禁用</Option>
              </Select>
            </Form-item>
          </i-col>
        </Row>
        <Form-item label="介绍">
          <Input v-model="form.tagline" type="textarea" :rows="3" placeholder="用户简介" />
        </Form-item>
      </Form>
    </Modal>
  </div>
</template>

<script>
import { createAdminUser, deleteAdminUser, fetchAdminUsers, updateAdminUser } from '../../api'

function createDefaultForm() {
  return {
    id: null,
    nickname: '',
    campus: '',
    studentNo: '',
    tagline: '',
    password: '',
    role: 'user',
    status: 'active',
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
        role: 'all',
        status: 'all',
      },
      rows: [],
      form: createDefaultForm(),
      columns: [
        { title: '昵称', key: 'nickname', minWidth: 140 },
        { title: '学号/账号', key: 'studentNo', width: 130 },
        { title: '校区', key: 'campus', width: 120 },
        { title: '角色', key: 'role', width: 90 },
        { title: '状态', key: 'status', width: 90 },
        {
          title: '操作',
          key: 'action',
          width: 200,
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
        const result = await fetchAdminUsers({
          page: this.page,
          pageSize: this.pageSize,
          keyword: this.filters.keyword,
          role: this.filters.role,
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
      this.form = row ? { ...row, password: '' } : createDefaultForm()
      this.visible = true
    },
    async submitForm() {
      try {
        const payload = { ...this.form }
        if (!payload.password) {
          delete payload.password
        }
        if (this.form.id) {
          await updateAdminUser(this.form.id, payload)
          this.$Message.success('用户更新成功')
        } else {
          await createAdminUser(payload)
          this.$Message.success('用户创建成功')
        }
        this.visible = false
        this.loadList()
      } catch (error) {
        this.$Message.error(error.message)
      }
    },
    async removeRow(row) {
      this.$Modal.confirm({
        title: '确认删除用户',
        content: `确认删除用户“${row.nickname}”吗？该操作不可恢复。`,
        onOk: async () => {
          try {
            await deleteAdminUser(row.id)
            this.$Message.success('用户删除成功')
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
