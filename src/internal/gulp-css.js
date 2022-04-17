const gulpIf = require('gulp-if')
const gulpRename = require('gulp-rename')
const gulpReplace = require('gulp-replace')
const gulpPostcss = require('gulp-postcss')
const pxtorpx = require('postcss-px2rpx')
//
const gulpMpAlias = require('./gulp-mp-alias')
const gulpImgBase64 = require('./gulp-img-base64')
const gulpDepend = require('./gulp-depend')
//
const combine = require('multipipe')
const { cssImportReg, cssUrlReg } = require('../config/constants')

// .js文件
module.exports = function (options = {}) {
    let { alias = {}, css = {}, px2rpx = {} } = options

    return combine(
        gulpMpAlias(alias),
        gulpDepend({ matchers: [cssImportReg, cssUrlReg] }),
        // px2rpx
        gulpIf(!!px2rpx, gulpPostcss([pxtorpx(px2rpx)])),
        gulpIf(css.rename, gulpRename(css.rename)),
        gulpIf(
            !!(css.rename && css.rename.extname),
            gulpReplace('.css', css.rename.extname)
        ),
        gulpImgBase64(options.base64)
    )
}
