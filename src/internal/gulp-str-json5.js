const json5 = require('json5')
const through = require('through2')
const GulpError = require('./gulp-error').partial('gulp-str-json5')

// json5解析
module.exports = function (options) {
    return through.obj(function (file, enc, cb) {
        if (file.isNull()) {
            return cb(null, file)
        }

        try {
            var obj = json5.parse(file.contents.toString('utf8'))

            file.contents = Buffer.from(JSON.stringify(obj, null, 4))
        } catch (e) {
            return cb(new GulpError(file, e))
        }

        cb(null, file)
    })
}
