const { src } = require('gulp')
const { importFromStringSync } = require('module-from-string')
const { fixture, stream, afterN } = require('~h')
const compilerContext = require('~f/compiler-context')
//
const gulpFileContext = require('internal/gulp-file-context')
const gulpJson = require('internal/gulp-json')
//
let context = {}

describe('gulp-app-json', function () {
    beforeEach(function () {
        // reset
        context = compilerContext()
    })

    it('trans', function (done) {
        var unitErr = [],
            unitDone = afterN(3, () => {
                done(unitErr[0])
            })

        src([fixture('json/app.json')])
            .pipe(gulpFileContext(context))
            .pipe(gulpJson(context.options))
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
})
