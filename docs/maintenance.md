# weapp-gulp-service 架构与维护说明

> 面向维护者的全景文档：分层结构、编译流水线、缓存与依赖图机制、扩展点，以及当前代码里值得注意的坑。
>
> 版本基线：`package.json` v1.0.13（分支 `main`）。文中结论均以仓库当前代码为准，与 `docs/md` 下的使用文档不一致之处在“已知问题”里单独列出。

---

## 1. 项目定位

`weapp-gulp-service` 是一个基于 gulp 4 的**微信小程序预编译工作流**：它把原生小程序不支持的语法（less、json5、路径别名、环境变量、单文件组件等）在构建阶段转换成小程序可识别的产物，并额外提供增量编译、编译缓存、依赖图联动、自动构建 npm、代码上传等工程化能力。

| 项目 | 说明 |
| --- | --- |
| 包名 | `weapp-gulp-service` |
| 可执行命令 | `weapp-gulp-service`、`wgs`（均指向 `src/bin/cli.js`） |
| 入口 | `src/index.js`，导出 `Compiler` 类（已预装 3 个内置插件） |
| 运行环境 | Node.js >= 12.4.0 |
| 包管理器 | pnpm（`preinstall` 脚本用 `only-allow pnpm` 强制） |
| 发布内容 | `package.json.files` 声明为 `src/` 与 `templates/` |
| 官网 demo | `templates/weapp-project`，可直接作为项目模板 |

核心设计思想：**用“任务 + 管道（piper）”描述编译，用“插件 + hook”扩展编译器，用“依赖图 + 缓存”换取增量编译性能。**

---

## 2. 目录结构

```
.
├── src
│   ├── index.js                 # 包入口：注册内置插件后导出 Compiler
│   ├── bin/cli.js               # 命令行入口（serve / build / upload / build:npm）
│   ├── config
│   │   ├── constants.js         # 依赖分析用正则（js/wxml/css 引用匹配）
│   │   ├── defaults.js          # 默认配置（含默认 tasks）
│   │   ├── index.js             # resolveOptions：合并 CLI 参数 + 用户配置 + 默认值
│   │   └── tasks.js             # 内部任务（目前仅 npm 构建任务 pkg）
│   ├── core
│   │   ├── compiler.js          # 编译器核心：生命周期、任务调度、上下文、钩子
│   │   ├── ext.js               # app.json 扩展语法解析（路由对象写法）
│   │   ├── progress.js          # 全局进度条单例
│   │   ├── require-piper.js     # piper 解析与注册表
│   │   ├── watcher/             # 源码 watcher、package.json watcher
│   │   └── wx-tool/             # 微信开发者工具 cli / miniprogram-ci 集成
│   ├── internal/                # 内置 piper（gulp 流处理插件），按名称引用
│   ├── plugins/                 # 编译器插件：clean、dep-graph、compile-cache
│   └── utils/                   # 通用工具：helper、cmd、connector、scheduler、sfc-parser …
├── templates/weapp-project/     # 项目模板（含 .env、weapp.config.js、示例页面）
├── test/                        # mocha 单测（fakes / fixture / shared / unit）
├── docs/md/                     # 使用文档（配置、语法增强、工具特性）
└── docs/MAINTAINS.md            # 本文档
```

---

## 3. 启动链路

```
CLI (commander)
   │  解析命令与选项
   ▼
resolveOptions(cmdOptions, { Compiler })      src/config/index.js
   │  1. 按 mode 读取 .env 系列文件 → process.env
   │  2. require 用户 weapp.config.js
   │  3. 合并：defaults() ← 用户配置 ← CLI 参数
   │  4. 归一化 ignore，执行 callback（支持异步）
   ▼
new Compiler(options)                          src/core/compiler.js
   │  构造函数触发 _init()（返回 _ready Promise）
   │  计算 baseDir / cacheDir / sourceDir / outputDir，解析 alias、npmList
   │  创建 .wgs 缓存目录，连接 lowdb，触发 init hook
   ▼
compiler.run() 或 compiler.watch()
   │  归一化任务 → 注入编译上下文 → 清理过期产物 → 执行任务 → 上游联动补偿
   ▼
[watch 模式] sourceWatcher + pkgWatcher
```

### CLI 命令一览（`src/bin/cli.js`）

