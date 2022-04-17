const { fromArray } = require('~h')
//
const gulpPassThrough = require('internal/gulp-pass-through')

describe('gulp-pass-through', function () {
    it('trans', function (done) {
        let res = []

        fromArray([1, 'a', true])
            .pipe(gulpPassThrough())
            .on('data', (v) => {
                res.push(v)
            })
            .on('end', () => {
                res.should.eql([1, 'a', true])
                done()
            })
    })
})
