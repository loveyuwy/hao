/**
 * 生日提醒助手 - 通用适配版 (v3)
 * 适配 Surge: argument=info={{{数据}}};... &advance={{{天数}}}
 * 适配 Loon: argument=[{数据1},{数据2},...] advance={天数}
 */

const forcedConfig = ''; 
const defaultAdvance = 3; 

// 农历数据表
const lunarInfo = [
    0x4bd8,0x4ae0,0xa570,0x54d5,0xd260,0xd950,0x16554,0x56a0,0x9ad0,0x55d2,0x4ae0,0xa5b6,0xa4d0,0xd250,0x1d255,0xb540,
    0xd6a0,0xada2,0x95b0,0x14977,0x4970,0xa4b0,0xb4b5,0x6a50,0x6d40,0x1ab54,0x2b60,0x9570,0x52f2,0x4970,0x6566,0xd4a0,
    0xea50,0x6e95,0x5ad0,0x2b60,0x186e3,0x92e0,0x1c8d7,0xc950,0xd4a0,0x1d8a6,0xb550,0x56a0,0x1a5b4,0x25d0,0x92d0,0xd2b2,
    0xa950,0xb557,0x6ca0,0xb550,0x15355,0x4da0,0xa5d0,0x14573,0x52d0,0xa9a8,0xe950,0x6aa0,0xaea6,0xab50,0x4b60,0xaae4,
    0xa570,0x5260,0xf263,0xd950,0x5b57,0x56a0,0x96d0,0x4dd5,0x4ad0,0xa4d0,0xd4d4,0xd250,0xd558,0xb540,0xb5a0,0x195a6,
    0x95b0,0x49b0,0xa974,0xa4b0,0xb27a,0x6a50,0x6d40,0xaf46,0xab60,0x9570,0x4af5,0x4970,0x64b0,0x74a3,0xea50,0x6b58,
    0x55c0,0xab60,0x96d5,0x92e0,0xc960,0xd954,0xd4a0,0xda50,0x7552,0x56a0,0xabb7,0x25d0,0x92d0,0xcab5,0xa950,0xb4a0,
    0xbaa4,0xad50,0x55d9,0x4ba0,0xa5b0,0x15176,0x52b0,0xa930,0x7954,0x6aa0,0xad50,0x5b52,0x4b60,0xa6e6,0xa4e0,0xd260,
    0xea65,0xd530,0x5aa0,0x76a3,0x96d0,0x4bd7,0x4ad0,0xa4d0,0x1d0b6,0xd250,0xd520,0xdd45,0xb5a0,0x56d0,0x55b2,0x49b0,
    0xa577,0xa4b0,0xaa50,0x1b255,0x6d20,0xada0
];

function getLeapMonth(y) { return lunarInfo[y - 1900] & 0xf; }
function getMonthDays(y, m) { return m > 12 || m < 1 ? 0 : lunarInfo[y - 1900] & (0x10000 >> m) ? 30 : 29; }
function getLunarYearDays(y) {
    let days = 348;
    for (let i = 0x8000; i > 0x8; i >>= 1) days += lunarInfo[y - 1900] & i ? 1 : 0;
    return days + getLeapDays(y);
}
function getLeapDays(y) { return getLeapMonth(y) ? (lunarInfo[y - 1900] & 0x10000 ? 30 : 29) : 0; }

function solarToLunar(date) {
    const year = date.getFullYear();
    if (year < 1900 || year > 2100) return null;
    const baseDate = new Date(1900, 0, 31);
    let offset = Math.floor((date.getTime() - baseDate.getTime()) / 86400000);
    let lYear = 1900;
    let daysOfYear = getLunarYearDays(lYear);
    while (lYear < 2101 && offset >= daysOfYear) {
        offset -= daysOfYear; lYear++; daysOfYear = getLunarYearDays(lYear);
    }
    let lMonth = 1, isLeap = false, leapMonth = getLeapMonth(lYear);
    for (let i = 1; i <= 12; i++) {
        if (leapMonth > 0 && i == leapMonth + 1 && !isLeap) {
            --i; isLeap = true; let leapDays = getLeapDays(lYear);
            if (offset < leapDays) { lMonth = i; break; }
            offset -= leapDays;
        } else {
            let monthDays = getMonthDays(lYear, i);
            if (offset < monthDays) { lMonth = i; break; }
            offset -= monthDays;
        }
    }
    return { month: lMonth, day: offset + 1 };
}

