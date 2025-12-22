/*
声荐自动签到 - 智能汇总版
*/

const $ = new Env("声荐自动签到");
const tokenKey = "shengjian_auth_token";

// --- 配置参数 ---
const LAST_RUN_HOUR = 18; // 设定当日最后一次运行的小时数

// --- 参数解析 ---
let isSilentMode = false; 
if (typeof $argument !== "undefined" && $argument) {
    const argStr = String($argument).toLowerCase().trim();
    if (argStr.includes("true") || argStr === "{silent_switch}" || argStr === "silent_switch" || argStr === "1") {
        isSilentMode = true;
    }
}

// 判断是否为今日最后一次运行
const isLastRun = (() => {
    const hour = new Date().getHours();
    return hour >= LAST_RUN_HOUR;
})();

const rawToken = $.read(tokenKey);
const token = rawToken ? (rawToken.startsWith("Bearer ") ? rawToken : `Bearer ${rawToken}`) : null;

(async () => {
    if (!token) {
        $.notify("❌ 声荐失败", "", "未找到 Token");
        return $.done();
    }

    const signRes = await signIn();
    const flowerRes = await claimFlower();

    // 逻辑分流
    if (!isSilentMode) {
        // 模式 A: 静默关闭 -> 每次都实时弹窗
        $.notify("声荐签到结果", "", signRes);
        $.notify("声荐领花结果", "", flowerRes);
    } else {
        // 模式 B: 静默开启
        if (isLastRun) {
            // 只有最后一次运行才发汇总通知
            const summary = `📊 声荐汇总报告\n──────────────\n📋 签到: ${signRes}\n🌸 领花: ${flowerRes}\n──────────────`;
            $.notify("声荐运行总结", "", summary);
            console.log("[DEBUG] 模式: 静默汇总 (末班车已发送)");
        } else {
            // 非最后一次运行，仅记录日志
            console.log(`[DEBUG] 模式: 静默汇总 (当前时间未到末班车，跳过弹窗)`);
            console.log(`结果: ${signRes} | ${flowerRes}`);
        }
    }

})().catch((e) => {
    console.log(`[异常] ${e}`);
}).finally(() => $.done());

// --- 接口函数 ---
function signIn() {
    return new Promise((resolve) => {
        $.put({
            url: "https://xcx.myinyun.com:4438/napi/gift",
            headers: { "Authorization": token, "Content-Type": "application/json" },
            body: "{}"
        }, (err, res, data) => {
            try {
                const j = JSON.parse(data);
                resolve(j.msg === "ok" ? `成功(${j.data?.prizeName || ""})` : (j.msg || "已签到"));
            } catch (e) { resolve("已完成"); }
        });
    });
}

function claimFlower() {
    return new Promise((resolve) => {
        $.post({
            url: "https://xcx.myinyun.com:4438/napi/flower/get",
            headers: { "Authorization": token, "Content-Type": "application/json" },
            body: "{}"
        }, (err, res, data) => {
            resolve(data === "true" ? "🌺 领花成功" : "🌸 已领/未到时间");
        });
    });
}

function Env(n){this.name=n;this.notify=(t,s,b)=>{if(typeof $notification!="undefined")$notification.post(t,s,b);else if(typeof $notify!="undefined")$notify(t,s,b);else console.log(`${t}\n${s}\n${b}`)};this.read=k=>{if(typeof $persistentStore!="undefined")return $persistentStore.read(k);if(typeof $prefs!="undefined")return $prefs.valueForKey(k)};this.put=(r,c)=>{if(typeof $httpClient!="undefined")$httpClient.put(r,c)};this.post=(r,c)=>{if(typeof $httpClient!="undefined")$httpClient.post(r,c)};this.done=v=>{if(typeof $done!="undefined")$done(v)}}
