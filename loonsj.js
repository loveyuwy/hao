/*
声荐每日自动任务 - Loon 适配版
*/

const $ = new Env("声荐组合任务");
const tokenKey = "shengjian_auth_token";
const statsKey = "shengjian_daily_stats";

// --- 参数解析 ---
const ARGS = (() => {
  let args = { notify: "0" }; // 默认0：22点汇总
  if (typeof $argument !== "undefined" && $argument) {
    let pairs = $argument.split("&");
    for (let pair of pairs) {
      let [k, v] = pair.split("=");
      if (k) args[k] = v;
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

// ----------------- 汇总逻辑 -----------------
function getDailyStats() {
  const today = new Date().toLocaleDateString();
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

// ----------------- 任务函数 -----------------
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
          resolve({ status: 'info', message: '📋 签到: 今日已签' });
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
      if (err) return resolve({ status: 'info', message: '⏰ 领花: 失败' });
      if (data === "true") return resolve({ status: 'success', message: '🌺 已领小红花' });
      try {
        const obj = JSON.parse(data);
        if (obj.statusCode === 401) resolve({ status: 'token_error', message: 'Token 过期' });
        else if (obj.statusCode === 400) resolve({ status: 'info', message: '⏰ 领花: 未到时间' });
        else resolve({ status: 'info', message: `🌸 领花: ${obj.message || '未知'}` });
      } catch {
        resolve({ status: 'info', message: data === 'false' ? '👍 领花: 已领过' : '🤔 领花: 异常' });
      }
    });
  });
}

// ----------------- 主逻辑 -----------------
(async () => {
  console.log(`--- ${$.name} 开始 ---`);
  const now = new Date();
  const hour = now.getHours();

  if (!token) {
    $.notify("❌ 声荐任务失败", "未找到令牌", "请进入小程序重新捕获");
    return $.done();
  }

  const [signRes, flowerRes] = await Promise.all([signIn(), claimFlower()]);
  
  let stats = getDailyStats();
  const currentLog = `[${hour}点] ${signRes.message} | ${flowerRes.message}`;
  stats.logs.push(currentLog);
  saveDailyStats(stats);

  if (signRes.status === 'token_error' || flowerRes.status === 'token_error') {
    $.notify("🛑 声荐认证失败", "Token 已过期", "请重新获取");
    return $.done();
  }

  if (ARGS.notify === "1") {
    $.notify("声荐任务", "", `${signRes.message}\n${flowerRes.message}`);
  } else if (hour === 22) {
    $.notify("📊 声荐每日汇总", `今日执行 ${stats.logs.length} 次`, stats.logs.join("\n"));
  }

  console.log(`--- ${$.name} 结束 ---`);
  $.done();
})().catch((e) => { $.notify("错误", "", e.message); $.done(); });

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
