const path = require('path')
const fs = require('fs')
const ansiColors = require('ansi-colors')
const { objectMerge, loadProcessEnv } = require('../utils/helper')
const defaults = require('./defaults')

// 获取编译选项
function resolveOptions(opts) {
    let args = opts.args,
        configFile = path.resolve(args.config),
        mode = args.mode,
        options = {}

    // 静态环境变量
    const env = loadProcessEnv(mode, path.dirname(configFile))
    env.mode = mode
    Object.assign(process.env, env)

    // custom option
    if (fs.existsSync(configFile)) {
        options = require(configFile)

        if (typeof options === 'function') {
            options = options()
        }
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

    // option合并
    Object.assign(options, opts)
    options.config = configFile

    return objectMerge(defaults(), options)
}

module.exports = resolveOptions
