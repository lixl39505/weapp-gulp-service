const path = require('path')
const through = require('through2')
const Clean = require('clean-css')
const terser = require('terser')
const htmlTerser = require('html-minifier-terser')
const from2 = require('from2')

const defualtHtmlMin = {
    collapseWhitespace: true, // 压缩空白字符
    caseSensitive: true, // 区分大小写

    minifyJS: true,
    minifyCSS: true,
}
const defaultCssMin = {
    inline: false, // 忽略@import
}
const defaultJsMin = {
    format: {
        quote_style: 3, //always use the original quotes
    },
}

// 获取fixture文件
exports.fixture = function (name = '') {
    return path.resolve(__dirname, '../fixture', name)
}

// 获取pkgJson信息
exports.getPkgJson = function () {
    return require('../../package.json')
}

// 压缩源代码
exports.minify = function (type, contents, options = {}) {
    if (type == 'js') {
        return terser
            .minify(contents, {
                ...defaultJsMin,
                ...options,
            })
            .then(({ code }) => code)
    }

    if (type == 'css') {
        return new Promise((resolve, reject) => {
            const { styles, errors } = new Clean({
                ...defaultCssMin,
                ...options,
            }).minify(contents)

            errors.length ? reject(errors) : resolve(styles)
        })
    }

    if (type == 'html') {
        return new Promise((resolve, reject) => {
            try {
                resolve(
                    htmlTerser.minify(contents, {
                        ...defualtHtmlMin,
                        ...options,
                    })
                )
            } catch (e) {
                reject(e)
            }
        })
    }
}

// 创建流
exports.stream = function (fn) {
    return through.obj(fn)
}

// 第n次调用才生效
exports.afterN = function (count, fn) {
    var _c = 0

    return function (...args) {
        if (++_c >= count) {
            return fn.apply(this, args)
        }
    }
}

// from2-array
exports.fromArray = function (arr) {
    var reduce = [].concat(arr)

    return from2(
        {
            objectMode: true,
        },
        function (size, cb) {
            if (reduce.length <= 0) return cb(null, null)
            cb(null, reduce.shift())
        }
    )
}
