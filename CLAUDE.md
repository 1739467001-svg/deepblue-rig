# CLAUDE.md

DeepBlue Rig · 海上油田数字孪生视觉模拟。技术栈与架构详见 `README.md`。

## 构建

```bash
npm install
npm run dev        # 本地开发 http://localhost:5173
npm run build      # 生产构建,产物在 dist/
npm run preview    # 预览生产构建
```

Vite + React 18 + TypeScript + Three.js(R3F 8)。生产部署在根路径 `/`。

## 部署工作流(与用户约定 · 每次修改都遵守)

用户每次修改本项目后,按顺序执行:

1. **先推送到 GitHub** —— 提交改动并 push 到远程仓库 `1739467001-svg/deepblue-rig`。
2. **再由 Vercel 自动部署** —— 仓库已连接 Vercel,push 到生产分支后 Vercel 自动构建并更新线上站点,无需手动操作 Vercel。

### 约束

- **凭据**:GitHub 推送所需的 Personal Access Token 由用户在会话中临时提供,**绝不写入仓库、提交信息或任何日志**;用完提醒用户撤销。
- **生产分支**:Vercel 默认从 `main` 部署生产版本。若在特性分支开发,需合并到 `main`(或在 Vercel 设置中指定生产分支)才会更新线上。
- Vercel 为 Vite 自动识别构建命令(`npm run build`)与产物目录(`dist`),无需 `vercel.json`。
