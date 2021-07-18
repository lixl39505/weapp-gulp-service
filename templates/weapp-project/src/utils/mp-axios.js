import Axios from 'axios'
import mpAdapter from 'axios-miniprogram-adapter'

// 适配wx.request
Axios.defaults.adapter = mpAdapter

const baseConfig = {
    baseURL: process.env.APP_SERVER, // 接口地址
    headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
    },
    withCredentials: true,
}

// 拦截
function intercept(instance) {
    // 请求前
    instance.interceptors.request.use(
        (config) => {
            // ...

            return config
        },
        (error) => {
            // 对请求错误做些什么
            return Promise.reject(error)
        }
    )

    // 请求后
    instance.interceptors.response.use(
        (res) => {
            let { data, config } = res
            // ...

            return data
        },
        (error) => {
            return Promise.reject(error)
        }
    )

    return instance
}

// prototype
var axios = Axios.create(baseConfig)
intercept(axios)

// extendable
axios.create = function (conf) {
    return intercept(Axios.create(Object.assign(baseConfig, conf)))
}

export default axios
