## 简介

weapp-gulp-service 是一款基于 gulp 实现的微信小程序预编译开发工具，可以有效提升原生小程序的开发效率。主要功能如下所示：

语法增强：

1. 支持 less
2. 支持 px 自动转 rpx
3. 支持本地图片转 base64
4. 支持路径别名 alias
5. 支持设置环境变量
6. 支持 json5 语法
7. 扩展 app.json，支持表达力更好的路由写法
8. 支持.vue 单文件开发体验
9. 支持自动构建 npm
10. 支持命令行上传代码

工具特性：

1. 0 配置使用
1. 支持增量编译(watch 模式)
1. 支持编译缓存
1. 支持自定义 task
1. 支持插件扩展

## 安装/运行

全局安装并使用：

```bash
npm i weapp-gulp-service -g
# 项目根目录执行
wgs --config /user/workspace/xx/weapp.config.js
```

也可以局部安装并使用：

```bash
npm i weapp-gulp-service -D
# 项目根目录执行
npx wgs
```

项目 Demo 参见 [weapp-project](https://github.com/pixelsLee/weapp-gulp-service/tree/main/templates/weapp-project) （可直接作为开发模版）。

## 详细说明

见 [docs](./docs/md) 目录。

## Command API

### 开发模式

编译并 watching。

```bash
Usage: wgs serve [options]

Options:
  -c, --config <string>  配置文件，默认为weapp.config.js
  -m, --mode <string>    编译环境名称，默认为development
  --no-build-npm         禁用自动构建npm
  -h, --help             display help for command
```

ps：serve 名称可省略，即 `wgs [options]`

### 单独打包

只编译。

```bash
Usage: wgs build [options]

Options:
  -m, --mode <string>    编译环境名称，默认为production
  -c, --config <string>  配置文件，默认为weapp.config.js
  -h, --help             display help for command
```

### 构建 npm

等同微信开发者工具中的【构建 npm】

```bash
Usage: wgs build:npm [options]

Options:
  -m, --mode <string>    编译环境名称，默认为production
  -c, --config <string>  配置文件，默认为weapp.config.js
  -h, --help             display help for command
```

### 代码上传

等同微信开发者工具中的【上传代码】。

```bash
Usage: wgs upload [options] [desc]

Options:
  -v, --ver <string>     版本号，必填
  -m, --mode <string>    编译环境名称，默认为production
  -c, --config <string>  配置文件，默认为weapp.config.js
  -dd, --verbose         是否打印详细日志
  -h, --help             display help for command
```

### 小程序 ci/cli 集成说明

_自动构建 npm_ 与*上传代码*两个功能前置依赖小程序官方服务——[wxdevtool-cli](https://developers.weixin.qq.com/miniprogram/dev/devtools/cli.html) 或者 [miniprogram-ci](https://developers.weixin.qq.com/miniprogram/dev/devtools/ci.html)。

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

两种方式二选一即可。如果二者同时设置，则 ci 模式优先。
