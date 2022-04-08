const through = require('through2')
const GulpError = require('./gulp-error').partial('gulp-context')

// 上下文注入
module.exports = function (session) {
    return through.obj(function (file, enc, cb) {
        if (file.isNull()) {
            return cb(null, file)
        }

        if (file.isStream()) {
            return cb(new GulpError(file, 'stream not supported'))
        }

        // 存在编译会话
        if (session) {
            session.total++
            // 初始化文件级上下文
            file.context = session.createFileContext(file, session)
        }

        cb(null, file)
    })
}
