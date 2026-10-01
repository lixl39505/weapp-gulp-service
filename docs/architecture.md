# wgs v2 架构

wgs v2 是 [deltic](../)（通用增量编译内核）之上的小程序领域层。原则：**组合优于继承；通用能力下沉 deltic，wgs 不做 workaround**。

## 分层

```
CLI (src/cli.ts)                    serve / build / upload / build:npm，runCli(deps) 可注入
  └─ 配置层 (src/config)            jiti 加载 weapp.config.* → env 链 → objectMerge → callback
      └─ WeappCompiler (src/compiler.ts)   组合门面：toUserConfig() + npm 构建编排
          └─ deltic Compiler        任务/管道/插件/缓存/依赖图/watch 的执行引擎
```

## 任务表（weappTasks）

| 任务 | 匹配 | 管道 | compileAncestor |
|---|---|---|---|
| wxml / wxs | `**/*.wxml`、`**/*.wxs` | deltic alias（自定义策略） | |
| js | `**/*.js` | deltic 内置 `js` | |
| less | `**/*.less` | env → alias → depend → dep-add → less 核心 | ✅ |
| css / wxss | | px2rpx / base64 等核心 | |
| img | `**/*.{imgType}` | deltic `depend` | ✅ |
| json / json5 | | env → (str-json5) → app-json → depend | |
| mp / vue | `**/*.mp`、`**/*.vue` | `sfc` 单管道（解析→切片编译→样式合并） | |

增量编译的「扩展名→任务」映射由 deltic 的 `taskTypeMap` 承担（imgType 各扩展 → img）。

## 关键机制

- **per-task 缓存摘要**：每个任务的配置单独计算 sha1 并与其文件绑定——less 任务参数变更只失效 `.less`（deltic compile-cache）。
- **extraDeps**：`compileCachePlugin({ extraDeps: () => [wgsVersion] })` —— wgs 升级可靠失效缓存。
- **产物追踪 clean**：终端 sink 记录 `originalPath → 输出路径`，删除源文件精确清理（SFC 子目录、route-map 全覆盖）。
- **npm 构建**：清单（依赖声明 + node_modules/miniprogram_npm 目录戳 + 私钥/CLI 环境键）sha1 与上次比对，变化才 `npm install/update` + `wx.buildNpm`（tolerant）；serve 期间由 wgs 自建 chokidar 监听 package.json。
- **缓存状态**：`.wgs/state.db`（SQLite，经 deltic SqliteState）。

## 与 1.0 的差异清单

- 管道名 `gulp-x → x`；`--no-npm-build` → `--no-build-npm`；上传 `-dd` → `--verbose`
- env 不再写 `process.env`（callback + `options.env` 取值）
- alias 结果显式 `./` 前缀；`subPackages` 驼峰拼写受支持
- lessVar 产物固定为 `variables.js/.wxss`（1.0 相同），不再依赖中间 dest
- 修复：`project.config.json` 缺 `setting` 不再崩溃；`subPackages` 依赖收集；Windows 路径的尾段去重
