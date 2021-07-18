const path = require('path')
const gulpOnce = require('./gulp-once-v2')
const gulpNpmDep = require('./gulp-npm-dep')
const gulpBuildNpm = require('./gulp-build-npm')
//
const combine = require('multipipe')
const progress = require('../core/progress')

// .js文件
module.exports = function (options = {}) {
    const { baseDir, npmList } = options

    return combine(
        gulpNpmDep({
            packNpmRelationList: npmList,
        }),
        gulpOnce({
            context: baseDir,
            namespace: 'npmDeps',
            file: path.join(baseDir, '.wgs/.checksums'),
            hit: () => progress.increment(),
        }),
        gulpBuildNpm({
            project: baseDir,
            tolerant: true,
        })
    )
}
