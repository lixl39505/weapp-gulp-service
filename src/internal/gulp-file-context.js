const through = require('through2')
const GulpError = require('./gulp-error').partial('gulp-file-context')

// 注入fileContext
module.exports = function (taskContext) {
    return through.obj(function (file, enc, cb) {
        if (file.isNull()) {
            return cb(null, file)
        }

        if (file.isStream()) {
            return cb(new GulpError(file, 'stream not supported'))
        }

        file.context = taskContext.createFileContext(file)

        cb(null, file)
    })
}
