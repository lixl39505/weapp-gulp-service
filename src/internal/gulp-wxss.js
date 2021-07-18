const combine = require('multipipe')
const { cssImportReg, cssUrlReg } = require('../config/constants')
//
const gulpMpAlias = require('./gulp-mp-alias')
const gulpImgBase64 = require('./gulp-img-base64')
const gulpDepend = require('./gulp-depend')

// .wxss文件
module.exports = function (options = {}) {
    return combine(
        gulpMpAlias(options.alias),
        gulpDepend({ matchers: [cssImportReg, cssUrlReg] }),
        gulpImgBase64(options.base64)
    )
}
