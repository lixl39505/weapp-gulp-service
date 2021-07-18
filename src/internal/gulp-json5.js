const combine = require('multipipe')
const rqp = require('../core/require-piper')
//
const gulpRename = require('gulpRename')
const gulpJson = rqp('gulp-json')

// .json5文件
module.exports = function (options = {}) {
    return combine(
        // 复用
        gulpJson(options),
        gulpRename({ extname: '.json' })
    )
}
