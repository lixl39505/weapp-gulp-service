import { describe, expect, it } from 'vitest'

import { Ext } from '../../src/ext.js'

const PAGES = JSON.stringify({
    pages: [
        {
            path: 'pages/tab1/tab1',
            title: '首页',
            name: 'home',
            meta: { auth: false },
        },
        'pages/tab4/tab4',
        {
            path: 'pages/sub',
            children: [{ path: 'inner/deep', title: '深层' }],
        },
    ],
    subpackages: [
        {
            root: 'pkg-a',
            pages: [{ path: 'pages/x/x', name: 'ax' }, 'pages/y/y'],
        },
    ],
    subPackages: [{ root: 'pkg-b', pages: ['pages/z/z'] }],
    window: { navigationBarTitleText: '测试' },
})

describe('Ext (extended app.json)', () => {
    it('flattens nested routes into pages and builds route maps', () => {
        const ext = Ext.from(PAGES, 'wx')
        const appJson = ext.getJson()

        expect(appJson.pages).toEqual([
            'pages/tab1/tab1',
            'pages/tab4/tab4',
            'pages/sub/inner/deep',
        ])
        expect(ext.getRouteMap()).toEqual({
            'pages/tab1/tab1': {
                title: '首页',
                name: 'home',
                meta: { auth: false },
            },
            'pages/tab4/tab4': {},
            'pages/sub/inner/deep': { title: '深层' },
            'pkg-a/pages/x/x': { name: 'ax' },
            'pkg-a/pages/y/y': {},
            'pkg-b/pages/z/z': {},
        })
        expect(ext.getRouteNameMap()).toEqual({
            home: 'pages/tab1/tab1',
            ax: 'pkg-a/pages/x/x',
        })
        expect(appJson.window).toEqual({ navigationBarTitleText: '测试' })
    })

    it('expands subpackages (relative page paths, both spellings)', () => {
        const ext = Ext.from(PAGES, 'wx')
        const appJson = ext.getJson()
        const subpackages = appJson.subpackages as Array<{
            root: string
            pages: string[]
        }>
        const subPackages = appJson.subPackages as Array<{
            root: string
            pages: string[]
        }>

        expect(subpackages).toHaveLength(1)
        expect(subpackages[0]!.pages).toEqual(['pages/x/x', 'pages/y/y'])
        expect(subPackages).toHaveLength(1)
        expect(subPackages[0]!.root).toBe('pkg-b')
        expect(subPackages[0]!.pages).toEqual(['pages/z/z'])
    })

    it('strips a leading slash from joined routes', () => {
        const ext = Ext.from(
            JSON.stringify({ pages: [{ path: '/pages/abs/abs' }] }),
            'wx'
        )

        expect(ext.getJson().pages).toEqual(['pages/abs/abs'])
    })

    it('throws on routes without a path', () => {
        expect(() =>
            Ext.from(JSON.stringify({ pages: [{ title: 'no path' }] }), 'wx')
        ).toThrowError(/Invalid Route From app.json/)
    })

    it('throws on unknown platforms', () => {
        expect(() => Ext.from('{}', 'alipay')).toThrowError(
            /platform:alipay not support/
        )
    })

    it('defaults the platform to wx', () => {
        const ext = new Ext('{"pages":[]}')

        expect(ext.platform).toBe('wx')
        expect(ext.getJson()).toEqual({ pages: [] })
    })
})
