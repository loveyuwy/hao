/*
 * 生日提醒脚本 (v5.1 全能版)
 * * 功能：
 * 1. 支持公历 (0) 和 农历 (1)
 * 2. 支持自定义倒计时天数 (默认提前3天)
 * 3. 当天生日会有特殊提醒
 * 4. 兼容 Surge, Loon, Quantumult X
 *
 * ========== 配置说明 ==========
 * 格式：名字@类型@日期
 * 类型：0=公历, 1=农历
 * 日期格式：MM-DD (例如 10-13)
 * * 填写示例 (多个人用分号 ; 隔开)：
 * 老婆@1@10-13;老妈@0@05-20;死党@1@08-15
 *
 * ========== 参数填写位置 ==========
 * Surge: 脚本 -> Argument: info=名字@类型@日期&advance=3
 * Loon: 脚本 -> argument: info=名字@类型@日期&advance=3
 * QX: 无法直接传参，建议在代码顶部 const forcedConfig 中直接填入，或使用 $prefs 配合 BoxJs。
 */

// 如果你是 QX 用户且不想用 BoxJs，请直接在这里填入字符串，例如 "老婆@1@10-13"
const forcedConfig = ""; 
// 默认提前几天提醒
const defaultAdvance = 3; 

// ==================== 1. 农历算法核心 ====================
const lunarInfo = [
    0x04bd8, 0x04ae0, 0x0a570, 0x054d5, 0x0d260, 0x0d950, 0x16554, 0x056a0, 0x09ad0, 0x055d2,
    0x04ae0, 0x0a5b6, 0x0a4d0, 0x0d250, 0x1d255, 0x0b540, 0x0d6a0, 0x0ada2, 0x095b0, 0x14977,
    0x04970, 0x0a4b0, 0x0b4b5, 0x06a50, 0x06d40, 0x1ab54, 0x02b60, 0x09570, 0x052f2, 0x04970,
    0x06566, 0x0d4a0, 0x0ea50, 0x06e95, 0x05ad0, 0x02b60, 0x186e3, 0x092e0, 0x1c8d7, 0x0c950,
    0x0d4a0, 0x1d8a6, 0x0b550, 0x056a0, 0x1a5b4, 0x025d0, 0x092d0, 0x0d2b2, 0x0a950, 0x0b557,
    0x06ca0, 0x0b550, 0x15355, 0x04da0, 0x0a5d0, 0x14573, 0x052d0, 0x0a9a8, 0x0e950, 0x06aa0,
    0x0aea6, 0x0ab50, 0x04b60, 0x0aae4, 0x0a570, 0x05260, 0x0f263, 0x0d950, 0x05b57, 0x056a0,
    0x096d0, 0x04dd5, 0x04ad0, 0x0a4d0, 0x0d4d4, 0x0d250, 0x0d558, 0x0b540, 0x0b5a0, 0x195a6,
    0x095b0, 0x049b0, 0x0a974, 0x0a4b0, 0x0b27a, 0x06a50, 0x06d40, 0x0af46, 0x0ab60, 0x09570,
    0x04af5, 0x04970, 0x064b0, 0x074a3, 0x0ea50, 0x06b58, 0x055c0, 0x0ab60, 0x096d5, 0x092e0,
    0x0c960, 0x0d954, 0x0d4a0, 0x0da50, 0x07552, 0x056a0, 0x0abb7, 0x025d0, 0x092d0, 0x0cab5,
    0x0a950, 0x0b4a0, 0x0baa4, 0x0ad50, 0x055d9, 0x04ba0, 0x0a5b0, 0x15176, 0x052b0, 0x0a930,
    0x07954, 0x06aa0, 0x0ad50, 0x05b52, 0x04b60, 0x0a6e6, 0x0a4e0, 0x0d260, 0x0ea65, 0x0d530,
    0x05aa0, 0x076a3, 0x096d0, 0x04bd7, 0x04ad0, 0x0a4d0, 0x1d0b6, 0x0d250, 0x0d520, 0x0dd45,
    0x0b5a0, 0x056d0, 0x055b2, 0x049b0, 0x0a577, 0x0a4b0, 0x0aa50, 0x1b255, 0x06d20, 0x0ada0
];

function getLeapMonth(year) { return lunarInfo[year - 1900] & 0xf; }
function getMonthDays(year, month) { return (month > 12 || month < 1) ? 0 : (lunarInfo[year - 1900] & (0x10000 >> month)) ? 30 : 29; }
function getLunarYearDays(year) {
    let sum = 348;
    for (let i = 0x8000; i > 0x8; i >>= 1) sum += (lunarInfo[year - 1900] & i) ? 1 : 0;
    return sum + getLeapDays(year);
}
function getLeapDays(year) { return getLeapMonth(year) ? ((lunarInfo[year - 1900] & 0x10000) ? 30 : 29) : 0; }
function solarToLunar(date) {
    const year = date.getFullYear();
    if (year < 1900 || year > 2099) return null;
    const baseDate = new Date(1900, 0, 31);
    let offset = Math.floor((date.getTime() - baseDate.getTime()) / 86400000);
    let lunarYear = 1900;
    let daysInLunarYear = getLunarYearDays(lunarYear);
    while(lunarYear < 2100 && offset >= daysInLunarYear) {
        offset -= daysInLunarYear;
        lunarYear++;
        daysInLunarYear = getLunarYearDays(lunarYear);
    }
    let lunarMonth = 1;
    let isLeap = false;
    const leapMonth = getLeapMonth(lunarYear);
    for (let m = 1; m <= 12; m++) {
        if (leapMonth > 0 && m == (leapMonth + 1) && !isLeap) {
            --m; isLeap = true;
            let leapDays = getLeapDays(lunarYear);
            if (offset < leapDays) { lunarMonth = m; break; }
            offset -= leapDays;
        } else {
            let monthDays = getMonthDays(lunarYear, m);
            if (offset < monthDays) { lunarMonth = m; break; }
            offset -= monthDays;
        }
    }
    return { year: lunarYear, month: lunarMonth, day: offset + 1 };
}

