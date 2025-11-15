const url = $request.url;
const isLeisuConfig = url.includes('app-gateway.leisuapi.com/v1/app/mobile/params');

if (isLeisuConfig && $response.status === 200) {
    try {
        let body = JSON.parse($response.body);
        
        console.log("原始响应:", JSON.stringify(body));
        
        // 关键修改：尝试不同的状态码来禁用广告
        // 可能的值：0, 1, 200, 201 等
        body.code = 0;  // 尝试改为0
        
        // 清空广告数据
        body.data = "";
        
        // 修改消息
        body.msg = "success";
        
        console.log("修改后响应:", JSON.stringify(body));
        console.log("雷速广告配置已修改，广告已禁用");
        
        $done({body: JSON.stringify(body)});
    } catch (e) {
        console.log("雷速广告配置修改失败: " + e);
        $done({});
    }
} else {
    $done({});
}