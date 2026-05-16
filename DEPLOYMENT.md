# 部署到 GitHub Pages

## 方法 1: 直接部署（推荐）

### 1. 创建 GitHub 仓库

在 GitHub 上创建一个新仓库（例如：`task-manager`）

### 2. 推送代码

```bash
cd "C:\Users\Lin Yu\Desktop\Trae_first_project\claude code\task-manager"
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/你的用户名/task-manager.git
git branch -M main
git push -u origin main
```

### 3. 设置 GitHub Pages

1. 进入 GitHub 仓库页面
2. 点击 **Settings** → **Pages**
3. 在 **Build and deployment** 中：
   - Source 选择 **Deploy from a branch**
   - Branch 选择 **main** / **root**
4. 点击 **Save**

### 4. 访问应用

约 1-2 分钟后，访问：
```
https://你的用户名.github.io/task-manager/
```

## 方法 2: 使用 Vercel 部署

### 1. 安装 Vercel CLI

```bash
npm i -g vercel
```

### 2. 部署到 Vercel

```bash
cd "C:\Users\Lin Yu\Desktop\Trae_first_project\claude code\task-manager"
vercel
```

按照提示操作即可完成部署。

## 注意事项

- **数据存储**：使用 JSON 文件存储，团队多人同时使用时可能会有数据冲突
- **生产环境**：建议使用更专业的数据库（如 PostgreSQL、MongoDB）替代 JSON 存储
- **HTTPS**：GitHub Pages 自动提供 HTTPS 支持

## 后续优化建议

1. 添加数据库支持（PostgreSQL/MongoDB）
2. 添加用户认证
3. 添加任务分享功能
4. 添加邮件通知
