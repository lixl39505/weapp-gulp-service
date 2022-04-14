/*
    参考: https://github.com/corneliusio/gulp-once/issues
    改造点:
    1. 增加缓存命中回调参数hit
    2. PluginError替换为本地封装的GulpError
*/

const { Transform } = require('stream')
const GulpError = require('./gulp-error').partial('gulp-once-v2')

module.exports = (options = {}) => {
    let empty = process.env.NODE_ENV === 'test' ? '' : null,
        stream = new Transform({ objectMode: true })

    // eslint-disable-next-line complexity
    stream._transform = (file, encoding, next) => {
        if (file.isStream()) {
            return next(new GulpError(file, 'Streams are not supported!'))
        }

        try {
            // 文件内容未改变
            if (file.context.checkFileChanged(file, options) === false) {
                if (options.hit) {
                    options.hit(file, filechecksum)
                }
                return next(null, empty)
            }
        } catch (e) {
            return next(new GulpError(file, e))
        }

        next(null, file)
    }

    return stream
}