| 命令 | 默认选项 | 行为 |
| --- | --- | --- |
| `wgs` / `wgs serve` | `--config weapp.config.js`、`--mode development`、可 `--no-build-npm` | 编译一次后进入 watch |
| `wgs build` | `--mode production`、`--no-npm-build` | 仅编译一次 |
| `wgs upload -v <ver> [desc]` | `--mode production`、`--verbose` | 先编译，再调用 wx-tool 上传代码 |
| `wgs build:npm` | `--mode production` | 直接调用 wx-tool 构建 `miniprogram_npm` |

`upload` 未传 `desc` 时，自动生成 `"<编译时间> <mode> v<ver>"` 作为备注。

---

## 4. 配置层

### 4.1 合并规则

`src/config/index.js` 的 `objectMerge(defaults(), options)` 规则：

- 对象 → 递归合并（`objectMerge`）；
- 数组 → 直接替换（浅拷贝覆盖）；
- `undefined` 的字段会被忽略（即“不覆盖”）；
- 未识别的字段原样保留，可被 `callback`、插件消费。

因此用户配置**不是全量替换**，只需要写差异部分。

### 4.2 环境变量加载优先级

`loadProcessEnv(mode, configDir)` 依次读取（后者覆盖前者）：

```
.env  →  .env.local  →  .env.[mode]  →  .env.[mode].local
```

随后 `weapp.config.js` 中的 `env` 字段优先级最高（`Object.assign(envs, options.env)`），最终整体写入 `process.env` 并保存在 `options.env`。

编译时 `gulp-env` 会把源码里的 `process.env.XXX` 替换成**字面量**（不是运行时读取），同时把 `.env/XXX` 登记为伪依赖节点，用于缓存失效判断。

### 4.3 callback 与 npm 配置解析

- `options.callback(options, { Compiler })` 支持同步修改配置、注册插件，或返回 Promise（异步配置）。
- `resolveNpmList(options)` 决定自动构建 npm 的目标：若 `project.config.json` 开启了 `setting.packNpmManually`，则读取 `packNpmRelationList`；否则默认取 `output/package.json` 与 `output` 目录。

---

## 5. 编译器核心（`src/core/compiler.js`）

`Compiler extends EventEmitter`，是整个工具的骨架。

### 5.1 关键实例状态

| 字段 | 含义 |
| --- | --- |
| `_running` / `_compiling` / `_inited` | 运行、编译、初始化状态锁 |
| `_hooks` | 生命周期钩子表 |
| `_watchers` | 已创建的 watcher 列表 |
| `_userTasks` / `_internalTasks` | 归一化后的任务配置 |
| `_db` | `.wgs/db.json`（lowdb）句柄 |
| `_compileContext` | 注入到 gulp 流的上下文原型 |
| `baseDir` / `cacheDir` / `sourceDir` / `outputDir` | 由配置推导出的绝对路径 |
| `_ignore` | 全局忽略：`**/node_modules/**` + 用户 ignore + output + cache |

### 5.2 编译流程

`run()` 与 `watch()` 共用同一条主链路：

1. `_normalizeTasks()`：归一化用户任务与内部任务；
2. `_setCompileContext()`：收集实例属性、原型方法与内部方法，构造上下文原型；
3. `_clean()`：`cleanExpired()` 找出源码中已删除的文件并删除对应产物，触发 `clean` hook；
4. `_runTasks()`：
   - 统计待编译文件总数（驱动进度条）；
   - 触发 `beforeCompile` hook；
   - 用 `gulp.series` 串联「内部任务 → 用户任务 → 收尾（更新依赖图 + 保存 env）」；
   - 触发 `afterCompile` hook，输出耗时与缓存命中统计；
   - 出错时触发 `taskerror` hook 并 reject；
5. `_compileUpStream()`：若本次存在缓存命中，补偿编译依赖它的上游模块（避免因缓存跳过导致产物不一致）；
6. `watch()` 额外启动 `sourceWatcher` 与 `pkgWatcher`。

### 5.3 生命周期钩子

| Hook | 时机 | 典型用途 |
| --- | --- | --- |
| `init` | 编译器初始化完成 | 读取数据库状态（内置插件都挂了这里） |
| `clean` | 清理过期产物前后 | 同步清理依赖图/缓存 |
| `beforeCompile` | 所有任务开始前 | 重置统计、检测配置变更 |
| `afterCompile` | 所有任务完成后 | 持久化状态、追加产物 |
| `taskerror` | 任务出错 | 清理出错文件的缓存 |

