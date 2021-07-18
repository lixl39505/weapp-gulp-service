const rqp = require('core/require-piper')

describe('require-piper', function () {
    it('require', function () {
        // exception
        should.throw(() => rqp('unknown'), `can not find 'unknown'`)
        // internal pipe
        should.exist(rqp('gulp-js'))
        // node_modules
        should.exist(rqp('gulp-if'))
        // HOF
        function myPipe() {}
        rqp(myPipe).should.equal(myPipe)
    })
})
