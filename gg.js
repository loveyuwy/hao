const url = $request.url;

// 如果是广告相关请求，立即返回空数据
if (url.includes('splash') || url.includes('startup') || url.includes('pangolin') || url.includes('gdt')) {
    console.log(`快速失败: ${url}`);
    $done({
        status: 200,
        body: JSON.stringify({code: 0, data: null, msg: "success"})
    });
} else {
    $done({});
}