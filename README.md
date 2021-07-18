## 简介

weapp-gulp-service 是一款基于 gulp 实现的微信小程序预编译开发工具，可以有效提升原生小程序的开发效率。主要功能如下所示：

语法增强：

1. 支持 less
2. 支持 px 转 rpx
3. 支持图片转 base64
4. 支持路径 alias
5. 支持设置环境变量
6. 支持 json5 语法解
7. 扩展 app.json，支持表达力更好的路由写法
8. 支持自动构建 npm、上传代码
9. 支持单文件开发

工具特性：

1. 支持增量编译(watch 模式)
2. 支持编译缓存
3. 支持自定义任务
4. 支持插件扩展

## 安装/运行

全局安装并使用：

```bash
npm i weapp-gulp-service -g
# 项目根目录执行
weapp-gulp-service --config /user/workspace/xx/weapp.config.js
```

也可以局部安装并使用：

```bash
npm i weapp-gulp-service -D
# 项目根目录执行
npx weapp-gulp-service
```

另外可复制 templates/weapp-project 做为项目模版。

## 配置说明

每个 weapp-gulp-service 项目都必须提供一份配置文件（哪怕是一份空配置）。因为在 weapp-gulp-service 内部，以及配置文件本身，都是相对于配置文件所在目录而计算文件位置的。配置文件所在目录即项目根目录。

ps: 运行 weapp-gulp-service 时，如果不提供 config 参数，则默认视为读取当前环境下的 weapp.config.js 文件。

默认配置如下:

```js
module.exports = {
    // 环境变量
    env: {},
    // 编译模式
    mode: 'development',
    // 输出目录
    output: 'dist',
    // 源码目录
    source: 'src',
    // 图片类型
    imgType: ['jpg', 'png', 'svg', 'webp', 'gif'],
    // 路径别名
    alias: {
        '@': './src',
    },
    // less编译选项
    less: {
        javascriptEnabled: true,
    },
    // less全局混入文件路径（通常用于定义主题变量）
    lessVar: '',
    // postcss-px2rpx选项
    px2rpx: {
        times: 2, // px -> rpx 转换倍数
    },
    // 图片转base64选项
    base64: {
        baseDir: '', // 相对于所在css文件
        exclude: ['alicdn'],
        maxImageSize: 8 * 1024, // 8kb,
        deleteAfterEncoding: false, // 转换后删除原图片（慎用,g）
        debug: false, // 是否开启调试
    },
    // 任务配置
    tasks: {
        wxml: {
            test: `./**/*.wxml`,
            use: ['gulp-wxml'],
        },
        js: {
            test: `./**/*.js`,
            use: ['gulp-js'],
        },
        wxs: {
            test: `./**/*.wxs`,
            use: ['gulp-wxs'],
        },
        less: {
            test: `./**/*.less`,
            use: ['gulp-less'],
            compileAncestor: true,
        },
        css: {
            test: `./**/*.css`,
            use: ['gulp-css'],
        },
        wxss: {
            test: `./**/*.wxss`,
            use: ['gulp-wxss'],
        },
        img: {
            test: ({ imgType }) => `./**/*.{${imgType.join(',')}}`,
            use: ['gulp-img'],
        },
        json: {
            test: `./**/*.json`,
            use: ['gulp-json'],
        },
        json5: {
            test: `./**/*.json5`,
            use: ['gulp-json'],
        },
        mp: {
            test: `./**/*.mp`,
            use: ['gulp-mp'],
        },
        vue: {
            test: `./**/*.vue`,
            use: ['gulp-mp'],
        },
    },
}
```

可以在自定义配置文件中覆盖/扩展默认选项。比如：

```js
module.exports = {
    // 添加环境变量（优先级高于.evn等配置文件）
    env: {
        APPID: 'xxxxxxxxx',
    },
    // 路径别名
    alias: {
        _c: './src/components',
    },
    // 全局less
    lessVar: `src/theme/blue.less`, // 蓝色主题
}
```

