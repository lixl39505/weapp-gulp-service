// 3rd
const { dest } = require('gulp')
const gulpRename = require('gulp-rename')
const gulpReplace = require('gulp-replace')
const gulpIf = require('gulp-if')
const gulpLess = require('gulp-less')
const gulpPostcss = require('gulp-postcss')
// internal
const gulpEnv = require('./gulp-env')
const gulpDepend = require('./gulp-depend')
const gulpDepAdd = require('./gulp-dep-add')
const gulpLessVar = require('./gulp-less-var')
const gulpProgress = require('./gulp-progress')
const gulpMpAlias = require('./gulp-mp-alias')
const gulpImgBase64 = require('./gulp-img-base64')
// utils
const path = require('path')
const combine = require('multipipe')
const { cssImportReg, cssUrlReg } = require('../config/constants')
const pxtorpx = require('postcss-px2rpx')
const gulpIgnore = require('gulp-ignore')

// .js文件
module.exports = function (options = {}) {
    let { baseDir, outputDir, lessVar, css = {}, px2rpx = {} } = options
    let lessOptons = Object.assign({}, options.less)
    lessVar = lessVar ? path.resolve(baseDir, options.lessVar) : ''

    if (lessVar) {
        // 全局less变量注入
        if (!lessOptons.modifyVars) lessOptons.modifyVars = {}
        if (!lessOptons.modifyVars.hack) lessOptons.modifyVars.hack = ''
        lessOptons.modifyVars.hack += `true; @import "${lessVar}";`
    }

    // less变量文件处理
    let lessVarPipes = combine(
        // 依赖收集
        gulpDepend({ matchers: [cssImportReg, cssUrlReg] }),
        // less->js
        gulpLessVar(),
        // 固定变量文件名称
        gulpRename({
            basename: 'variables',
        }),
        // 输出
        dest(outputDir),
        // +1
        gulpProgress(),
        // 截断后续处理
        gulpIgnore.exclude(function () {
            return true
        })
    )

    return combine(
        // 环境变量处理
        gulpEnv(options),
        // 分支,lessVar文件
        gulpIf(function (file) {
            return lessVar && file.path == lessVar
        }, lessVarPipes),
        // 别名
        gulpMpAlias(options.alias),
        // 依赖收集
        gulpDepend({ matchers: [cssImportReg, cssUrlReg] }),
        // 如果存在vars，则手动添加依赖
        gulpIf(
            function () {
                return !!lessVar
            },
            gulpDepAdd({ paths: lessVar })
        ),
        // less2css
        gulpLess(lessOptons),
        // css convert
        gulpIf(!!px2rpx, gulpPostcss([pxtorpx(px2rpx)])),
        gulpIf(css.rename, gulpRename(css.rename)),
        gulpIf(
            !!(css.rename && css.rename.extname),
            gulpReplace('.css', css.rename.extname)
        ),
        // 图片转base64
        gulpImgBase64(options.base64)
    )
}
