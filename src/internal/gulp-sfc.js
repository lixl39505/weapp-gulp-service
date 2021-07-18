const path = require('path')
const through = require('through2')
const Vinyl = require('vinyl')
const GulpError = require('./gulp-error').partial('gulp-sfc')
const { requireFromString: rfs } = require('module-from-string')
const cheerio = require('cheerio')

// 单文件处理
module.exports = function (options) {
    return through.obj(function (file, enc, cb) {
        if (file.isNull()) {
            return cb(null, file)
        }

        let { sourceDir } = file.context,
            stem = path.basename(file.path, path.extname(file.path)),
            content = file.contents.toString('utf8'),
            $ = cheerio.load(content, {
                xml: {
                    xmlMode: false,
                    decodeEntities: false,
                    lowerCaseTags: false,
                    lowerCaseAttributeNames: false,
                    recognizeSelfClosing: true,
                    withStartIndices: true,
                    withEndIndices: true,
                },
            })

        try {
            var $topEles = $.root().children()
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

            // 代码
            var wxml = '',
                js = '',
                json = '',
                css = '',
                lang = 'css'

            $topEles.each((i, e) => {
                var tagName = e.tagName,
                    $e = $(e)

                // .wxml
                if (tagName === 'template') {
                    var { startIndex, endIndex } = $e[0],
                        tplLength = '<template>'.length

                    // @bugfix cherrio序列化有问题，采用原始字符串剪切方式
                    wxml += content.slice(
                        startIndex + tplLength, // 排除template标签本身
                        endIndex - tplLength
                    )
                }

                // 脚本
                if (tagName === 'script') {
                    if ($e.attr('name') === 'json') {
                        json += $e.html()
                    } else {
                        js += $e.html()
                    }
                }

                // 样式表
                if (tagName === 'style') {
                    lang = $e.attr('lang') || 'css'
                    css += $e.html()
                }
            })

            pushFile(wxml, '.wxml')
            pushFile(js, `.js`)
            pushFile(json ? JSON.stringify(rfs(json)) : '{}', `.json`)
            pushFile(css, `.${lang}`)
        } catch (e) {
            return cb(new GulpError(file, e))
        }

        cb()
    })
}
