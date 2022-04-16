const { src } = require('gulp')
const { fixture, stream } = require('~h')
const compilerSession = require('~f/compiler-session')
//
const gulpContext = require('internal/gulp-context')
const gulpWxs = require('internal/gulp-wxs')
//
let context = {}

describe('gulp-wxs', function () {
    beforeEach(function () {
        // reset
        session = compilerSession()
    })
    
    it('trans', function (done) {
        src([fixture('wxs/foo.wxs')])
            .pipe(gulpContext(session))
            .pipe(gulpWxs(session.options))
            .pipe(
                stream(function (file, enc, cb) {
                    try {
                        var contents = file.contents.toString('utf8')

                        // alias
                        contents.should.include(`const add = require('add')`)

                        done()
                    } catch (e) {
                        done(e)
                    }
                    cb()
                })
            )
    })
})
