/*
声荐自动签到 - 调试增强版 V2
*/

const $ = new Env("声荐自动签到");
const tokenKey = "shengjian_auth_token";

let isSilent = false;

// --- 调试与参数解析逻辑 ---
if (typeof $argument !== "undefined" && $argument) {
  const argStr = String($argument).toLowerCase().trim();
  console.log(`[DEBUG] 传入参数详情: 内容="${argStr}", 类型=${typeof $argument}`);
  
  // 只有当 Loon 成功替换为 true 或 1 时才开启静默
  if (argStr === "true" || argStr === "1") {
    isSilent = true;
    console.log("[DEBUG] 决策：开启静默模式。");
  } else {
    // 包含 "{silent_switch}"、"false" 或其他情况，全部不静默
    isSilent = false;
    console.log(`[DEBUG] 决策：不使用静默 (原因: 参数为 ${argStr})`);
  }
} else {
  console.log("[DEBUG] 决策：未接收到参数，默认不静默。");
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
    console.log("[ERROR] 缺少 Token，无法执行任务。");
    $.notify("❌ 声荐失败", "未找到Token", "请打开小程序获取。");
    return $.done();
  }

  console.log("[INFO] 任务启动...");
  const [signResult, flowerResult] = await Promise.all([signIn(), claimFlower()]);

  if (signResult.status === 'token_error' || flowerResult.status === 'token_error') {
    $.notify("🛑 声荐认证失败", "Token 已过期", "请重新获取令牌。");
    return $.done();
  }

  const body = [signResult.message, flowerResult.message].filter(Boolean).join("\n");

  if (isSilent) {
    console.log(`[静默日志] 任务完成，已拦截通知推送。内容：\n${body}`);
  } else {
    $.notify("声荐任务结果", "", body);
    console.log(`[推送成功] 任务完成。内容：\n${body}`);
  }
})().catch((e) => {
  console.log(`[致命错误] ${e}`);
  $.notify("💥 声荐脚本崩溃", "", String(e));
}).finally(() => $.done());

// --- 接口实现 ---
function signIn() {
  return new Promise((resolve) => {
    $.put({ url: "https://xcx.myinyun.com:4438/napi/gift", headers: commonHeaders, body: "{}" }, (err, res, data) => {
      if (err) return resolve({ status: 'error', message: '📡 签到: 网络错误' });
      if (res && (res.status === 401 || res.statusCode === 401)) return resolve({ status: 'token_error' });
      try {
        const result = JSON.parse(data || "{}");
        if (result.msg === "ok") resolve({ status: 'success', message: `✅ 签到: ${result.data?.prizeName || "成功"}` });
        else if (String(result.msg || "").includes("已经")) resolve({ status: 'info', message: '📋 签到: 已签到' });
        else resolve({ status: 'error', message: `🚫 签到: ${result.msg || "未知"}` });
      } catch (e) { resolve({ status: 'error', message: '🤯 签到解析失败' }); }
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
