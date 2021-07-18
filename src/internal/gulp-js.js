const combine = require('multipipe')
const gulpMpAlias = require('./gulp-mp-alias')
const gulpEnv = require('./gulp-env')
const gulpDepend = require('./gulp-depend')
//
const { es5ImportReg, es6ImportReg } = require('../config/constants')

// .js文件
module.exports = function (options = {}) {
    const { alias } = options

    return combine(
        gulpMpAlias(alias),
        gulpEnv(options),
        gulpDepend({ matchers: [es5ImportReg, es6ImportReg] })
    )
}