钩子签名：`function ({ next, ...payload }) { /* this 指向 compiler */ next() }`，必须调用 `next()`（支持异步，等价于回调式控制流）。

### 5.4 会话与文件上下文

- `createCompileSession()`：一次编译共享的会话对象，记录 `files`（实际编译的文件）、`total`（扫描总数）、`totalCache` / `totalHit`（缓存统计）、起止时间。
- `createFileContext(file, session)`：每个文件一个上下文，继承 `_compileContext`，并携带 `originalPath`、`customDeps`（自定义依赖）、`depended`、`session`。
- 上下文通过原型链暴露 compiler 上**非 `_` 开头**的属性与方法（含插件注入的方法），piper 里常见的 `file.context.depend(...)`、`file.context.getGraphNode(...)` 都来自这里。

### 5.5 静态 API（对外扩展接口）

| API | 作用 |
| --- | --- |
| `Compiler.use(plugin, options)` | 安装插件（去重，直接调用 `plugin(Compiler, options)`） |
| `Compiler.installHook(name, handler)` | 注册钩子，支持传对象批量注册 |
| `Compiler.setPipe(name, fn)` / `getPipe` / `removePipe` | 注册/读取/移除 piper |

---

## 6. 任务与 piper

### 6.1 任务配置归一化

每个任务对象支持：

```js
{
    test: '',              // required：glob | glob[] | { globs, options }
    use: [],               // required：piper 名称或模块，可写 [piper, options]
    compileAncestor: false,// 变更时是否联动重编上游模块
    cache: true,           // 是否启用 compiled 缓存
    output: true           // 是否输出到 output 目录
}
```

归一化细节：`test` 可为函数（入参为完整配置）；字符串会包装成 `{ globs, options }`；`globs` 统一为数组并**相对于 `sourceDir` 解析**；`options.ignore` 会自动叠加全局 `_ignore`；`use` 中未指定 options 时默认传入整个配置对象。

### 6.2 默认任务（`src/config/defaults.js`）

| 任务 | test | use | compileAncestor | 说明 |
| --- | --- | --- | --- | --- |
| `wxml` | `./**/*.wxml` | `gulp-wxml` | 否 | 仅路径别名替换 |
| `js` | `./**/*.js` | `gulp-js` | 否 | 别名 + 环境变量 + 依赖收集 |
| `wxs` | `./**/*.wxs` | `gulp-wxs` | 否 | 仅路径别名替换 |
| `less` | `./**/*.less` | `gulp-less` | 是 | 编译为 wxss，可选 px2rpx、base64 |
| `css` | `./**/*.css` | `gulp-css` | 否 | 重命名为 `.wxss` |
| `wxss` | `./**/*.wxss` | `gulp-wxss` | 否 | 别名 + 依赖 + base64 |
| `img` | 由 `imgType` 动态生成 | `gulp-img` | 是 | 仅登记依赖图 |
| `json` | `./**/*.json` | `gulp-json` | 否 | json5 解析 + app.json 扩展 |
| `json5` | `./**/*.json5` | `gulp-json` | 否 | 同上 |
| `mp` | `./**/*.mp` | `gulp-mp` + `gulp-mp-concat` | 否 | 单文件组件 |
| `vue` | `./**/*.vue` | `gulp-mp` + `gulp-mp-concat` | 否 | 单文件组件 |
| `pkg`（内部） | `npmList[].path` | `gulp-pkg` | 否 | `cache:false`、`output:false`，npm 构建专用 |

> `less` 与 `img` 之所以 `compileAncestor: true`：它们的产物会替换/影响引用方（变量注入、base64 内联），源文件变了必须让上游页面重新编译。

### 6.3 piper 解析（`src/core/require-piper.js`）

`rqp(request)` 的解析顺序：

1. 命中注册表缓存 → 直接返回；
2. 尝试 `require('../internal/' + dashify(request))`（如 `gulp-mp-alias` → `src/internal/gulp-mp-alias`）；
3. 回退到 `require(request)`（第三方 gulp 插件）；
4. 传入函数则直接使用（HOF）。

找不到时抛 `can not find '<name>'`。

### 6.4 内置 piper 清单（`src/internal/`）

