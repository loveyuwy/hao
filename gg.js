const url = $request.url;
const isLeisuAd = url.includes('app-gateway.leisuapi.com/v1/app/mobile/params');

if (isLeisuAd) {
    if ($response.status === 200) {
        try {
            let body = JSON.parse($response.body);
            // 修改响应数据，清除广告
            body.code = 200; // 改为成功状态
            body.data = ""; // 清空广告数据
            body.msg = "success";
            
            console.log("雷速广告已屏蔽");
            $done({body: JSON.stringify(body)});
        } catch (e) {
            console.log("雷速广告屏蔽失败: " + e);
            $done({});
        }
    } else {
        $done({});
    }
} else {
    $done({});
}