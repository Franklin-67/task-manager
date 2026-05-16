# 任务管理小程序架构方案

## 技术栈

- **前端**: HTML + JavaScript + CSS（使用 Vue.js，简单易学）
- **后端**: Microsoft Graph API（读取/修改 SharePoint Excel）
- **数据存储**: 现有 SharePoint Excel 文件
- **认证**: Azure AD OAuth 2.0

## 核心功能

1. **任务管理**
   - 添加任务
   - 删除任务
   - 标记完成

2. **成员管理**
   - 查看团队成员
   - 给任务分配成员

3. **任务属性**
   - 标签分类
   - 优先级（高/中/低）
   - 完成进度
   - 截止日期

## 工作流程

```
用户操作 → 前端页面 → Graph API → SharePoint Excel → 更新并返回
```

## 需要准备的资源

1. Azure AD 应用注册
2. SharePoint 文件路径
3. Office 365 账号权限

## 实施步骤

1. 设置 Azure AD 应用（获取 token）
2. 准备 SharePoint Excel 文件结构
3. 开发前端页面
4. 连接 Graph API
5. 测试并部署
