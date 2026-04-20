const userAgent = "Mozilla/5.0 (iPhone; CPU iPhone OS 16_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.2 Mobile/15E148 Safari/604.1";
const loginUrl = "https://69yun69.com/auth/login";
const checkinUrl = "https://69yun69.com/user/checkin";

let rawArg = typeof $argument !== "undefined" ? $argument : "";
let isSilent = false;
const accounts = [];

function parseLoonArray(argArray) {
    if (!Array.isArray(argArray)) return false;
    for (let i = 0; i < 5; i++) {
        const val = argArray[i];
        if (typeof val === 'string' && val.trim() !== '') {
            let sep = val.includes(':') ? ':' : (val.includes(',') ? ',' : null);
            if (sep) {
                const [email, password] = val.split(sep).map(s => s.trim());
                if (email && password) accounts.push({ email, password });
            }
        }
    }
    if (argArray.length >= 6) {
        const silentVal = argArray[5];
        if (typeof silentVal === 'string' && silentVal.trim() === '#') {
            isSilent = true;
        }
    }
    return true;
}

function parseSurgeString(argStr) {
    let str = argStr;
    const silentMatch = str.match(/&silent=([^&\s]*)/);
    if (silentMatch) {
        if (silentMatch[1].trim() === "#") isSilent = true;
        str = str.replace(/&silent=[^&\s]*/, "").trim();
    }
    if (!str) return false;
    let parts = str.split('#').map(p => p.trim()).filter(p => p !== "");
    const silentIndex = parts.findIndex(p => p.toLowerCase() === "silent");
    if (silentIndex !== -1) {
        isSilent = true;
        parts.splice(silentIndex, 1);
    }
    for (const part of parts) {
        let sep = part.includes(':') ? ':' : (part.includes(',') ? ',' : null);
        if (!sep) continue;
        const [email, password] = part.split(sep).map(s => s.trim());
        if (email && password) accounts.push({ email, password });
    }
    return true;
}

if (rawArg) {
    let parsed = false;
    if (Array.isArray(rawArg)) {
        parsed = parseLoonArray(rawArg);
    } else if (typeof rawArg === 'string' && rawArg.trim().startsWith('[')) {
        try {
            const arr = JSON.parse(rawArg);
            parsed = parseLoonArray(arr);
        } catch (e) {}
    }
    if (!parsed && typeof rawArg === 'string') {
        parseSurgeString(rawArg);
    }
}

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
                    header: {
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
                    if (error) return reject(error);
                    if (response.status !== 200) return reject(new Error(`状态码: ${response.status}`));
                    try {
                        const json = JSON.parse(data);
                        if (json.ret !== 1) return reject(new Error(json.msg || '登录失败'));
                        resolve({ cookie: response.headers['Set-Cookie'] || '', data: json });
                    } catch (e) {
                        reject(new Error(`解析失败: ${e.message}`));
                    }
                });
            });
        } catch (err) {
            lastError = err;
            if (i === 0) {
                console.log(`   ⏳ 登录失败，1秒后重试...`);
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
                    header: {
                        "User-Agent": userAgent,
                        "Origin": "https://69yun69.com",
                        "Referer": "https://69yun69.com/user",
                        "X-Requested-With": "XMLHttpRequest",
                        "Cookie": cookie,
                        "Content-Length": "0"
                    },
                    timeout: 12
                }, (error, response, data) => {
                    if (error) return reject(error);
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
                console.log(`   ⏳ 签到失败，1秒后重试...`);
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
            console.log(`   ❌ 失败: ${err.message}`);
            if (!isSilent) $notification.post("❌ 69云签到失败", masked, `错误: ${err.message}`);
        }
        await new Promise(r => setTimeout(r, 800));
    }
    console.log("\n✅ 所有账号处理完毕");
    $done();
}

main().catch(e => { console.log(`脚本异常: ${e.stack || e}`); $done(); });