| 文件 | 职责 |
| --- | --- |
| `gulp-context` | 注入 `file.context`，`session.total++` |
| `gulp-compile-cache` | 命中缓存则中断该文件后续管道（配合进度 +1） |
| `gulp-progress` | 进度条 +1 |
| `gulp-mp-alias` | 路径别名替换（js/wxs/wxml/css/less 等，按扩展名选正则） |
| `gulp-env` | `process.env.X` 字面量替换 + 登记 `.env/X` 伪依赖 |
| `gulp-depend` | 按 `matchers`（正则或函数）收集依赖写入依赖图 |
| `gulp-dep-add` | 手动追加依赖（须在 `gulp-depend` 之后） |
| `gulp-less` | less → wxss 全流程（含全局变量注入分支） |
| `gulp-less-var` | less 变量 → JS 对象 + `page{--x:...}` CSS 变量，并移除全局变量文件的依赖关系 |
| `gulp-css` | css → wxss（px2rpx、重命名、`.css` 引用替换、base64） |
| `gulp-wxss` | 别名 + 依赖 + base64 |
| `gulp-wxml` / `gulp-wxs` | 仅别名替换 |
| `gulp-js` | 别名 + 环境变量 + `require`/`import` 依赖收集 |
| `gulp-json` | 环境变量 + json5 解析 + `app.json` 分支 + `usingComponents/pages/subpackages` 依赖展开 |
| `gulp-json5` | 复用 `gulp-json` 并把扩展名改为 `.json` |
| `gulp-str-json5` | json5 文本 → 标准 JSON 文本 |
| `gulp-app-json` | 解析扩展版 `app.json`，额外产出 `route-map.js`、`route-name-map.js` |
| `gulp-sfc` | 把 `.vue` / `.mp` 拆成 `wxml / js / json / style` 分片 |
| `gulp-mp` | 单文件组件入口：拆包后按扩展名再分发到各子管道 |
| `gulp-mp-concat` | 合并多个同类 style 分片 |
| `gulp-pkg` | npm 任务聚合：收集依赖信息 → 内容 hash 判断 → 触发 wx-tool 构建 |
| `gulp-npm-dep` | 收集 `dependencies`、`node_modules`/`miniprogram_npm` 时间戳、ci/cli 路径 |
| `gulp-build-npm` | 检测缺包并安装，调用 `wxBuildNpm` 生成 `miniprogram_npm` |
| `gulp-once-v2` | 基于内容 hash 的“未变化则跳过” |
| `gulp-img` | 仅登记依赖（图片本身不需要编译） |
| `gulp-img-base64` | `gulp-base64-v2` 包装 |
| `gulp-pass-through` | 空透传（占位/测试） |
| `gulp-error` | `GulpError` 工厂，`partial` 后可在流中统一包装错误并保留 `file` |

### 6.5 单个任务的管道结构

`Compiler#createGulpTask()` 为每个任务生成一个 gulp stream task：

```
src(globs, { base: sourceDir })
  → gulp-context(session)          // 注入文件上下文
  → gulp-compile-cache(...)        // 命中即中断
  → combine(...use pipes)          // 任务自定义的转换链
  → dest(outputDir)                // output 为 true 时
  → gulp-progress()                // 进度 +1
```

用户只需要定义中间那段 `use`，`src` 与 `dest` 由编译器统一负责。

---

## 7. 内置插件（`src/plugins/`）

三个插件在 `src/index.js` 中默认安装，均通过 `installHook` + 扩展 `Compiler.prototype` 实现。

### 7.1 `clean` —— 产物清理

- hook：`init`（读取 `fileList`、重置统计）、`beforeCompile`（重置计数）。
- 方法：`isNewFile`、`cleanExpired`、`cleanSpec`、`getOutputPath`、`saveFileList`。
- 逻辑：对比上次编译的文件列表与当前 `sourceDir` 下的实际文件，删除已消失文件对应的产物；`.vue`/`.mp` 因产出一个目录，删除时用 `<dir>/**` 通配。

### 7.2 `dep-graph` —— 依赖图

- hook：`init`（读取 `depGraph`）、`clean`（删除节点并重建反向关系）、`beforeCompile`（重置统计）。
- 方法：`getFileId`、`getGraphNode(ById)`、`depend`、`reverseDep`、`traceReverseDep`、`addDep`、`removeDep`、`removeGraphNodes`、`saveDepGraph`。
- 数据：节点形如 `{ path, dependencies: [], requiredBy: [] }`，键为相对 `sourceDir` 的归一化路径；依赖图持久化在 `.wgs/db.json`。

