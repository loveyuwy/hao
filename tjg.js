const url = "http://62.234.16.24:59/tjg";
const storeKey = "tjg_products_cache";

$httpClient.get(url, function(error, response, data) {
    if (error) {
        console.log("天机观监控请求失败: " + error);
        $done();
        return;
    }

    let products = [];
    const regex = /📦 商品：(.*?)\n(?:.*\n)*?🎯 积分：(.*?)\n(?:.*\n)*?📊 库存：(.*?)\n/g;
    let match;

    while ((match = regex.exec(data)) !== null) {
        products.push({
            name: match[1].trim(),
            points: match[2].trim(),
            stock: match[3].trim()
        });
    }

    if (products.length === 0) {
        console.log("未解析到任何商品。");
        $done();
        return;
    }
    let currentNames = products.map(p => p.name);
    let historyStr = $persistentStore.read(storeKey);
    let historyNames = null;
    
    try {
        if (historyStr) {
            historyNames = JSON.parse(historyStr);
        }
    } catch (e) {
        console.log("解析历史数据失败");
    }
    const formatProduct = (p) => `📦 ${p.name}\n     💰 积分: ${p.points} | 📊 库存: ${p.stock}`;

    if (!historyNames) {        $persistentStore.write(JSON.stringify(currentNames), storeKey);
        
        let content = products.map(formatProduct).join("\n\n");
        $notification.post("🛍️ 天机观监控 (首次运行)", `共发现 ${products.length} 个商品`, content);
        console.log("首次运行，全量通知。");

    } else {
        let newItems = products.filter(p => !historyNames.includes(p.name));

        if (newItems.length > 0) {            $persistentStore.write(JSON.stringify(currentNames), storeKey);
            
            let content = newItems.map(formatProduct).join("\n\n");
            $notification.post("🛍️ 天机观上新啦！", `新增了 ${newItems.length} 个商品`, content);
            console.log("发现新商品名，已弹窗通知。");
        } else {            $persistentStore.write(JSON.stringify(currentNames), storeKey);
            console.log("没有新商品名，静默结束。");
        }
    }

    $done();
});
