/*
声荐自动签到 - 适配 Loon
*/

const $ = new Env("声荐组合任务");
const tokenKey = "shengjian_auth_token";
const statsKey = "shengjian_daily_stats";

// --- Loon 参数获取兼容 ---
const ARGS = (() => {
  let args = { notify: "0" };
  // Loon 的 $argument 通常是字符串
  if (typeof $argument !== "undefined" && $argument) {
    if ($argument.indexOf("=") !== -1) {
      let pairs = $argument.split("&");
      for (let pair of pairs) {
        let [k, v] = pair.split("=");
        if (k) args[k] = v;
      }
    } else {
      args.notify = $argument; // 处理直接传值的情况
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

function saveDailyStats(stats) {
  $.write(JSON.stringify(stats), statsKey);
}

function signIn() {
  return new Promise((resolve) => {
    const req = { url: "https://xcx.myinyun.com:4438/napi/gift", headers: commonHeaders, body: "{}" };
    $.put(req, (err, res, data) => {
      if (err) return resolve({ status: 'error', message: '📡 签到: 网络错误' });
      const code = res ? (res.status || res.statusCode) : 0;
      if (code === 401) return resolve({ status: 'token_error', message: 'Token 已过期' });
      try {
        const result = JSON.parse(data);
        if ((code === 200 || code === "200") && result.msg === "ok") {
          const prize = result.data?.prizeName || "成功";
          resolve({ status: 'success', message: `✅ 签到: ${prize}` });
        } else if (String(result.msg || "").includes("已经")) {
          resolve({ status: 'info', message: '📋 签到: 今天已签到' });
        } else {
          resolve({ status: 'error', message: `🚫 签到: ${result.msg || "未知错误"}` });
        }
      } catch { resolve({ status: 'error', message: '🤯 签到: 解析失败' }); }
    });
  });
}

function claimFlower() {
  return new Promise((resolve) => {
    const req = { url: "https://xcx.myinyun.com:4438/napi/flower/get", headers: commonHeaders, body: "{}" };
    $.post(req, (err, res, data) => {
      if (err) return resolve({ status: 'info', message: '⏰ 领花: 超时或未到时间' });
      if (data === "true") return resolve({ status: 'success', message: '🌺 已领小红花' });
      try {
        const obj = JSON.parse(data);
        if (obj.statusCode === 401) resolve({ status: 'token_error', message: 'Token 已过期' });
        else if (obj.statusCode === 400) resolve({ status: 'info', message: '⏰ 领花: 未到时间' });
        else resolve({ status: 'info', message: `🌸 领花: ${obj.message || '已领'}` });
      } catch {
        resolve({ status: 'info', message: data === 'false' ? '👍 领花: 已领过' : '🤔 领花: 结束' });
      }
    });
  });
}

// ----------------- 主逻辑 -----------------
(async () => {
  console.log("--- 声荐任务开始 ---");
  const now = new Date();
  const hour = now.getHours();
  
  if (!token) {
    $.notify("❌ 声荐任务失败", "未找到令牌", "请先在 Loon 开启抓包并打开小程序");
    return $.done();
  }

  const [signResult, flowerResult] = await Promise.all([signIn(), claimFlower()]);
  
  let stats = getDailyStats();
  const currentLog = `[${hour}点] ${signResult.message} | ${flowerResult.message}`;
  stats.logs.push(currentLog);
  saveDailyStats(stats);

  if (signResult.status === 'token_error') {
    $.notify("🛑 声荐认证失败", "Token 已过期", "请重新获取令牌");
    return $.done();
  }

  // 通知判定
  if (ARGS.notify === "1") {
    $.notify("声荐签到任务", "", `${signResult.message}\n${flowerResult.message}`);
  } else if (hour === 22) {
    const body = stats.logs.join("\n");
    $.notify("📊 声荐每日汇总", `今日执行 ${stats.logs.length} 次`, body);
  }

  console.log("--- 任务结束 ---");
  $.done();
})().catch((e) => {
  console.log(e);
  $.done();
});

// ----------------- Loon 兼容环境 -----------------
function Env(name) {
  this.name = name;
  this.read = (k) => $persistentStore.read(k);
  this.write = (v, k) => $persistentStore.write(v, k);
  this.notify = (t, s, b) => $notification.post(t, s, b);
  this.put = (r, c) => $httpClient.put(r, c);
  this.post = (r, c) => $httpClient.post(r, c);
  this.done = (v = {}) => $done(v);
}
