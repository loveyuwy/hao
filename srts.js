/*
 * 生日提醒脚本 (v5.0 倒计时版)
 * * 新增功能：支持自定义提前几天通知 (默认1天)
 * * 逻辑：在设置的天数范围内，每天都会弹窗提示倒计时
 * * * * 参数填写说明:
 * 格式：名字@类型@日期
 * 示例：老婆@1@10-13
 */

// ==================== 1. 农历算法核心 (优先加载) ====================
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
    let rawArgs = $.getdata("argument") || $.getdata("args") || "";
    let configStr = "";
    let advanceDays = 1; // 默认提前1天

    // 智能解析参数 (支持 info=xx&advance=3 或 纯文本)
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
        configStr = rawArgs;
    }

    try { configStr = decodeURIComponent(configStr); } catch(e) {}

    console.log(`🔔 参数配置: [提前 ${advanceDays} 天] | 数据: ${configStr}`);

    if (!configStr) {
        console.log("⚠️ 未检测到生日数据，请检查模块参数！");
        return;
    }
    
    const items = configStr.split(/;|\\n/); 
    const notifications = [];
    const today = new Date();

    // --- 2. 循环未来 N 天进行检查 ---
    console.log(`📅 开始检查未来 ${advanceDays} 天的生日...`);

    // i 表示距离今天的天数 (1=明天, 2=后天...)
    for (let i = 1; i <= advanceDays; i++) {
        const futureDate = new Date(today);
        futureDate.setDate(today.getDate() + i);
        const futureDateStr = formatDate(futureDate);

        // 计算这天的农历缓存
        let lunarCache = null;
        try { lunarCache = solarToLunar(futureDate); } catch(e) {}

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
                if (targetDate === futureDateStr) {
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
                console.log(`🎉 匹配: ${name} 在 ${i} 天后过生日`);
                notifications.push(`🎂 ${name} 还有 ${i} 天过生日！\n📅 日期: ${futureDateStr} ${matchTypeStr}`);
            }
        }
    }

    // --- 3. 推送结果 ---
    if (notifications.length > 0) {
        // 去重 (防止同一个人同一天配置多次)
        let uniqueNotes = [...new Set(notifications)];
        $.msg("生日提醒 🎂", "近期有朋友要过生日啦", uniqueNotes.join("\n\n"));
    } else {
        console.log("✅ 未来几天内没有人生日。");
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

function Env(t,e){"undefined"!=typeof process&&JSON.stringify(process.env).indexOf("GITHUB")>-1&&process.exit(0);class s{constructor(t){this.env=t}msg(t,e,s){"undefined"!=typeof $notify?$notify(t,e,s):"undefined"!=typeof $notification&&$notification.post(t,e,s)}getdata(t){if("undefined"!=typeof $argument)return $argument;if("undefined"!=typeof $surname){if(arguments.length>1)return $surname.read(t);{const e=$surname.read(t);return e?JSON.parse(e):null}}return"undefined"!=typeof $looon?this.looon(t):null}get(t,e){"undefined"!=typeof $task?$task.fetch(t).then(t=>{e(null,t,t.body)},t=>{e(t.error,null,null)}):"undefined"!=typeof $httpClient&&$httpClient.get(t,e)}log(t){console.log(t)}done(t={}){const e=(new Date).getTime(),s=(e-this.startTime)/1e3;this.log("",`🔔${this.name}, 结束! 🕛 ${s} 秒`),"undefined"!=typeof $done&&$done(t)}}return new s(t,e)}
