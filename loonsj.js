const $ = new Env("声荐组合任务");
const tokenKey = "shengjian_auth_token";
const statsKey = "shengjian_daily_stats";

// --- 仿 Surge 参数解析 ---
const ARGS = (() => {
  let args = { notify: "1" };
  if (typeof $argument !== "undefined" && $argument) {
    let pairs = $argument.split("&");
    for (let pair of pairs) {
      let [k, v] = pair.split("=");
      if (k) args[k.trim()] = v ? v.trim() : "";
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

function getDailyStats() {
  const today = new Date().toISOString().slice(0, 10);
  let stats;
  try { stats = JSON.parse($.read(statsKey) || "{}"); } catch (e) { stats = null; }
  if (!stats || stats.date !== today || !Array.isArray(stats.logs)) {
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
      if (err) return resolve({ status: 'error', message: '📡 网络连接失败' });
      const code = res ? (res.status || res.statusCode) : 0;
      if (code == 401) return resolve({ status: 'token_error', message: 'Token失效' });
      try {
        const result = JSON.parse(data);
        if (result.msg === "ok") {
          resolve({ status: 'success', message: `✅ 签到: ${result.data?.prizeName || "成功"}` });
        } else if (String(result.msg).includes("已经")) {
          resolve({ status: 'info', message: '📋 今日已签到' });
        } else {
          resolve({ status: 'error', message: `🚫 ${result.msg}` });
        }
      } catch { resolve({ status: 'error', message: '🤯 数据解析错误' }); }
    });
  });
}

function claimFlower() {
  return new Promise((resolve) => {
    const req = { url: "https://xcx.myinyun.com:4438/napi/flower/get", headers: commonHeaders, body: "{}" };
    $.post(req, (err, res, data) => {
      if (err) return resolve({ status: 'info', message: '⏰ 未到领花时间' });
      if (data === "true") return resolve({ status: 'success', message: '🌺 已领小红花' });
      try {
        const obj = JSON.parse(data);
        resolve({ status: 'info', message: `🌸 领花: ${obj.message || '已处理'}` });
      } catch { resolve({ status: 'info', message: '👍 领花完成' }); }
    });
  });
}

(async () => {
  console.log("--- 声荐任务开始 ---");
  const hour = new Date().getHours();
  
  // 核心判断：只有显式设置为 "0" 且不是手动运行，才进入静默模式
  const isSilentMode = (ARGS.notify === "0" && typeof $argument !== "undefined" && $argument.indexOf("notify") !== -1);

  if (!token) {
    $.notify("❌ 声荐失败", "未找到令牌", "请进入小程序重新获取");
    return $.done();
  }

  const [res1, res2] = await Promise.all([signIn(), claimFlower()]);
  
  let stats = getDailyStats();
  const logEntry = `${res1.message} | ${res2.message}`;
  stats.logs.push(`[${hour}点] ${logEntry}`);
  saveDailyStats(stats);

  if (res1.status === 'token_error') {
    $.notify("🛑 声荐令牌过期", "请重新获取", "");
    return $.done();
  }

  // 通知逻辑
  if (!isSilentMode) {
    // 只要不是明确的静默模式（notify=0），就弹窗通知
    $.notify("声荐签到", "", logEntry);
  } else if (hour >= 22) {
    // 静默模式下，22点汇总
    $.notify("📊 声荐汇总通知", `今日累计执行 ${stats.logs.length} 次`, stats.logs.join("\n"));
  } else {
    // 其他时间仅打印日志
    console.log(`[静默执行记录] ${logEntry}`);
  }

  console.log("--- 任务结束 ---");
  $.done();
})().catch((e) => { 
  console.log(e);
  $.done(); 
});

function Env(name) {
  this.name = name;
  this.read = (k) => (typeof $persistentStore !== "undefined" ? $persistentStore.read(k) : null);
  this.write = (v, k) => (typeof $persistentStore !== "undefined" ? $persistentStore.write(v, k) : false);
  this.notify = (t, s, b) => {
    if (typeof $notification !== "undefined") $notification.post(t, s, b);
    console.log(`[通知] ${t}: ${s}\n${b}`);
  };
  this.put = (r, c) => $httpClient.put(r, c);
  this.post = (r, c) => $httpClient.post(r, c);
  this.done = (v = {}) => (typeof $done !== "undefined" ? $done(v) : null);
}
