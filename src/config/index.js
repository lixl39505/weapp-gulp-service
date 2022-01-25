const path = require('path')
const fs = require('fs')
const ansiColors = require('ansi-colors')
const { objectMerge, loadProcessEnv } = require('../utils/helper')
const defaults = require('./defaults')

// 获取编译选项
function resolveOptions(cmdOptions) {
    let args = cmdOptions.args,
        configFile = path.resolve(args.config),
        mode = args.mode,
        options = {}

    // 静态环境变量
    const env = loadProcessEnv(mode, path.dirname(configFile))
    env.mode = mode
    Object.assign(process.env, env)

    // 用户配置
    if (fs.existsSync(configFile)) {
        options = require(configFile)
    }

    // 运行时环境变量
    options.env = Object.assign(env, options.env)
    Object.assign(process.env, env)

    console.log(ansiColors.white('current env:'))
    console.log(ansiColors.white(JSON.stringify(options.env, null, 4)))

    // 应用配置
    options.app = objectMerge(
        require(path.join(path.dirname(configFile), 'project.config.json')),
        options.app || {}
    )

    // 最终options
    options.config = configFile
    Object.assign(options, cmdOptions)
    options = objectMerge(defaults(), options)

    // 支持回调
    if (options.callback) {
        options.callback.call(null, options)
    }

    return options
}

module.exports = resolveOptions
