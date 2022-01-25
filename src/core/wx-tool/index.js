const WxDevtoolCli = require('./cli')
const WxCI = require('./ci')
const fancyLog = require('fancy-log')
const ansiColors = require('ansi-colors')

// 接口对象
let wx

function noop() {}

function getWx(options, cb) {
    // 缓存wx
    if (wx) {
        return cb(null, wx)
    }

    const { project } = options

    // 接口实例
    let errors = []

    // 优先使用ci
    try {
        wx = new WxCI({
            projectPath: project,
            privateKeyPath: process.env.WE_APP_PRIVATE_KEY_PATH,
        })

        wx.type = 'ci'
    } catch (e) {
        errors.push(e)
    }

    // 其次使用cli
    if (!wx) {
        try {
            wx = new WxDevtoolCli(process.env.WE_CLI)

            wx.type = 'cli'
        } catch (e) {
            errors.push(e)
        }
    }

    if (cb) {
        if (wx) {
            cb(null, wx)
        } else {
            fancyLog(
                ansiColors.yellow(
                    'Warning: ' + errors.map((e) => e.message).join(' or ')
                )
            )
            fancyLog(
                ansiColors.yellow(
                    `The auto npm-build feature is not available, But you can do it manually(see https://developers.weixin.qq.com/miniprogram/dev/devtools/npm.html#_2-%E6%9E%84%E5%BB%BA-npm).`
                )
            )
            fancyLog(
                ansiColors.cyan(
                    `We strongly recommend that you set up WE_CLI or WE_APP_PRIVATE_KEY_PATH environment variables to enbale auto npm-build feature.`
                )
            )
            console.log('\n')
            cb(new Error('Wechat interface call failed'))
        }
    }
}

// 代码上传
function upload(options, cb = noop) {
    const { ver = '', desc = '', verbose = false, project } = options

    getWx(options, (err, wx) => {
        if (err) {
            return cb(err)
        }

        if (wx.type === 'ci') {
            return wx
                .upload({
                    version: ver,
                    desc,
                    verbose,
                })
                .then(
                    (res) => cb(),
                    (err) => cb(err)
                )
        }

        if (wx.type === 'cli') {
            try {
                // 上传代码
                wx.upload({
                    version: ver,
                    desc,
                    project,
                })

                return cb()
            } catch (e) {
                return cb(e)
            }
        }
    })
}

// npm构建
function buildNpm(options, cb = noop) {
    const { project } = options

    getWx(options, (err, wx) => {
        if (err) {
            return cb(err)
        }

        if (wx.type === 'ci') {
            return wx.buildNpm().then(
                (res) => cb(),
                (err) => cb(err)
            )
        }

        if (wx.type === 'cli') {
            try {
                wx.buildNpm({
                    project,
                })

                return cb()
            } catch (e) {
                return cb(e)
            }
        }
    })
}

module.exports = {
    getWx,
    upload,
    buildNpm,
}
