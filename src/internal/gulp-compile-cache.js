const through2 = require('through2')
const GulpError = require('./gulp-error').partial('gulp-compile-cache')

// 编译缓存gulp插件
module.exports = function gulpCompileCache(options = {}) {
    const {
        hit = () => {}, // 命中回调
    } = options

    return through2.obj(function (file, enc, next) {
        if (file.isNull()) {
            return next(null, file)
        }

        try {
            const { checkFileCached } = file.context

            if (checkFileCached(file)) {
                // 命中回调
                hit(file)
                // 终止流
                return next(null, null)
            }
        } catch (e) {
            throw GulpError(file, e)
        }

        next(null, file)
    })
}
