/*
 * 生日提醒脚本 (v6.2 最终修正版)
 * 适配简化后的参数格式 argument="data={text}&days={days}"
 */

const $ = new Env("生日提醒");

// 农历算法
const lunarInfo=[0x04bd8,0x04ae0,0x0a570,0x054d5,0x0d260,0x0d950,0x16554,0x056a0,0x09ad0,0x055d2,0x04ae0,0x0a5b6,0x0a4d0,0x0d250,0x1d255,0x0b540,0x0d6a0,0x0ada2,0x095b0,0x14977,0x04970,0x0a4b0,0x0b4b5,0x06a50,0x06d40,0x1ab54,0x02b60,0x09570,0x052f2,0x04970,0x06566,0x0d4a0,0x0ea50,0x06e95,0x05ad0,0x02b60,0x186e3,0x092e0,0x1c8d7,0x0c950,0x0d4a0,0x1d8a6,0x0b550,0x056a0,0x1a5b4,0x025d0,0x092d0,0x0d2b2,0x0a950,0x0b557,0x06ca0,0x0b550,0x15355,0x04da0,0x0a5d0,0x14573,0x052d0,0x0a9a8,0x0e950,0x06aa0,0x0aea6,0x0ab50,0x04b60,0x0aae4,0x0a570,0x05260,0x0f263,0x0d950,0x05b57,0x056a0,0x096d0,0x04dd5,0x04ad0,0x0a4d0,0x0d4d4,0x0d250,0x0d558,0x0b540,0x0b5a0,0x195a6,0x095b0,0x049b0,0x0a974,0x0a4b0,0x0b27a,0x06a50,0x06d40,0x0af46,0x0ab60,0x09570,0x04af5,0x04970,0x064b0,0x074a3,0x0ea50,0x06b58,0x055c0,0x0ab60,0x096d5,0x092e0,0x0c960,0x0d954,0x0d4a0,0x0da50,0x07552,0x056a0,0x0abb7,0x025d0,0x092d0,0x0cab5,0x0a950,0x0b4a0,0x0baa4,0x0ad50,0x055d9,0x04ba0,0x0a5b0,0x15176,0x052b0,0x0a930,0x07954,0x06aa0,0x0ad50,0x05b52,0x04b60,0x0a6e6,0x0a4e0,0x0d260,0x0ea65,0x0d530,0x05aa0,0x076a3,0x096d0,0x04bd7,0x04ad0,0x0a4d0,0x1d0b6,0x0d250,0x0d520,0x0dd45,0x0b5a0,0x056d0,0x055b2,0x049b0,0x0a577,0x0a4b0,0x0aa50,0x1b255,0x06d20,0x0ada0];
function solarToLunar(e){const o=e.getFullYear();if(o<1900||o>2099)return null;const t=new Date(1900,0,31);let n=Math.floor((e.getTime()-t.getTime())/864e5),a=1900,r=function(e){let o=348;for(let t=32768;t>8;t>>=1)o+=(lunarInfo[e-1900]&t)?1:0;return o+function(e){return(lunarInfo[e-1900]&15)?(lunarInfo[e-1900]&65536)?30:29:0}(e)}(a);for(;a<2100&&n>=r;)n-=r,a++,r=function(e){let o=348;for(let t=32768;t>8;t>>=1)o+=(lunarInfo[e-1900]&t)?1:0;return o+function(e){return(lunarInfo[e-1900]&15)?(lunarInfo[e-1900]&65536)?30:29:0}(e)}(a);let l=1,s=!1,i=lunarInfo[a-1900]&15;for(let e=1;e<=12;e++){if(i>0&&e==i+1&&!s){--e,s=!0;let o=function(e){return(lunarInfo[e-1900]&15)?(lunarInfo[e-1900]&65536)?30:29:0}(a);if(n<o){l=e;break}n-=o}else{let o=function(e,o){return o>12||o<1?0:(lunarInfo[e-1900]&65536>>o)?30:29}(a,e);if(n<o){l=e;break}n-=o}}return{year:a,month:l,day:n+1}}

