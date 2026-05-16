# 任务管理小程序 - 实施方案

## 技术栈

- **前端**: HTML + CSS + Vanilla JavaScript
- **后端**: Node.js + Express
- **数据库**: SQLite
- **部署**: GitHub

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
│   └── script.js         # JavaScript
├── README.md             # 项目说明
└── .gitignore           # Git 忽略文件
```

## 数据库设计

```sql
-- 用户表
CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    avatar TEXT
);

-- 任务表
CREATE TABLE tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT,
    status TEXT DEFAULT 'todo',      -- todo, in_progress, done
    priority TEXT DEFAULT 'medium',  -- low, medium, high
    tags TEXT,                       -- JSON 格式: ["工作", "紧急"]
    assignee_id INTEGER,
    deadline TEXT,                   -- 格式: YYYY-MM-DD
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (assignee_id) REFERENCES users(id)
);

-- 成员表（可选）
CREATE TABLE team_members (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    role TEXT
);
```

## API 设计

### 用户相关
- `GET /api/users` - 获取所有用户
- `POST /api/users` - 创建用户

### 任务相关
- `GET /api/tasks` - 获取任务列表（支持筛选）
- `POST /api/tasks` - 创建任务
- `PUT /api/tasks/:id` - 更新任务
- `DELETE /api/tasks/:id` - 删除任务
- `GET /api/tasks/:id` - 获取单个任务详情

### 统计
- `GET /api/stats/tasks-by-user` - 按用户统计任务
- `GET /api/stats/priority-overview` - 优先级统计

## 前端页面设计

### 主页面（index.html）
```
┌─────────────────────────────────────────────────────────────┐
│                        任务管理系统                           │
├──────────────┬──────────────────────────────────────────────┤
│  团队成员     │  任务列表                                    │
│              │                                              │
│  [成员列表]   │  [筛选/排序]                                  │
│              │                                              │
│  • 张三       │  ┌──────────────────────────────────────┐  │
│  • 李四       │  │ [待办] 任务标题                      │  │
│  • 王五       │  │ 标签: [工作] 优先级: 高  截止: 5/20 │  │
│              │  │             [编辑] [删除]            │  │
│  [+ 添加成员] │  └──────────────────────────────────────┘  │
│              │  ┌──────────────────────────────────────┐  │
│              │  │ [进行中] 任务标题                    │  │
│              │  │ ...                                   │  │
│              │  └──────────────────────────────────────┘  │
│              │  ┌──────────────────────────────────────┐  │
│              │  │ [已完成] 任务标题                    │  │
│              │  │ ...                                   │  │
│              │  └──────────────────────────────────────┘  │
└──────────────┴──────────────────────────────────────────────┘
```

## 功能模块

### 1. 用户管理
- 显示团队成员列表
- 添加新成员
- 成员头像显示（可后续扩展）

### 2. 任务管理
- 创建任务（标题、描述、标签、优先级、截止日期）
- 编辑任务
- 删除任务
- 状态切换（待办 → 进行中 → 已完成）
- 任务筛选（按成员、状态、优先级）

### 3. 数据统计
- 按成员统计任务数
- 优先级分布
- 完成进度

## 实施步骤

### 阶段 1：后端基础（3 步）
1. 初始化项目，安装依赖
2. 设置数据库和连接
3. 实现 API 路由

### 阶段 2：前端界面（3 步）
1. 创建 HTML 结构
2. 编写 CSS 样式
3. 实现 JavaScript 逻辑

### 阶段 3：测试与部署（2 步）
1. 本地测试
2. 推送到 GitHub

## 开发环境

### 安装依赖
```bash
npm init -y
npm install express cors sqlite3
```

### 运行服务器
```bash
node backend/server.js
```

前端访问 `http://localhost:3000`
