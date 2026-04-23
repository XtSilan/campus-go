<template>
  <div class="dashboard-page">
    <div class="stats-grid">
      <Card v-for="item in cards" :key="item.label" class="stat-card">
        <div class="stat-label">{{ item.label }}</div>
        <div class="stat-value">{{ item.value }}</div>
      </Card>
    </div>

    <Row :gutter="16">
      <i-col :span="14">
        <Card>
          <div class="panel-head">
            <div>
              <h3>最近商品</h3>
              <p>最新创建或更新的商品信息</p>
            </div>
          </div>
          <Table :columns="listingColumns" :data="latestListings" />
        </Card>
      </i-col>
      <i-col :span="10">
        <Card>
          <div class="panel-head">
            <div>
              <h3>平台通知</h3>
              <p>已发布公告预览</p>
            </div>
          </div>
          <div v-for="item in recentNotifications" :key="item.id" class="notice-card">
            <div class="notice-title">{{ item.title }}</div>
            <div class="notice-content">{{ item.content }}</div>
          </div>
        </Card>
      </i-col>
    </Row>
  </div>
</template>

<script>
import { fetchAdminStats } from '../api'

export default {
  data() {
    return {
      summary: {
        userCount: 0,
        adminCount: 0,
        listingCount: 0,
        activeListingCount: 0,
        supplyCount: 0,
        demandCount: 0,
        activeNotificationCount: 0,
      },
      latestListings: [],
      recentNotifications: [],
      listingColumns: [
        { title: '标题', key: 'title', minWidth: 180 },
        { title: '分类', key: 'category', width: 110 },
        { title: '类型', key: 'type', width: 90 },
        { title: '发布人', key: 'ownerNickname', width: 120 },
        { title: '状态', key: 'status', width: 100 },
      ],
    }
  },
  computed: {
    cards() {
      return [
        { label: '总用户数', value: this.summary.userCount },
        { label: '管理员数', value: this.summary.adminCount },
        { label: '商品总数', value: this.summary.listingCount },
        { label: '上架商品', value: this.summary.activeListingCount },
        { label: '供应信息', value: this.summary.supplyCount },
        { label: '求购信息', value: this.summary.demandCount },
        { label: '生效通知', value: this.summary.activeNotificationCount },
      ]
    },
  },
  async mounted() {
    await this.loadStats()
  },
  methods: {
    async loadStats() {
      try {
        const result = await fetchAdminStats()
        this.summary = result.data.summary
        this.latestListings = result.data.latestListings
        this.recentNotifications = result.data.recentNotifications
      } catch (error) {
        this.$Message.error(error.message)
      }
    },
  },
}
</script>

<style scoped>
.stats-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 16px;
  margin-bottom: 16px;
}

.stat-card {
  min-height: 112px;
}

.stat-label {
  color: #8e8e93;
  font-size: 13px;
}

.stat-value {
  margin-top: 16px;
  color: #1a1a1a;
  font-size: 30px;
  font-weight: 700;
}

.panel-head {
  margin-bottom: 16px;
}

.panel-head h3 {
  margin: 0;
  font-size: 18px;
}

.panel-head p {
  margin: 8px 0 0;
  color: #8e8e93;
}

.notice-card {
  padding: 14px 0;
  border-bottom: 1px solid #f1f1f1;
}

.notice-card:last-child {
  border-bottom: none;
}

.notice-title {
  font-size: 14px;
  font-weight: 700;
  color: #1a1a1a;
}

.notice-content {
  margin-top: 8px;
  color: #8e8e93;
  line-height: 1.7;
}
</style>
