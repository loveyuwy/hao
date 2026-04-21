const userAgent = "Mozilla/5.0 (iPhone; CPU iPhone OS 16_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.2 Mobile/15E148 Safari/604.1";
const loginUrl = "https://69yun69.com/auth/login";
const checkinUrl = "https://69yun69.com/user/checkin";

let rawArg = typeof $argument !== "undefined" ? $argument : "";
let isSilent = false;
const accounts = [];

// ------------------ 参数解析 ------------------
function parseArgument(arg) {
    if (Array.isArray(arg)) {
        parseArrayFormat(arg);
        return;
    }
    if (typeof arg === "object" && arg !== null) {
        parseObjectFormat(arg);
        return;
    }
    if (typeof arg === "string") {
        let trimmed = arg.trim();
        if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
            try {
                const arr = JSON.parse(trimmed);
                if (Array.isArray(arr)) {
                    parseArrayFormat(arr);
                    return;
                }
            } catch (e) {}
        }
        if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
            try {
                const obj = JSON.parse(trimmed);
                if (typeof obj === "object" && obj !== null) {
                    parseObjectFormat(obj);
                    return;
                }
            } catch (e) {}
        }
        parseStringFormat(trimmed);
    }
}

function parseArrayFormat(arr) {
    for (let i = 0; i < arr.length; i++) {
        const val = arr[i];
        if (typeof val !== "string") continue;
        const trimmed = val.trim();
        if (trimmed === "" || trimmed === "#") {
            if (trimmed === "#") isSilent = true;
            continue;
        }
        const sep = trimmed.includes(":") ? ":" : (trimmed.includes(",") ? "," : null);
        if (sep) {
            const [email, password] = trimmed.split(sep).map(s => s.trim());
            if (email && password) accounts.push({ email, password });
        }
    }
}

function parseObjectFormat(obj) {
    for (const [key, val] of Object.entries(obj)) {
        if (typeof val !== "string") continue;
        const trimmed = val.trim();
        if (trimmed === "" || trimmed === "#") {
            if (trimmed === "#") isSilent = true;
            continue;
        }
        if (trimmed.includes("@") && (trimmed.includes(":") || trimmed.includes(","))) {
            const sep = trimmed.includes(":") ? ":" : ",";
            const [email, password] = trimmed.split(sep).map(s => s.trim());
            if (email && password) accounts.push({ email, password });
        }
    }
}

function parseStringFormat(str) {
    const silentMatch = str.match(/&silent=([^&\s]*)/);
    if (silentMatch && silentMatch[1].trim() === "#") {
        isSilent = true;
        str = str.replace(/&silent=[^&\s]*/, "").trim();
    }
    const parts = str.split("#").map(p => p.trim()).filter(p => p !== "");
    for (const part of parts) {
        if (part.toLowerCase() === "silent") {
            isSilent = true;
            continue;
        }
        if (part.includes("@") && (part.includes(":") || part.includes(","))) {
            const sep = part.includes(":") ? ":" : ",";
            const [email, password] = part.split(sep).map(s => s.trim());
            if (email && password) accounts.push({ email, password });
        }
    }
}

parseArgument(rawArg);

// -----------------------------------------------------------------

if (accounts.length === 0) {
    console.log("⚠️ 未检测到有效账号，脚本结束");
    $done();
}

function maskEmail(email) {
    const [name, domain] = email.split("@");
    return (name.length > 2 ? name[0] + "***" + name.slice(-1) : name[0] + "***") + "@" + domain;
}

async function performLogin(email, password) {
    const body = `email=${encodeURIComponent(email)}&passwd=${encodeURIComponent(password)}&code=`;
    let lastError;
    for (let i = 0; i <= 1; i++) {
        try {
            return await new Promise((resolve, reject) => {
                $httpClient.post({
                    url: loginUrl,
                    headers: {  // 💡 修复：将 header 改为了 headers 以兼容 Loon
                        "User-Agent": userAgent,
                        "Origin": "https://69yun69.com",
                        "Referer": loginUrl,
                        "X-Requested-With": "XMLHttpRequest",
                        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
                        "Accept": "application/json, text/javascript, */*; q=0.01"
                    },
                    body: body,
                    timeout: 12
                }, (error, response, data) => {
                    // 💡 修复：将 error 统一转为 Error 对象，防止 err.message 为 undefined
                    if (error) return reject(error instanceof Error ? error : new Error(error));
                    if (response.status !== 200) return reject(new Error(`状态码: ${response.status}`));
                    try {
                        const json = JSON.parse(data);
                        if (json.ret !== 1) return reject(new Error(json.msg || '登录失败'));
                        
                        // 💡 修复：兼容 Loon 可能将 header key 全小写的情况
                        const cookie = response.headers['Set-Cookie'] || response.headers['set-cookie'] || '';
                        resolve({ cookie: cookie, data: json });
                    } catch (e) {
                        reject(new Error(`解析失败: ${e.message}`));
                    }
                });
            });
        } catch (err) {
            lastError = err;
            if (i === 0) {
                console.log(`   ⏳ 登录失败 (${err.message || err})，1秒后重试...`);
                await new Promise(r => setTimeout(r, 1000));
            }
        }
    }
    throw lastError;
}

