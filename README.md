<div align="center">

# Campus Go

校园二手与求购信息平台，包含 `uni-app` 移动端、`Node.js + Express` 共享后端，以及 `Vue 2 + iView` 管理后台。

[![uni-app](https://img.shields.io/badge/uni--app-Vue%203-2B2B2B?logo=vuedotjs&logoColor=white)](./campus-go-app)
[![Node.js](https://img.shields.io/badge/Node.js-24.x-43853D?logo=nodedotjs&logoColor=white)](./campus-go-server)
[![Express](https://img.shields.io/badge/Express-5.x-111111?logo=express&logoColor=white)](./campus-go-server)
[![SQLite](https://img.shields.io/badge/SQLite-Local%20Storage-003B57?logo=sqlite&logoColor=white)](./campus-go-server)
[![Admin](https://img.shields.io/badge/Admin-Vue%202%20%2B%20iView-2d8cf0)](./vue2-iview2-admin-master)

</div>

## Overview

Campus Go 面向校园场景，聚焦“闲置发布 + 求购信息 + 即时沟通 + 后台管理”这四件事。

- 前端采用更简约的商品信息流布局，支持闲置区和求购区分流展示
- 后端提供统一的数据接口、会话鉴权、媒体上传、通知、关注、聊天能力
- 管理后台与移动端共用一套后端，支持商品、用户、通知、媒体库和存储策略管理
- 当前实现以“信息撮合”为主，不包含在线支付和担保交易

## Table of Contents

- [Overview](#overview)
- [Highlights](#highlights)
- [Tech Stack](#tech-stack)
- [Architecture](#architecture)
- [Core Features](#core-features)
- [Repository Structure](#repository-structure)
- [Requirements](#requirements)
- [Quick Start](#quick-start)
- [Default Access](#default-access)
- [Available Scripts](#available-scripts)
- [Data & Storage](#data--storage)
- [Build Targets](#build-targets)
- [Development Notes](#development-notes)
- [FAQ](#faq)
- [Roadmap](#roadmap)
- [Contributing](#contributing)
- [Acknowledgements](#acknowledgements)

## Highlights

- 双流市场：闲置 `supply` 和求购 `demand` 独立分区展示
- 多端支持：H5、微信小程序、App 同源构建
- 实时聊天：商品详情页可直接“聊一聊”，基于 `WebSocket`
- 个人中心：我的交易、我的关注、浏览记录、清单、个性化设置
- 管理后台：商品 CRUD、用户管理、通知管理、媒体库、OSS / 本地存储切换
- 存储能力：支持本地上传，也预留阿里云 OSS 接入与迁移能力

## Tech Stack

### Mobile App

- `uni-app`
- `Vue 3`
- `TypeScript`
- `Pinia`
- `Vite`
- `Sass`
- `wot-design-uni`

### Server

- `Node.js`
- `Express 5`
- `SQLite`
- `WebSocket (ws)`
- `ali-oss`

### Admin Panel

- `Vue 2`
- `iView 2`
- `Vue Router`
- `Webpack`

## Architecture

```text
campus-go-app
        |
        | HTTP / WebSocket
        v
campus-go-server
        |
        +-- SQLite
        |
        +-- Local Uploads / OSS
        |
        +-- Admin APIs
                ^
                |
vue2-iview2-admin-master
```

## Core Features

### User Side

- 首页信息流按“闲置 / 求购”切换
- 分类标签筛选与关键词搜索
- 商品详情查看、加入清单、发起聊天
- 发布闲置 / 发布求购，支持编辑和删除
- 我的交易中统一管理自己发布的内容
- 我的关注、最近浏览、系统通知

### Admin Side

- 管理员登录
- 商品审核与增删改查
- 用户管理与权限控制
- 通知发布与维护
- 媒体库管理
- 存储设置管理，支持本地与 OSS 策略切换

## Repository Structure

```text
.
├─ campus-go-app/                 # uni-app 移动端
│  ├─ src/
│  │  ├─ api/                     # 接口请求
│  │  ├─ components/              # 通用组件
│  │  ├─ config/                  # 运行时配置
│  │  ├─ pages/                   # 页面
│  │  │  ├─ buyer/                # 首页 / 信息流
│  │  │  ├─ detail/               # 商品详情
│  │  │  ├─ cart/                 # 清单 / 浏览记录
│  │  │  ├─ publish/              # 发布页
│  │  │  ├─ seller/               # 消息页
│  │  │  └─ profile/              # 我的 / 设置 / 关注 / 交易
│  │  ├─ stores/                  # Pinia 状态管理
│  │  ├─ types/                   # 类型定义
│  │  └─ utils/                   # 工具函数
│  ├─ package.json
│  └─ unh.config.ts
├─ campus-go-server/              # 共享后端
│  ├─ src/
│  │  ├─ server.js                # API 与 WebSocket 入口
│  │  ├─ db.js                    # SQLite 数据访问与种子数据
│  │  ├─ config.js                # 环境变量与路径配置
│  │  └─ security.js              # 密码与安全相关逻辑
│  ├─ data/                       # 数据库与上传目录
│  ├─ .env.example
│  └─ package.json
├─ vue2-iview2-admin-master/      # 后台管理系统
│  ├─ src/
│  │  ├─ api/                     # 后台接口封装
│  │  ├─ pages/                   # 后台页面
│  │  │  ├─ nav1/                 # 业务管理页
│  │  │  └─ nav2/                 # 媒体库 / 存储设置等
│  │  ├─ routes.js                # 路由配置
│  │  └─ main.js
│  └─ package.json
├─ le-labo-ui/                    # UI 参考演示页面
├─ package.json                   # 根目录快捷脚本
└─ task.md                        # 任务说明
```

## Requirements

- `Node.js >= 20`
- `pnpm >= 9`
- `npm >= 9`

当前本地开发环境实测版本：

- `Node.js 24.13.0`
- `pnpm 10.28.1`
- `npm 11.6.2`

## Quick Start

### 1. Clone

```bash
git clone <your-repo-url>
cd temp
```

### 2. Install Dependencies

```bash
cd campus-go-app
pnpm install

cd ../campus-go-server
pnpm install

cd ../vue2-iview2-admin-master
npm install --legacy-peer-deps
```

### 3. Configure Server Environment

复制示例环境变量：

```bash
cd campus-go-server
cp .env.example .env
```

Windows PowerShell 可使用：

```powershell
Copy-Item .env.example .env
```

默认配置如下：

```env
API_HOST=0.0.0.0
API_PORT=4000
CORS_ORIGIN=*
TOKEN_TTL_HOURS=168
DB_PATH=./data/campus-go.sqlite
```

如需本地上传目录，可额外配置：

```env
UPLOAD_DIR=./data/uploads
```

### 4. Start Services

先启动后端：

```bash
cd campus-go-server
pnpm dev
```

再启动移动端 H5：

```bash
cd campus-go-app
pnpm dev:h5
```

如需启动后台管理：

```bash
cd vue2-iview2-admin-master
npm run dev
```

## Default Access

### Server API

```text
http://127.0.0.1:4000/api
```

### WebSocket

```text
ws://127.0.0.1:4000/ws
```

### Mobile Runtime Config

移动端默认接口配置文件：

- `campus-go-app/src/config/runtime.js`

默认内容：

```js
const runtimeConfig = {
  protocol: 'http',
  host: '127.0.0.1',
  port: 4000,
  prefix: '/api',
}
```

### Admin Login

默认管理员账号由种子数据初始化：

```text
账号：admin
密码：admin123
```

## Available Scripts

### Root

```bash
pnpm dev:server
pnpm dev:app
pnpm build:h5
pnpm build:mp-weixin
pnpm build:app
```

### Mobile App

```bash
pnpm dev
pnpm dev:h5
pnpm dev:mp-weixin
pnpm dev:app
pnpm build
pnpm build:h5
pnpm build:mp-weixin
pnpm build:app
pnpm type-check
pnpm lint
pnpm lint:fix
```

### Server

```bash
pnpm dev
pnpm start
```

### Admin

```bash
npm run dev
npm run build
```

## Data & Storage

- 默认数据库位于 `campus-go-server/data/campus-go.sqlite`
- 本地上传目录位于 `campus-go-server/data/uploads`
- 后台可配置存储策略，并支持媒体库管理
- 如果启用 OSS，请确保 `bucket / endpoint / AccessKey / 签名版本` 与阿里云控制台配置完全一致

## Build Targets

### Mobile

```bash
cd campus-go-app
pnpm build:h5
pnpm build:mp-weixin
pnpm build:app
```

### Admin

```bash
cd vue2-iview2-admin-master
npm run build
```

## Development Notes

- 页面导航大多使用自定义导航栏，配置在 `pages.json`
- 即时聊天入口在商品详情页发起，会自动建立会话
- “清单 / 浏览记录 / 关注 / 通知” 都由同一套后端数据源提供
- 管理后台和移动端共用同一数据库

## FAQ

### 1. 为什么移动端能打开但没有数据？

先确认 `campus-go-server` 已启动，并检查 `campus-go-app/src/config/runtime.js` 中的地址是否与后端一致。

### 2. 为什么 OSS 上传会报签名错误？

通常是以下几类问题：

- `AccessKeyId / AccessKeySecret` 不匹配
- `bucket` 不是对应账号下的 bucket
- `endpoint`、地域、签名版本配置错误
- 自定义域名没有按 OSS 规范完成绑定

### 3. 为什么后台能登录但页面空白？

优先检查后端是否启动、后台接口地址是否正确，以及浏览器控制台是否存在跨域或接口报错。

## Roadmap

- [x] 闲置 / 求购双流信息架构
- [x] 聊一聊即时会话
- [x] 我的交易 / 我的关注 / 清单整合
- [x] 后台商品、用户、通知管理
- [x] 媒体库与存储策略切换
- [ ] 更完整的审核流
- [ ] 更细粒度的角色权限
- [ ] 自动化测试与 CI

## Contributing

如果你准备继续迭代这个项目，建议优先遵循下面的顺序：

1. 先改共享后端接口或数据结构
2. 再同步移动端调用与状态管理
3. 最后同步后台管理页

提交前建议至少完成：

```bash
cd campus-go-app
pnpm build:h5

cd ../campus-go-server
node --check src/server.js

cd ../vue2-iview2-admin-master
npm run build
```

## Acknowledgements

- 管理后台基础模板来自 `vue2-iview2-admin-master`
- UI 重构阶段参考了本地 `le-labo-ui` 演示页面
- README 结构参考了 GitHub Docs 对 README 的建议，以及 React / Supabase 这类热门仓库常见的“简介 + 快速开始 + 文档分区”组织方式
