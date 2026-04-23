<template>
  <div class="login-page">
    <div class="login-card">
      <div class="login-kicker">Campus Go Admin</div>
      <h2>校园购运营后台</h2>
      <p>统一管理商品、用户权限和平台通知。</p>

      <i-form ref="formLogin" :model="formLogin" :rules="formLoginRules">
        <Form-item prop="username">
          <i-input size="large" v-model="formLogin.username" placeholder="管理员账号">
            <Icon type="ios-person-outline" slot="prepend"></Icon>
          </i-input>
        </Form-item>
        <Form-item prop="password">
          <i-input size="large" type="password" v-model="formLogin.password" placeholder="登录密码">
            <Icon type="ios-locked-outline" slot="prepend"></Icon>
          </i-input>
        </Form-item>
        <Form-item class="login-actions">
          <i-button type="primary" long :loading="submitting" @click="handleSubmit('formLogin')">登录后台</i-button>
        </Form-item>
      </i-form>

      <div class="login-tip">
        默认管理员账号：admin / admin123
      </div>
    </div>
  </div>
</template>

<script>
import { adminLogin } from '../api'

export default {
  data() {
    return {
      submitting: false,
      formLogin: {
        username: 'admin',
        password: 'admin123',
      },
      formLoginRules: {
        username: [
          { required: true, message: '请输入管理员账号', trigger: 'blur' },
        ],
        password: [
          { required: true, message: '请输入登录密码', trigger: 'blur' },
          { type: 'string', min: 6, message: '密码至少 6 位', trigger: 'blur' },
        ],
      },
    }
  },
  methods: {
    handleSubmit(name) {
      this.$refs[name].validate(async (valid) => {
        if (!valid) {
          this.$Message.error('表单验证失败')
          return
        }

        this.submitting = true

        try {
          const result = await adminLogin(this.formLogin)
          sessionStorage.setItem('admin_token', result.data.token)
          sessionStorage.setItem('admin_user', JSON.stringify(result.data.user))
          this.$Message.success('登录成功')
          this.$router.push({ path: '/main' })
        } catch (error) {
          this.$Message.error(error.message)
        } finally {
          this.submitting = false
        }
      })
    },
  },
}
</script>

<style scoped>
.login-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #1f2329, #0f1115);
}

.login-card {
  width: 420px;
  padding: 40px 36px;
  border-radius: 20px;
  background: rgba(255, 255, 255, 0.98);
  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.2);
}

.login-kicker {
  color: #ff7a59;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 1px;
  text-transform: uppercase;
}

.login-card h2 {
  margin: 14px 0 8px;
  font-size: 28px;
}

.login-card p {
  margin: 0 0 24px;
  color: #8e8e93;
  line-height: 1.7;
}

.login-actions {
  margin-top: 12px;
}

.login-tip {
  margin-top: 18px;
  color: #8e8e93;
  font-size: 12px;
}
</style>
