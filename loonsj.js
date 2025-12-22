/*
声荐自动签到 - 酷我逻辑优化版
*/

const $ = new Env("声荐自动签到");
const tokenKey = "shengjian_auth_token";

// --- 借鉴酷我：智能参数解析 ---
const ARGS = (() => {
    let args = { silent: "false" };
    if (typeof $argument !== "undefined" && $argument) {
        let str = String($argument).toLowerCase();
        // 兼容多种 Loon 传递方式 (数组式、键值对式、占位符式)
        if (str.includes("true") || str.includes("silent_switch")) {
            args.silent = "true";
        }
    }
    return args;
})();

const isSilentMode = ARGS.silent === "true";

// --- 判断是否为今日最后一次运行 (参考酷我 23 点逻辑，这里设定为 12 点) ---
const isLastRun = (() => {
    const hour = new Date().getHours();
    return hour >= 12; // 假设你 cron 最后一个时间点是 12 点
})();

const rawToken = $.read(tokenKey);
const token = rawToken ? (rawToken.startsWith("Bearer ") ? rawToken : `Bearer ${rawToken}`) : null;

(async () => {
    if (!token) {
        $.notify("❌ 声荐失败", "", "未找到 Token");
        return $.done();
    }

    console.log(`[DEBUG] 模式: ${isSilentMode ? "静默汇总" : "实时通知"}`);

    // 1. 执行任务
    const signRes = await signIn();
    const flowerRes = await claimFlower();

    // 2. 实时通知逻辑 (静默关闭时)
    if (!isSilentMode) {
        $.notify("声荐任务", "实时结果", `📋 ${signRes}\n🌸 ${flowerRes}`);
    }

    // 3. 汇总通知逻辑 (静默开启 且 是最后一次运行)
    // 或者根据你的要求：静默开启就只发总结（不限时间）
    if (isSilentMode) {
        const summary = `📊 声荐汇总报告\n──────────────\n📋 签到: ${signRes}\n🌸 领花: ${flowerRes}\n──────────────`;
        $.notify("声荐运行总结", "", summary);
    }

})().catch((e) => {
    console.log(`[异常] ${e}`);
}).finally(() => $.done());

// --- 任务函数 ---
function signIn() {
    return new Promise((resolve) => {
        $.put({
            url: "https://xcx.myinyun.com:4438/napi/gift",
            headers: { "Authorization": token, "Content-Type": "application/json" },
            body: "{}"
        }, (err, res, data) => {
            try {
                const j = JSON.parse(data);
                resolve(j.msg === "ok" ? `成功(${j.data?.prizeName || ""})` : (j.msg || "已签"));
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
            resolve(data === "true" ? "🌺 成功" : "🌸 已领/未到时");
        });
    });
}

function Env(n){this.name=n;this.notify=(t,s,b)=>{if(typeof $notification!="undefined")$notification.post(t,s,b);else if(typeof $notify!="undefined")$notify(t,s,b);else console.log(`${t}\n${s}\n${b}`)};this.read=k=>{if(typeof $persistentStore!="undefined")return $persistentStore.read(k);if(typeof $prefs!="undefined")return $prefs.valueForKey(k)};this.put=(r,c)=>{if(typeof $httpClient!="undefined")$httpClient.put(r,c)};this.post=(r,c)=>{if(typeof $httpClient!="undefined")$httpClient.post(r,c)};this.done=v=>{if(typeof $done!="undefined")$done(v)}}
