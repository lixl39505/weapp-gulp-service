const gulpIf = require('gulp-if')
const through = require('through2')
const gulpSfc = require('./gulp-sfc')
//
const combine = require('multipipe')
const rqp = require('../core/require-piper')

// .mp文件
module.exports = function (options = {}) {
    let stageFiles = {}

    return combine(
        gulpSfc(options.mp),
        gulpIf(function (file) {
            return file.extname == '.json'
        }, rqp('gulp-json')(options)),
        gulpIf(function (file) {
            return file.extname == '.js'
        }, rqp('gulp-js')(options)),
        gulpIf(function (file) {
            return file.extname == '.wxml'
        }, rqp('gulp-wxml')(options)),
        gulpIf(function (file) {
            return file.extname == '.less'
        }, rqp('gulp-less')(options)),
        gulpIf(function (file) {
            return file.extname == '.css'
        }, rqp('gulp-css')(options)),
        // 子文件合并（支持复数同类顶层元素）
        through.obj(function (file, enc, cb) {
            if (file.sliceCount > 1) {
                let originalPath = file.context.originalPath,
                    stage =
                        stageFiles[originalPath] ||
                        (stageFiles[originalPath] = {
                            count: 0,
                            bufs: [],
                        })

                stage.count++
                stage.bufs[file.sliceNum] = file.contents
                // 最后一片
                if (stage.count >= file.sliceCount) {
                    file.contents = Buffer.concat(stage.bufs)

                    delete stageFiles[originalPath]
                    return cb(null, file)
                }
                // next
                cb()
            } else {
                cb(null, file)
            }
        })
    )
}