### 7.3 `compile-cache` —— 编译缓存

- hook：`init`（读取 `compiled` / `checksums`）、`clean`（移除缓存）、`beforeCompile`（记录版本、输出目录存在性、配置是否变化）、`afterCompile`（持久化版本号）、`taskerror`（清理出错文件缓存）。
- 方法：`checkFileCached`、`checkFileChanged`、`checkOptionsChanged`、`removeCache`、`saveCompileCache`、`saveChecksums`。

缓存失效的全部条件（任一命中即重新编译）：

1. 包版本号变化；
2. `output` 目录不存在；
3. 配置（排除 `env/args/app/config/output/source/ignore/tasks`）内容变化；
4. 该文件没有历史记录；
5. 文件 `mtimeMs` 变化；
6. 依赖的 `.env/XXX` 对应的环境变量值变化。

---

## 8. 关键机制

### 8.1 增量编译与上游联动

```
watch 事件 (add / change / unlink)
   → source-watcher 收集并 debounce 200ms
   → compiler.incrementCompile(paths)
        ├─ traceUpstreamModules(paths)   // 仅 compileAncestor 任务
        ├─ groupBy(getTaskType)          // 按扩展名分组（图片归入 img）
        ├─ 克隆任务配置并强制 cache = false
        └─ nextTask → _runTasks
   → unlink 路径走 cleanSpec + clean hook
```

`pkgWatcher` 单独监听 npm 相关的 `package.json`，任何事件都会重置进度并重跑 `pkg` 任务。

`incrementCompile` 通过 `queueTask`（`src/utils/scheduler.js`）串行排队，遇到错误立即中止队列，保证不会并发写同一批产物。

### 8.2 缓存体系（`.wgs/db.json`）

| Key | 写入方 | 用途 |
| --- | --- | --- |
| `fileList` | clean 插件 | 上次编译的文件列表，用于识别过期产物 |
| `compiled` | compile-cache 插件 | 相对路径 → `mtimeMs`，文件级缓存 |
| `checksums` | compile-cache 插件 | 内容 hash（默认 sha1），支持 namespace |
| `depGraph` | dep-graph 插件 | 依赖图与反向引用 |
| `env` | compiler 收尾 | 上次编译使用的环境变量快照 |
| `version` | compile-cache 插件 | 上次编译时的工具版本号 |

写库统一走 `debounce(500ms)`，避免频繁落盘。

### 8.3 环境变量与缓存联动的闭环

`gulp-env` 替换 `process.env.X` 时，会把 `sourceDir/.env/X` 作为**自定义依赖**写入依赖图；`checkFileCached` 再反查这些伪依赖，比较 `lastEnv` 与当前 `process.env`。这样即使源码文件 `mtime` 没变，只要 `.env` 值变了，产物也会重新生成。

### 8.4 单文件组件（`.vue` / `.mp`）

1. `gulp-sfc` 用 `htmlparser2` 解析（`src/utils/sfc-parser.js`），按顶层节点类型收集：
   - `<template>` → `wxml`（同时做指令转换与标签别名）；
   - 无 `name` 的 `<script>` → `js`；
   - `<script name="json">` → `json`（用 `module-from-string` 求值后序列化）；
   - `<style lang="...">` → 按语言生成 `less`/`css`/`wxss` 分片。
2. 分片路径为 `<dir>/<stem>/<stem>.<ext>`，并携带 `sliceNum` / `sliceCount`；
3. `gulp-mp-concat` 把多个 style 分片按序合并；
4. `gulp-mp` 再按扩展名把分片分发到 `gulp-json` / `gulp-js` / `gulp-wxml` / `gulp-less` / `gulp-css` 子管道，从而复用全部既有能力。

指令映射：`v-for → wx:for(+item/index)`、`v-if → wx:if`、`v-else-if → wx:elif`、`v-else → wx:else`、`v-show → hidden`、`:prop → prop="{{ }}"`、`:key → wx:key`、`@event → bind:`、`@event.stop → catch:`、`@event.capture → capture-bind:`、`@event.mut → mut-bind:`；标签别名由 `mp.tagAlias` 配置。

### 8.5 `app.json` 扩展与路由表

`src/core/ext.js` 按平台（目前仅 `wx`）解析 `app.json`，把 `pages` / `subpackages` 中形如 `{ path, name, meta, children }` 的节点深度遍历展开：

