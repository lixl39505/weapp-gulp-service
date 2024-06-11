const path = require('path')
const camelcase = require('camelcase')
const { isPojo, deepTraverse } = require('../utils/helper')

const posix = path.posix

// 对应微信小程序 ext.json
module.exports = class Ext {
    constructor(str, platform = 'wx') {
        this.content = str
        this.platform = platform

        this.init()
    }

    init() {
        this.parser = parserFactory(this.platform)

        if (this.parser) {
            this.parser.parse(this.content)
        } else {
            throw new Error(`platform:${this.platform} not support`)
        }
    }

    getJson() {
        return this.parser.appJson
    }

    getRouteMap() {
        return this.parser.routeMap
    }

    getRouteNameMap() {
        return this.parser.routeNameMap
    }

    static from() {
        return new Ext(...arguments)
    }
}

// 配置解析器，区分不同平台，为未来做准备
const parserMap = {
    wx: class ParserWx {
        constructor() {
            this.appJson = {}
            this.routeMap = {}
            this.routeNameMap = {}
        }

        parse(content) {
            var config = JSON.parse(content)

            Object.keys(config).forEach((key) => {
                var value = config[key],
                    strategy = `parse${pascalcase(key)}`

                if (this[strategy]) {
                    this.appJson[key] = this[strategy](value)
                } else {
                    this.appJson[key] = value
                }
            })
        }

        normalizeRoute(route) {
            return isPojo(route) ? route : { path: route }
        }

        // pages选项解析
        parsePages(pages, options = {}) {
            var result = []

            deepTraverse(pages, (route, parent) => {
                var { before } = options

                route = this.normalizeRoute(route)

                if (!route.path) {
                    throw new Error(
                        `Invalid Route From app.json，only support 'path' or { path: '' }`
                    )
                }

                var is = parent
                    ? posix.join(parent.__is__, route.path)
                    : route.path

                if (is[0] === '/') {
                    is = is.slice(1)
                }

                // fullpath
                route.__is__ = is

                if (route.children && route.children.length) {
                    return
                }

                // 只保存叶子节点
                result.push(typeof before == 'function' ? before(is) : is)

                //     页面地图
                var metadata = Object.keys(route).reduce((acc, k) => {
                    // 页面地图排除无用字段
                    if (['path', 'children', '__is__'].indexOf(k) < 0) {
                        acc[k] = route[k]
                    }

                    return acc
                }, {})

                this.routeMap[is] = metadata

                if (route.name) {
                    this.routeNameMap[route.name] = is
                }
            })

            return result
        }

        // subPages选项解析
        parseSubpackages(pkgs) {
            return pkgs.map((v) => {
                var pages = this.parsePages(
                    [
                        {
                            path: v.root,
                            children: v.pages,
                        },
                    ],
                    {
                        before(is) {
                            return is.replace(v.root + '/', '')
                        },
                    }
                )

                return Object.assign({}, v, {
                    pages,
                })
            })
        }
    },
}

function parserFactory(platform) {
    return parserMap[platform] ? new parserMap[platform]() : null
}

function pascalcase(s) {
    return camelcase(s, { pascalCase: true })
}
