const path = require('path')
const low = require('lowdb')
const FileSync = require('lowdb/adapters/FileSync')

// 连接池
const pool = {}
// 获取数据库
module.exports = function (config) {
    var { dir = '', name = 'db.json', defaults } = config,
        filePath = path.resolve(dir, name)

    // 缓存
    if (pool[filePath]) {
        return pool[filePath]
    }
    // db连接
    const db = low(new FileSync(filePath))
    // 默认值
    if (defaults) {
        db.defaults(defaults).write()
    }

    return (pool[filePath] = db)
}
