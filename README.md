# 任务管理系统

团队协作任务管理 Web 应用，支持用户注册、多角色权限、群组隔离、任务追踪和统计。

## 功能特性

### 用户与认证
- 邮箱 + 密码注册/登录，bcrypt 密码哈希
- 三级角色：**超级管理员**、**管理员**、**普通成员**
- 邀请码控制注册（绑定角色类型，支持次数与有效期限制）

### 角色权限

| 操作 | 超级管理员 | 管理员 | 成员 |
|------|:---:|:---:|:---:|
| 创建/编辑/删除任务 | ✓ | ✓ | ✓ |
| 创建小组 | ✓ | ✓ | — |
| 管理小组成员 | ✓ | ✓（仅自己管理的小组） | — |
| 查看所有用户 | ✓ | 仅同组成员 | 仅同组成员 |
| 删除用户 | ✓ | — | — |
| 生成/删除邀请码 | ✓ | — | — |
| 管理所有小组 | ✓ | — | — |
| 审批小组申请 | ✓ | — | — |

### 任务管理
- 创建、编辑、删除任务，状态切换（待办 / 进行中 / 已完成）
- 优先级标记（低 / 中 / 高）、标签分类、截止日期
- 分配负责人，关联小组
- 多维度筛选：状态、优先级、负责人、小组

### 群组管理
- 创建小组，管理小组成员（添加/移除）
- 任务按小组隔离筛选
- 侧边栏成员按小组分类展示

### 统计面板
- 总用户数、总任务数、待办/进行中/已完成数量

## 技术栈

| 层 | 技术 |
|----|------|
| 前端 | HTML + CSS + Vanilla JavaScript |
| 后端 | Node.js + Express |
| 数据 | JSON 文件（`data/` 目录） |
| 认证 | bcrypt + 自定义 Base64 Token |
| 密码哈希 | bcrypt（10 轮加盐） |

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 启动

```bash
npm start
```

### 3. 访问

浏览器打开 `http://localhost:3000`

**默认超级管理员**：`admin@example.com` / `admin123`

首次启动时自动创建 `data/` 目录并初始化超管账号。

## 项目结构

```
task-manager/
├── backend/
│   ├── server.js         # Express 入口，CORS，静态文件，挂载 /api
│   ├── api.js            # 所有 API 路由与中间件（~650 行）
│   └── data.js           # JSON 读写、bcrypt、数据初始化
├── frontend/
│   ├── index.html        # 单页应用（登录页 + 面板 + 模态框）
│   ├── style.css         # 紫色渐变主题，响应式布局
│   └── script.js         # 前端全部逻辑（~850 行）
├── data/                 # JSON 数据文件，首次启动自动创建
│   ├── users.json
│   ├── tasks.json
│   ├── groups.json
│   ├── user_groups.json
│   ├── invites.json
│   └── group_requests.json
├── package.json
└── README.md
```

## API 接口

### 认证
| 方法 | 路径 | 权限 | 说明 |
|------|------|------|------|
| POST | `/api/auth/register` | 公开 | 注册（需邀请码） |
| POST | `/api/auth/login` | 公开 | 登录，返回 Token |
| GET | `/api/auth/me` | 登录 | 获取当前用户信息 |

### 用户
| 方法 | 路径 | 权限 | 说明 |
|------|------|------|------|
| GET | `/api/users` | 登录 | 获取用户列表（超管看全部，其他人看同组） |
| POST | `/api/users` | 超管 | 创建用户 |
| DELETE | `/api/users/:id` | 超管 | 删除用户及关联数据 |

### 任务
| 方法 | 路径 | 权限 | 说明 |
|------|------|------|------|
| GET | `/api/tasks` | 登录 | 任务列表，支持 `?status=&priority=&assignee_id=&group_id=` |
| GET | `/api/tasks/:id` | 登录 | 任务详情 |
| POST | `/api/tasks` | 登录 | 创建任务 |
| PUT | `/api/tasks/:id` | 登录 | 更新任务（需目标小组成员权限） |
| DELETE | `/api/tasks/:id` | 登录 | 删除任务 |

### 群组
| 方法 | 路径 | 权限 | 说明 |
|------|------|------|------|
| GET | `/api/my-groups` | 登录 | 我的群组列表 |
| POST | `/api/groups` | 管理员+ | 创建群组 |
| GET | `/api/groups` | 超管 | 所有群组（含成员数、创建者） |
| PUT | `/api/groups/:id` | 超管 | 编辑群组名称/描述 |
| DELETE | `/api/groups/:id` | 超管 | 删除群组及清理关联 |
| GET | `/api/groups-admin` | 管理员+ | 我管理的群组 |
| POST | `/api/groups/requests` | 管理员+ | 申请加入群组 |
| GET | `/api/groups/my-requests` | 管理员+ | 我的群组申请 |
| PUT | `/api/groups/requests/:id` | 超管 | 审批群组申请 |
| GET | `/api/groups/:id/members` | 群组管理员 | 小组成员列表 |
| POST | `/api/groups/:id/members` | 群组管理员 | 添加成员 |
| DELETE | `/api/groups/:id/members/:uid` | 群组管理员 | 移除成员 |

### 邀请码
| 方法 | 路径 | 权限 | 说明 |
|------|------|------|------|
| GET | `/api/invites` | 超管 | 邀请码列表 |
| POST | `/api/invites` | 超管 | 生成邀请码（角色/次数/有效期） |
| DELETE | `/api/invites/:code` | 超管 | 删除邀请码 |

### 统计
| 方法 | 路径 | 权限 | 说明 |
|------|------|------|------|
| GET | `/api/stats` | 登录 | 用户数、任务数、各状态数量 |

### 认证方式

除 `/api/auth/*` 外，所有接口需在请求头携带：
```
Authorization: Bearer <base64-token>
```

## 数据存储

所有数据以 JSON 文件存储在 `data/` 目录下，读写通过 `backend/data.js` 封装。**注意**：JSON 文件不支持并发写入，多用户同时操作可能造成数据冲突。生产环境建议迁移至 PostgreSQL 或 MongoDB。

## 部署

### Vercel（推荐，支持后端）

```bash
npm i -g vercel
cd task-manager
vercel
```

### GitHub Pages（仅前端）

适用于仅托管静态前端（后端需单独部署）。

> GitHub Pages 不支持 Node.js 后端，需配合 Vercel 或其他云服务部署后端 API。

## 许可证

MIT License
