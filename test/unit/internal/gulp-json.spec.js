const { src } = require('gulp')
const { fixture, stream } = require('~h')
const compilerContext = require('~f/compiler-context')
//
const gulpContext = require('internal/gulp-context')
const gulpJson = require('internal/gulp-json')
//
let context = {}

describe('gulp-json', function () {
    beforeEach(function () {
        // reset
        context = compilerContext()
    })

    it('trans', function (done) {
        src([fixture('json/human.json5')])
            .pipe(gulpContext(context))
            .pipe(gulpJson(context.options))
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
})
