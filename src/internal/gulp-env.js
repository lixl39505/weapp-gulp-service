const path = require('path')
const through = require('through2')

// 环境变量替换
module.exports = function (options = {}) {
    const env = options.env || process.env

    return through.obj(function (file, enc, cb) {
        if (file.isNull()) {
            return cb(null, file)
        }

        const { customDeps, sourceDir } = file.context

        var contents = file.contents
            .toString('utf8')
            .replace(
                /process\.env\.([_a-zA-Z][_a-zA-Z0-9]*)/g,
                function (match, name, offset, string) {
                    // 添加env依赖
                    customDeps.push(path.resolve(sourceDir, `.env/${name}`))

                    return typeof env[name] !== 'undefined'
                        ? JSON.stringify(env[name])
                        : 'undefined'
                }
            )

        file.contents = Buffer.from(contents)

        cb(null, file)
    })
}
