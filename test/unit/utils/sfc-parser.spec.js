// target
let SfcParser = require('utils/sfc-parser')

describe('helper', function () {
    it('parse', function () {
        let content = `
<template>
    <div active>
        <input id="selfClose" />
        <input id="xmlClose"></input>
        <input id="h5Close">
    </div>
    <!-- xml允许但h5不允许 -->
    <span class="invalid" />
    <span></span>
</template>
<template>
    <div 
        v-if="inited"
        v-show="show"
        class="qrcode"
        :id="id"
        :align="   {
            name: prefix ? 'left' : 'right'
        }   "
        @click="onClick"
        @move.stop="onMove"
        @blur.capture="onBlur"
        @focus.stop.capture="onFocus"
        @target.mut="onTarget"
        @touch.mut.stop="onTouch">
        {{ dot ? '' : displayValue > max ? max + '+' : displayValue }}
    </div>
    <div v-else-if="loaded">loaded</div>
    <div v-else>loading</div>
    <div v-for="item in list"></div>
    <div v-for="(stu, idx) in list" :key="stu.name"></div>
</template>

<script>
import helper from '_u/helper'
</script>
<script>
global.wComponent({
    name: 'VanBadge',
    options: {
        multipleSlots: true,
    },
    props: {
        // 徽标内容
        content: {
            type: [String, Number],
            default: Infinity,
        },
        // @depreciated 徽标内容(兼容旧写法)
        count: {
            type: Number,
            default: Infinity,
        },
    },
})
</script>

<style lang="less">
.main { color: red;}
</style>
<style>
.main { font-size: 20px;}
</style>

<script name="json">
module.exports = {}
</script>
<script name="json">
module.exports = {
    component: true,
    usingComponents: {},
}
</script>
`

        const parser = new SfcParser({
            tagAlias: {
                div: 'view',
                span: 'text',
            },
        })
        parser.write(content)
        parser.end()
        // compare wxml
        parser.wxml.should.equal(`
    <view active>
        <input id="selfClose"></input>
        <input id="xmlClose"></input>
        <input id="h5Close"></input>
    </view>
    <!-- xml允许但h5不允许 -->
    <text class="invalid"></text>
    <text></text>

    <view wx:if="{{ inited }}" hidden="{{ show === false }}" class="qrcode" id="{{ id }}" align="{{{
        name: prefix ? 'left' : 'right'
    }}}" bind:click="onClick" catch:move="onMove" capture-bind="onBlur" capture-catch:focus mut-bind="onTarget" mut-touch="onTouch">
        {{ dot ? '' : displayValue > max ? max + '+' : displayValue }}
    </view>
    <view wx:elif="{{ loaded }}">loaded</view>
    <view wx:else>loading</view>
    <view wx:for="{{ list }}"></view>
    <view wx:for="{{ list }}" wx:for-item="{{ stu }}" wx:for-index="{{ idx }}" wx:key="name"></view>
`)
        // compare js
        parser.js.should.equal(`import helper from '_u/helper'
global.wComponent({
    name: 'VanBadge',
    options: {
        multipleSlots: true,
    },
    props: {
        // 徽标内容
        content: {
            type: [String, Number],
            default: Infinity,
        },
        // @depreciated 徽标内容(兼容旧写法)
        count: {
            type: Number,
            default: Infinity,
        },
    },
})
`)
        // compare json
        parser.json.should.equal(`module.exports = {
    component: true,
    usingComponents: {},
}`)
        // compare wxss
        parser.style.should.eql([
            { lang: 'less', text: `.main { color: red;}` },
            { lang: 'css', text: `.main { font-size: 20px;}` },
        ])
    })
})
