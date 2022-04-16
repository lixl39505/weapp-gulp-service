const { requireFromString: rfs } = require('module-from-string')
const { src } = require('gulp')
const { fixture, minify, stream, afterN } = require('~h')
const compilerSession = require('~f/compiler-session')
//
const gulpContext = require('internal/gulp-context')
const gulpMp = require('internal/gulp-mp')
const gulpMpConcat = require('internal/gulp-mp-concat')
//
let context = {}

describe('gulp-mp', function () {
    beforeEach(function () {
        // reset
        session = compilerSession()
    })

    it('require-from-string', function () {
        const res = rfs(`
            module.exports = {
                "usingComponents": {
                    "order-item": "./order-item/order-item"
                },
                "navigationBarTitleText": "订单"
            }
        `)

        // res来自vm，原型与主程序不同
        expect(res).to.an('object')
        expect(res).to.eql({
            usingComponents: {
                'order-item': './order-item/order-item',
            },
            navigationBarTitleText: '订单',
        })
    })

    it('trans normal file', function (done) {
        var unitErr = [],
            unitDone = afterN(4, () => {
                done(unitErr[0])
            })

        src([fixture('sfc/bar.vue')])
            .pipe(gulpContext(session))
            .pipe(gulpMp(session.options))
            .pipe(
                stream(function (file, env, cb) {
                    const { extname } = file,
                        contents = file.contents.toString('utf8')

                    let compare

                    if (extname == '.js') {
                        compare = minify('js', contents).then((code) => {
                            code.should.equal(
                                `import{barView}from'../../api/bar';global.wComponent({props:{name:String}});`
                            )
                        })
                    }

                    if (extname == '.wxss') {
                        compare = minify('css', contents).then((code) => {
                            code.should.equal(`.bar{color:#123456}`)
                        })
                    }

                    if (extname == '.json') {
                        compare = new Promise((resolve, reject) => {
                            try {
                                var obj = JSON.parse(contents)
                                obj.should.eql({
                                    component: true,
                                    usingComponents: {
                                        'bar-title': './bar-title/bar-title',
                                    },
                                })

                                resolve()
                            } catch (e) {
                                reject(e)
                            }
                        })
                    }

                    if (extname == '.wxml') {
                        compare = minify('html', contents).then((code) => {
                            code.should.equal(
                                `<view><bar-title>{{ name }}</bar-title></view>`
                            )
                        })
                    }

                    compare
                        .catch((e) => unitErr.push(e))
                        .finally(() => {
                            cb(null, file)
                            unitDone()
                        })
                })
            )
    })

    it('trans empty file', function (done) {
        var unitErr = [],
            unitDone = afterN(4, () => {
                done(unitErr[0])
            })

        src([fixture('sfc/empty.vue')])
            .pipe(gulpContext(session))
            .pipe(gulpMp(session.options))
            .pipe(
                stream(function (file, env, cb) {
                    const { extname } = file,
                        contents = file.contents.toString('utf8')

                    let compare

                    if (extname == '.js') {
                        compare = minify('js', contents).then((code) => {
                            code.should.equal('')
                        })
                    }

                    if (extname == '.wxss') {
                        compare = minify('css', contents).then((code) => {
                            code.should.equal('')
                        })
                    }

                    if (extname == '.json') {
                        compare = new Promise((resolve, reject) => {
                            try {
                                var obj = JSON.parse(contents)
                                obj.should.eql({})

                                resolve()
                            } catch (e) {
                                reject(e)
                            }
                        })
                    }

                    if (extname == '.wxml') {
                        compare = minify('html', contents).then((code) => {
                            code.should.equal('')
                        })
                    }

                    compare
                        .catch((e) => unitErr.push(e))
                        .finally(() => {
                            cb(null, file)
                            unitDone()
                        })
                })
            )
    })

    it('trans multi nodes', function (done) {
        var unitErr = [],
            unitDone = afterN(4, () => {
                done(unitErr[0])
            })

        src([fixture('sfc/multi.vue')])
            .pipe(gulpContext(session))
            .pipe(gulpMp(session.options))
            .pipe(gulpMpConcat(session.options))
            .pipe(
                stream(function (file, env, cb) {
                    const { extname } = file,
                        contents = file.contents.toString('utf8')

                    let compare

                    if (extname == '.js') {
                        // 合并
                        compare = minify('js', contents).then((code) => {
                            code.should.equal(
                                `import{userView}from'../../api/user';global.wComponent({props:{header:String,content:String}});`
                            )
                        })
                    }

                    if (extname == '.wxss') {
                        // 合并
                        compare = minify('css', contents).then((code) => {
                            code.should.equal(
                                `.header{color:#123456}.content{height:200px}`
                            )
                        })
                    }

                    if (extname == '.json') {
                        // 合并，后来者居上
                        compare = new Promise((resolve, reject) => {
                            try {
                                var obj = JSON.parse(contents)
                                obj.should.eql({
                                    component: false,
                                })

                                resolve()
                            } catch (e) {
                                reject(e)
                            }
                        })
                    }

                    if (extname == '.wxml') {
                        // 合并
                        compare = minify('html', contents).then((code) => {
                            code.should.equal(
                                `<view class="header">{{ header }}</view><view class="content">{{ content }}</view>`
                            )
                        })
                    }

                    compare
                        .catch((e) => unitErr.push(e))
                        .finally(() => {
                            cb(null, file)
                            unitDone()
                        })
                })
            )
    })
})
