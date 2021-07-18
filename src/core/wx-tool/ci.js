const rg = require('requireg')
const fs = require('fs')
const path = require('path')
const dashify = require('dashify')
const { runQueue } = require('../../utils/helper')

// miniprogram-ci
let ci = null

// 微信小程序ci集成工具
class WxCI {
    constructor(options = {}) {
        let {
            appid,
            type, //  miniProgram/miniProgramPlugin/miniGame/miniGamePlugin
            projectPath, //  @required
            privateKeyPath, //  @required
            ignores = [], //  ['node_modules/**/*']
        } = options

        if (!projectPath) {
            throw new Error('Project root must be specified')
        }

        // 兼容全局安装的miniprogram-ci
        ci = rg('miniprogram-ci')

        // 基目录，所有相对路径根据其计算
        this.baseDir = path.resolve(projectPath)

        // 小程序项目配置路径
        let projConfigPath = path.resolve(this.baseDir, './project.config.json')
        if (fs.existsSync(projConfigPath) === false) {
            throw new Error(
                `The project configuration file '${projConfigPath}' does not exist`
            )
        }

        if (!privateKeyPath) {
            throw new Error('Private key file path not provided')
        }

        let privateKeyFullPath = path.resolve(this.baseDir, privateKeyPath)
        if (fs.existsSync(privateKeyFullPath) === false) {
            throw new Error(
                `Private key file '${privateKeyFullPath}' does not exist`
            )
        }

        // 项目配置信息
        this.projectConfig = require(projConfigPath)
        // 常用配置
        this.miniprogramRoot = path.resolve(
            this.baseDir,
            this.projectConfig.miniprogramRoot || ''
        )
        this.packNpmManually = this.projectConfig.setting.packNpmManually
        this.packNpmRelationList =
            this.projectConfig.setting.packNpmRelationList

        // 项目
        this.project = new ci.Project({
            appid: appid || this.projectConfig.appid,
            type: type || this.projectConfig.compileType,
            projectPath: this.baseDir,
            privateKeyPath: privateKeyFullPath,
            ignores,
        })
    }

    // 构建npm
    buildNpm() {
        return new Promise((resolve, reject) => {
            // 手动构建
            if (this.packNpmManually) {
                let packNpmRelationList = this.packNpmRelationList || [],
                    results = []

                runQueue(
                    packNpmRelationList,
                    ({ packageJsonPath, miniprogramNpmDistDir }, next) => {
                        ci.packNpmManually({
                            packageJsonPath: path.resolve(
                                this.baseDir,
                                packageJsonPath
                            ),
                            miniprogramNpmDistDir: path.resolve(
                                this.baseDir,
                                miniprogramNpmDistDir
                            ),
                            // ignores: ['pack_npm_ignore_list'],
                        })
                            .then((res) => {
                                results.push(res)

                                next()
                            })
                            .catch((err) => {
                                // 中止队列
                                next(err)
                            })
                    },
                    (err, complete) => {
                        if (complete) {
                            console.log(results)
                            resolve(results)
                        } else {
                            console.warn(err)
                            reject(err)
                        }
                    }
                )
            } else {
                return ci
                    .packNpm(this.project, {
                        // ignores: ['pack_npm_ignore_list'],
                        reporter: (infos) => {
                            console.log(infos)
                        },
                    })
                    .then((res) => {
                        console.log(res)
                        resolve(res)
                    })
                    .catch((err) => {
                        console.warn(err)
                        reject(err)
                    })
            }
        })
    }

    // 上传
    upload(params = {}) {
        let { version, desc, verbose } = params

        if (!version) {
            throw new Error(`未提供版本号`)
        }

        const projSetting = this.projectConfig.setting,
            uploadConfig = {
                project: this.project,
                version, // 版本号
                desc, // 上传备注
                // 编译设置
                setting: {
                    es6: projSetting.es6, // es6转es5
                    es7: projSetting.enhance, // 增强编译
                    minify: projSetting.minified, // 压缩所有代码
                    codeProtect: projSetting.uglifyFileName, // 代码保护
                    autoPrefixWXSS: projSetting.postcss, // 样式自动补全
                },
            }

        // 开启进度监听
        if (verbose) {
            uploadConfig.onProgressUpdate = console.log
        }

        return ci
            .upload(uploadConfig)
            .then((res) => {
                console.log(res)

                return res
            })
            .catch((err) => {
                console.warn(err)

                return Promise.reject(err)
            })
    }
}

module.exports = WxCI
