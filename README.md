# weapp-gulp-service

微信小程序预编译工作流 & weapp precompile workflow — **v2，基于 [deltic](https://github.com/lixl39505/deltic) 增量编译内核重构（TypeScript 7 / gulp 5 / streamx / SQLite 缓存）**。

## 特性

- **开箱即用**：默认提供一份完整的小程序任务配置，`wgs serve` 即可开发
- **语法增强**：less（含全局 lessVar）、px2rpx、图片 base64 内联、路径别名、.env 环境变量、json5、`.vue`/`.mp` 单文件组件、app.json 扩展路由（route-map）
- **增量编译**：基于 mtime + 配置摘要（**per-task 粒度**，改 less 参数只重编 .less）+ 环境变量伪依赖
- **依赖图谱**：依赖收集 + 反向追踪，上游模块自动补偿编译
- **自动 npm 构建**：package.json 变更自动 `npm install` + `build-npm`（miniprogram-ci 或开发者工具 CLI）
- **精确产物清理**：记录每个源文件实际发射的产物，删除源文件时精确清理（含 SFC 子目录）
- **上传**：`wgs upload` 走 miniprogram-ci（代码保护/压缩等设置从 project.config.json 映射）

## 安装

```bash
pnpm add -D weapp-gulp-service
```

要求 Node.js >= 20。

## 快速开始

```
project/
├── project.config.json     # miniprogramRoot 指向 dist/
├── weapp.config.js         # 可选
├── .env / .env.local / .env.[mode]
└── src/
    ├── app.json            # 支持 { path, title, name, meta, children } 嵌套路由
    ├── pages/index.vue     # SFC：template / script / style / script[name=json]
    └── styles/variables.less
```

```bash
wgs serve          # 开发（默认命令），增量 + watch
wgs build          # 生产构建
wgs upload -v 1.0.0 [desc]   # 构建并上传
wgs build:npm      # 仅构建 miniprogram_npm
```

## weapp.config.js

```js
module.exports = {
    alias: {
        '@': './src',
    },
    // 全局 less 变量文件（相对项目根）
    lessVar: 'src/styles/variables.less',

    // 可选：同步修改 / 异步替换合并后的配置
    callback(options) {
        options.lessVar = `src/styles/${options.env.APP_THEME}.less`
    },
}
```

也支持 `weapp.config.ts`（jiti 直接加载）。默认值（均可覆盖）：`px2rpx.times: 2`、`base64.maxImageSize: 8kb`、`css.rename.extname: '.wxss'`、`mp.tagAlias: { div: 'view', span: 'text' }`、`imgType: [jpg,png,svg,webp,gif]`。

> **v2 变化**：env 不再写入 `process.env`，动态取值请使用 `callback` + `options.env`；`--no-npm-build` 统一为 `--no-build-npm`；上传 verbose 旗标改为 `--verbose`。

## 环境变量

`.env → .env.local → .env.[mode] → .env.[mode].local`（后者覆盖前者），值替换源码中的 `process.env.X` 字面量，并登记为伪依赖 —— **修改 .env 值会自动失效相关文件缓存**。

上传/npm 构建相关：

- `WE_APP_PRIVATE_KEY_PATH`：miniprogram-ci 私钥（优先）
- `WE_CLI`：微信开发者工具 CLI 路径（兜底）

## 基于 deltic 的架构

wgs v2 是 deltic 的领域层：

| 层 | 内容 |
|---|---|
| 配置层 | `weapp.config.*` 加载（jiti）、env 链、defaults 合并、callback |
| 任务表 | `weappTasks()` — 1:1 扩展名→任务，`taskTypeMap` 把图片扩展映射到 img 任务 |
| 管道 | `less`（含 lessVar 分支发射 variables.js/.wxss）、`css`、`wxss`、`wxml`、`wxs`、`json`/`json5`（app.json 分支）、`sfc`（切片编译+样式合并）；`js`/`depend`/`alias`/`env` 复用 deltic 内置 |
| 插件 | 全部 deltic 原生：compile-cache（per-task 摘要 + extraDeps 版本戳）、dep-graph、clean（产物追踪） |
| 编排 | `WeappCompiler` 门面（组合）：run/watch/stop + npm 构建编排（依赖清单哈希门 + package.json watcher） |

程序化使用：

```ts
import { createWeappCompiler, resolveWeappOptions } from 'weapp-gulp-service'

const options = await resolveWeappOptions({ config: 'weapp.config.js' })
const compiler = createWeappCompiler(options)

await compiler.watch()   // 或 run() / stop() / incrementCompile(...)
```

缓存目录为项目根下的 `.wgs/`（SQLite），建议加入 `.gitignore`。

## License

MIT
