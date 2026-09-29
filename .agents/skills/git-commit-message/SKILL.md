---
name: git-commit-message
description: Generate Chinese-language git commit messages following the project's commit convention. Use when the user asks to commit code, generate a commit message, submit changes, or mentions keywords like "commit"、"提交"、"提交信息"、"git commit".
---

# Git 提交信息生成

按照项目结构化提交格式，生成中文 Git 提交信息。

## 执行步骤

### 第一步：检查变更

运行以下命令了解发生了什么改动：

```bash
git status
git diff --staged  # 或: git diff（如果没有暂存区内容）
```

### 第二步：生成提交信息

分析变更内容，按以下格式生成提交信息：

```
<type>(<scope>): <subject>

<body>
```

**Header**（首行）为必填项，Body（正文）为可选项（仅在需要额外说明时填写）。

#### Type（类型）

| Type | 使用场景 |
|------|----------|
| **feat** | 新功能 |
| **fix** | 修复 bug |
| **docs** | 仅文档变更 |
| **style** | 代码格式、空格、分号等（不影响代码逻辑） |
| **refactor** | 代码重构，既非 feat 也非 fix |
| **test** | 添加或更新测试 |
| **chore** | 构建工具、依赖、维护性工作 |
| **perf** | 性能优化 |
| **build** | 构建系统或外部依赖变更 |
| **ci** | CI/CD 配置变更 |
| **revert** | 回退之前的提交 |

#### Scope（范围）

尽可能简洁地标识受影响的区域：模块名、组件名或目录。如果变更跨多个区域，选取最相关的一个或使用更宽泛的范围。如果没有明确的范围，可以省略。

#### Subject（标题）规则

- 不超过 50 个字符
- 以动词开头，使用祈使句
- 首字母小写
- 结尾不加句号

#### Body（正文，可选）

- 解释**为什么**做这个改动，而非做了什么
- 每行不超过 72 个字符
- 列举时使用列表项
- 段落之间用空行分隔

### 第三步：确认提交

展示生成的提交信息，询问用户是否执行：

```bash
git add <files> && git commit -m "<message>"
```

**不要**自动提交 — 始终先向用户确认。

## 示例

### 新功能

```
feat(payment): 微信支付功能集成

- 新增微信支付SDK依赖
- 实现支付结果回调处理
- 添加支付相关的单元测试

Closes #889
```

### Bug 修复

```
fix(auth): 修复用户认证失效问题

由于 Token 过期时间计算错误导致用户频繁掉线，
现已修正过期时间计算逻辑。
```

### 破坏性变更

```
refactor(api): 重构支付回调接口

将旧版支付回调接口迁移至新版接口，提升安全性。

BREAKING CHANGE: 旧版支付回调接口已废弃，需迁移至 /api/1/callback
```

### 简单变更

```
chore(deps): 升级 Vue 至 2.7.16
```

## 最佳实践

- 仔细阅读 diff；不要猜测变动内容
- 如果 diff 内容过多难以在 50 个字符内概括，建议拆分为多个提交
- 对于 `revert:` 类型的提交，正文必须为 `This reverts commit <hash>.`
- 仅在变更真正破坏向后兼容性时，才标注 `BREAKING CHANGE`
