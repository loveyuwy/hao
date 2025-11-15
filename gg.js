/*
 * 名称: 跳过开屏广告 (强制返回空JSON)
 * 功能: 拦截广告请求，立即返回一个空的JSON响应，解决启动卡顿问题。
 * 作者: Gemini
 */

// 伪造一个响应体 (空JSON对象)
const body = JSON.stringify({});

// 在 $done() 中返回一个 response 对象
// Loon 会立即返回这个伪造的响应，从而阻止了真实的请求
$done({
  response: {
    status: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8'
    },
    body: body
  }
});
