# 从 1.0 迁移到 2.0

wgs 2.0 基于 [deltic](https://github.com/lixl39505/deltic)(通用增量编译内核)完全重写:TypeScript 7 / ESM / gulp 5 / SQLite 状态存储。**配置文件与 CLI 基本兼容,程序化 API 与内部扩展点不兼容。**

1.0 已归档至 tag `1.0` 与永久分支 `1.0`(仅维护,不再接受新特性);1.0 的使用文档(`docs/md/`)随分支保留,本文只讲迁移。

## 环境要求

| | 1.0 | 2.0 |
|---|---|---|
| Node.js | >= 12.4.0 | **>= 20** |
| 模块系统 | CJS | ESM(打包产物仍通过 `wgs` CLI / `dist` 入口使用,无感知) |
| 测试/工程 | gulp 4 + mocha | gulp 5 + vitest |

## CLI

| 1.0 | 2.0 | 说明 |
|---|---|---|
| `wgs` / `wgs serve` | 同左 | 默认命令仍是 serve(编译一次 + watch) |
| `wgs build` | 同左 | 默认 mode=production |
| `wgs upload -v <ver> [desc]` | 同左 | verbose 旗标由 `-dd` 改为 **`--verbose`** |
| `wgs build:npm` | 同左 | 仅构建 `miniprogram_npm`,不编译 |
| serve `--no-build-npm` / build `--no-npm-build` | **统一为 `--no-build-npm`** | |
| `-c, --config` / `-m, --mode` | 同左 | 默认配置文件仍是 `weapp.config.js` |

## 配置文件(weapp.config.*)

- 文件名不变,扩展名支持 `.js` / `.mjs` / `.ts` / `.mts`(jiti 加载);找不到配置文件时仍可零配置构建。
- 合并规则不变:defaults ⊕ 用户配置 ⊕ CLI 参数;`callback(options, context)` 仍支持同步修改、返回新对象整体替换、或返回 Promise 异步替换。
- **env 不再写入 `process.env`**——值随 resolved options 流入 `env` 管道与 wx-tool。动态取值改用 `callback` + `options.env`:
  ```js
  // 1.0:config 加载后 process.env.FOO 可用,业务代码运行时读 process.env
  // 2.0:业务代码中的 process.env.X 在编译期被替换为字面量;config 里需要 env 值时:
  module.exports = {
      callback(options) {
          options.lessVar = `src/styles/${options.env.APP_THEME}.less`
      },
  }
  ```
- `.env → .env.local → .env.[mode] → .env.[mode].local` 链与优先级不变;env 值统一字符串化;`env.mode` 标记保留(1.0 parity)。

## 缓存与状态

- `.wgs/db.json`(lowdb JSON)→ **`.wgs/state.db`(SQLite)**。旧缓存不迁移:升级后删除 `.wgs/`,首次构建全量重编,之后增量恢复。
- 缓存摘要是 **per-task 粒度**:改 less 任务参数只失效 `.less` 文件,不再整包失效。
- `.wgs/` 记得加入 `.gitignore`。

## 任务与语法能力

默认任务表按扩展名 1:1 保留(wxml / wxs / js / less / css / wxss / img / json / json5 / mp / vue),任务字段 `test` / `use` / `compileAncestor` / `cache` / `output` 语义不变。语法增强全部保留:less(含 `lessVar`)、px2rpx、图片 base64、路径别名、环境变量、json5、`.vue`/`.mp` 单文件组件、`app.json` 扩展路由。

`imgType` 各扩展名通过 deltic 的 `taskTypeMap` 路由到 img 任务(1.0 是动态生成 glob)。

## 行为差异与修复

- **alias 输出语义修正**:同目录别名显式 `./` 前缀;保留 `../` 真实相对深度(1.0 会剥掉前导 `../`);未命中别名的裸包名请求不动。
- `subPackages` 驼峰写法受支持(1.0 只认 `subpackages`)。
- `project.config.json` 缺 `setting` 字段不再崩溃。
- `lessVar` 产物固定为 `variables.js` / `variables.wxss`。
- 产物清理精确到每个源文件实际发射的产物(含 SFC 子目录、route-map)。
- Windows 路径的尾段去重修复。

## 程序化 API(破坏性)

```ts
// 1.0
import Compiler from 'weapp-gulp-service'
const compiler = new Compiler(options)
Compiler.use(plugin)
Compiler.installHook('afterCompile', handler)

// 2.0
import { createWeappCompiler, resolveWeappOptions, definePlugin } from 'weapp-gulp-service'
const options = await resolveWeappOptions({ config: 'weapp.config.js' })
const compiler = createWeappCompiler(options)
```

- 插件改为 deltic 的命名插件体系:`definePlugin(name, (api) => { api.extendContext(...) / api.registerPipe(...) })`;钩子经 `api.hooks.on('afterCompile', ...)` 注册,按实例隔离。
- 自定义管道经 deltic 的 pipe 注册(`registerPipe` / `pipes` 配置)接入,不再有 `gulp-x` 前缀的内置 piper 查找链。
- 默认导出仍保留 `WeappCompiler` 类形状,但推荐使用 `createWeappCompiler` 门面。
- `callback` 的 `context.Compiler` 现在是编译器工厂函数(1.0 是类),仅用于 `callback` 内构造编译器的场景。

## 升级步骤

1. 升级 Node ≥ 20,确认包管理器为 pnpm。
2. `pnpm add -D weapp-gulp-service@2`。
3. 删除项目下的 `.wgs/`(旧 JSON 缓存不兼容)。
4. 检查 `weapp.config.*`:依赖 `process.env` 的配置改写为 `callback` + `options.env`;CLI 脚本中的 `--no-npm-build`、`-dd` 旗标更名。
5. `wgs build` 全量构建,对照 `dist/` 产物;`project.config.json` 的 `miniprogramRoot` 指向不变。
6. 有问题先对照 `docs/architecture.md`(分层与机制)与本 README;1.0 行为细节回分支 `1.0` 查阅。
