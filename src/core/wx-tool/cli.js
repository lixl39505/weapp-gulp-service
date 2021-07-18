const fs = require('fs')
const path = require('path')
const dashify = require('dashify')
const { execSync } = require('child_process')

// 微信开发者工具-命令行接口对象
class WxDevtoolCli {
    constructor(cliPath, options = {}) {
        if (!cliPath) {
            throw new Error('Wechat developer tool cli path not provided')
        }

        if (fs.existsSync(path.resolve(cliPath)) === false) {
            throw new Error(
                'The path of wechat developer tool cli is incorrect'
            )
        }

        // 微信开发者工具cli路径:
        //     macOS: <安装路径>/Contents/MacOS/cli
        //     Windows: <安装路径>/cli.bat
        this.path = path.resolve(cliPath)
        // 可用选项见 https://developers.weixin.qq.com/miniprogram/dev/devtools/cli.html
        this.globalOptions = options
    }

    // 子命令执行
    run(cmd, options = {}) {
        // 序列化配置项
        var params = Object.keys(options).reduce((acc, k) => {
            var v = options[k]

            if (k.length === 1) {
                acc += `-${k} ${v} `
            } else {
                acc += `--${dashify(k)} ${v} `
            }

            return acc
        }, '')

        var order = `"${this.path}" ${cmd} ${params}`
        console.log(order)

        return execSync(order, {
            stdio: 'inherit',
        })
    }
}

// 子命令填充
var cmds = [
    'login',
    'autoPreview',
    'upload',
    'buildNpm',
    'auto',
    'open',
    'close',
    'quit',
    'resetFileutils',
    'cache',
]

Object.assign(
    WxDevtoolCli.prototype,
    cmds.reduce(
        (acc, k) =>
            Object.assign(acc, {
                [k]: function (options) {
                    return this.run(dashify(k), options)
                },
            }),
        {}
    )
)

// 云开发操作 todo

module.exports = WxDevtoolCli
