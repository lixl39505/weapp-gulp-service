const { runQueue, once } = require('./helper')

let queue = [],
    flushing = false

// 消费
function flushScheduler() {
    if (flushing) return
    flushing = true
    runQueue(
        queue,
        (task, next) => {
            // 遇错则立即中止
            const done = once((err) => next(err))
            // cps
            const result = task(done)
            // thenable
            if (result && result.then) {
                result.then(
                    () => done(),
                    (err) => done(err || new Error('reject'))
                )
            }
        },
        () => {
            resetScheduler()
        }
    )
}

// 重置
function resetScheduler() {
    queue = []
    flushing = false
}

// 异步队列
function queueTask(task) {
    queue.push(task)

    if (flushing === false) {
        Promise.resolve().then(() => flushScheduler())
    }
}

function getFlushing() {
    return flushing
}

function getSize() {
    return queue.length
}

module.exports = {
    queueTask,
    getFlushing,
    getSize,
}