自定义选项会以深度遍历的方式跟默认选项合并。

## cli 调用

### 开发

编译并 watching。

```bash
Usage: weapp-gulp-service serve [options]

Options:
  -c, --config <string>  配置文件，默认为weapp.config.js
  -m, --mode <string>    编译环境名称，默认为development
  --no-build-npm         禁用自动构建npm
  -h, --help             display help for command
```

ps：serve 名称可省略，即 `weapp-gulp-service [options]`

### 打包

只编译。

```bash
Usage: weapp-gulp-service build [options]

Options:
  -m, --mode <string>    编译环境名称，默认为production
  -c, --config <string>  配置文件，默认为weapp.config.js
  -h, --help             display help for command
```

### 构建 npm

等同微信开发者工具中的【构建 npm】

```bash
Usage: weapp-gulp-service build:npm [options]

Options:
  -m, --mode <string>    编译环境名称，默认为production
  -c, --config <string>  配置文件，默认为weapp.config.js
  -h, --help             display help for command
```

### 代码上传

等同微信开发者工具中的【上传代码】。

```bash
Usage: weapp-gulp-service upload [options] [desc]

Options:
  -v, --ver <string>     版本号，必填
  -m, --mode <string>    编译环境名称，默认为production
  -c, --config <string>  配置文件，默认为weapp.config.js
  -dd, --verbose         是否打印详细日志
  -h, --help             display help for command
```

###  小程序 ci/cli 集成说明

自动构建 npm 与上传代码两个功能前置依赖小程序官方服务——[wxdevtool-cli](https://developers.weixin.qq.com/miniprogram/dev/devtools/cli.html) 或者 [miniprogram-ci](https://developers.weixin.qq.com/miniprogram/dev/devtools/ci.html)。

如果使用 wxdevtool-cli（以下简称 cli 模式），需设置环境变量：

```bash
# macOS
WX_CLI=<安装路径>/Contents/MacOS/cli
# Windows
WX_CLI=<安装路径>/cli.bat
```

如果使用 miniprogram-ci（以下简称 ci 模式），需设置环境变量：

```bash
WE_APP_PRIVATE_KEY_PATH=<私匙路径>/private.xxxx.key
```

并安装全局依赖 miniprogram-ci；

```bash
npm i miniprogram-ci -g
```

两种方式二选一即可。如果二者同时设置，则优先使用 ci 模式。

## 语法增强详细说明

### 支持 less

支持使用 .less 文件替代 .wxss：

```less
// input: src/login.less
.login {
    &-btn {
        background: @primary-color;
    }
}
```

```less
// output: dist/login.wxss
.login-btn {
    background: #123456;
}
```

支持设置全局注入 less 变量（需要在配置中指明 lessVar)。如：

```less
// src/theme/blue.less
@primary-color: blue;

@font-size-xs: 10px;
@font-size-sm: 12px;
@font-size-md: 14px;
@font-size-lg: 16px;
```

另外 blue.less 还会生成对应的 js 版本，可供 js 引用：

```js
// dist/style/variables.js
export default {
    primaryColor: 'blue',
    fontSizeXs: '10px',
    fontSizeSm: '12px',
    fontSizeMd: '14px',
    fontSizeLg: '16px',
}
```

### px 转 rpx

可以通过 px2rpx 选项进行配置。默认是 1px=2rpx。

```less
// input: src/style/cell.less
.cell {
    margin-top: 20px;
    border-radius: 2px;
}
```

```less
// output: dist/style/cell.wxss
.cell {
    margin-top: 40rpx;
    border-radius: 4rpx;
}
```

### 图片转 base64

小程序不允许直接在 wxss 中以相对路径引用本地图片。该功能可以将图片转为 base64 编码，从而支持本地引用。

```less
// src
.login-btn-wx {
    background: url('@/images/wx.png') no-repeat center !important;
}
```

```less
// dist
.login-btn-wx {
    background: url(data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAIAAAACAC......glkJggg==)
        no-repeat center !important;
}
```

