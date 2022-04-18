const fs = require('fs')
const path = require('path')
const Vinyl = require('vinyl')
const fancyLog = require('fancy-log')
const { debounce, type, checksum } = require('../utils/helper')

const opsExclude = [
    'env',
    'args',
    'app',
    'config',
    'output',
    'source',
    'ignore',
    'tasks',
]

// 获取唯一id
function uid(file) {
    return path.resolve(file.path).replace(file.base, '')
}

const hooks = {
    init({ next }) {
        // private state
        this._compiled = this.query('compiled', {}) // 缓存记录
        this._checksums = this.query('checksums', {}) // 签名对象
        this._hitTimes = 0 // 缓存命中数
        this._cacheTimes = 0 // 缓存总数
        this._cw = 0 // 写次数

        next()
    },
    clean({ next, expired }) {
        // 清理缓存
        this.removeCache(expired)
        next()
    },
    beforeCompile({ next }) {
        this._hitTimes = 0
        this._cacheTimes = 0
        this._cw = 0
        //
        this._lastVersion = this.query('version')
        this._isOutputDirExist = fs.existsSync(this.outputDir)
        this._isOptionsChanged = this.checkOptionsChanged()

        next()
    },
    afterCompile({ next }) {
        // 更新版本号
        if (this._lastVersion != this._version) {
            this.save('version', this._version)
        }

        next()
    },
    taskerror({ next, error }) {
        error && error.file && this.removeCache(error.file)
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

        // expired 版本号变更 | 输出目录不存在 | 配置发生改变 | 没有历史记录
        if (
            this._lastVersion !== this._version ||
            this._isOutputDirExist === false ||
            this._isOptionsChanged ||
            !last
        ) {
            return false
        }

        // expired 文件有修改
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
                    lastEnv[name] &&
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
    // 检查文件内容是否发生改变
    checkFileChanged(file, settings) {
        settings = Object.assign(
            {
                namespace: false,
                algorithm: 'sha1',
            },
            settings
        )
        let ns = this._checksums

        if (settings.namespace) {
            if (typeof settings.namespace === 'function') {
                settings.namespace = settings.namespace(file.clone())
            }

            ns = ns[settings.namespace] || (ns[settings.namespace] = {})
        }

        let key = path.relative(this.baseDir, file.path),
            sum = (filechecksum = checksum(
                file.contents.toString('utf8'),
                settings.algorithm
            ))

        if (ns[key] === sum) {
            return false
        } else {
            ns[key] = sum
            this.saveChecksums()
            return true
        }
    },
    // 检查options是否发生改变
    checkOptionsChanged() {
        let pluginOptions = Object.assign({}, this.options)

        opsExclude.forEach((v) => delete pluginOptions[v])

        return this.checkFileChanged({
            path: path.join(this.baseDir, 'config'),
            contents: Buffer.from(
                JSON.stringify(pluginOptions, (key, value) => {
                    if (typeof value === 'function') {
                        return value.toString()
                    }
                    return value
                })
            ),
        })
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
    // 保存签名对象
    saveChecksums: debounce(500, function () {
        this.save('checksums', this._checksums)
    }),
}

// 编译缓存
module.exports = function (Compiler) {
    Compiler.installHook(hooks)
    Object.assign(Compiler.prototype, methods)
}
