const through = require('through2')
const GulpError = require('./gulp-error').partial('gulp-dep-add')

// 手动增添依赖
// 需要在depend之后，否则会被覆盖
// depend之前，可以使用file.contenxt.customDeps
module.exports = function (options) {
    const { paths } = options

    return through.obj(function (file, enc, cb) {
        if (file.isNull()) {
            return cb(null, file)
        }

        if (file.isStream()) {
            return cb(GulpError(file, 'stream not supported'))
        }

        const { addDep } = file.context

        try {
            addDep(file, paths)

            cb(null, file)
        } catch (e) {
            cb(GulpError(file, e))
        }
    })
}
