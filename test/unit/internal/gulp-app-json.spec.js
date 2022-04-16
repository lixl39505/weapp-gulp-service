const { src } = require('gulp')
const { importFromStringSync } = require('module-from-string')
const { fixture, stream, afterN, fromArray } = require('~h')
const Vinyl = require('vinyl')
const compilerSession = require('~f/compiler-session')
//
const gulpContext = require('internal/gulp-context')
const gulpJson = require('internal/gulp-json')

describe('gulp-app-json', function () {
    beforeEach(function () {
        // reset
        session = compilerSession()
    })

    it('normal parse', function (done) {
        var unitErr = [],
            unitDone = afterN(3, () => {
                done(unitErr[0])
            })

        src([fixture('json/app.json')])
            .pipe(gulpContext(session))
            .pipe(gulpJson(session.options))
            .pipe(
                stream(function (file, enc, cb) {
                    const basename = file.basename,
                        contents = file.contents.toString('utf8')

                    try {
                        // app.json
                        if (basename == 'app.json') {
                            var appJson = JSON.parse(contents)
                            // pages
                            expect(appJson.pages).to.eql([
                                'pages/tab-bar/tab1/tab1',
                                'pages/tab-bar/tab4/tab4',
                            ])
                            // subpackages
                            expect(appJson.subpackages).to.eql([
                                {
                                    root: 'pkg-demo',
                                    pages: [
                                        'pages/index/index',
                                        'pages/select-user/select-user',
                                    ],
                                },
                            ])
                            // env
                            expect(appJson.tabBar.custom).to.equal(true)
                        }
                        // route-map.js
                        if (basename == 'route-map.js') {
                            var routeMap = importFromStringSync(contents)
                            expect(routeMap.default).to.eql({
                                'pages/tab-bar/tab1/tab1': {
                                    title: '首页',
                                    name: 'home',
                                },
                                'pages/tab-bar/tab4/tab4': {},
                                'pkg-demo/pages/index/index': {
                                    title: '示例',
                                    name: 'demo',
                                    meta: {
                                        auth: false,
                                    },
                                },
                                'pkg-demo/pages/select-user/select-user': {},
                            })
                        }
                        // route-name-map.js
                        if (basename == 'route-name-map.js') {
                            var routeNameMap = importFromStringSync(contents)
                            expect(routeNameMap.default).to.eql({
                                home: 'pages/tab-bar/tab1/tab1',
                                demo: 'pkg-demo/pages/index/index',
                            })
                        }
                    } catch (e) {
                        unitErr.push(e)
                    }
                    cb()
                    unitDone()
                })
            )
    })

    it('not support platform', function (done) {
        fromArray([
            new Vinyl({
                base: fixture(),
                path: fixture('json/app.json'),
                contents: Buffer.from('{}'),
            }),
        ])
            .pipe(gulpContext(session))
            .pipe(
                gulpJson({
                    platform: 'zfb',
                })
            )
            .on('error', (e) => {
                e.toString().should.eql(
                    'GulpAppJson: platform:zfb not support \nGulpFile: /Users/july/workspace/open-source/wgs/test/fixture/json/app.json'
                )

                done()
            })
    })

    it('invalid route', function (done) {
        fromArray([
            new Vinyl({
                base: fixture(),
                path: fixture('json/app.json'),
                contents: Buffer.from(
                    JSON.stringify({
                        pages: [
                            {
                                name: 'home',
                            },
                        ],
                    })
                ),
            }),
        ])
            .pipe(gulpContext(session))
            .pipe(
                gulpJson({
                    platform: 'wx',
                })
            )
            .on('error', (e) => {
                e.toString().should.eql(
                    "GulpAppJson: Invalid Route From app.json，only support 'path' or { path: '' } \nGulpFile: /Users/july/workspace/open-source/wgs/test/fixture/json/app.json"
                )

                done()
            })
    })
})