### 路径 alias

避免出现 require('../../../xx')。可通过 alias 选项配置。支持 require、@import '@/xxx' 、url('@/xxx')以及 src="@/xxx"。

```js
// input
import { throttle, runQueue, getPropByPath } from '@/utils/helper'
```

```js
// output:
import { throttle, runQueue, getPropByPath } from '../../utils/helper'
```

ps:
预编译后仍然是相对路径引用，不影响小程序上传代码保护功能的使用。

### 设置环境变量

在项目根目录下，支持使用 ini 格式文件配置环境变量。在 js 以及 json 文件中，可以通过 process.env.xx 来使用它们。

```bash
# 接口地址
APP_SERVER=https://xx.api.com/
# appid
APPID="xxxxxxxxx"
```

```js
// src/utils/axios.js
const baseURL = process.env.APP_SERVER
```

支持同时存在 4 类环境变量文件，其优先级依次升高：

```
.env
.env.local
.env.[mode]
.env.[mode].local
```

1. .env 是基础配置文件，优先级最低。
2. mode 可用于切换编译环境，如.env.production 用于生产环境（mode 可通过 cli 命令中传递）。
3. .local 主要用于定义本地环境变量(注意添加到.gitignore)，便于开发测试。

另外在 weapp.config.js 中也可以定义环境变量，而且其优先级高于所有 env 文件:

```js
module.exports = {
    env: {
        APP_SERVER: 'https://v2.api.com/',
    },
}
```

### json5 语法解析

所有.json 都使用 json5 语法解析，输出时再转为普通 JSON。
这样做的好处是，json 代码中可以使用注释、尾逗号、变量等等。

### 扩展 app.json，支持表达力更好的路由写法

小程序的路由只能在 app.json 中的 pages 或者 subPages 字段下配置，而且只支持写 path。一旦页面太多就不好维护。因此借鉴 vue-router，使其支持对象写法：

```js
{
    "pages": [
        {
            "path": "pages/tab-bar/tab1/tab1",
            "title": "首页",
            "meta": {
                auth: false, // 是否需要登录验证
            },
            "name": "home"
        },
        "pages/tab-bar/tab2/tab2",
    ]
}
```

这样写不仅能够清晰看到路由对应的页面名称，还可以为路由绑定元数据。
路由元数据经过编译会自动生成`dist/route-map.js`、`dist/route-name-map.js`文件以供使用，如：

```js
import routeNameMap from '@/route-name-map'

function getRouteByName(name) {
    return routeNameMap[name]
}
```

### 自动构建 npm、上传代码

见 cli 调用——小程序 ci/cli 集成说明

### 单文件开发

原生小程序开发一个页面需要创建 4 份文件，js、json、wxml、wxss 比较烦琐。因此支持直接使用.mp 或者.vue 单文件来开发页面（.vue 主要是为了复用 IDE 的语法高亮）。

```html
<!-- 对应index.wxml文件 -->
<template>
    <view class="home">Home2</view>
</template>

<!-- 对应index.js文件 -->
<script>
    global.wView({
        name: 'Home',
    })
</script>

<!-- 对应index.wxss文件，可以使用lang指定语种，默认为css。 -->
<style lang="less">
    .home {
        background-color: @primary-color;
    }
</style>

<!-- 对应index.json文件 -->
<script name="json">
    module.exports = {
        usingComponents: {},
        navigationBarTitleText: 'home',
    }
</script>
```

注意单文件 pages/index.vue 在编译后会输出

-   pages/index/index.js
-   pages/index/index.json
-   pages/index/index.wxml
-   pages/index/index.wxss

四份文件。因此在 usingComponents 中，应该使用`/pages/index/index`而不是`/pages/index`（以 dist 输出结构为准）

## 工具特性说明

### 增量编译

在 gulp-watch 的帮助下，我们可以监听到文件的改变，从而对其进行增量编译。但是有时侯仅仅编译发生改变的文件是不够的，还需要编译引用过它们的上游文件。因此工具在编译的过程中根据模块间的引用关系维护了一张依赖图（depGraph），便于在文件发生变动时找到其上游文件。

