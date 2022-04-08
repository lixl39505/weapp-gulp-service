const { src } = require('gulp')
const { fixture, stream, afterN } = require('~h')
const compilerContext = require('~f/compiler-context')
//
const gulpContext = require('internal/gulp-context')
const gulpLessVar = require('internal/gulp-less-var')
//
let context = {}

describe('gulp-less-var', function () {
    beforeEach(function () {
        // reset
        context = compilerContext()
    })

    it('trans', function (done) {
        var unitErr = [],
            unitDone = afterN(2, () => done(unitErr[0]))

        src([fixture('less/variables.less')])
            .pipe(gulpContext(context))
            .pipe(gulpLessVar(context.options))
            .pipe(
                stream(function (file, env, cb) {
                    const { extname } = file,
                        contents = file.contents.toString('utf8')

                    try {
                        if (extname == '.js') {
                            contents.should.equal(
                                `export default {"primaryColor":"#123456"}`
                            )
                        }

                        if (extname == '.wxss') {
                            contents.should.equal(
                                `page {--primary-color: #123456;}`
                            )
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
