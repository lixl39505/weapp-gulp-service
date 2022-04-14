const through = require('through2')

// 子文件合并（支持复数同类顶层元素）
module.exports = function (options = {}) {
    let stageFiles = {}

    return through.obj(function (file, enc, cb) {
        if (file.sliceCount > 1) {
            let originalPath = file.context.originalPath,
                stage =
                    stageFiles[originalPath] ||
                    (stageFiles[originalPath] = {
                        count: 0,
                        bufs: [],
                    })

            stage.count++
            stage.bufs[file.sliceNum] = file.contents
            // 最后一片
            if (stage.count >= file.sliceCount) {
                file.contents = Buffer.concat(stage.bufs)

                delete stageFiles[originalPath]
                return cb(null, file)
            }
            // next
            cb()
        } else {
            cb(null, file)
        }
    })
}
