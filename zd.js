// 彻底阻断脚本 - 针对顽固请求
const blockedPatterns = [
    'open.e.kuaishou.com',
    'open.e.kuaishou.cn', 
    'mi.gdt.qq.com'
];

function isBlocked(url) {
    for (let pattern of blockedPatterns) {
        if (url.includes(pattern)) {
            return true;
        }
    }
    return false;
}

if (isBlocked($request.url)) {
    console.log(`🚫 阻断请求: ${$request.url}`);
    
    // 方法1: 返回空响应 + 404状态码
    $done({
        response: {
            status: 404,
            headers: {
                'Content-Type': 'text/plain'
            },
            body: ''
        }
    });
    
    // 方法2: 直接丢弃请求（更彻底）
    // $done({});
} else {
    $done({});
}