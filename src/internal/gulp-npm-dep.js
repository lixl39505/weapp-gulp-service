const path = require('path')
const fs = require('fs')
const through2 = require('through2')
const GulpError = require('./gulp-error').partial('gulp-npm-dep')

// 收集小程序npm构建所需的依赖项
module.exports = function (options) {
    return through2.obj(function (file, enc, next) {
        if (file.isNull()) {
            return next(null, file)
        }
        var { packNpmRelationList = [] } = options
        var content = file.contents.toString('utf8'),
            pkg,
            nodeStat,
            miniStat,
            now = new Date()

        try {
            var nodePath = path.resolve(file.path, '../node_modules'),
                miniPath = packNpmRelationList.find((v) => v.path === file.path)

            miniPath =
                miniPath && path.resolve(miniPath.output, 'miniprogram_npm')

            nodeStat = miniStat = {
                birthtime: now,
                ctime: now,
                mtime: now,
            }
            // packageJson
            pkg = JSON.parse(content)
            // node_modules目录状态
            if (fs.existsSync(nodePath)) {
                nodeStat = fs.statSync(
                    path.resolve(file.path, '../node_modules')
                )
            }
            // miniprogram_npm目录状态
            if (fs.existsSync(miniPath)) {
                miniStat = fs.statSync(miniPath)
            }
        } catch (e) {
            return next(new GulpError(file, e))
        }

        // 收集依赖
        var deps = {
            // package.json依赖声明
            dependencies: pkg.dependencies || {},
            peerDependencies: pkg.peerDependencies || {},
            // @bugfix 若首次构建未设置ci/cli，之后再设置也不会触发npmBuild
            privateKeyPath: process.env.WE_APP_PRIVATE_KEY_PATH || '', // 私匙路径
            cliPath: process.env.WE_CLI || '', // 微信开发者工具路径
            // node_modules change
            nodeModules: {
                birthtime: nodeStat.birthtime.getTime(), // 创建时间
                ctime: nodeStat.ctime.getTime(), // 变更时间
                mtime: nodeStat.mtime.getTime(), // 修改时间
            },
            // miniprogram_npm change
            miniNpm: {
                birthtime: miniStat.birthtime.getTime(), // 创建时间
                ctime: miniStat.ctime.getTime(), // 变更时间
                mtime: miniStat.mtime.getTime(), // 修改时间
            },
        }

        // 重置内容
        file.contents = Buffer.from(JSON.stringify(deps, null, 4))

        next(null, file)
    })
}
