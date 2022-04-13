const path = require('path')
const through = require('through2')
const Vinyl = require('vinyl')
const GulpError = require('./gulp-error').partial('gulp-sfc')
const { requireFromString: rfs } = require('module-from-string')
const SfcParser = require('../utils/sfc-parser')

// 单文件处理
module.exports = function (options) {
    return through.obj(function (file, enc, cb) {
        if (file.isNull()) {
            return cb(null, file)
        }

        let { sourceDir } = file.context,
            stem = path.basename(file.path, path.extname(file.path)),
            content = file.contents.toString('utf8')

        try {
            // 文件路径
            var filePath = path.join(file.path, `../${stem}/`, stem)
            // 添加文件
            const pushFile = (contents, extName) => {
                let vf = new Vinyl({
                    base: sourceDir,
                    path: `${filePath}${extName}`,
                    contents: Buffer.from(contents),
                    // 继承context
                    context: file.context,
                })

                this.push(vf)
            }

            const parser = new SfcParser(options)
            parser.write(content)
            parser.end()

            let { wxml, js, json, style } = parser
            if (wxml) pushFile(wxml, '.wxml')
            if (js) pushFile(js, '.js')
            if (json) pushFile(json ? JSON.stringify(rfs(json)) : '{}', `.json`)
            Object.entries(style).forEach(([lang, css]) => {
                pushFile(css, `.${lang}`)
            })

            // pushFile(wxml, '.wxml')
            // pushFile(js, `.js`)
            // pushFile(json ? JSON.stringify(rfs(json)) : '{}', `.json`)
            // pushFile(css, `.${lang}`)
        } catch (e) {
            return cb(new GulpError(file, e))
        }

        cb()
    })
}