需要注意的是，尽管拥有全量依赖图，但并非所有文件变更都需要更新上游。因为小程序开发环境本身提供了模块加载以及热更新环境，它自己会走一遍打包流程。我们只需要对那些在预编译阶段进行过语法转换或者代码替换的文件采取同步更新其上游的措施，比如修改 less、修改 env（环境变量），而修改 js、wxss、wxml、json 等是不需要的（减轻微信开发者工具的负担 -.-）。

另外依赖图 depGraph 可以在.wgs/db.json 文件中看到。

### 编译缓存

在编译过程中，工具会在项目根目录下自动创建一个.wgs 文件夹（记得加入 gitignore)用于存放缓存信息。

其中一份文件叫.checksums，用于存放文件内容 hash 值。通过 checksums 可以实现基于文件内容（content）是否改变的缓存策略。目前应用该策略的只有 package.json 文件，具体点说，只有当修改 dependencies、devDependencies、peerDependencies 三个字段下的内容或者手动操作 node_modules 文件夹时（修改子文件夹无法识别），才会导致其 hash 值刷新，从而在下一次编译中触发 npm 安装以及构建。

另外一份文件叫 db.json，用于存放最近一次编译的本地信息，包括 fileList（参与编译的文件列表）、env（自定义环境变量）、depGraph（依赖图），compiled（文件编译时间戳）。通过 db.compiled 可以实现基于文件修改时间是否发生改变的缓存策略。目前大部分文件都是采取这个策略，具体点说，如果发现文件的 stat.mtimeMs 没有变过，则会跳过该文件的编译，dist 目录中仍为上一次的编译结果。

### 自定义任务

从配置项的 tasks 字段可以看出工具支持自定义任务。其中 wxml、js 等既是任务名称，也是文件后缀类型。任务配置对象说明如下：

```json
{
    "test": "", // required。待编译的文件，支持node-glob
    "use": [], // required。指定piper
    "compileAncestor": false, // 是否同步更新上游模块
    "cache": true, // 是否启用compiled缓存
    "output": true // 是否输出到dist
}
```

#### 复杂参数说明

test 可以接受一个 glob 表达式，也可以是一个返回 glob 表达式的函数。使用函数时会接受 options 参数，即整个配置对象。

use 用来指定一个或多个 piper。piper 是指标准的 gulp 插件（流处理），比如 gulp-if、gulp-rename。piper 可以用名称指代（需内部注册），或者直接使用模块本身，比如：

```js
const gulpIf = require('gulp-if')

{
    use: [gulpIf]
}
```

如果需要为 piper 传递参数，那么可以利用数组形式`[piper, options]`，其中 options 还可以是返回配置对象的函数，比如：

```js
{
    use: ['gulp-mp-alias', { alias: { @: './src' } }]
}

{
    use: ['gulp-mp-alias', (options) => {
        return {
            alias: { @: './src' }
        }
    ]
}
```

如果没有为 piper 指定参数，那么默认将当前整个配置对象传递给它。

#### 可复用 piper

在默认配置中出现的 task 都是内部已经写好的任务，其中所有 use 引用的 piper 也是内部已经写好的（所有内部 piper 都放在 src/core/internal 目录），可以直接通过名称去引用它们。比如：

```js
{
    // 自定义一个.ts文件编译任务
    tasks: {
        test: './**/*.ts',
        ts: [
            use: [
                'gulp-mp-alias', // 路径别名转换
                'gulp-env', // 环境变量替换
                'gulp-depend', // 支持依赖图
                'gulp-ts', // tsc编译
            ]
        ],
    }
}
```

一个标准的 gulp 工作流，一般都是从 src 开始，最后以 dist 结尾。因此工具内部将 src 以及 dist 部分封装了起来，用户只需定义中间的处理过程。src 部分除了查询目标文件外，还会添加进度信息、添加编译上下文对象等等。dist 部分除了输出编译产物外，还会进行进度汇报、更新本地缓存信息等等。

