const $ = new Env("声荐组合任务");
const tokenKey = "shengjian_auth_token";
const STATS_KEY = "shengjian_daily_stats";

// --- 配置常量 ---
const BUSINESS_CONSTANTS = {
  LAST_RUN_HOUR: 22, // 汇总通知的小时
};

// --- 参数解析 (适配面板开关) ---
const ARGS = (() => {
  let isNotify = "1"; // 默认开启
  if (typeof $argument !== "undefined" && $argument !== "") {
    // 兼容 true/false 或 1/0
    if ($argument === "false" || $argument === "0") {
      isNotify = "0";
    }
  }
  return { notify: isNotify };
})();

// --- 判断是否是汇总时间 ---
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
        if (res && (res.status == 401 || res.statusCode == 401)) return resolve("Token 过期");
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
      if (err) return resolve("🌸 领花: 请求失败");
      if (data === "false") return resolve("🌸 领花: 今日次数已用完");
      if (data === "true") return resolve("🌺 领花: 成功");
      try {
        const obj = JSON.parse(data);
        resolve(`🌸 领花: ${obj.message || '已领过'}`);
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
  
  // 更新统计数据
  let stats = getDailyStats();
  const timeStr = new Date().getHours() + ":" + String(new Date().getMinutes()).padStart(2, '0');
  stats.results.push(`[${timeStr}] ${currentSummary}`);
  saveDailyStats(stats);

  // 通知逻辑判断
  if (ARGS.notify === "1") {
    // 模式1：每次运行都发送通知
    $.notify("声荐签到结果", "", currentSummary);
    console.log("每次通知模式已执行");
  } else if (isLastRun) {
    // 模式0：汇总通知（仅在22点执行）
    const summaryBody = stats.results.join("\n");
    $.notify("声荐每日汇总报告", `日期: ${stats.date}`, summaryBody);
    console.log("22点汇总通知已发送");
  } else {
    // 模式0且非汇总时间
    console.log(`当前运行结果: ${currentSummary}`);
    console.log(`静默模式运行中，结果已存入统计，等待${BUSINESS_CONSTANTS.LAST_RUN_HOUR}点汇总通知...`);
  }

  $.done();
})();

// ----------------- Env 简易兼容层 -----------------
function Env(name) {
  this.name = name;
  this.read = (k) => (typeof $persistentStore !== "undefined" ? $persistentStore.read(k) : $prefs.valueForKey(k));
  this.write = (v, k) => (typeof $persistentStore !== "undefined" ? $persistentStore.write(v, k) : $prefs.setValueForKey(v, k));
  this.notify = (t, s, b) => {
    if (typeof $notification !== "undefined") $notification.post(t, s, b);
    else if (typeof $notify !== "undefined") $notify(t, s, b);
    else console.log(`[通知] ${t}\n${s}\n${b}`);
  };
  this.put = (r, c) => (typeof $httpClient !== "undefined" ? $httpClient.put(r, c) : $http.put(r, c));
  this.post = (r, c) => (typeof $httpClient !== "undefined" ? $httpClient.post(r, c) : $http.post(r, c));
  this.done = (v = {}) => (typeof $done !== "undefined" ? $done(v) : console.log("Script Done"));
}
