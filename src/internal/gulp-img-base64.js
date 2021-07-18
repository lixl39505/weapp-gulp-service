const gulpIf = require('gulp-if')
const gulpBase64 = require('gulp-base64-v2')

// .js文件
module.exports = function (options) {
    return gulpIf(function (file) {
        // 排除空文件
        return !file.isNull()
    }, gulpBase64(options))
}
