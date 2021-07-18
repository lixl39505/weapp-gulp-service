const through = require('through2')
const progress = require('../core/progress')

// 进度+1
module.exports = function () {
    return through.obj(function (file, enc, cb) {
        progress.increment()

        cb(null, file)
    })
}
