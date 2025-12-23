/*
声荐自动签到合并版 - 修复通知逻辑
适配 Loon / Surge
*/

const $ = new Env("声荐组合任务");
const tokenKey = "shengjian_auth_token";
const statsKey = "shengjian_daily_stats";

// --- 修复后的参数解析 ---
const ARGS = (() => {
    let args = { notify: "1" }; // 默认开启通知
    if (typeof $argument !== "undefined" && $argument) {
        if (typeof $argument === "string") {
            // 处理 key=value&key2=value2 格式
            $argument.split("&").forEach(item => {
                let [k, v] = item.split("=");
                if (k) args[k] = v;
            });
        } else if (typeof $argument === "object") {
            args = { ...args, ...$argument };
        }
    }
    return args;
})();

const rawToken = $.read(tokenKey);
const token = rawToken ? (rawToken.startsWith("Bearer ") ? rawToken : `Bearer ${rawToken}`) : null;

const commonHeaders = {
    "Authorization": token,
    "Content-Type": "application/json",
    "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 16_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 MicroMessenger/8.0.64 NetType/4G Language/zh_CN",
    "Referer": "https://servicewechat.com/wxa25139b08fe6e2b6/23/page-frame.html"
};

function getDailyStats() {
    const today = new Date().toISOString().slice(0, 10);
    let stats = {};
    try { 
        const data = $.read(statsKey);
        stats = data ? JSON.parse(data) : {}; 
    } catch (e) { stats = {}; }
    if (stats.date !== today) {
        stats = { date: today, logs: [] };
    }
    return stats;
}

function saveDailyStats(stats) {
    $.write(JSON.stringify(stats), statsKey);
}

function signIn() {
    return new Promise((resolve) => {
        const req = { url: "https://xcx.myinyun.com:4438/napi/gift", headers: commonHeaders, body: "{}" };
        $.put(req, (err, res, data) => {
            if (err) return resolve({ status: 'error', message: '📡 签到: 网络错误' });
            const code = res ? (res.status || res.statusCode) : 0;
            if (code == 401) return resolve({ status: 'token_error', message: 'Token 过期' });
            try {
                const result = JSON.parse(data);
                if ((code == 200) && result.msg === "ok") {
                    resolve({ status: 'success', message: `✅ 签到: ${result.data?.prizeName || "成功"}` });
                } else if (String(result.msg || "").includes("已经")) {
                    resolve({ status: 'info', message: '📋 签到: 今日已完成' });
                } else {
                    resolve({ status: 'error', message: `🚫 签到: ${result.msg || "错误"}` });
                }
            } catch { resolve({ status: 'error', message: '🤯 签到: 解析失败' }); }
        });
    });
}

function claimFlower() {
    return new Promise((resolve) => {
        const req = { url: "https://xcx.myinyun.com:4438/napi/flower/get", headers: commonHeaders, body: "{}" };
        $.post(req, (err, res, data) => {
            if (err) return resolve({ status: 'info', message: '⏰ 领花: 超时' });
            if (data === "true") return resolve({ status: 'success', message: '🌺 已领小红花' });
            try {
                const obj = JSON.parse(data);
                if (obj.statusCode == 401) resolve({ status: 'token_error', message: 'Token 过期' });
                else if (obj.statusCode == 400) resolve({ status: 'info', message: '⏰ 领花: 未到时间' });
                else resolve({ status: 'info', message: `🌸 领花: ${obj.message || '未知'}` });
            } catch {
                if (data === 'false') resolve({ status: 'info', message: '👍 领花: 已领过' });
                else resolve({ status: 'info', message: '🤔 领花: 响应未知' });
            }
        });
    });
}

(async () => {
    console.log("--- 声荐任务开始 ---");
    const now = new Date();
    const hour = now.getHours();
    const isLastRun = (hour >= 22);

    if (!token) {
        $.notify("❌ 声荐任务失败", "未找到 Token", "请进入小程序登录以自动获取");
        return $.done();
    }

    const [signResult, flowerResult] = await Promise.all([signIn(), claimFlower()]);
    
    let stats = getDailyStats();
    const currentLog = `[${hour}点] ${signResult.message} | ${flowerResult.message}`;
    stats.logs.push(currentLog);
    saveDailyStats(stats);

    if (signResult.status === 'token_error' || flowerResult.status === 'token_error') {
        $.notify("🛑 声荐认证失败", "Token 已过期", "请重新打开小程序获取");
        return $.done();
    }

    // --- 修复后的通知判定 ---
    // 强制转为字符串比较，防止 Loon 传入数字类型的 1
    if (String(ARGS.notify) === "1") {
        console.log("通知模式: 每次运行均通知");
        $.notify("声荐签到任务", "", `${signResult.message}\n${flowerResult.message}`);
    } else if (isLastRun) {
        console.log("通知模式: 22点汇总通知");
        $.notify("📊 声荐每日汇总", `今日执行 ${stats.logs.length} 次`, stats.logs.join("\n"));
    } else {
        console.log(`静默运行中 (${hour}点)，notify参数值为: ${ARGS.notify}`);
    }

    console.log("--- 任务结束 ---");
    $.done();
})().catch((e) => {
    console.log("脚本执行异常: " + e);
    $.done();
});

// --- 环境兼容 ---
function Env(name) {
    this.name = name;
    this.read = (k) => $persistentStore.read(k);
    this.write = (v, k) => $persistentStore.write(v, k);
    this.notify = (t, s, b) => $notification.post(t, s, b);
    this.put = (r, c) => $httpClient.put(r, c);
    this.post = (r, c) => $httpClient.post(r, c);
    this.done = (v = {}) => $done(v);
}
