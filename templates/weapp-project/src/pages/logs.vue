<template>
    <!--logs.wxml-->
    <view class="container log-list">
        <block wx:for="{{logs}}" wx:key="timeStamp" wx:for-item="log">
            <text class="log-item">{{ index + 1 }}. {{ log.date }}</text>
        </block>
    </view>
</template>

<script>
// logs.js
const util = require('../../utils/util.js')

Page({
    data: {
        logs: [],
    },
    onLoad() {
        this.setData({
            logs: (wx.getStorageSync('logs') || []).map((log) => {
                return {
                    date: util.formatTime(new Date(log)),
                    timeStamp: log,
                }
            }),
        })
    },
})
</script>

<style lang="less">
.log {
    &-list {
        display: flex;
        flex-direction: column;
        padding: 40rpx;
    }
    &-item {
        margin: 10rpx;
    }
}
</style>

<script name="json">
module.exports = {
    navigationBarTitleText: '查看启动日志',
    usingComponents: {},
}
</script>
