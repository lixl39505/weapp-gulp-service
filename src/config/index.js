const path = require('path')
const fs = require('fs')
const ansiColors = require('ansi-colors')
const { objectMerge, loadProcessEnv } = require('../utils/helper')
const defaults = require('./defaults')

// async 获取编译选项
function resolveOptions(cmdOptions, context) {
    let args = cmdOptions.args,
        configFile = path.resolve(args.config),
        mode = args.mode,
        options = {}

    // 静态环境变量
    const envs = loadProcessEnv(mode, path.dirname(configFile))
    envs.mode = mode
    Object.assign(process.env, envs)

    // 用户配置
    if (fs.existsSync(configFile)) {
        options = require(configFile)
    }

    // 运行时环境变量
    options.env = Object.assign(envs, options.env)
    Object.assign(process.env, envs)

    console.log(ansiColors.white('current env:'))
    console.log(ansiColors.white(JSON.stringify(options.env, null, 4)))

    return Promise.resolve().then(() => {
        // merge options
        options.config = configFile
        Object.assign(options, cmdOptions) // cmd first
        options = objectMerge(defaults(), options) // user second

        // normalize
        if (options.ignore && !Array.isArray(options.ignore)) {
            options.ignore = [options.ignore]
        }

        // 支持回调
        if (options.callback) {
            let res = options.callback.call(null, options, context)
            // 支持异步 thenable
            if (res) {
                if (res.then) {
                    return res.then(
                        (replaceOptions) => replaceOptions || options
                    )
                } else options = res
            }
        }

        return options
    })
}

module.exports = resolveOptions
