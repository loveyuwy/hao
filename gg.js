const url = $request.url;
const isLeisuConfig = url.includes('app-gateway.leisuapi.com/v1/app/mobile/params');

if (isLeisuConfig && $response.status === 200) {
    try {
        let body = JSON.parse($response.body);
        
        // 关键修改：将code改为非广告状态码
        // 109可能是广告状态，改为200或其他成功状态
        body.code = 200;
        
        // 清空广告数据，但保留其他配置
        body.data = "";
        
        // 修改消息
        body.msg = "success";
        
        console.log("雷速广告配置已修改，广告已禁用");
        $done({body: JSON.stringify(body)});
    } catch (e) {
        console.log("雷速广告配置修改失败: " + e);
        $done({});
    }
} else {
    $done({});
}