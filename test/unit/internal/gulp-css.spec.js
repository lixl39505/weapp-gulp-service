const { src } = require('gulp')
const { fixture, minify, stream } = require('~h')
const compilerSession = require('~f/compiler-session')
//
const gulpContext = require('internal/gulp-context')
const gulpCss = require('internal/gulp-css')
//
let context = {}

describe('gulp-css', function () {
    beforeEach(function () {
        // reset
        session = compilerSession()
    })

    it('trans', function (done) {
        src([fixture('css/index.css')])
            .pipe(gulpContext(session))
            .pipe(gulpCss(session.options))
            .pipe(
                stream(function (file, enc, cb) {
                    minify('css', file.contents.toString('utf8'))
                        .then((code) => {
                            // rename
                            file.extname.should.equal('.wxss')
                            // replace
                            code.should.include(`@import url(base.wxss);`)
                            // normal
                            code.should.include(`body{background:#f2f2f2}`)

                            done()
                        })
                        .catch((err) => done(err))
                        .finally(() => cb(null, file))
                })
            )
    })
})
