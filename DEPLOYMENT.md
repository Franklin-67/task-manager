# 部署方案

## 方案 1: Vercel 部署（推荐，一键完成）

### 步骤 1：安装 Vercel CLI

```bash
npm i -g vercel
```

### 步骤 2：登录 Vercel

```bash
vercel login
```

### 步骤 3：部署到 Vercel

```bash
cd "C:\Users\Lin Yu\Desktop\Trae_first_project\claude code\task-manager"
vercel
```

按照提示操作：
1. 输入项目名称（例如：task-manager）
2. 选择是否要部署到生产环境（输入 `Y`）
3. 等待部署完成

部署完成后，你会得到一个链接：`https://task-manager.vercel.app`

### 优点
- ✅ 一键部署，无需配置服务器
- ✅ 自动 HTTPS
- ✅ 全球 CDN 加速
- ✅ 免费额度足够使用

---

## 方案 2: GitHub Pages（免费但有限制）

### 步骤 1：推送代码到 GitHub（已完成）
你的代码已推送到：https://github.com/Franklin-67/task-manager

### 步骤 2：设置 GitHub Pages

1. 访问：https://github.com/Franklin-67/task-manager
2. 点击 **Settings** → **Pages**
3. 在 **Build and deployment** 中：
   - Source 选择 **Deploy from a branch**
   - Branch 选择 **main** / **root**
4. 点击 **Save**

### 步骤 3：配置后端 API（需要 Cloudflare Workers）

由于 GitHub Pages 无法运行 Node.js 后端，可以使用 Cloudflare Workers 作为后端 API。

---

## 方案 3: 本地运行（最简单）

如果只是个人使用或小团队内部使用：

```bash
cd "C:\Users\Lin Yu\Desktop\Trae_first_project\claude code\task-manager"
npm install
npm start
```

然后访问：http://localhost:3000

---

## 推荐方案对比

| 方案 | 成本 | 难度 | 适用场景 |
|------|------|------|---------|
| **Vercel** | 免费 | 简单 | 推荐，适合大多数场景 |
| **GitHub Pages** | 免费 | 中等 | 无法部署后端 |
| **本地运行** | 免费 | 最简单 | 仅限个人/内网使用 |

## 注意事项

- **数据存储**：使用 JSON 文件存储，多人同时使用时可能会有数据冲突
- **生产环境**：建议使用更专业的数据库（如 PostgreSQL、MongoDB）替代 JSON 存储
- **HTTPS**：Vercel 自动提供 HTTPS 支持
