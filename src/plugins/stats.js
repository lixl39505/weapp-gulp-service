const fancyLog = require('fancy-log')
const ansiColors = require('ansi-colors')

let elapsedTime = 0

// 统计插件
module.exports = function (Compiler) {
    Compiler.installHook({
        beforeCompile({ next }) {
            elapsedTime = Date.now()
            next()
        },
        afterCompile({ next }) {
            // 延迟1s是等候最后一次文件写入
            setTimeout(() => {
                var expiredNum = this._expiredNum,
                    fileWTS = this._fw,
                    hitTimes = this._hitTimes,
                    cacheTimes = this._cacheTimes,
                    cacheWTS = this._cw,
                    reverseTimes = this._reverseTimes,
                    depWTS = this._gw

                // 打印统计信息
                var stats = `${expiredNum} file expired, save ${fileWTS} sec. ${hitTimes}/${cacheTimes} file skipped, save ${cacheWTS} sec. graph reverse ${reverseTimes} sec, save ${depWTS} sec.`
                fancyLog(ansiColors.cyan(stats))
            }, 1000)

            elapsedTime = Date.now() - elapsedTime
            // prettier-ignore
            console.log('\n')
            fancyLog(
                ansiColors.cyan(
                    `Compiling Time: ${
                        elapsedTime < 10
                            ? '<10ms'
                            : (elapsedTime / 1000).toFixed(2) + 's'
                    } `
                )
            )
            next()
        },
    })
}
