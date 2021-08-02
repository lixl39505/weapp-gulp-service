const fs = require('fs')
const path = require('path')
const Vinyl = require('vinyl')
const fancyLog = require('fancy-log')
const { debounce, type } = require('../utils/helper')

// 获取唯一id
function uid(file) {
    return path.resolve(file.path).replace(file.base, '')
}

const hooks = {
    init({ next }) {
        // private state
        this._compiled = this._db.get('compiled').value() || {} // 依赖图
        this._hitTimes = 0 // 缓存命中数
        this._cacheTimes = 0 // 缓存总数
        this._cw = 0 // 写次数

        next()
    },
    beforeCompile({ next }) {
        this._hitTimes = 0
        this._cacheTimes = 0
        this._cw = 0
        this._outputDirExist = fs.existsSync(this.outputDir)
        this._lastVersion = this.query('version')
        if (this._lastVersion) fancyLog('_lastVersion: ' + this._lastVersion)

        next()
    },
    afterCompile({ next }) {
        // 更新版本号
        if (this._lastVersion != this._version) {
            this.save('version', this._version)
        }
        next()
    },
}

const methods = {
    // 检查文件是否缓存
    checkFileCached(file) {
        const compiled = this._compiled

        let key = uid(file),
            last = compiled[key],
            current

        // 总数+1
        this._cacheTimes++

        // 获取文件最新修改时间戳
        if (Vinyl.isVinyl(file)) {
            current = file.stat.mtimeMs
        } else {
            current = fs.statSync(file.path).mtimeMs
        }

        // 更新缓存
        compiled[key] = current
        this.saveCompileCache()

        // expired 版本号变更 | 输出目录不存在 | 没有历史记录
        if (
            this._lastVersion !== this._version ||
            !this._outputDirExist ||
            !last
        ) {
            return false
        }

        // expired 文件修改时间更新
        if (last && last !== current) {
            return false
        }

        // expired 环境变量发生变化
        let lastEnv = this.query('env', {}), // 上一次编译使用的环境变量
            currentEnv = process.env,
            node = this.getGraphNode(file)

        if (
            node &&
            node.dependencies.some((v) => {
                // @bugfix 文件分隔符存在平台差异
                let name = v.split(path.sep).pop()

                // @bugfix process.env只能是字符串
                return (
                    v.startsWith(`${path.sep}.env`) &&
                    lastEnv[name].toString() !== currentEnv[name]
                )
            })
        ) {
            return false
        }

        // effective 缓存有效
        this._hitTimes++
        return true
    },
    // 移除缓存
    removeCache(files) {
        // remove(file)
        if (type(files) !== 'array') {
            files = [files]
        }

        var compiled = this._compiled,
            sourceDir = this.sourceDir,
            change = false

        files.forEach((v) => {
            // remove(filePath)
            if (type(v) === 'string') {
                v = {
                    base: sourceDir,
                    path: v,
                }
            }
            var id = uid(v)
            if (compiled[id] !== undefined) {
                delete compiled[id]
                change = true
            }
        })

        if (change) {
            this.saveCompileCache()
        }
    },
    // 保存缓存
    saveCompileCache: debounce(500, function () {
        this.save('compiled', this._compiled)
        this._cw++
    }),
}

// 编译缓存
module.exports = function (Compiler) {
    Compiler.installHook(hooks)
    Object.assign(Compiler.prototype, methods)
}