const $ = new Env("生日提醒");

!(async () => {
    let rawArgs = (typeof $argument !== 'undefined') ? $argument : forcedConfig;
    if (!rawArgs) return;

    // 1. 提取提前天数
    let advanceDays = defaultAdvance;
    let advMatch = rawArgs.match(/advance[=:](\d+)/i);
    if (advMatch) advanceDays = parseInt(advMatch[1]);

    // 2. 核心：全局清洗生日数据
    // 先移除 advance 部分和 info= 前缀，再去掉 Loon 的方括号，最后去掉所有可能的双引号/单引号
    let cleanData = rawArgs.replace(/advance[=:]\d+/i, "")
                           .replace(/info=/i, "")
                           .replace(/[\[\]]/g, "")
                           .replace(/["']/g, "") // 这一步关键：统一去掉所有引号
                           .trim();
    
    // 按分号或逗号切分，并过滤掉空数据和不带@的无效行
    let birthLines = cleanData.split(/[;,]/)
                               .map(s => s.trim())
                               .filter(s => s.includes('@'));

    console.log(`🔔 解析配置: [提前 ${advanceDays} 天提醒] | 有效条数: ${birthLines.length}`);

    if (birthLines.length === 0) {
        console.log("⚠️ 无法识别生日数据。接收到的清洗后内容为: " + cleanData);
        return;
    }

    const notifyArr = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (let i = 0; i <= advanceDays; i++) {
        const checkDate = new Date(today);
        checkDate.setDate(today.getDate() + i);
        const m = (checkDate.getMonth() + 1).toString().padStart(2, '0');
        const d = checkDate.getDate().toString().padStart(2, '0');
        const checkDateStr = `${m}-${d}`;
        
        let lunar = solarToLunar(checkDate);
        let lunarStr = lunar ? `${lunar.month.toString().padStart(2, '0')}-${lunar.day.toString().padStart(2, '0')}` : null;

        for (let line of birthLines) {
            let parts = line.split('@');
            if (parts.length < 3) continue;
            
            let name = parts[0];
            let type = parts[1];
            // 再次兼容各种特殊横线
            let date = parts[2].replace(/[\uff0d\u2212\u2014\u2013\.\/]/g, '-').trim();
            
            let isMatch = false;
            let typeDesc = "";

            if (type === '0' && date === checkDateStr) {
                isMatch = true;
                typeDesc = "公历";
            } else if (type === '1' && date === lunarStr) {
                isMatch = true;
                typeDesc = `农历(${lunarStr})`;
            }

            if (isMatch) {
                if (i === 0) {
                    notifyArr.push(`🎂 今天是 【${name}】 的生日！\n📅 日期: ${checkDateStr} (${typeDesc})`);
                } else {
                    notifyArr.push(`⏳ 【${name}】 还有 ${i} 天过生日\n📅 日期: ${checkDateStr} (${typeDesc})`);
                }
            }
        }
    }

    if (notifyArr.length > 0) {
        let uniqueNotify = [...new Set(notifyArr)];
        let isToday = uniqueNotify.some(n => n.includes('今天'));
        $.msg(isToday ? "🎂 生日提醒" : "⏳ 生日预告", "", uniqueNotify.join('\n\n'));
    } else {
        console.log("✅ 近期无生日计划");
    }
})().catch(e => {
    $.log(`❌ 错误: ${e}`);
}).finally(() => {
    $.done();
});

function Env(name) {
    return new class {
        constructor(name) { this.name = name; }
        msg(t, s, b) {
            if (typeof $notification !== "undefined") $notification.post(t, s, b);
            else if (typeof $notify !== "undefined") $notify(t, s, b);
            console.log(`\n--- ${t} ---\n${s}\n${b}`);
        }
        log(m) { console.log(m); }
        done() { if (typeof $done !== "undefined") $done({}); }
    }(name);
}