// ==================== 2. 主程序 ====================

const $ = new Env("生日提醒");

!(async () => {
    // --- 1. 参数解析 ---
    // 优先读取 Argument，其次 forcedConfig
    let rawArgs = "";
    if (typeof $argument !== "undefined") rawArgs = $argument;
    else if (typeof $ops !== "undefined") rawArgs = $ops; // Loon 某些版本
    else rawArgs = forcedConfig;

    let configStr = "";
    let advanceDays = defaultAdvance;

    const getArg = (key, text) => {
        const regex = new RegExp(`${key}=([^&]+)`);
        const match = text.match(regex);
        return match ? decodeURIComponent(match[1]) : null;
    };

    if (rawArgs.includes("info=")) {
        configStr = getArg("info", rawArgs);
        const advArg = getArg("advance", rawArgs);
        if (advArg) advanceDays = parseInt(advArg);
    } else {
        // 兼容只填数据不填 key 的情况
        configStr = rawArgs;
    }

    try { configStr = decodeURIComponent(configStr); } catch(e) {}

    console.log(`🔔 参数配置: [提前 ${advanceDays} 天] | 数据: ${configStr}`);

    if (!configStr) {
        console.log("⚠️ 未检测到生日数据，请检查模块参数！");
        // QX 用户如果没有配置，给个提示
        if ($.isQuanX()) $.msg("生日提醒", "配置缺失", "请在脚本内 forcedConfig 填写数据或使用 BoxJs");
        return;
    }
    
    const items = configStr.split(/;|\\n/); 
    const notifications = [];
    const today = new Date();
    today.setHours(0,0,0,0); // 归零时间，确保计算准确

    // --- 2. 循环检查 (从 0=今天 开始) ---
    console.log(`📅 开始检查 今天 及未来 ${advanceDays} 天的生日...`);

    for (let i = 0; i <= advanceDays; i++) {
        const checkDate = new Date(today);
        checkDate.setDate(today.getDate() + i);
        const checkDateStr = formatDate(checkDate);

        // 计算这天的农历缓存
        let lunarCache = null;
        try { lunarCache = solarToLunar(checkDate); } catch(e) {}

        for (let item of items) {
            if (!item) continue;
            let parts = item.split(/,|@|，/);
            if (parts.length < 3) continue;

            let name = parts[0].trim();
            let type = parts[1].trim(); // 0=公历, 1=农历
            let targetDate = parts[2].trim();
            // 修正符号
            targetDate = targetDate.replace(/[\uff0d\u2212\u2014\u2013\.\/]/g, '-');
            
            let isMatch = false;
            let matchTypeStr = "";

            if (type === "0") {
                // 公历比对
                if (targetDate === checkDateStr) {
                    isMatch = true;
                    matchTypeStr = "公历";
                }
            } else if (type === "1" && lunarCache) {
                // 农历比对
                const lunStr = `${lunarCache.month.toString().padStart(2,'0')}-${lunarCache.day.toString().padStart(2,'0')}`;
                if (lunStr === targetDate) {
                    isMatch = true;
                    matchTypeStr = `农历(${lunStr})`;
                }
            }

            if (isMatch) {
                console.log(`🎉 匹配: ${name} (i=${i})`);
                if (i === 0) {
                     notifications.push(`🎂 今天是 ${name} 的生日！\n📅 日期: ${checkDateStr} ${matchTypeStr}`);
                } else {
                     notifications.push(`⏳ ${name} 还有 ${i} 天过生日\n📅 日期: ${checkDateStr} ${matchTypeStr}`);
                }
            }
        }
    }

    // --- 3. 推送结果 ---
    if (notifications.length > 0) {
        // 去重
        let uniqueNotes = [...new Set(notifications)];
        // 标题动态变化
        let title = "生日提醒 🎂";
        let sub = "近期寿星名单";
        // 如果有今天生日的，标题加强
        if (uniqueNotes.some(n => n.includes("今天是"))) {
            title = "🎂 生日快乐！";
            sub = "今天有人过生日啦";
        }
        
        $.msg(title, sub, uniqueNotes.join("\n\n"));
    } else {
        console.log("✅ 近期无人生日。");
    }

})().catch((e) => {
    $.log('', `❌ 错误: ${e.message}`);
}).finally(() => {
    $.done();
});

function formatDate(date) {
    const m = (date.getMonth() + 1).toString().padStart(2, '0');
    const d = date.getDate().toString().padStart(2, '0');
    return `${m}-${d}`;
}

// 兼容 Surge/Loon/QX 的 Polyfill
function Env(name) {
    return new class {
        constructor(name) { this.name = name; }
        isQuanX() { return typeof $task !== "undefined"; }
        isSurge() { return typeof $httpClient !== "undefined" && typeof $loon === "undefined"; }
        isLoon() { return typeof $loon !== "undefined"; }
        getdata(key) {
            if (this.isSurge() || this.isLoon()) return $argument;
            if (this.isQuanX()) return $prefs.valueForKey(key);
            return null;
        }
        msg(title, subtitle, body) {
            if (this.isSurge() || this.isLoon()) $notification.post(title, subtitle, body);
            if (this.isQuanX()) $notify(title, subtitle, body);
            console.log(`\n${title}\n${subtitle}\n${body}`);
        }
        log(val) { console.log(val); }
        done(val = {}) { $done(val); }
    }(name);
}
