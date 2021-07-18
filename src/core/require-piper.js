const dashify = require('dashify')
// pipe缓存
const gpc = {}

// 获取pipe
function requirePiper(request) {
    var result
    // name
    if (typeof request === 'string') {
        if (gpc[request]) {
            result = gpc[request]
        } else {
            // internal
            try {
                // prettier-ignore
                result = gpc[request] = require(`../internal/${dashify(request)}`)
            } catch (e) {
                result = null
            }
            // node_modules
            if (!result) {
                try {
                    result = gpc[request] = require(request)
                } catch (e) {
                    result = null
                }
            }
        }
    }
    // HOF
    if (typeof request === 'function') {
        result = request
    }

    if (!result) {
        throw new Error(`can not find '${request}'`)
    }
    return result
}

requirePiper.cache = gpc

module.exports = requirePiper
