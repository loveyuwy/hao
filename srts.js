/**
 * 生日提醒助手 - Loon & Surge 融合版
 * 支持：公历/农历、提前提醒、自动修正日期符号
 */

const lunarInfo = [
    0x4bd8,0x4ae0,0xa570,0x54d5,0xd260,0xd950,0x16554,0x56a0,0x9ad0,0x55d2,0x4ae0,0xa5b6,0xa4d0,0xd250,0x1d255,0xb540,0xd6a0,0xada2,0x95b0,0x14977,0x4970,0xa4b0,0xb4b5,0x6a50,0x6d40,0x1ab54,0x2b60,0x9570,0x52f2,0x4970,0x6566,0xd4a0,0xea50,0x6e95,0x5ad0,0x2b60,0x186e3,0x92e0,0x1c8d7,0xc950,0xd4a0,0x1d8a6,0xb550,0x56a0,0x1a5b4,0x25d0,0x92d0,0xd2b2,0xa950,0xb557,0x6ca0,0xb550,0x15355,0x4da0,0xa5d0,0x14573,0x52d0,0xa9a8,0xe950,0x6aa0,0xaea6,0xab50,0x4b60,0xaae4,0xa570,0x5260,0xf263,0xd950,0x5b57,0x56a0,0x96d0,0x4dd5,0x4ad0,0xa4d0,0xd4d4,0xd250,0xd558,0xb540,0xb5a0,0x195a6,0x95b0,0x49b0,0xa974,0xa4b0,0xb27a,0x6a50,0x6d40,0xaf46,0xab60,0x9570,0x4af5,0x4970,0x64b0,0x74a3,0xea50,0x6b58,0x55c0,0xab60,0x96d5,0x92e0,0xc960,0xd954,0xd4a0,0xda50,0x7552,0x56a0,0xabb7,0x25d0,0x92d0,0xcab5,0xa950,0xb4a0,0xbaa4,0xad50,0x55d9,0x4ba0,0xa5b0,0x15176,0x52b0,0xa930,0x7954,0x6aa0,0xad50,0x5b52,0x4b60,0xa6e6,0xa4e0,0xd260,0xea65,0xd530,0x5aa0,0x76a3,0x96d0,0x4bd7,0x4ad0,0xa4d0,0x1d0b6,0xd250,0xd520,0xdd45,0xb5a0,0x56d0,0x55b2,0x49b0,0xa577,0xa4b0,0xaa50,0x1b255,0x6d20,0xada0
];

