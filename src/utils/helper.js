const path = require('path')
const fs = require('fs')
const ini = require('ini')
const { promisify } = require('util')
const fastGlob = require('fast-glob')
const fancyLog = require('fancy-log')
const crypto = require('crypto')

// 返回对象类型
function type(obj) {
    return obj === null || obj === undefined
        ? String(obj)
        : Object.prototype.toString
              .call(obj)
              .match(/\[object (\w+)\]/)[1]
              .toLowerCase()
}

var proto = Object.prototype
var gpo = Object.getPrototypeOf

// 是否纯对象
function isPojo(obj) {
    if (obj === null || typeof obj !== 'object') {
        return false
    }
    return gpo(obj) === proto
}

// object递归合并（array浅复制覆盖）
function objectMerge(to, from = {}) {
    Object.keys(from).forEach((k) => {
        var toVal = to[k],
            fromVal = from[k],
            isToPojo = isPojo(toVal),
            isFromPojo = isPojo(fromVal)

        if (toVal !== fromVal) {
            if (isToPojo && isFromPojo) {
                objectMerge(toVal, fromVal)
            } else if (typeof toVal == 'undefined' && isFromPojo) {
                toVal = to[k] = {}
                objectMerge(toVal, fromVal)
            } else {
                to[k] =
                    typeof fromVal == 'undefined'
                        ? to[k]
                        : type(fromVal) == 'array'
                        ? [...fromVal]
                        : fromVal
            }
        }
    })

    return to
}

// 统一路径分隔符
function toGlobPath(s) {
    s = path.normalize(s)

    return path.sep == '\\' ? s.replace(/\\/g, '/') : s
}

// 深度遍历
function deepTraverse(forest, callback, options = {}) {
    if (type(forest) != 'array') {
        forest = [forest]
    }

    var { children = 'children' } = options
    var isContinue = true // 控制遍历是否继续执行

    function iterate(node, parent, options) {
        isContinue = callback(node, parent, options)

        // 默认继续
        if (typeof isContinue == 'undefined') {
            isContinue = true
        }

        if (isContinue && node[children]) {
            node[children].every((n) => iterate(n, node, options))
        }

        return isContinue
    }

    forest.every((root) => iterate(root, null, options))
}

// 加载环境变量
function loadProcessEnv(mode = '', dir = './') {
    // 环境变量读取优先级
    // .env
    // .env.local
    // .env.[mode]
    // .env.[mode].local
    const env = {},
        targets = ['.env', '.env.local']

    if (mode) {
        targets.push(...[`.env.${mode}`, `.env.${mode}.local`])
    }

    targets.forEach((name) => {
        var file = path.resolve(dir, name)

        if (fs.existsSync(file)) {
            objectMerge(env, ini.parse(fs.readFileSync(file, 'utf-8')))
        }
    })

    return env
}

// 日期格式化， 默认年月日 时分秒
var dateFormat = (function () {
    var regYear = new RegExp('(Y+)', 'i')

    function timeFormat(num) {
        return num < 10 ? '0' + num : num
    }

    return function (timestamp, format) {
        // 默认格式
        if (!format) {
            format = 'YYYY-MM-DD HH:mm:ss'
        }

        timestamp = parseInt(timestamp)
        var realDate = new Date(timestamp)

        var date = [
            ['M+', timeFormat(realDate.getMonth() + 1)],
            ['D+', timeFormat(realDate.getDate())],
            ['H+', timeFormat(realDate.getHours())],
            ['m+', timeFormat(realDate.getMinutes())],
            ['s+', timeFormat(realDate.getSeconds())],
            ['q+', Math.floor((realDate.getMonth() + 3) / 3)],
            ['S+', realDate.getMilliseconds()],
        ]
        var reg1 = regYear.exec(format)

        if (reg1) {
            format = format.replace(
                reg1[1],
                (realDate.getFullYear() + '').substring(4 - reg1[1].length)
            )
        }

        for (var i = 0; i < date.length; i++) {
            var k = date[i][0]
            var v = date[i][1]

            var reg2 = new RegExp('(' + k + ')').exec(format)
            if (reg2) {
                format = format.replace(
                    reg2[1],
                    reg2[1].length == 1
                        ? v
                        : ('00' + v).substring(('' + v).length)
                )
            }
        }
        return format
    }
})()

// 单例
function once(fn) {
    var called = false,
        result

    return function (...args) {
        if (called === false) {
            called = true
            result = fn.call(this, ...args)
        }

        return result
    }
}

