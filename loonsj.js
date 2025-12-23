/*
声荐自动签到合并版
适配 Loon / Surge
*/

const $ = new Env("声荐组合任务");
const tokenKey = "shengjian_auth_token";
const statsKey = "shengjian_daily_stats";

// --- 参数解析 (兼容 Loon Argument) ---
const ARGS = (() => {
  let args = { notify: "0" };
  // Loon 的 argument 传递方式处理
  if (typeof $argument !== "undefined" && $argument) {
    if (typeof $argument === "string") {
      let pairs = $argument.split("&");
      for (let pair of pairs) {
        let [k, v] = pair.split("=");
        if (k) args[k] = v;
      }
    } else if (typeof $argument === "object") {
      args = { ...args, ...$argument };
    }
  }
  return args;
})();

const rawToken = $.read(tokenKey);
const token = rawToken ? (rawToken.startsWith("Bearer ") ? rawToken : `Bearer ${rawToken}`) : null;

const commonHeaders = {
  "Authorization": token,
  "Content-Type": "application/json",
  "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 16_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 MicroMessenger/8.0.64 NetType/4G Language/zh_CN",
  "Referer": "https://servicewechat.com/wxa25139b08fe6e2b6/23/page-frame.html"
};

// ----------------- 汇总逻辑处理 -----------------
function getDailyStats() {
  const today = new Date().toISOString().slice(0, 10);
  let stats = {};
  try { 
    const data = $.read(statsKey);
    stats = data ? JSON.parse(data) : {}; 
  } catch (e) { stats = {}; }
  if (stats.date !== today) {
    stats = { date: today, logs: [] };
  }
  return stats;
}

function saveDailyStats(stats) {
  $.write(JSON.stringify(stats), statsKey);
}

// ----------------- Step 1: 签到 -----------------
function signIn() {
  return new Promise((resolve) => {
    const req = { url: "https://xcx.myinyun.com:4438/napi/gift", headers: commonHeaders, body: "{}" };
    $.put(req, (err, res, data) => {
      if (err) return resolve({ status: 'error', message: '📡 签到: 网络错误' });
      const code = res ? (res.status || res.statusCode) : 0;
      if (code === 401) return resolve({ status: 'token_error', message: 'Token 过期' });
      try {
        const result = JSON.parse(data);
        if ((code === 200 || code === "200") && result.msg === "ok") {
          const prize = result.data?.prizeName || "成功";
          resolve({ status: 'success', message: `✅ 签到: ${prize}` });
        } else if (String(result.msg || "").includes("已经")) {
          resolve({ status: 'info', message: '📋 签到: 今日已完成' });
        } else {
          resolve({ status: 'error', message: `🚫 签到: ${result.msg || "错误"}` });
        }
      } catch { resolve({ status: 'error', message: '🤯 签到: 解析失败' }); }
    });
  });
}

// ----------------- Step 2: 领取小红花 -----------------
function claimFlower() {
  return new Promise((resolve) => {
    const req = { url: "https://xcx.myinyun.com:4438/napi/flower/get", headers: commonHeaders, body: "{}" };
    $.post(req, (err, res, data) => {
      if (err) return resolve({ status: 'info', message: '⏰ 领花: 超时' });
      if (data === "true") return resolve({ status: 'success', message: '🌺 已领小红花' });
      try {
        const obj = JSON.parse(data);
        if (obj.statusCode === 401) resolve({ status: 'token_error', message: 'Token 过期' });
        else if (obj.statusCode === 400 && /未到领取时间/.test(obj.message || "")) resolve({ status: 'info', message: '⏰ 领花: 未到时间' });
        else resolve({ status: 'info', message: `🌸 领花: ${obj.message || '未知'}` });
      } catch {
        if (data === 'false') resolve({ status: 'info', message: '👍 领花: 已领过' });
        else resolve({ status: 'info', message: '🤔 领花: 响应未知' });
      }
    });
  });
}

// ----------------- 主逻辑 -----------------
(async () => {
  console.log("--- 声荐任务开始 ---");
  const now = new Date();
  const hour = now.getHours();
  const isLastRun = (hour >= 22); 

  if (!token) {
    $.notify("❌ 声荐任务失败", "未找到 Token", "请进入小程序登录以自动获取");
    return $.done();
  }

  const [signResult, flowerResult] = await Promise.all([signIn(), claimFlower()]);
  
  let stats = getDailyStats();
  const currentLog = `[${hour}点] ${signResult.message} | ${flowerResult.message}`;
  stats.logs.push(currentLog);
  saveDailyStats(stats);

  if (signResult.status === 'token_error' || flowerResult.status === 'token_error') {
    $.notify("🛑 声荐认证失败", "Token 已过期", "请重新打开小程序获取");
    return $.done();
  }

  // 通知判定
  if (ARGS.notify === "1") {
    $.notify("声荐签到任务", "", `${signResult.message}\n${flowerResult.message}`);
  } else if (isLastRun) {
    const body = stats.logs.join("\n");
    $.notify("📊 声荐每日汇总", `今日执行 ${stats.logs.length} 次`, body);
  } else {
    console.log(`静默运行中 (${hour}点)`);
  }

  console.log("--- 任务结束 ---");
  $.done();
})().catch((e) => {
  console.log(e);
  $.done();
});

// ----------------- Loon/Surge 兼容 Env -----------------
function Env(name) {
  this.name = name;
  this.read = (k) => {
    if (typeof $persistentStore !== "undefined") return $persistentStore.read(k);
    return null;
  };
  this.write = (v, k) => {
    if (typeof $persistentStore !== "undefined") return $persistentStore.write(v, k);
    return false;
  };
  this.notify = (t, s, b) => {
    if (typeof $notification !== "undefined") $notification.post(t, s, b);
    console.log(`[通知] ${t}: ${s}\n${b}`);
  };
  this.put = (r, c) => {
    if (typeof $httpClient !== "undefined") $httpClient.put(r, c);
  };
  this.post = (r, c) => {
    if (typeof $httpClient !== "undefined") $httpClient.post(r, c);
  };
  this.done = (v = {}) => {
    if (typeof $done !== "undefined") $done(v);
  };
}
