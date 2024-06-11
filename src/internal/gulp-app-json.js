const path = require('path')
const through2 = require('through2')
const vinyl = require('vinyl')
const Ext = require('../core/ext')
const GulpError = require('./gulp-error').partial('gulp-app-json')

module.exports = function (options) {
    return through2.obj(function (file, enc, next) {
        if (file.isNull()) {
            return next(null, file)
        }

        try {
            // config
            var { platform } = options,
                { sourceDir } = file.context

            // 配置解析
            var appExt = Ext.from(file.contents.toString('utf8'), platform),
                appJson = appExt.getJson(),
                routeMap = appExt.getRouteMap(),
                routeNameMap = appExt.getRouteNameMap()

            // 生成routeMap
            this.push(
                new vinyl({
                    base: sourceDir,
                    path: path.join(sourceDir, 'route-map.js'),
                    contents: Buffer.from(
                        `export default ${JSON.stringify(routeMap, null, 4)}`
                    ),
                    originalPath: file.path,
                    context: file.context,
                })
            )

            this.push(
                new vinyl({
                    base: sourceDir,
                    path: path.join(sourceDir, 'route-name-map.js'),
                    contents: Buffer.from(
                        `export default ${JSON.stringify(
                            routeNameMap,
                            null,
                            4
                        )}`
                    ),
                    originalPath: file.path,
                    context: file.context,
                })
            )

            // 重置app.json内容
            file.contents = Buffer.from(JSON.stringify(appJson, null, 4))
        } catch (e) {
            return next(new GulpError(file, e))
        }

        next(null, file)
    })
}
