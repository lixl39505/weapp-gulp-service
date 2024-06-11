const through = require('through2')
const GulpError = require('./gulp-error').partial('gulp-miniprogram-path-alias')
const path = require('path')
const {
    es5ImportReg,
    es6ImportReg,
    htmlUrlReg,
    cssImportReg,
    cssUrlReg,
} = require('../config/constants')

let keysPattern
let opt
let filePath

function alias(options, content, _filePath) {
    opt = options = options || {}
    filePath = _filePath
    setKeysPattern(options)
    switch (path.extname(_filePath)) {
        case '.js':
        case '.wxs':
            content = content.replace(es6ImportReg, replaceCallback)
            content = content.replace(es5ImportReg, replaceCallback)
            break
        case '.html':
        case '.xml':
        case '.wxml':
            content = content.replace(htmlUrlReg, replaceCallback)
            break
        case '.styl':
        case '.stylus':
        case '.less':
        case '.sass':
        case '.scss':
        case '.css':
        case '.wxss':
            content = content
                .replace(cssImportReg, replaceCallback)
                .replace(cssUrlReg, replaceCallback)
            break
    }
    return content
}

function setKeysPattern(options) {
    options = options || {}
    // 所有别名
    keysPattern =
        keysPattern || new RegExp('^(' + Object.keys(options).join('|') + ')')
}

function replaceCallback(match, subMatch) {
    if (keysPattern.test(subMatch)) {
        let key = subMatch.substr(0, subMatch.indexOf('/')),
            a = opt[key]

        // 非`${别名}/xxx`形式
        if (!a) {
            return match
        }

        let url = path.join(a, subMatch.slice(subMatch.indexOf('/')))

        return match.replace(
            subMatch,
            /^https?:\/\//.test(a)
                ? url
                : path
                      .relative(filePath, url)
                      .replace(/\\/g, '/')
                      .replace(/^\.\.\//, '')
        )
    } else {
        return match
    }
}

module.exports = function (options) {
    return through.obj(function (file, enc, cb) {
        if (file.isNull()) {
            return cb(null, file)
        }

        if (file.isStream()) {
            return cb(new GulpError(file, 'stream not supported'))
        }

        var content = file.contents.toString('utf8')
        try {
            content = alias(options, content, file.path)
        } catch (e) {
            return cb(GulpError(file, e))
        }

        file.contents = Buffer.from(content)
        cb(null, file)
    })
}