// --- 核心工具函数 ---
function getLeapMonth(y) { return lunarInfo[y - 1900] & 0xf; }
function getMonthDays(y, m) { return (m > 12 || m < 1) ? 0 : (lunarInfo[y - 1900] & (0x10000 >> m)) ? 30 : 29; }
function getLeapDays(y) { return getLeapMonth(y) ? ((lunarInfo[y - 1900] & 0x10000) ? 30 : 29) : 0; }
function getLunarYearDays(y) {
    let sum = 348;
    for (let i = 0x8000; i > 0x8; i >>= 1) sum += (lunarInfo[y - 1900] & i) ? 1 : 0;
    return sum + getLeapDays(y);
}
function solarToLunar(date) {
    let y = date.getFullYear();
    if (y < 1900 || y > 2100) return null;
    let baseDate = new Date(1900, 0, 31);
    let offset = Math.floor((date.getTime() - baseDate.getTime()) / 86400000);
    let tempYear = 1900;
    let daysOfYear = getLunarYearDays(tempYear);
    while (tempYear < 2101 && offset >= daysOfYear) {
        offset -= daysOfYear; tempYear++;
        daysOfYear = getLunarYearDays(tempYear);
    }
    let tempMonth = 1; let isLeap = false; let leapMonth = getLeapMonth(tempYear);
    for (let i = 1; i <= 12; i++) {
        if (leapMonth > 0 && i === (leapMonth + 1) && !isLeap) {
            --i; isLeap = true; let leapDays = getLeapDays(tempYear);
            if (offset < leapDays) { tempMonth = i; break; }
            offset -= leapDays;
        } else {
            let daysOfMonth = getMonthDays(tempYear, i);
            if (offset < daysOfMonth) { tempMonth = i; break; }
            offset -= daysOfMonth;
        }
    }
    return { month: tempMonth, day: offset + 1 };
}
function formatDate(date) {
    return `${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

const $ = new Env("生日提醒助手");

!(async () => {
    let rawArg = (typeof $argument !== 'undefined') ? $argument : '';
    let advanceDays = 3;
    let birthdayList = [];

    $.log(`--- [调试] 环境识别开始 ---`);
    $.log(`[1] 原始数据内容: ${JSON.stringify(rawArg)}`);

    // --- 多模式参数解析逻辑 ---
    
    // 1. 如果是 Surge 风格字符串 (info=...&advance=...)
    if (typeof rawArg === 'string' && rawArg.includes('info=')) {
        $.log(`[2] 识别为 Surge 格式参数`);
        let infoMatch = rawArg.match(/info=([^&]+)/);
        let advanceMatch = rawArg.match(/advance=([^&]+)/);
        if (infoMatch) {
            let decodedInfo = decodeURIComponent(infoMatch[1]);
            birthdayList = decodedInfo.split(/;|\\n/).filter(x => x.includes('@'));
        }
        if (advanceMatch) advanceDays = parseInt(advanceMatch[1]);
    } 
    // 2. 如果是 Loon 风格对象/字典
    else if (typeof rawArg === 'object' && rawArg !== null && !Array.isArray(rawArg)) {
        $.log(`[2] 识别为 Loon 对象格式`);
        for (let key in rawArg) {
            let val = String(rawArg[key]).trim();
            if (!val || val === '""') continue;
            if (key.includes("天数") && !isNaN(val)) advanceDays = parseInt(val);
            else if (val.includes('@')) birthdayList.push(...val.split(';'));
        }
    }
    // 3. 通用纯字符串或数组模式
    else {
        $.log(`[2] 识别为通用格式`);
        let items = Array.isArray(rawArg) ? rawArg : [rawArg];
        items.forEach(val => {
            let s = String(val).trim();
            if (s.includes('@')) birthdayList.push(...s.split(';'));
            else if (!isNaN(s) && s !== "") advanceDays = parseInt(s);
        });
    }

    $.log(`--- [调试] 解析结果: 提前 ${advanceDays} 天, 数据 ${birthdayList.length} 条 ---`);

    if (birthdayList.length === 0) {
        $.log("⚠️ 未发现有效数据，请检查配置。");
        return $.done();
    }

    let today = new Date();
    today.setHours(0, 0, 0, 0);
    let results = [];

    for (let i = 0; i <= advanceDays; i++) {
        let checkDate = new Date(today);
        checkDate.setDate(today.getDate() + i);
        let solarStr = formatDate(checkDate);
        let lunarObj = solarToLunar(checkDate);
        let lunarStr = lunarObj ? `${String(lunarObj.month).padStart(2, '0')}-${String(lunarObj.day).padStart(2, '0')}` : null;

        for (let item of birthdayList) {
            let parts = item.split(/@|,|，/);
            if (parts.length < 3) continue;

            let name = parts[0].trim();
            let type = parts[1].trim(); // 0公历 1农历
            let rawDate = parts[2].trim().replace(/[−—﹣－.／\\]/g, '-');
            let targetDate = rawDate.split('-').map(v => v.padStart(2, '0')).join('-');

            let isMatch = false;
            let label = "";

            if (type === '0' && targetDate === solarStr) {
                isMatch = true;
                label = "公历";
            } else if (type === '1' && targetDate === lunarStr) {
                isMatch = true;
                label = `农历(${lunarStr})`;
            }

            if (isMatch) {
                let dayLabel = (i === 0) ? `今天` : `还有 ${i} 天`;
                let icon = (i === 0) ? `🎂` : `⏳`;
                results.push(`${icon} ${name} ${dayLabel}生日\n📅 日期: ${solarStr} ${label}`);
                $.log(`✨ 匹配成功: ${name} (${dayLabel})`);
            }
        }
    }

    if (results.length > 0) {
        $.msg("生日提醒助手 🎂", "发现近期寿星", [...new Set(results)].join('\n\n'));
    } else {
        $.log("✅ 近期无人生日。");
    }
})().catch(e => {
    $.log("❌ 脚本错误: " + e.message);
}).finally(() => {
    $.done();
});

// --- 环境兼容类 ---
function Env(n) {
    return new class {
        constructor(n) { this.name = n; }
        isSurge() { return typeof $httpClient !== 'undefined' && typeof $loon === 'undefined'; }
        isLoon() { return typeof $loon !== 'undefined'; }
        log(m) { console.log(m); }
        msg(t, s, m) {
            if (this.isLoon() || this.isSurge()) $notification.post(t, s, m);
            console.log(`\n${t}\n${s}\n${m}`);
        }
        done(v = {}) { $done(v); }
    }(n);
}
