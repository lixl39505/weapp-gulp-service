const path = require('path')
const sinon = require('sinon')
//
const { getPkgJson } = require('~h')
const defaults = require('./defaults'),
    pkgJson = getPkgJson()

// 提供gulp task测试所需的session上下文对象
module.exports = function () {
    const options = defaults(),
        baseDir = path.dirname(options.config),
        common = {
            // context
            baseDir,
            sourceDir: path.join(baseDir, './fixture'),
            outputDir: path.join(baseDir, './dist'),
            cacheDir: path.join(baseDir, './wgs'),
            npmList: [
                {
                    path: path.join(baseDir, './fixture/json/package.json'), // node_module安装目录
                    output: path.join(baseDir, './dist'), // miniprogram_npm安装目录
                },
            ],
        }

    Object.assign(options, common)

    const context = {
        options,
        ...common,
        // pkg
        _version: pkgJson.version,
        npmList: options.npmList,
        // session
        files: [], // 编译文件列表
        // methods
        tap: sinon.fake(),
        fire: sinon.fake(),
        depend: sinon.fake(),
        addDep: sinon.fake(),
        removeGraphNodes: sinon.fake(),
        removeCache: sinon.fake(),
        createFileContext(file, session) {
            let fileContext = Object.create(context)

            Object.assign(fileContext, {
                originalPath: file.path,
                customDeps: [], // 自定义依赖
                depended: false,
                session,
            })

            return fileContext
        },
    }

    return context
}