- 叶子节点输出为标准 `path` 字符串数组；
- 其余字段收集进 `routeMap`（路径 → 元数据）；
- 带 `name` 的节点额外写入 `routeNameMap`（名称 → 路径）。

`gulp-app-json` 会额外生成两个虚拟文件，最终落到 `dist/route-map.js` 与 `dist/route-name-map.js`，供业务侧按名取路由。

### 8.6 less 变量双产出

配置 `lessVar` 指向的全局 less 文件会被注入每个 less 文件的编译上下文（`less.modifyVars.hack += '@import "..."'`），并被登记为所有 less 文件的依赖。同时该文件本身经 `gulp-less-var` 产出：

- `<stem>.js`：变量对象的 ESM 默认导出（键名 camelCase）；
- `<stem>.wxss`：`page { --var-name: value; }` 形式的 CSS 变量。

为避免全局变量文件“污染”依赖图的上游链，插件在 `afterCompile` 阶段会递归移除下游模块对该文件的依赖引用。

### 8.7 自动构建 npm

1. `pkg` 内部任务以 `npmList[].path` 作为输入（默认 `dist/package.json`）；
2. `gulp-npm-dep` 把 `dependencies`、`node_modules` / `miniprogram_npm` 的时间戳、`WE_CLI` / `WE_APP_PRIVATE_KEY_PATH` 写入文件内容；
3. `gulp-once-v2` 用内容 hash 判断是否需要重建（只有依赖声明或目录状态变化才继续）；
4. `gulp-build-npm` 检测缺失包（`npm ls --json` + semver 比对）并 `npm install --no-save` / `npm update`，然后调用 wx-tool 构建。

### 8.8 wx-tool：ci 与 cli 双通道

`src/core/wx-tool/index.js` 按 **ci 优先、cli 兜底** 的顺序初始化接口实例：

- `ci` 模式：`miniprogram-ci` + `WE_APP_PRIVATE_KEY_PATH`，支持手动/自动两种 packNpm 方式，上传走 `ci.upload`；
- `cli` 模式：微信开发者工具命令行 + `WE_CLI`，通过 `execSync` 调用 `upload` / `buildNpm` 等子命令。

两者都不可用时不会中断编译，只打印黄色告警，提示手动构建 npm。

---

## 9. 测试与开发

| 配置 | 内容 |
| --- | --- |
| `.mocharc.js` | 预加载 `test/init.js`、`test/hooks.js`、`@babel/register`；用例 `test/**/*.spec.js` |
| `test/init.js` | 注入 `global.should/expect`、`chai-as-promised`、`global.alias2path` 桩，关闭 proxyquire 缓存 |
| `test/hooks.js` | 每个用例后 `sinon.restore()` |
| `babel.config.js` | `module-resolver` 别名：`@`、`config`、`core`、`internal`、`plugins`、`utils`、`~`、`~h`、`~f`；并让 `proxyquire` / `alias2path` 走别名转换 |
| `jsconfig.json` | 与 babel 别名保持一致，供编辑器跳转 |
| `test/shared/helper.js` | fixture 定位、代码压缩（terser / clean-css / html-minifier-terser）、流与数组工具 |
| `test/fakes/*` | `compiler-hooks`、`compiler-session`、`defaults` 三个测试替身 |
| `test/fixture/*` | css / img / js / json / less / sfc / wxml / wxs / wxss 样例 |
| `test/wx-dev-tool-cli` | 空文件，作为 `WE_CLI` 的存在性校验桩 |

常用脚本：

```bash
pnpm test          # mocha 全量单测
pnpm coverage      # nyc + html 报告
pnpm format        # prettier 格式化 src/**/*.js
pnpm patch|minor   # npm version + npm publish（注意与 only-allow pnpm 的差异）
```

单测覆盖 `config`、`core`（compiler / watcher / wx-tool / progress / require-piper）、`internal` 各 piper、`plugins` 与 `utils`，是目前判断“改动是否破坏既有行为”的主要依据。

---

## 10. 扩展点速查

