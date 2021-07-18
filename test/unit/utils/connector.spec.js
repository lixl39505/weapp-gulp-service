const sinon = require('sinon')
const proxyquire = require('proxyquire')
const Memory = require('lowdb/adapters/Memory')
//
let connector

describe('connector', function () {
    beforeEach(function () {
        connector = proxyquire('utils/connector', {
            // 改用内存数据库
            'lowdb/adapters/FileSync': Memory,
        })
    })

    it('db', function () {
        var dbA = connector({
            name: 'a.json',
            defaults: {
                name: 'a',
            },
        })
        dbA.get('name').value().should.equal('a')

        // cache
        var dbA2 = connector({
            name: 'a.json',
            defaults: {
                name: 'a2',
            },
        })
        dbA.get('name').value().should.equal('a')
    })
})
