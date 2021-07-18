const { src } = require('gulp')
const { fixture, stream } = require('~h')
const compilerContext = require('~f/compiler-context')
//
const gulpFileContext = require('internal/gulp-file-context')
const gulpJs = require('internal/gulp-js')
//
let context = {}

describe('gulp-js', function () {
    beforeEach(function () {
        // reset
        context = compilerContext()
    })

    it('trans', function (done) {
        src([fixture('js/a.js')])
            .pipe(gulpFileContext(context))
            .pipe(gulpJs(context.options))
            .pipe(
                stream(function (file, enc, cb) {
                    try {
                        var contents = file.contents.toString('utf8')

                        // alias
                        contents.should.include(`import { read } from 'b'`)
                        // env
                        contents.should.include(`return read("/" + name)`)

                        done()
                    } catch (e) {
                        done(e)
                    }
                    cb()
                })
            )
    })
})
