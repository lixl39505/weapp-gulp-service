const chai = require('chai')
const proxyquire = require('proxyquire')
const chaiAsPromised = require('chai-as-promised')
// 启用BDD
const should = chai.should()
global.should = should
global.expect = chai.expect
global.alias2path = (x) => x
// 让chai支持promise
chai.use(chaiAsPromised)
// 取消proxyquire cache
proxyquire.noPreserveCache()