// 异步执行队列
function runQueue(queue, fn, cb) {
    const stopQueue = (err, index) => {
        // (err, complete)
        cb && cb(err, index >= queue.length)
    }

    const step = (index) => {
        if (index >= queue.length) {
            stopQueue(null, index)
        } else {
            fn(queue[index], (err, goOn) => {
                err || goOn === false ? stopQueue(err, index) : step(index + 1)
            })
        }
    }

    Promise.resolve().then(() => step(0))
}

// 异步队列，promise版本
runQueue.promise = promisify(runQueue)

// 获取npm构建信息
function resolveNpmList(options) {
    const projectPath = path.resolve(path.dirname(options.config))
    const projConfig = require(path.resolve(projectPath, 'project.config.json'))

    // 手动配置
    if (projConfig.setting.packNpmManually) {
        return projConfig.setting.packNpmRelationList.map((v) => ({
            // package.json
            path: path.resolve(projectPath, v.packageJsonPath),
            // 输出目录
            output: path.resolve(projectPath, v.miniprogramNpmDistDir),
        }))
    }
    // 默认配置
    else {
        return [
            {
                path: path.resolve(projectPath, options.output, 'package.json'), // 小程序默认读取miniprogramRoot下的package.json，即我们的output目录
                output: path.resolve(projectPath, options.output),
            },
        ]
    }
}

// glob 统计文件数量
function statsFilesNum(path, options) {
    let patterns = Array.isArray(path) ? path : [path]

    return fastGlob.sync(patterns.flat(), options).length
}

// 数组分组
function groupBy(arr, iteratee) {
    if (typeof iteratee == 'string') {
        var _id = iteratee

        iteratee = function (e) {
            return e[_id]
        }
    }

    if (typeof iteratee != 'function') {
        throw new TypeError(
            'groupBy iteratee`s type must be String or Functiom'
        )
    }

    var groups = {},
        key = ''

    arr.forEach((v) => {
        key = iteratee(v)
        groups[key] ? groups[key].push(v) : (groups[key] = [v])
    })

    return groups
}

// 节流
function throttle(delay, callback, options = {}, debounceMode) {
    var timeoutId,
        lastTimeoutId,
        lastExec = 0

    var { leading = true, trailing = true, immediate = false } = options

    function wrapper() {
        var self = this
        var elapsed = Number(new Date()) - lastExec
        var args = arguments

        // Execute `callback` and update the `lastExec` timestamp.
        function exec() {
            lastExec = Number(new Date())
            callback.apply(self, args)
        }

        function clear() {
            if (timeoutId) {
                clearTimeout(timeoutId)
                timeoutId = undefined
            }

            if (lastTimeoutId) {
                clearTimeout(lastTimeoutId)
                lastTimeoutId = undefined
            }
        }

        // Clear any existing timeout.
        clear()

        // debounce mode
        if (debounceMode) {
            // 第一次立即执行
            if (lastExec === 0 && immediate) {
                return exec()
            }

            timeoutId = setTimeout(exec, delay)
        }
        // throttle mode
        else {
            // 第一次执行
            if (lastExec === 0) {
                // 立即执行
                if (leading) {
                    return exec()
                } else {
                    // 更新时间点
                    return (lastExec = Number(new Date()))
                }
            } else {
                // 间隔有效
                if (elapsed > delay) {
                    exec()
                }
                // 总是允许最后一次执行
                else if (trailing) {
                    lastTimeoutId = setTimeout(exec, delay - elapsed)
                }
            }
        }
    }

    // useful for unit test
    wrapper._original = callback
    // Return the wrapper function.
    return wrapper
}

// 防抖
function debounce(delay, callback, options) {
    return throttle(delay, callback, options, true)
}

// 偏函数
const partial = function (f, ...arr) {
    return function (...args) {
        return (function (a) {
            return a.length === f.length ? f(...a) : partial(f, ...a)
        })([...arr, ...args])
    }
}

// 日志打印
function log() {
    var data = Array.prototype.slice.call(arguments)
    fancyLog.apply(false, data)
}

// 从数组中删除元素
function remove(arr, target) {
    var idx = -1

    if (type(target) === 'function') {
        idx = arr.findIndex(target)
    } else {
        idx = arr.indexOf(target)
    }

    if (idx >= 0) {
        return arr.splice(idx, 1)
    }

    return null
}

// 数组去重
function dedup(arr) {
    return Array.from(new Set(arr))
}

// 内容签名
function checksum(content, algorithm = 'sha1') {
    return crypto.createHash(algorithm).update(content).digest('hex')
}

module.exports = {
    type,
    isPojo,
    objectMerge,
    toGlobPath,
    deepTraverse,
    loadProcessEnv,
    dateFormat,
    once,
    runQueue,
    resolveNpmList,
    statsFilesNum,
    groupBy,
    throttle,
    debounce,
    partial,
    promisify,
    log,
    remove,
    dedup,
    checksum,
}
