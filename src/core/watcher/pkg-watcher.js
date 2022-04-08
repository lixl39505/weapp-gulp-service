const { statsFilesNum } = require('../../utils/helper')
const progress = require('../progress')
const { series } = require('gulp')

module.exports = (compiler) => {
    const pkgTask = compiler.getTaskConfig('pkg'),
        watcher = compiler.createWatcher(pkgTask.test.globs)

    watcher.on('all', () => {
        progress.append(statsFilesNum(pkgTask.test.globs))
        compiler.nextTask(series(compiler.createGulpTask(pkgTask)))
    })

    return watcher
}
