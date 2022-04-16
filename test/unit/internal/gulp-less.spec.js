const through = require('through2')
const { src } = require('gulp')
const { fixture, minify } = require('~h')
const compilerSession = require('~f/compiler-session')
//
const gulpContext = require('internal/gulp-context')
const gulpLess = require('internal/gulp-less')
//
let context = {}

describe('gulp-less', function () {
    beforeEach(function () {
        // reset
        session = compilerSession()
    })
    
    it('trans', function (done) {
        src([fixture('less/index.less')])
            .pipe(gulpContext(session))
            .pipe(gulpLess(session.options))
            .pipe(
                through.obj(function (file, enc, cb) {
                    return minify('css', file.contents.toString('utf8'))
                        .then((code) => {
                            // alias
                            code.should.include(
                                `.page{background:url('../img/big.jpg') no-repeat}`
                            )
                            // px2rpx
                            code.should.include(
                                `.page-content{min-width:400rpx}`
                            )
                            // less2css
                            code.should.include(`.active{color:#123456}`)
                            // rename > .wxss
                            file.extname.should.equal('.wxss')

                            done()
                        })
                        .catch((err) => done(err))
                        .finally(() => cb(null, file))
                })
            )
    })
})
