const { src } = require('gulp')
const sinon = require('sinon')
const { fixture, stream } = require('~h')
const compilerSession = require('~f/compiler-session')
//
const gulpContext = require('internal/gulp-context')
const gulpCompileCache = require('internal/gulp-compile-cache')

describe('gulp-compile-cache', function () {
    beforeEach(function () {
        // reset
        session = compilerSession()
    })

    it('skip cache', function (done) {
        session.checkFileCached = () => false

        src([fixture('js/a.js')])
            .pipe(gulpContext(session))
            .pipe(gulpCompileCache())
            .pipe(
                stream(function (file, enc, cb) {
                    try {
                        session.files.should.eql([fixture('js/a.js')])

                        done()
                    } catch (e) {
                        done(e)
                    }
                    cb()
                })
            )
    })

    it('hit cache', function (done) {
        function hit(file) {
            done()
        }
        session.checkFileCached = () => true

        src([fixture('js/a.js')])
            .pipe(gulpContext(session))
            .pipe(gulpCompileCache({ hit }))
    })
})
