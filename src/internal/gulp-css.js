const gulpRename = require('gulp-rename')
const gulpReplace = require('gulp-replace')
const gulpMpAlias = require('./gulp-mp-alias')
const gulpImgBase64 = require('./gulp-img-base64')
const gulpDepend = require('./gulp-depend')
//
const combine = require('multipipe')
const { cssImportReg, cssUrlReg } = require('../config/constants')

// .js文件
module.exports = function (options = {}) {
    return combine(
        gulpMpAlias(options.alias),
        gulpDepend({ matchers: [cssImportReg, cssUrlReg] }),
        gulpRename({ extname: '.wxss' }),
        gulpReplace('.css', '.wxss'),
        gulpImgBase64(options.base64)
    )
}
