const fs = require('fs')
const path = require('path')
const through = require('through2')
const fancyLog = require('fancy-log')
const ansiColors = require('ansi-colors')

const { buildNpm: wxBuildNpm } = require('../core/wx-tool')
const { makeCmd, checkNpmPkg, npmInstallNoSave } = require('../utils/cmd')

// 自动构建npm
module.exports = function (options = {}) {
    return through.obj(function (file, enc, cb) {
        if (file.isNull() || file.basename !== 'package.json') {
            return cb(null, file)
        }

        let packageDir = path.dirname(file.path), // package.json所在目录的也是node_modules的安装目录
            project = options.project,
            tolerant =
                typeof options.tolerant === 'boolean' ? options.tolerant : false // 是否允许一些错误

        // check node_modules
        if (fs.existsSync(path.join(packageDir, 'node_modules'))) {
            // prettier-ignore
            var { isPkgMissing, pkgToUpdate, pkgMissing } = checkNpmPkg(file.path, project)
            // npm install --no-save
            if (isPkgMissing) {
                console.log('pkgMissing: ', pkgMissing)
                npmInstallNoSave({ exec: { cwd: packageDir } })
            }
            // npm update
            if (pkgToUpdate.length) {
                console.log('pkgToUpdate: ', pkgToUpdate)
                var batchUpdate = makeCmd(`npm update ${pkgToUpdate.join(' ')}`)
                batchUpdate()
            }
        } else {
            // 未安装node_modules
            try {
                // npm install --no-save
                // @使用--no-save是因为npm install会修改package.json，从而又导致一次change
                npmInstallNoSave({ exec: { cwd: packageDir } })
            } catch (err) {
                return cb(err)
            }
        }

        // check mini output dir
        let { npmList } = file.context

        // mini_npm所在目录需提前创建
        npmList.forEach((v) => {
            if (!fs.existsSync(v.output)) {
                fs.mkdirSync(v.output, { recursive: true })
            }
        })

        // 构建mini_npm
        wxBuildNpm(
            {
                project,
            },
            (err) => {
                if (err) {
                    fancyLog(ansiColors.yellow(err.message))

                    tolerant ? cb(null, file) : cb(err)
                } else {
                    cb(null, file)
                }
            }
        )
    })
}
