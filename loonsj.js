/*
声荐自动签到 - 酷我逻辑适配版
*/

const $ = new Env("声荐自动签到");
const tokenKey = "shengjian_auth_token";

// --- 完全移植酷我的 ARGS 解析逻辑 ---
const ARGS = (() => {
    let args = { silent: "0" }; // 默认 0 代表不静默
    let input = null;

    if (typeof $argument !== "undefined" && $argument) {
        input = $argument;
    }

    if (!input) return args;

    // 处理 Loon 的各种传参格式
    let str = String(input).trim().toLowerCase();
    
    // 如果包含等号，解析键值对
    if (str.includes("=")) {
        str.split(/&|,/).forEach(item => {
            let [k, v] = item.split("=");
            if (k && k.trim() === "silent_switch") {
                // 只有明确为 true 或 1 时才设为静默模式 "1"
                args.silent = (v.trim() === "true" || v.trim() === "1") ? "1" : "0";
            }
        });
    } else {
        // 如果是直接传变量名或占位符 (Loon 常见 Bug)
        // 只有当它是开启状态时，Loon 才会传变量名字符串
        args.silent = (str === "true" || str === "1" || str === "silent_switch" || str === "{silent_switch}") ? "1" : "0";
    }
    return args;
})();

const isSilentMode = ARGS.silent === "1";
const SUMMARY_HOUR = 23; 

// 判断是否到 23 点
const isTimeToShowSummary = new Date().getHours() >= SUMMARY_HOUR;

const rawToken = $.read(tokenKey);
const token = rawToken ? (rawToken.startsWith("Bearer ") ? rawToken : `Bearer ${rawToken}`) : null;

(async () => {
    if (!token) {
        $.notify("❌ 声荐失败", "", "未找到 Token");
        return $.done();
    }

    console.log(`[DEBUG] 原始参数: "${$argument}"`);
    console.log(`[DEBUG] 最终判定: ${isSilentMode ? "静默汇总模式" : "实时通知模式"}`);

    const signRes = await signIn();
    const flowerRes = await claimFlower();

    // --- 通知决策逻辑 ---
    if (!isSilentMode) {
        // 模式 1：关闭静默 -> 实时弹出通知
        $.notify("声荐签到结果", "", signRes);
        $.notify("声荐领花结果", "", flowerRes);
        console.log("[INFO] 已发送实时通知");
    } else if (isTimeToShowSummary) {
        // 模式 2：开启静默 且 到了23点 -> 发送汇总通知
        const summary = `📊 声荐汇总报告\n──────────────\n📋 签到: ${signRes}\n🌸 领花: ${flowerRes}\n──────────────`;
        $.notify("声荐汇总总结", "", summary);
        console.log("[INFO] 已发送汇总通知");
    } else {
        // 模式 3：开启静默 但 没到23点 -> 仅记录日志
        console.log(`[INFO] 静默中，23点前不弹窗。记录: ${signRes} | ${flowerRes}`);
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
                resolve(j.msg === "ok" ? `✅ 成功(${j.data?.prizeName || ""})` : `📋 ${j.msg || "已签到"}`);
            } catch (e) { resolve("📋 已完成"); }
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
