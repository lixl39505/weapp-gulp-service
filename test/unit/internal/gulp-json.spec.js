const proxyquire = require('proxyquire')
const gulpRename = require('gulp-rename')
const { src } = require('gulp')
const { fixture, stream, toGlobPath } = require('~h')
const compilerSession = require('~f/compiler-session')
//
const gulpContext = require('internal/gulp-context')
// target
let gulpJson

describe('gulp-json', function () {
    beforeEach(function () {
        // reset
        gulpJson = proxyquire('internal/gulp-json', {
            'fast-glob': {
                sync(patterns) {
                    return [toGlobPath(patterns.pop())]
                },
            },
        })
        session = compilerSession()
    })

    it('json5', function (done) {
        src([fixture('json/human.json5')])
            .pipe(gulpContext(session))
            .pipe(gulpJson(session.options))
            .pipe(
                stream(function (file, enc, cb) {
                    try {
                        var obj = JSON.parse(file.contents.toString('utf8'))

                        // json5
                        obj.should.eql({
                            unquoted: 'and you can quote me on that',
                            singleQuotes: 'I can use "double quotes" here',
                            lineBreaks: "Look, Mom! No \\n's!",
                            hexadecimal: 912559,
                            leadingDecimalPoint: 0.8675309,
                            andTrailing: 8675309,
                            positiveSign: 1,
                            trailingComma: 'in objects',
                            andIn: ['arrays'],
                            backwardsCompatible: 'with JSON',
                        })

                        done()
                    } catch (e) {
                        done(e)
                    }
                    cb()
                })
            )
    })

    it('depend', function (done) {
        let deps = []
        session.depend = (file, { matchers = [] }) => {
            deps = matchers[0](file)
        }
        session.wgsResolve = (s, f) => s
        src([fixture('json/app.json')])
            .pipe(gulpContext(session))
            // 排除gulp-app-json干扰
            .pipe(gulpRename({ basename: 'app2.json' }))
            .pipe(gulpJson(session.options))
            .pipe(
                stream(function (file, enc, cb) {
                    deps.should.have.members([
                        '/pages/tab-bar/tab1/*.*',
                        'pages/tab-bar/tab4/*.*',
                        'pkg-demo/pages/index/*.*',
                        'pkg-demo/pages/select-user/*.*',
                        '@weapp/button/*.*',
                        '@weapp/icon/*.*',
                    ])

                    cb()
                    done()
                })
            )
    })
})
