const { statsFilesNum } = require('../../utils/helper')
const progress = require('../progress')
const { series } = require('gulp')

module.exports = (compiler) => {
    const pkgTask = compiler.getTaskConfig('pkg'),
        watcher = compiler.createWatcher(pkgTask.test)

    watcher.on('all', () => {
        progress.append(statsFilesNum(pkgTask.test))
        compiler.nextTask(
            series(compiler.createGulpTask(compiler.getTaskConfig('pkg')))
        )
    })

    return watcher
}
