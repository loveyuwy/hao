/*
 * 这里的代码必须保存到本地文件 sj_custom.js 才能生效
 * 逻辑：
 * 1. 如果 silent_switch 为 false (关闭静默) -> 每次运行都通知。
 * 2. 如果 silent_switch 为 true (开启静默) -> 
 * - 0点~21点: 不通知（Console里会有日志）。
 * - 22点: 强制通知（发送每日汇总）。
 * - 23点: 不通知。
 */

const $ = new Env("声荐自动签到");
const tokenKey = "shengjian_auth_token";

let isSilent = false;

// --- 1. 处理参数 (Loon/Surge/QX) ---
if (typeof $argument !== "undefined" && $argument) {
  const argStr = String($argument).toLowerCase();
  console.log(`[参数检查] 接收到的参数: ${argStr}`);
  
  // 只要参数里包含 true/1/#，就开启静默模式
  if (argStr.includes("true") || argStr.includes("#") || argStr.includes("1")) {
    isSilent = true;
  }
  
  // 针对 Loon 变量替换未生效的情况做兼容
  if (argStr.includes("{silent_switch}")) {
    console.log("⚠️ 检测到 Loon 变量未替换，默认开启静默模式。");
    isSilent = true; 
  }
}

// --- 2. 关键逻辑：22点强制解除静默 ---
const currentHour = new Date().getHours();
let isSummaryTime = false;

if (isSilent) {
  // 如果当前是晚上 22 点 (22:00 - 22:59)
  if (currentHour === 22) {
    console.log(`🔔 当前是 22 点，触发每日汇总，强制解除静默！`);
    isSilent = false; 
    isSummaryTime = true;
  } else {
    console.log(`🤫 当前是 ${currentHour} 点，非汇总时间，保持静默。`);
  }
} else {
  console.log(`🔊 静默开关未开启，正常通知。`);
}

const rawToken = $.read(tokenKey);
const token = rawToken ? (rawToken.startsWith("Bearer ") ? rawToken : `Bearer ${rawToken}`) : null;

const commonHeaders = {
  "Authorization": token,
  "Content-Type": "application/json",
  "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 16_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 MicroMessenger/8.0.64",
  "Referer": "https://servicewechat.com/wxa25139b08fe6e2b6/23/page-frame.html"
};

(async () => {
  if (!token) {
    if (!isSilent) $.notify("❌ 声荐失败", "未找到Token", "请打开小程序获取。");
    return $.done();
  }

  const [signResult, flowerResult] = await Promise.all([signIn(), claimFlower()]);

  // 如果 Token 失效，属于严重错误，必须通知（忽略静默设置）
  if (signResult.status === 'token_error' || flowerResult.status === 'token_error') {
    $.notify("🛑 声荐认证失败", "Token 已过期", "请重新获取令牌。");
    return $.done();
  }

  const body = [signResult.message, flowerResult.message].filter(Boolean).join("\n");

  if (isSilent) {
    console.log(`[静默拦截] 本次运行结果（不会弹窗）:\n${body}`);
  } else {
    // 根据是否是汇总时间改变标题，方便确认
    const title = isSummaryTime ? "声荐每日汇总" : "声荐任务结果";
    $.notify(title, "", body);
  }
})().catch((e) => {
  console.log(`[脚本异常] ${e}`);
  if (!isSilent) $.notify("💥 声荐脚本崩溃", "", String(e));
}).finally(() => $.done());

function signIn() {
  return new Promise((resolve) => {
    $.put({ url: "https://xcx.myinyun.com:4438/napi/gift", headers: commonHeaders, body: "{}" }, (err, res, data) => {
      if (err) return resolve({ status: 'error', message: '📡 签到: 网络错误' });
      const code = res ? (res.status || res.statusCode) : 0;
      if (code === 401) return resolve({ status: 'token_error' });
      try {
        const result = JSON.parse(data || "{}");
        if (result.msg === "ok") resolve({ status: 'success', message: `✅ 签到: ${result.data?.prizeName || "成功"}` });
        else if (String(result.msg || "").includes("已经")) resolve({ status: 'info', message: '📋 签到: 已签到' });
        else resolve({ status: 'error', message: `🚫 签到: ${result.msg || "未知"}` });
      } catch (e) { resolve({ status: 'error', message: '🤯 解析失败' }); }
    });
  });
}

function claimFlower() {
  return new Promise((resolve) => {
    $.post({ url: "https://xcx.myinyun.com:4438/napi/flower/get", headers: commonHeaders, body: "{}" }, (err, res, data) => {
      if (err || !data) return resolve({ status: 'info', message: '🌸 领花: 正常' });
      if (data === "true") return resolve({ status: 'success', message: '🌺 已领小红花' });
      try {
        const obj = JSON.parse(data);
        if (obj.statusCode === 401) resolve({ status: 'token_error' });
        else resolve({ status: 'info', message: `🌸 领花: ${obj.message || '已领'}` });
      } catch (e) { resolve({ status: 'info', message: '👍 领花: 记录正常' }); }
    });
  });
}

// Env helper
function Env(n){this.name=n;this.notify=(t,s,b)=>{if(typeof $notification!="undefined")$notification.post(t,s,b);else if(typeof $notify!="undefined")$notify(t,s,b);else console.log(`${t}\n${s}\n${b}`)};this.read=k=>{if(typeof $persistentStore!="undefined")return $persistentStore.read(k);if(typeof $prefs!="undefined")return $prefs.valueForKey(k)};this.put=(r,c)=>{if(typeof $httpClient!="undefined")$httpClient.put(r,c)};this.post=(r,c)=>{if(typeof $httpClient!="undefined")$httpClient.post(r,c)};this.done=v=>{if(typeof $done!="undefined")$done(v)}}
