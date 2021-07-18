const through = require('through2')
const GulpError = require('./gulp-error').partial('gulp-dep')

// 依赖收集
module.exports = function (options = {}) {
    return through.obj(function (file, enc, cb) {
        if (file.isNull()) {
            return cb(null, file)
        }

        if (file.isStream()) {
            return cb(new GulpError(file, 'stream not supported'))
        }

        const { depend, removeGraphNodes, removeCache } = file.context

        try {
            depend(file, options)

            cb(null, file)
        } catch (e) {
            // 移除缓存，以便下一次重新收集
            removeGraphNodes(file.path)
            removeCache(file.path)

            throw GulpError(file, e)
        }
    })
}
