const ansiColors = require('ansi-colors')
const { toGlobPath, log, debounce } = require('../../utils/helper')

module.exports = (compiler) => {
    const watcher = compiler.createWatcher(toGlobPath(compiler.sourceDir)),
        buffer = [], // [{ path: string, type: string }]
        incrementCompile = debounce(200, () => {
            let filePaths = [],
                unlinkPaths = [],
                compilePaths = [],
                visited = {}

            // deduplicate
            buffer.splice(0, buffer.length).reduceRight((acc, v) => {
                if (!acc[v.path]) {
                    acc[v.path] = v
                    filePaths.push(v.path)
                }
                return acc
            }, visited)

            filePaths.forEach((v) => {
                if (visited[v].type === 'unlink') {
                    unlinkPaths.push(v)
                } else {
                    compilePaths.push(v)
                }
            })
            // 增量编译
            compiler.incrementCompile(compilePaths)
            // 批量删除
            if (unlinkPaths.length) {
                compiler.nextTask((cb) => {
                    try {
                        compiler.cleanSpec(unlinkPaths)
                        compiler.removeGraphNodes(unlinkPaths)
                        compiler.removeCache(unlinkPaths)
                    } catch (e) {
                        cb(e)
                    }

                    cb()
                })
            }
        })

    // 删除
    watcher.on('unlink', (filePath) => {
        buffer.push({
            path: filePath,
            type: 'unlink',
        })
        incrementCompile()
    })

    // 新增
    watcher.on('add', (filePath) => {
        log(ansiColors.cyan(filePath) + ' was added')

        buffer.push({
            path: filePath,
            type: 'add',
        })
        incrementCompile()
    })

    // 修改
    watcher.on('change', (filePath) => {
        log(ansiColors.yellow(filePath) + ' was changed')

        buffer.push({
            path: filePath,
            type: 'change',
        })
        incrementCompile()
    })

    return watcher
}
