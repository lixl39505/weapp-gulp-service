const through = require('through2')

// just pass through
module.exports = function () {
    return through.obj(function (file, enc, cb) {
        cb(null, file)
    })
}
