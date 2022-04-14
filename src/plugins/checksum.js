const path = require('path')
const { debounce, checksum } = require('../utils/helper')

// 文件内容签名管理
module.exports = function (Compiler) {
    Compiler.installHook({
        init({ next }) {
            // private state
            this._checksums = this.query('checksums', {}) // 签名对象

            next()
        },
    })

    Object.assign(Compiler.prototype, {
        // 校验文件内容是否发生改变
        checkFileChanged(file, settings) {
            settings = Object.assign(
                {
                    namespace: false,
                    algorithm: 'sha1',
                },
                settings
            )
            let ns = this._checksums

            if (settings.namespace) {
                if (typeof settings.namespace === 'function') {
                    settings.namespace = settings.namespace(file.clone())
                }

                ns = ns[settings.namespace] || (ns[settings.namespace] = {})
            }

            let key = path.relative(this.baseDir, file.path),
                sum = (filechecksum = checksum(
                    file.contents.toString('utf8'),
                    settings.algorithm
                ))

            if (ns[key] === sum) {
                return false
            } else {
                ns[key] = sum
                this.saveChecksums()
                return true
            }
        },
        // 保存签名对象
        saveChecksums: debounce(500, function () {
            this.save('checksums', this._checksums)
        }),
    })
}
