const path = require('path')
const fastGlob = require('fast-glob')
const del = require('del')
const fancyLog = require('fancy-log')
const ansiColors = require('ansi-colors')
const { debounce, toGlobPath, type } = require('../utils/helper')

// 输出目录清理
module.exports = function (Compiler) {
    Compiler.installHook({
        init({ next }) {
            // private state
            this._fileList = this.query('fileList', []) // 文件列表
            this._expiredNum = 0 // 过期文件数量
            this._fw = 0 // 写次数

            next()
        },
        beforeCompile({ next }) {
            this._expiredNum = 0
            this._fw = 0

            next()
        },
    })

    Object.assign(Compiler.prototype, {
        // 是否新文件
        isNewFile(filePath) {
            return this._fileList.indexOf(filePath) < 0
        },
        // 清理历史编译文件
        cleanExpired() {
            const { sourceDir, outputDir, baseDir } = this
            let current = fastGlob.sync([`${toGlobPath(sourceDir)}/**`], {
                    ignore: this._ignore,
                }), // 当前文件列表
                expired = []

            // 将sourceDir视为根目录
            current = current.map((v) => v.replace(sourceDir, ''))

            // 寻找已经被删除的文件
            this._fileList.forEach((v) => {
                if (current.indexOf(v) < 0) {
                    expired.push(v)
                }
            })

            if (expired.length) {
                return del(this.getOutputPath(expired), {
                    cwd: baseDir,
                    force: true,
                }).then((res) => {
                    res.forEach((s) =>
                        fancyLog(ansiColors.red(s) + ' was deleted')
                    )
                    // stat
                    this._expiredNum += expired.length
                    this._fileList = current
                    this.saveFileList()
                    // 返回已过期文件列表
                    return expired
                })
            } else {
                this._fileList = current
                this.saveFileList()
                return Promise.resolve([])
            }
        },
        // 清理指定编译文件
        cleanSpec(paths) {
            // cleanSpec(filePath)
            if (type(paths) !== 'array') paths = [paths]

            return del(this.getOutputPath(paths), {
                cwd: this.baseDir,
                force: true,
            }).then((res) => {
                res.forEach((s) => fancyLog(ansiColors.red(s) + ' was deleted'))
                // 更新缓存
                paths.forEach((p) => {
                    let i = this._fileList.indexOf(p)
                    if (i >= 0) this._fileList.splice(i, 1)
                })
                this.saveFileList()
            })
        },
        // 获取输出文件路径
        getOutputPath(paths) {
            if (type(paths) !== 'array') {
                paths = [paths]
            }
            const { baseDir, sourceDir, outputDir } = this
            // normalize
            paths = paths.map((v) => path.resolve(baseDir, v))

            return paths.map((filePath) => {
                var extname = path.extname(filePath),
                    basename = path.basename(filePath, extname),
                    // 输出目录
                    dirname = path.dirname(
                        // 根据source目录推算
                        path.join(outputDir, filePath.replace(sourceDir, ''))
                    ),
                    result

                // todo 提供通用解决方案
                if (extname === '.vue' || extname === '.mp') {
                    result = `${dirname}/${basename}/**`
                } else {
                    result = `${dirname}/${basename}.*`
                }

                return toGlobPath(result)
            })
        },
        // 保存文件列表
        saveFileList: debounce(500, function () {
            this.save('fileList', this._fileList)
            this._fw++
        }),
    })
}
