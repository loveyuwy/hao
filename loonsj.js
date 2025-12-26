const $ = new Env("声荐自动签到");
const tokenKey = "shengjian_auth_token";

let isSilent = false;

// --- 参数处理逻辑 ---
if (typeof $argument !== "undefined" && $argument) {
  const argStr = String($argument).toLowerCase();
  console.log(`[参数检查] 当前参数内容: ${argStr}`);
  
  // 判断是否开启静默
  if (argStr.includes("true") || argStr.includes("#") || argStr.includes("1")) {
    isSilent = true;
  }
  
  // Loon 变量替换 Bug 修复
  if (argStr.includes("{silent_switch}")) {
    console.log("⚠️ 检测到 Loon 变量替换 Bug，已自动开启静默模式防止弹窗。");
    isSilent = true; 
  }
}

// --- 新增：22点强制通知逻辑 ---
const currentHour = new Date().getHours();
if (isSilent) {
  // 如果开启了静默，但当前是 22 点，则强制开启通知（作为汇总）
  if (currentHour === 22) {
    console.log(`🔔 当前时间 ${currentHour}点，触发每日汇总通知，解除静默。`);
    isSilent = false;
  } else {
    console.log(`🤫 当前时间 ${currentHour}点，非汇总时间，保持静默运行。`);
  }
} else {
  console.log(`🔊 静默开关未开启，执行常规通知模式。`);
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
    // 无 Token 时，无论是否静默都建议提示，防止漏签（可选）
    if (!isSilent) $.notify("❌ 声荐失败", "未找到Token", "请打开小程序获取。");
    return $.done();
  }

  const [signResult, flowerResult] = await Promise.all([signIn(), claimFlower()]);

  // 如果 Token 失效，属于重要错误，强制通知
  if (signResult.status === 'token_error' || flowerResult.status === 'token_error') {
    $.notify("🛑 声荐认证失败", "Token 已过期", "请重新获取令牌。");
    return $.done();
  }

  const body = [signResult.message, flowerResult.message].filter(Boolean).join("\n");

  if (isSilent) {
    console.log(`[静默生效] 已拦截以下通知内容:\n${body}`);
  } else {
    // 这里的 title 改了一下，如果是 22 点汇总，看起来更直观
    const title = currentHour === 22 ? "声荐每日汇总" : "声荐任务结果";
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

function Env(n){this.name=n;this.notify=(t,s,b)=>{if(typeof $notification!="undefined")$notification.post(t,s,b);else if(typeof $notify!="undefined")$notify(t,s,b);else console.log(`${t}\n${s}\n${b}`)};this.read=k=>{if(typeof $persistentStore!="undefined")return $persistentStore.read(k);if(typeof $prefs!="undefined")return $prefs.valueForKey(k)};this.put=(r,c)=>{if(typeof $httpClient!="undefined")$httpClient.put(r,c)};this.post=(r,c)=>{if(typeof $httpClient!="undefined")$httpClient.post(r,c)};this.done=v=>{if(typeof $done!="undefined")$done(v)}}