| 需求 | 做法 |
| --- | --- |
| 新增文件类型编译 | 在 `tasks` 中定义 `{ test, use }`，`use` 可引用内置 piper 或第三方 gulp 插件 |
| 复用一段转换逻辑 | `Compiler.setPipe('gulp-xxx', fn)` 后用名称引用；`getPipe` / `removePipe` 管理 |
| 注入编译流程 | `Compiler.use(plugin)`，在 plugin 内 `installHook({...})` 或扩展 `Compiler.prototype` |
| 读取/写入本地状态 | 上下文里的 `this.query(key, defaults)` / `this.save(key, value)` |
| 访问依赖图 | `file.context.depend(file, { matchers })`、`addDep`、`removeDep`、`traceReverseDep` |
| 动态改配置 | `weapp.config.js` 的 `callback(options, { Compiler })`，支持返回 Promise |

插件扩展建议：为避免与内部实现冲突，团队约定自定义属性/方法以 `$` 开头（如 `$foo`、`$getFoo`）。

---

## 11. 已知问题与维护注意事项

以下问题在当前代码中确实存在，改动相关模块前建议先确认，避免“修文档反而引入回归”。

**代码层面的脆弱点**

1. **隐式全局变量**：`src/core/progress.js` 的 `bar`、`src/plugins/compile-cache.js` 里的 `filechecksum` 都是未声明赋值。`src/internal/gulp-once-v2.js` 恰好读取全局 `filechecksum` 作为 `hit` 回调参数——一旦某个文件加上 `'use strict'`，或调整赋值顺序，npm 构建任务就会抛 `ReferenceError`。
2. **`gulp-json5.js` 引用大小写错误**：`require('gulpRename')`，在大小写敏感的 Linux/macOS 上会解析失败（默认任务未走到该文件，因此不易暴露）。
3. **`gulp-mp-alias.js` 的模块级缓存**：`keysPattern` / `opt` / `filePath` 被缓存在模块作用域，第一次调用的 alias 会一直生效；且 `subMatch.indexOf('/') === -1` 时 `substr(0, -1)` 会得到空串。
4. **`wx-tool` 的实例缓存**：`src/core/wx-tool/index.js` 用模块级 `wx` 缓存 ci/cli 实例，同一进程内切换项目会复用上一个项目的实例。
5. **`resolveNpmList` 缺少防御**：直接访问 `projConfig.setting.packNpmManually`，`project.config.json` 缺 `setting` 时会抛 TypeError。
6. **`Ext` 只识别 `subpackages`**：微信同时支持 `subPackages` 写法，该写法会走默认分支、不做路由展开。
7. **`clean.getOutputPath` 的时间/平台耦合**：用 `path.join` 拼 glob 再 `toGlobPath` 修正，文件名含 glob 特殊字符时可能失效。
8. 若干文件头部注释仍写 `// .js文件`（`gulp-css.js`、`gulp-less.js`、`gulp-img.js`、`gulp-pkg.js`），属复制粘贴残留。

**配置与工程一致性**

9. CLI `program.version('1.0.0')` 写死，与 `package.json` 当前版本不一致。
10. `serve` 的关闭开关是 `--no-build-npm`，`build` 的是 `--no-npm-build`，命名不统一，且 `build` 的该选项目前在代码中未被消费。
11. `.gitignore` 未包含 `/.wgs`，缓存目录容易被误提交（使用文档里也只写了“记得加入 gitignore”）。
12. `.npmignore` 排除 `/src`，而 `package.json.files` 又包含 `src/`，两者语义冲突，发布内容需以实测 `npm pack` 结果为准。
13. `preinstall` 强制 pnpm，但 `patch` / `minor` / `postversion` 脚本仍使用 `npm version` / `npm publish` / `git push`。

**文档与代码的偏差**

14. `docs/md/01 配置说明.md` 的默认配置示例缺少 `less` 之外的 `compileAncestor`，且 `mp`/`vue` 任务的 `use` 只写了 `gulp-mp`（实际为 `gulp-mp` + `gulp-mp-concat`）。
15. `docs/md/03 工具特性说明.md` 称内部 piper 位于 `src/core/internal`，实际目录是 `src/internal`；hook 列表也缺少 `taskerror`。

---

## 12. 延伸阅读

- [01 配置说明](md/01%20配置说明.md)：默认配置、合并规则、callback
- [02 语法增强说明](md/02%20语法增强说明.md)：less、px2rpx、base64、alias、环境变量、json5、路由扩展、单文件组件
- [03 工具特性说明](md/03%20工具特性说明.md)：增量编译、编译缓存、自定义任务、piper、插件与 hook
- [README](../README.md)：安装方式与命令行用法
