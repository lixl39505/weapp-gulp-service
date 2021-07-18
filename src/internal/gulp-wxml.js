const gulpMpAlias = require('./gulp-mp-alias')

// .wxml文件
module.exports = function (options = {}) {
    const { alias } = options

    return gulpMpAlias(alias)
}
