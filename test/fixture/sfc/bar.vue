<template>
    <view>
        <bar-title showContent>{{ name }}</bar-title>
    </view>
</template>

<script>
import { barView } from '@/api/bar'

global.wComponent({
    props: {
        name: String,
    },
})
</script>

<style lang="less">
.bar {
    color: @primary-color;
}
</style>

<script name="json">
module.exports = {
    component: true,
    usingComponents: {
        'bar-title': './bar-title/bar-title',
    },
}
</script>
