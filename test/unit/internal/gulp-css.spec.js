const { src } = require('gulp')
const { fixture, minify, stream } = require('~h')
const compilerContext = require('~f/compiler-context')
//
const gulpFileContext = require('internal/gulp-file-context')
const gulpCss = require('internal/gulp-css')
//
let context = {}

describe('gulp-css', function () {
    beforeEach(function () {
        // reset
        context = compilerContext()
    })

    it('trans', function (done) {
        src([fixture('css/index.css')])
            .pipe(gulpFileContext(context))
            .pipe(gulpCss(context.options))
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
