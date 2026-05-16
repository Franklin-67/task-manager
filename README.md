# 任务管理系统

一个简洁高效的任务管理 Web 应用，支持多人协作。

## 功能特性

✅ **任务管理**
- 添加、编辑、删除任务
- 任务状态切换（待办、进行中、已完成）
- 优先级标记（低、中、高）
- 任务描述

✅ **成员管理**
- 团队成员列表
- 添加/删除成员
- 任务分配

✅ **高级功能**
- 任务标签分类
- 截止日期提醒
- 多维度筛选（状态、优先级、成员）
- 统计信息展示

## 技术栈

- 前端：HTML + CSS + Vanilla JavaScript
- 后端：Node.js + Express
- 数据库：SQLite
- 部署：GitHub

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 启动服务器

```bash
npm start
```

### 3. 访问应用

打开浏览器访问：http://localhost:3000

## 项目结构

```
task-manager/
├── backend/              # 后端代码
│   ├── server.js         # 主服务器文件
│   ├── db.js             # 数据库操作
│   └── api.js            # API 路由
├── frontend/             # 前端代码
│   ├── index.html        # 主页面
│   ├── style.css         # 样式
│   └── script.js         # JavaScript 逻辑
├── data/                 # 数据库文件（自动创建）
│   └── tasks.db
└── README.md
```

## API 接口

### 用户相关
- `GET /api/users` - 获取所有用户
- `POST /api/users` - 创建用户

### 任务相关
- `GET /api/tasks` - 获取任务列表（支持筛选）
- `POST /api/tasks` - 创建任务
- `PUT /api/tasks/:id` - 更新任务
- `DELETE /api/tasks/:id` - 删除任务

### 统计
- `GET /api/stats` - 获取统计数据

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

### 3. 持续部署（可选）

使用 GitHub Actions 自动部署到 Vercel 或其他托管平台。

## 开发说明

### 数据库

数据库使用 SQLite，数据存储在 `data/tasks.db` 文件中。

### 扩展开发

- 添加新 API：在 `backend/api.js` 中添加路由
- 修改界面：在 `frontend/` 目录下修改 HTML/CSS/JS
- 扩展功能：参考现有代码结构进行开发

## 许可证

MIT License