!(async () => {
    let rawArgs = (typeof $argument != "undefined") ? $argument : "";
    console.log(`🔍 调试: 参数 = [${rawArgs}]`);

    let configStr = "";
    let advanceDays = 3;

    // 1. 提取天数 (匹配 days=3 或 advance=3)
    let advMatch = rawArgs.match(/(?:days|advance)=(\d+)/);
    if (advMatch) advanceDays = parseInt(advMatch[1]);

    // 2. 提取数据
    // 优先匹配 data=xxx 格式
    let dataMatch = rawArgs.match(/data=([^&]+)/);
    if (dataMatch) {
        configStr = dataMatch[1];
    } else {
        // 如果没有 data=，尝试直接找含有 @ 的部分
        if (rawArgs.includes("@")) {
             configStr = rawArgs.replace(/(?:days|advance)=\d+/, "").replace(/&/g, "").trim();
             // 清理掉可能的 key 前缀
             configStr = configStr.replace(/^(?:info|data)=/, "");
        }
    }

    // 3. 解码与清洗
    try { configStr = decodeURIComponent(configStr); } catch(e) {}
    // 去掉可能的双引号
    configStr = configStr.replace(/"/g, "").trim();

    // 4. 最终检查
    if (!configStr || configStr.includes("{text}") || configStr.includes("{birthday_data}")) {
        console.log("❌ 严重错误: Loon 变量替换失败！请检查插件配置 Argument 是否对应。");
        configStr = "演示账号@0@01-01"; 
    }

    console.log(`🔔 启动: 提前${advanceDays}天 | 数据: ${configStr}`);

    // ==================== 逻辑处理 ====================
    const items = configStr.split(/;|；/);
    const notifications = [];
    const today = new Date();
    today.setHours(0,0,0,0);

    for (let i = 0; i <= advanceDays; i++) {
        let checkDate = new Date(today);
        checkDate.setDate(today.getDate() + i);
        let checkStr = formatDate(checkDate);
        let lunarCache = null; 

        for (let item of items) {
            let parts = item.split(/@|，|,/);
            if (parts.length >= 3) {
                let name = parts[0].trim();
                let type = parts[1].trim(); 
                let dateStr = parts[2].trim().replace(/[\.\/]/g, '-');
                
                let isMatch = false;
                let matchType = "";

                if (type == "0") {
                    if (dateStr == checkStr) { isMatch = true; matchType = "公历"; }
                } else if (type == "1") {
                    if (!lunarCache) { try { lunarCache = solarToLunar(checkDate); } catch(e){} }
                    if (lunarCache) {
                        let lunStr = `${lunarCache.month.toString().padStart(2,'0')}-${lunarCache.day.toString().padStart(2,'0')}`;
                        if (lunStr == dateStr) { isMatch = true; matchType = `农历(${lunStr})`; }
                    }
                }

                if (isMatch) {
                    let msg = (i === 0) ? `🎂 今天是 ${name} 的生日！` : `⏳ ${name} 还有 ${i} 天过生日`;
                    notifications.push(`${msg}\n📅 ${checkStr} ${matchType}`);
                }
            }
        }
    }

    if (notifications.length > 0) {
        let title = notifications.some(n => n.includes("今天是")) ? "🎂 生日快乐！" : "生日提醒 🎂";
        $.msg(title, "近期寿星名单", notifications.join("\n\n"));
    } else {
        console.log(`✅ ${formatDate(today)} 无人过生日`);
    }

})().catch(e => console.log(e)).finally(() => $.done());

function formatDate(d) { return `${(d.getMonth()+1).toString().padStart(2,'0')}-${d.getDate().toString().padStart(2,'0')}`; }
function Env(n){return new class{constructor(n){this.name=n}msg(n,e,t){typeof $notification!="undefined"?$notification.post(n,e,t):typeof $notify!="undefined"&&$notify(n,e,t),console.log(`\n${n}\n${e}\n${t}`)}done(n={}){$done(n)}}(n)}
