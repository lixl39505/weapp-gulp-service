const { runQueue } = require('utils/helper')

describe('helper', function () {
    it('runQueue', function (done) {
        runQueue(
            [1, 2, 3],
            (v, next) => next(),
            (err, over) => {
                try {
                    over.should.equal(true)
                } catch (e) {
                    err = e
                }

                done(err)
            }
        )
    })

    it('runQueue.promise', function () {
        return runQueue
            .promise([1, 2, 3], (v, next) => next())
            .then((over) => {
                over.should.equal(true)
            })
    })
})
