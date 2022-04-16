const proxyquire = require('proxyquire')
const sinon = require('sinon')
const { fixture } = require('~h')
// target
let helper
// stubs
let fsStub, iniStub

// 重复执行
function repeat(fn, total = 1, interval = 0, cb) {
    let n = 0

    return function _call() {
        if (n < total) {
            fn()
            n++
            setTimeout(_call, interval)
        } else {
            cb && cb()
        }
    }
}

describe('helper', function () {
    beforeEach(function () {
        fsStub = {
            existsSync() {
                return true
            },
            readFileSync() {
                return ''
            },
        }
        iniStub = {
            parse() {
                return { NODE_ENV: 'development' }
            },
        }
        helper = proxyquire('utils/helper', {
            fs: fsStub,
            ini: iniStub,
            'fast-glob': {
                sync(patterns) {
                    return patterns
                },
            },
        })
    })

    it('objectMerge', function () {
        let objectMerge = helper.objectMerge

        objectMerge(
            { a: { n: 1 }, b: 2, c: [3] },
            { a: { n: 2, m: 3 }, x: 1, c: [2] }
        ).should.eql({
            a: { n: 2, m: 3 },
            b: 2,
            x: 1,
            c: [2],
        })
    })

    it('deepTraverse', function () {
        let cb,
            deepTraverse = helper.deepTraverse

        // return false
        cb = sinon.fake(function () {
            return false
        })
        deepTraverse([{ id: '1' }, { id: '2' }], cb)
        cb.callCount.should.equal(1)

        // tree
        cb = sinon.fake()
        deepTraverse({ id: '1', childs: [{ id: '2' }, { id: '3' }] }, cb, {
            children: 'childs',
        })
        cb.callCount.should.equal(3)
    })

    it('loadProcessEnv', function () {
        let loadProcessEnv = helper.loadProcessEnv

        let env = loadProcessEnv('prod')
        env.should.eql({ NODE_ENV: 'development' })
    })

    it('dateFormat', function () {
        let dateFormat = helper.dateFormat,
            time = 1620118415812

        dateFormat(time).should.equal('2021-05-04 16:53:35')
        dateFormat(time, 'qq HH:mm:ss SS').should.equal('02 16:53:35 12')
    })

    it('runQueue', function (done) {
        let runQueue = helper.runQueue

        runQueue(
            [1, 2, 3],
            (v, next) => next(),
            (err, over) => {
                try {
                    over.should.equal(true)
                } catch (e) {
                    err = e
                }

                done(err)
            }
        )
    })

    it('runQueue.promise', function () {
        let runQueue = helper.runQueue

        return runQueue
            .promise([1, 2, 3], (v, next) => next())
            .then((over) => {
                over.should.equal(true)
            })
    })

    it('resolveNpmList', function () {
        let resolveNpmList = helper.resolveNpmList,
            options = {
                config: fixture(),
            },
            res

        res = resolveNpmList(options)
        res.should.eql([
            {
                path: fixture('../package.json'),
                output: fixture('../dist'),
            },
        ])
    })

    it('statsFilesNum', function () {
        let statsFilesNum = helper.statsFilesNum

        statsFilesNum(['*.js', '*.css', '*.']).should.equal(3)
    })

    it('groupBy', function () {
        let groupBy = helper.groupBy,
            stus = [
                { class: 'a', age: 10 },
                { class: 'a', age: 18 },
                { class: 'b', age: 14 },
                { class: 'b', age: 22 },
            ]

        groupBy(stus, 'class').should.eql({
            a: [
                { class: 'a', age: 10 },
                { class: 'a', age: 18 },
            ],
            b: [
                { class: 'b', age: 14 },
                { class: 'b', age: 22 },
            ],
        })

        groupBy(stus, (v) => v.age > 15).should.eql({
            true: [
                { class: 'a', age: 18 },
                { class: 'b', age: 22 },
            ],
            false: [
                { class: 'a', age: 10 },
                { class: 'b', age: 14 },
            ],
        })
    })

    it('throttle', function (done) {
        let throttle = helper.throttle,
            cb = sinon.fake()
        let t10 = throttle(10, cb)

        repeat(t10, 42, 1, () => {
            cb.callCount.should.lessThan(10)
            done()
        })()
    })

    it('debounce', function (done) {
        let debounce = helper.debounce,
            cb = sinon.fake()
        let d10 = debounce(10, cb, { immediate: true })

        repeat(d10, 42, 1, () => {
            cb.callCount.should.equal(1)
            done()
        })()
    })

    it('partial', function () {
        let f1 = helper.partial(function (a, b, c) {
            return a + b + c
        }, 1)

        f1(2)(3).should.equal(6)
    })

    it('remove', function () {
        let remove = helper.remove,
            arr = [1, 2, 3, 4]

        remove(arr, 2).should.eql([2])
        arr.should.eql([1, 3, 4])

        remove(arr, (v) => v > 3)
        arr.should.eql([1, 3])

        remove(arr, (v) => v > 3)
        arr.should.eql([1, 3])
    })
})
