# 任务管理系统

一个简洁高效的任务管理 Web 应用，支持多人协作和团队分组管理。

## 功能特性

✅ **任务管理**
- 添加、编辑、删除任务
- 任务状态切换（待办、进行中、已完成）
- 优先级标记（低、中、高）
- 任务描述
- **任务分组** - 任务可以分配到不同的工作小组
- **全局任务** - 任务可以不分组（所有成员可见）

✅ **用户系统**
- 用户登录/注册
- 角色权限管理（超级管理员、管理员、普通成员）
- 邀请码系统（管理员注册需要邀请码）
- 密码加密存储

✅ **小组管理**
- 管理员创建小组
- 小组创建申请审批流程
- 小组成员管理
- 小组名称限制（最多100字符）

✅ **任务协作**
- 任务指派给团队成员
- 任务标签分类
- 截止日期提醒
- 多维度筛选（状态、优先级、成员、小组）
- 统计信息展示

## 技术栈

- 前端：HTML + CSS + Vanilla JavaScript
- 后端：Node.js + Express
- 数据存储：JSON 文件（无需额外数据库）
- 部署：GitHub Pages / Vercel

## 快速开始

### 1. 安装依赖

```bash
cd backend
npm install
cd ..
```

### 2. 启动服务器

```bash
node backend/server.js
```

服务器将在 http://localhost:3000 启动。

### 3. 首次登录

默认超级管理员账号：
- 邮箱：`admin@example.com`
- 密码：`admin123`

### 4. 创建邀请码

使用超级管理员账号登录，访问 `/api/invites` 接口创建邀请码。

### 5. 创建小组

使用管理员账号登录，创建小组并提交申请，等待超级管理员审批。

## 项目结构

```
task-manager/
├── backend/              # 后端代码
│   ├── server.js         # 主服务器文件
│   ├── api.js            # API 路由
│   └── data.js           # 数据存储操作
├── frontend/             # 前端代码
│   ├── index.html        # 主页面
│   ├── style.css         # 样式
│   └── script.js         # JavaScript 逻辑
├── data/                 # 数据文件（自动创建）
│   ├── users.json        # 用户数据
│   ├── tasks.json        # 任务数据
│   ├── groups.json       # 小组数据
│   ├── user_groups.json  # 用户小组关联
│   ├── invites.json      # 邀请码
│   └── group_requests.json # 小组申请
└── README.md
```

## API 接口

### 认证
- `POST /api/auth/login` - 用户登录
- `POST /api/auth/register` - 使用邀请码注册
- `GET /api/auth/me` - 获取当前用户信息

### 用户管理
- `GET /api/users` - 获取所有用户（超级管理员）
- `POST /api/users` - 创建用户（超级管理员）

### 小组管理
- `POST /api/groups` - 创建小组（管理员）
- `GET /api/groups` - 获取所有小组（超级管理员）
- `GET /api/groups-admin` - 获取小组列表（管理员）
- `POST /api/groups/requests` - 提交小组创建申请（管理员）
- `GET /api/groups/my-requests` - 获取我的小组申请（管理员）
- `PUT /api/groups/requests/:id` - 批准/拒绝小组申请（超级管理员）

### 任务管理
- `GET /api/tasks` - 获取任务列表（支持筛选：assignee_id, status, priority, group_id）
- `POST /api/tasks` - 创建任务
- `GET /api/tasks/:id` - 获取单个任务
- `PUT /api/tasks/:id` - 更新任务
- `DELETE /api/tasks/:id` - 删除任务

### 邀请码管理
- `POST /api/invites` - 生成邀请码（超级管理员）
- `GET /api/invites` - 获取邀请码列表（超级管理员）

### 统计
- `GET /api/stats` - 获取统计数据

## 权限说明

### 超级管理员 (superadmin)
- 查看所有用户
- 创建用户
- 生成邀请码
- 查看所有小组
- 审批小组创建申请

### 管理员 (admin)
- 创建小组
- 提交小组创建申请
- 在自己的小组中创建任务
- 管理小组成员

### 普通成员 (member)
- 创建并完成任务
- 在自己加入的小组中创建任务

## 部署到 GitHub

### 1. 初始化 Git 仓库

```bash
git init
git add .
git commit -m "Initial commit"
```

### 2. 创建 GitHub 仓库

在 GitHub 上创建新仓库，然后将代码推送到远程。

```bash
git remote add origin https://github.com/你的用户名/task-manager.git
git branch -M main
git push -u origin main
```

### 3. 部署到 Vercel

1. 安装 Vercel CLI：
```bash
npm install -g vercel
```

2. 在项目根目录运行：
```bash
vercel
```

3. 按照提示完成部署。

## 开发说明

### 数据存储

使用 JSON 文件进行数据存储，无需额外数据库。数据文件位于 `data/` 目录：
- `users.json` - 用户信息
- `tasks.json` - 任务信息
- `groups.json` - 小组信息
- `user_groups.json` - 用户小组关联
- `invites.json` - 邀请码
- `group_requests.json` - 小组申请记录

### 添加新功能

- 添加 API：在 `backend/api.js` 中添加路由和中间件
- 修改界面：在 `frontend/` 目录下修改 HTML/CSS/JS
- 扩展功能：参考现有代码结构

### 常见问题

**Q: 如何重置管理员密码？**
A: 直接修改 `data/users.json` 文件中的密码哈希值，或通过超级管理员账号创建新用户。

**Q: 数据存储在哪里？**
A: 数据存储在 `data/` 目录下的 JSON 文件中。

**Q: 如何限制小组数量？**
A: 修改 `backend/api.js` 中 `POST /api/groups` 路由的验证逻辑。

## 许可证

MIT License
