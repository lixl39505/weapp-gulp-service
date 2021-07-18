<template>
    <view class="header">{{ header }}</view>
</template>
<template>
    <view class="content">{{ content }}</view>
</template>

<script>
import { userView } from '@/api/user'
</script>
<script>
global.wComponent({
    props: {
        header: String,
        content: String,
    },
})
</script>

<style lang="less">
.header {
    color: @primary-color;
}
</style>
<style>
.content {
    height: 200px;
}
</style>

<script name="json">
module.exports = {
    component: true,
}
</script>
<script name="json">
module.exports = {
    component: false,
}
</script>
