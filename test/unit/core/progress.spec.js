const proxyquire = require('proxyquire')
const sinon = require('sinon')
//
let progress

function Bar() {
    this.isActive = false
    this.total = 100
    this.value = 0
}

Object.assign(Bar.prototype, {
    append(c) {
        if (this.isActive) {
            this.total += c
        } else {
            this.total = c
        }
    },
    start(total, v) {
        this.total = total
        this.value = v
        this.isActive = true
    },
    stop() {
        this.isActive = false
    },
    setTotal(v) {
        this.total = v
    },
    getTotal() {
        return this.total
    },
    increment() {
        if (this.value < this.total) {
            this.value++
        }
    },
})

describe('progress', function () {
    beforeEach(function () {
        progress = proxyquire('core/progress', {
            'cli-progress': {
                Bar,
            },
        })
    })

    it('append', function () {
        progress.append(10)
        progress.getTotal().should.equal(10)
        progress.append(10)
        progress.getTotal().should.equal(20)
        progress.stop()
        progress.append(10)
        progress.getTotal().should.equal(10)
    })
})
