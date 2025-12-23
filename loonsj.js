const $ = new Env("声荐组合任务");
const tokenKey = "shengjian_auth_token";
const STATS_KEY = "shengjian_daily_stats";

// --- 配置常量 ---
const BUSINESS_CONSTANTS = {
  LAST_RUN_HOUR: 22, // 汇总通知的小时
};

// --- 解析参数 ---
const ARGS = (() => {
  let isNotify = "1";
  if (typeof $argument !== "undefined") {
    isNotify = ($argument === "true" || $argument === "1") ? "1" : "0";
  }
  return { notify: isNotify };
})();

// --- 判断是否是最后一次运行 (22点) ---
const isLastRun = (() => {
  const now = new Date();
  return now.getHours() === BUSINESS_CONSTANTS.LAST_RUN_HOUR;
})();

const rawToken = $.read(tokenKey);
const token = rawToken ? (rawToken.startsWith("Bearer ") ? rawToken : `Bearer ${rawToken}`) : null;

const commonHeaders = {
  "Authorization": token,
  "Content-Type": "application/json",
  "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 16_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 MicroMessenger/8.0.64 NetType/4G Language/zh_CN",
  "Referer": "https://servicewechat.com/wxa25139b08fe6e2b6/23/page-frame.html"
};

// ----------------- 核心功能 -----------------

function getDailyStats() {
  const today = new Date().toISOString().slice(0, 10);
  let stats = {};
  try { stats = JSON.parse($.read(STATS_KEY) || "{}"); } catch (e) { stats = {}; }
  if (stats.date !== today) {
    stats = { date: today, results: [] };
  }
  return stats;
}

function saveDailyStats(stats) {
  $.write(JSON.stringify(stats), STATS_KEY);
}

function signIn() {
  return new Promise((resolve) => {
    $.put({ url: "https://xcx.myinyun.com:4438/napi/gift", headers: commonHeaders, body: "{}" }, (err, res, data) => {
      if (err) return resolve("📡 签到: 网络错误");
      try {
        const result = JSON.parse(data);
        if (res.status == 401) return resolve("Token 过期");
        if (result.msg === "ok") return resolve(`✅ 签到: ${result.data?.prizeName || "成功"}`);
        if (String(result.msg).includes("已经")) return resolve("📋 签到: 已完成");
        resolve(`🚫 签到: ${result.msg}`);
      } catch { resolve("🤯 签到: 解析失败"); }
    });
  });
}

function claimFlower() {
  return new Promise((resolve) => {
    $.post({ url: "https://xcx.myinyun.com:4438/napi/flower/get", headers: commonHeaders, body: "{}" }, (err, res, data) => {
      if (err || data === "false") return resolve("🌸 领花: 已领或未到时间");
      if (data === "true") return resolve("🌺 领花: 成功");
      try {
        const obj = JSON.parse(data);
        resolve(`🌸 领花: ${obj.message || '未知'}`);
      } catch { resolve("🤔 领花: 响应异常"); }
    });
  });
}

// ----------------- 主逻辑 -----------------
(async () => {
  console.log("--- 声荐任务开始 ---");
  if (!token) {
    $.notify("❌ 声荐", "", "未找到 Token");
    return $.done();
  }

  const sMsg = await signIn();
  const fMsg = await claimFlower();
  const currentSummary = `${sMsg} | ${fMsg}`;
  console.log(currentSummary);

  // 更新统计
  let stats = getDailyStats();
  stats.results.push(`[${new Date().getHours()}点] ${currentSummary}`);
  saveDailyStats(stats);

  // 通知逻辑
  if (ARGS.notify === "1") {
    // 每次通知模式
    $.notify("声荐签到结果", "", currentSummary);
  } else if (isLastRun) {
    // 汇总模式且到了22点
    const summaryBody = stats.results.join("\n");
    $.notify("声荐每日汇总报告", `日期: ${stats.date}`, summaryBody);
  } else {
    console.log("静默运行中，等待22点汇总...");
  }

  $.done();
})();

// ----------------- Env 简易兼容层 -----------------
function Env(name) {
  this.name = name;
  this.read = (k) => (typeof $persistentStore !== "undefined" ? $persistentStore.read(k) : $prefs.valueForKey(k));
  this.write = (v, k) => (typeof $persistentStore !== "undefined" ? $persistentStore.write(v, k) : $prefs.setValueForKey(v, k));
  this.notify = (t, s, b) => (typeof $notification !== "undefined" ? $notification.post(t, s, b) : $notify(t, s, b));
  this.put = (r, c) => (typeof $httpClient !== "undefined" ? $httpClient.put(r, c) : $http.put(r, c));
  this.post = (r, c) => (typeof $httpClient !== "undefined" ? $httpClient.post(r, c) : $http.post(r, c));
  this.done = (v = {}) => $done(v);
}