之前提到过只有注册过的 piper 才可以在 use 中直接通过名称引用。用户也可以注册自己的 piper，比如：

```js
// weppp.config.js
const Compiler = require('weapp-gulp-service')
const through = require('through2')

Compiler.setPipe('gulp-custom', function (options) {
    return through.obj(function (file, enc, cb) {
        // ...
    })
})

module.exports = {
    // ...
}
```

当然也提供了移除方法:

```js
Compiler.remove('gulp-custom')
```

注册 piper 的另一个好处便是，即使是在 piper 内部，也可以复用其它 piper，比如单文件编译插件 gulp-mp：

```js
// core/internal/gulp-mp.js
const gulpIf = require('gulp-if')
const gulpSfc = require('./gulp-sfc')
const combine = require('multipipe')
const rqp = require('../core/require-piper') // 用于引用piper

module.exports = function (options = {}) {
    return combine(
        gulpSfc(), // 单文件编译
        gulpIf(function (file) {
            return file.extname == '.json'
        }, rqp('gulp-json')(options)), // 复用gulp-json piper
        gulpIf(function (file) {
            return file.extname == '.js'
        }, rqp('gulp-js')(options)), // 复用gulp-js piper
        gulpIf(function (file) {
            return file.extname == '.wxml'
        }, rqp('gulp-wxml')(options)),
        gulpIf(function (file) {
            return file.extname == '.less'
        }, rqp('gulp-less')(options)),
        gulpIf(function (file) {
            return file.extname == '.css'
        }, rqp('gulp-css')(options))
    )
}
```

### 插件扩展

除了自定义 task 以及可复用的 piper，工具还支持 plugin。plugin 支持自定义声明周期——hooks，以及扩展 Compiler 原型，以便从整条编译链路上实现一些自定义逻辑。插件的原型如下所示：

```js
// custom-plugin.js
module.exports = function (Compiler) {
    Compiler.installHook({
        init() {
            // ...
        },
        beforeCompile() {
            // ...
        },
    })

    Compiler.prototype.$customMethod = function () {
        // ...
    }
}
```

安装插件：

```js
const Compiler = require('weapp-gulp-service')
const customPlugin = require('custom-plugin')

Compiler.use(customPlugin)

module.exports = {
    // ...
}
```

#### 自定义 hook

目前提供了 4 种 hook，分别是：

```json
{
    "init": [], // 初始化时
    "clean": [], // 清理过期文件前
    "beforeCompile": [], // 编译前
    "afterCompile": [] // 编译后
}
```

init 是 compiler 实例创建的过程；clean 是编译的准备阶段；beforeCompile 是指所有 task 开始之前；afterCompile 是指所有 task 完成之后。

每个 hook 函数原型如下：

```js
function (payload) {
    const { next } = payload

    // ...
    next()
}
```

hook 函数内部可以通过 this 访问当前的 compiler 实例；payload 参数根据 hook 类型不同而有所区别，但是都存在一个 next 方法（为了支持异步操作），每个 hook 在结束时都需要调用 next 以进入下一个 hook。

#### 编译上下文

在插件中用户可以向 compiler 原型或者实例上添加自定义属性，其中公开的属性（以`_`开头的为私有属性）可以通过编译上下文访问到，比如：

```js
// some piper
module.exports = function (options) {
    return through2.obj(function (file, enc, next) {
        if (file.isNull()) {
            return next(null, file)
        }

        // context会自动注入到每个file对象
        var { sourceDir } = file.context
        // ...
    })
}
```

#### 插件开发规范

实际上依赖图、编译缓存等功能都是以插件的形式添加到 Compiler 上面去的（插件开发可以参考 src/plugins）。为了避免跟内部插件产生命名冲突，建议所有自定义属性都以$开头，比如`$foo、`、`\_$bar`、`$getFoo`