async function performCheckin(cookie) {
    let lastError;
    for (let i = 0; i <= 1; i++) {
        try {
            return await new Promise((resolve, reject) => {
                $httpClient.post({
                    url: checkinUrl,
                    headers: {  // 💡 修复：将 header 改为了 headers
                        "User-Agent": userAgent,
                        "Origin": "https://69yun69.com",
                        "Referer": "https://69yun69.com/user",
                        "X-Requested-With": "XMLHttpRequest",
                        "Cookie": cookie,
                        "Content-Length": "0"
                    },
                    timeout: 12
                }, (error, response, data) => {
                    if (error) return reject(error instanceof Error ? error : new Error(error));
                    if (response.status !== 200) return reject(new Error(`状态码: ${response.status}`));
                    try {
                        resolve(JSON.parse(data));
                    } catch (e) {
                        reject(new Error(`解析失败: ${e.message}`));
                    }
                });
            });
        } catch (err) {
            lastError = err;
            if (i === 0) {
                console.log(`   ⏳ 签到失败 (${err.message || err})，1秒后重试...`);
                await new Promise(r => setTimeout(r, 1000));
            }
        }
    }
    throw lastError;
}

function handleResult(result, email) {
    const masked = maskEmail(email);
    const timeStr = new Date().toLocaleTimeString();
    const dateStr = new Date().toLocaleDateString('zh-CN', { year:'numeric', month:'long', day:'numeric', weekday:'short' });
    
    if (result.ret === 0 && result.msg.includes("已经签到过了")) {
        const info = result.msg.replace(/\n/g, ' ');
        if (!isSilent) $notification.post("🔁 69云今日已签到", `${masked} | ${timeStr}`, `✨ 今日已签到，明天再来\n📅 ${dateStr}\n${info}`);
        console.log(`ℹ️ [${masked}] 今日已签到: ${info}`);
        return;
    }
    if (result.ret === 1) {
        const traffic = result.traffic || "0B";
        if (!isSilent) $notification.post("🎉 69云签到成功", `${masked} | ${timeStr}`, `✨ ${result.msg}\n🚀 总流量: ${traffic}\n📅 ${dateStr}`);
        console.log(`✅ [${masked}] 签到成功 | 流量: ${traffic}`);
        return;
    }
    throw new Error(result.msg || '未知签到错误');
}

async function main() {
    console.log(`🚀 开始执行 69云多账号签到 | 共 ${accounts.length} 个账号 | 静默: ${isSilent}`);
    for (let i = 0; i < accounts.length; i++) {
        const acc = accounts[i];
        const masked = maskEmail(acc.email);
        console.log(`\n🔹 [${i+1}/${accounts.length}] 处理账号: ${masked}`);
        try {
            const loginRes = await performLogin(acc.email, acc.password);
            console.log(`   ✅ 登录成功`);
            const checkinRes = await performCheckin(loginRes.cookie);
            handleResult(checkinRes, acc.email);
        } catch (err) {
            // 💡 修复：增加备用兜底，万一错误对象依然不是 Error 类型也能正常打印
            const errMsg = err.message || err || "未知网络错误";
            console.log(`   ❌ 失败: ${errMsg}`);
            if (!isSilent) $notification.post("❌ 69云签到失败", masked, `错误: ${errMsg}`);
        }
        await new Promise(r => setTimeout(r, 800));
    }
    console.log("\n✅ 所有账号处理完毕");
    $done();
}

main().catch(e => { console.log(`脚本异常: ${e.stack || e}`); $done(); });
