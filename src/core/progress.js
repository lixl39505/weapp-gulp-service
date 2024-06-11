const cliProgress = require('cli-progress')
const ansiColors = require('ansi-colors')

// prettier-ignore
bar = new cliProgress.Bar({
    format: 'CLI Progress |' + ansiColors.cyan('{bar}') + '| {percentage}% || {value}/{total} Chunks || Speed: {speed}',
    stopOnComplete: true,
    clearOnComplete: true,
    barCompleteChar: '\u2588',
    barIncompleteChar: '\u2591',
    hideCursor: true,
    linewrap: true,
})

// 增加计数
bar.append = function (count) {
    if (bar.isActive) {
        bar.setTotal(bar.getTotal() + count)
    } else {
        bar.start(count, 0)
    }
}

module.exports = bar
