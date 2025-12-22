/*
声荐自动签到 - 最终适配版
*/

const $ = new Env("声荐自动签到");
const tokenKey = "shengjian_auth_token";

// --- 适配酷我：参数解析逻辑 ---
const ARGS = (() => {
    let args = { silent: "0" };
    let input = (typeof $argument !== "undefined" && $argument) ? String($argument).toLowerCase() : "";

    // 逻辑：寻找 silent_switch= 后的布尔值
    if (input.includes("silent_switch=")) {
        let val = input.split("silent_switch=")[1].split("&")[0].split(",")[0].trim();
        args.silent = (val === "true" || val === "1") ? "1" : "0";
    } else {
        // 兜底：如果 Loon 还是只传了变量名
        args.silent = (input === "true" || input === "1" || input === "silent_switch") ? "1" : "0";
    }
    return args;
})();

const isSilentMode = ARGS.silent === "1";
const SUMMARY_HOUR = 23; 

// 判断当前小时是否 >= 23
const isTimeToShowSummary = new Date().getHours() >= SUMMARY_HOUR;

const rawToken = $.read(tokenKey);
const token = rawToken ? (rawToken.startsWith("Bearer ") ? rawToken : `Bearer ${rawToken}`) : null;

(async () => {
    if (!token) {
        $.notify("❌ 声荐失败", "", "未找到 Token，请重新抓包");
        return $.done();
    }

    console.log(`[DEBUG] 原始参数: "${$argument}"`);
    console.log(`[DEBUG] 判定模式: ${isSilentMode ? "静默汇总模式 (23点总结)" : "实时通知模式"}`);

    // 执行任务
    const signRes = await signIn();
    const flowerRes = await claimFlower();

    // --- 通知决策核心 ---
    if (!isSilentMode) {
        // 【模式 1】：关闭静默 -> 每次运行实时弹窗
        $.notify("声荐签到结果", "", signRes);
        $.notify("声荐领花结果", "", flowerRes);
        console.log("[INFO] 已执行实时通知");
    } else {
        // 【模式 2】：开启静默
        if (isTimeToShowSummary) {
            // 到了 23 点 -> 发送汇总通知
            const summary = `📊 声荐汇总报告 (今日结束)\n──────────────\n📋 签到: ${signRes}\n🌸 领花: ${flowerRes}\n──────────────\n⏰ 运行时间: ${new Date().toLocaleString('zh-CN', {hour12: false})}`;
            $.notify("声荐运行总结", "", summary);
            console.log("[INFO] 已执行 23 点汇总通知");
        } else {
            // 没到 23 点 -> 仅记录日志
            console.log(`[INFO] 静默中，23点前拦截弹窗。记录: ${signRes} | ${flowerRes}`);
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
                resolve(j.msg === "ok" ? `成功(${j.data?.prizeName || ""})` : `📋 ${j.msg || "已签到"}`);
            } catch (e) { resolve("📋 已签到"); }
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

// --- 环境适配器 ---
function Env(n){this.name=n;this.notify=(t,s,b)=>{if(typeof $notification!="undefined")$notification.post(t,s,b);else if(typeof $notify!="undefined")$notify(t,s,b);else console.log(`${t}\n${s}\n${b}`)};this.read=k=>{if(typeof $persistentStore!="undefined")return $persistentStore.read(k);if(typeof $prefs!="undefined")return $prefs.valueForKey(k)};this.put=(r,c)=>{if(typeof $httpClient!="undefined")$httpClient.put(r,c)};this.post=(r,c)=>{if(typeof $httpClient!="undefined")$httpClient.post(r,c)};this.done=v=>{if(typeof $done!="undefined")$done(v)}}
