/**
 * 声荐自动签到 & 领小红花 (Loon 适配版)
 */

const $ = new Env("声荐组合任务");
const tokenKey = "shengjian_auth_token";
const statsKey = "shengjian_daily_stats";

// --- 参数解析 (适配 Loon $argument) ---
const ARGS = (() => {
  let args = { notify: "0" };
  if (typeof $argument !== "undefined" && $argument) {
    if ($argument.includes("=")) {
      let pairs = $argument.split("&");
      for (let pair of pairs) {
        let [k, v] = pair.split("=");
        if (k) args[k] = v;
      }
    } else {
      args.notify = $argument; // 处理直接传值情况
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

// ----------------- 逻辑处理 -----------------
function getDailyStats() {
  const today = new Date().toISOString().slice(0, 10);
  let stats = {};
  try { stats = JSON.parse($.read(statsKey) || "{}"); } catch (e) { stats = {}; }
  if (stats.date !== today) {
    stats = { date: today, logs: [] };
  }
  return stats;
}

async function startTask() {
  console.log("--- 声荐任务开始 ---");
  const now = new Date();
  const hour = now.getHours();

  if (!token) {
    $.notify("❌ 声荐任务失败", "未找到令牌", "请先打开小程序获取token");
    return $.done();
  }

  const [signResult, flowerResult] = await Promise.all([signIn(), claimFlower()]);
  
  let stats = getDailyStats();
  const currentLog = `[${hour}点] ${signResult.message} | ${flowerResult.message}`;
  stats.logs.push(currentLog);
  $.write(JSON.stringify(stats), statsKey);

  if (signResult.status === 'token_error') {
    $.notify("🛑 声荐认证失败", "Token 已过期", "请重新获取令牌");
    return $.done();
  }

  // 通知判定
  if (ARGS.notify === "1") {
    $.notify("声荐签到任务", "", `${signResult.message}\n${flowerResult.message}`);
  } else if (hour === 22) {
    $.notify("📊 声荐每日汇总", `今日执行 ${stats.logs.length} 次`, stats.logs.join("\n"));
  }

  console.log("--- 任务结束 ---");
  $.done();
}

// 签到请求
function signIn() {
  return new Promise((resolve) => {
    $.put({ url: "https://xcx.myinyun.com:4438/napi/gift", headers: commonHeaders, body: "{}" }, (err, res, data) => {
      if (err) return resolve({ status: 'error', message: '📡 网络错误' });
      if (res.status === 401) return resolve({ status: 'token_error', message: 'Token过期' });
      try {
        const resObj = JSON.parse(data);
        if (resObj.msg === "ok") resolve({ status: 'success', message: `✅ 签到: ${resObj.data?.prizeName || "成功"}` });
        else resolve({ status: 'info', message: `📋 ${resObj.msg}` });
      } catch { resolve({ status: 'error', message: '解析失败' }); }
    });
  });
}

// 领花请求
function claimFlower() {
  return new Promise((resolve) => {
    $.post({ url: "https://xcx.myinyun.com:4438/napi/flower/get", headers: commonHeaders, body: "{}" }, (err, res, data) => {
      if (err || data === "false") resolve({ status: 'info', message: '🌸 领花: 已领或未到时' });
      else if (data === "true") resolve({ status: 'success', message: '🌺 领花: 成功' });
      else resolve({ status: 'info', message: '🌸 领花: 跳过' });
    });
  });
}

// ----------------- Loon 环境兼容 -----------------
function Env(name) {
  this.read = (k) => $persistentStore.read(k);
  this.write = (v, k) => $persistentStore.write(v, k);
  this.notify = (t, s, b) => $notification.post(t, s, b);
  this.put = (options, cb) => $httpClient.put(options, cb);
  this.post = (options, cb) => $httpClient.post(options, cb);
  this.done = (v = {}) => $done(v);
}

startTask();
