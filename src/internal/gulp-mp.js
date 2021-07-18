const gulpIf = require('gulp-if')
const gulpSfc = require('./gulp-sfc')
//
const combine = require('multipipe')
const rqp = require('../core/require-piper')

// .mp文件
module.exports = function (options = {}) {
    return combine(
        gulpSfc(),
        gulpIf(function (file) {
            return file.extname == '.json'
        }, rqp('gulp-json')(options)),
        gulpIf(function (file) {
            return file.extname == '.js'
        }, rqp('gulp-js')(options)),
        gulpIf(function (file) {
            return file.extname == '.wxml'
        }, rqp('gulp-wxml')(options)),
        gulpIf(function (file) {
            return file.extname == '.less'
        }, rqp('gulp-less')(options)),
        gulpIf(function (file) {
            return file.extname == '.css'
        }, rqp('gulp-css')(options))
    )
}
