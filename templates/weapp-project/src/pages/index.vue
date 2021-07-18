<template>
    <!--index.wxml-->
    <view class="container">
        <view class="userinfo">
            <block wx:if="{{canIUseOpenData}}">
                <view class="userinfo-avatar" bindtap="bindViewTap">
                    <open-data type="userAvatarUrl"></open-data>
                </view>
                <open-data type="userNickName"></open-data>
            </block>
            <block wx:elif="{{!hasUserInfo}}">
                <button
                    wx:if="{{canIUseGetUserProfile}}"
                    bindtap="getUserProfile"
                >
                    获取头像昵称
                </button>
                <button
                    wx:elif="{{canIUse}}"
                    open-type="getUserInfo"
                    bindgetuserinfo="getUserInfo"
                >
                    获取头像昵称
                </button>
                <view wx:else> 请使用1.4.4及以上版本基础库 </view>
            </block>
            <block wx:else>
                <image
                    bindtap="bindViewTap"
                    class="userinfo-avatar"
                    src="{{userInfo.avatarUrl}}"
                    mode="cover"
                ></image>
                <text class="userinfo-nickname">{{ userInfo.nickName }}</text>
            </block>
        </view>
        <view class="usermotto">
            <text class="user-motto">{{ motto }}</text>
        </view>
    </view>
</template>

<script>
// index.js
// 获取应用实例
const app = getApp()

Page({
    data: {
        motto: 'Hello World',
        userInfo: {},
        hasUserInfo: false,
        canIUse: wx.canIUse('button.open-type.getUserInfo'),
        canIUseGetUserProfile: false,
        canIUseOpenData:
            wx.canIUse('open-data.type.userAvatarUrl') &&
            wx.canIUse('open-data.type.userNickName'), // 如需尝试获取用户信息可改为false
    },
    // 事件处理函数
    bindViewTap() {
        wx.navigateTo({
            url: '../logs/logs',
        })
    },
    onLoad() {
        if (wx.getUserProfile) {
            this.setData({
                canIUseGetUserProfile: true,
            })
        }
    },
    getUserProfile(e) {
        // 推荐使用wx.getUserProfile获取用户信息，开发者每次通过该接口获取用户个人信息均需用户确认，开发者妥善保管用户快速填写的头像昵称，避免重复弹窗
        wx.getUserProfile({
            desc: '展示用户信息', // 声明获取用户个人信息后的用途，后续会展示在弹窗中，请谨慎填写
            success: (res) => {
                console.log(res)
                this.setData({
                    userInfo: res.userInfo,
                    hasUserInfo: true,
                })
            },
        })
    },
    getUserInfo(e) {
        // 不推荐使用getUserInfo获取用户信息，预计自2021年4月13日起，getUserInfo将不再弹出弹窗，并直接返回匿名的用户个人信息
        console.log(e)
        this.setData({
            userInfo: e.detail.userInfo,
            hasUserInfo: true,
        })
    },
})
</script>

<style lang="less">
/**index.wxss**/
.userinfo {
    display: flex;
    flex-direction: column;
    align-items: center;
    color: #aaa;

    &-avatar {
        overflow: hidden;
        width: 128rpx;
        height: 128rpx;
        margin: 20rpx;
        border-radius: 50%;
    }
}

.usermotto {
    margin-top: 200px;
}
</style>

<script name="json">
module.exports = {
    usingComponents: {},
}
</script>
