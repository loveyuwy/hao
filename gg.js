/*
 * 脚本功能：拦截咪咕视频 ggx03 的开屏广告请求
 * 脚本原理：返回一个空的 JSON 响应，欺骗 App 以为“没有广告”
 * 脚本作者：Gemini
 */

// 构造一个最精简的、合法的 JSON 空响应
const body = "{}";

// 完成响应
$done({
    response: {
        status: 200, // 告诉 App 请求成功
        headers: { "Content-Type": "application/json;charset=utf-8" },
        body: body // 返回空内容
    }
});
