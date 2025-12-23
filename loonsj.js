const $ = new Env("声荐组合任务");
const tokenKey = "shengjian_auth_token";
const STATS_KEY = "shengjian_daily_stats";

// --- 参数处理 ---
const ARGS = (() => {
    let notify = "true";
    if (typeof $argument !== "undefined") {
        notify = String($argument);
    }
    return { notify: notify === "true" || notify === "1" };
})();

// --- 汇总逻辑判断 ---
const LAST_RUN_HOUR = 22; // 设定汇总时间为22点
const isLastRun = (() => {
    const now = new Date();
    return now.getHours() === LAST_RUN_HOUR;
})();

const rawToken = $.read(tokenKey);
const token = rawToken ? (rawToken.startsWith("Bearer ") ? rawToken : `Bearer ${rawToken}`) : null;

const commonHeaders = {
  "Authorization": token,
  "Content-Type": "application/json",
  "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 16_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 MicroMessenger/8.0.64 NetType/4G Language/zh_CN",
  "Referer": "https://servicewechat.com/wxa25139b08fe6e2b6/23/page-frame.html"
};

// 获取持久化统计数据
function getDailyStats() {
    const today = new Date().toISOString().slice(0, 10);
    let stats = {};
    try { stats = JSON.parse($.read(STATS_KEY) || "{}"); } catch (e) { stats = {}; }
    if (stats.date !== today) {
        stats = { date: today, results: [] };
    }
    return stats;
}

// ----------------- Step 1: 签到 -----------------
function signIn() {
  return new Promise((resolve) => {
    const req = { url: "https://xcx.myinyun.com:4438/napi/gift", headers: commonHeaders, body: "{}" };
    $.put(req, (err, res, data) => {
      if (err) return resolve("📡 签到: 网络错误");
      try {
        const result = JSON.parse(data);
        if (res.status === 200 && result.msg === "ok") return resolve(`✅ 签到: ${result.data?.prizeName || "成功"}`);
        if (String(result.msg || "").includes("已经")) return resolve('📋 签到: 今日已完成');
        resolve(`🚫 签到: ${result.msg || "未知错误"}`);
      } catch { resolve('🤯 签到: 解析失败'); }
    });
  });
}

// ----------------- Step 2: 领取小红花 -----------------
function claimFlower() {
  return new Promise((resolve) => {
    const req = { url: "https://xcx.myinyun.com:4438/napi/flower/get", headers: commonHeaders, body: "{}" };
    $.post(req, (err, res, data) => {
      if (err || data === "false") return resolve('👍 领花: 已领或超时');
      if (data === "true") return resolve('🌺 领花: 成功');
      try {
        const obj = JSON.parse(data);
        resolve(`🌸 领花: ${obj.message || '已领过'}`);
      } catch { resolve('🤔 领花: 已处理'); }
    });
  });
}

// ----------------- 主逻辑 -----------------
(async () => {
  if (!token) {
    $.notify("❌ 声荐任务失败", "未找到令牌", "请先在微信打开小程序获取Token");
    return $.done();
  }

  const res1 = await signIn();
  const res2 = await claimFlower();
  const currentResult = `${res1} | ${res2}`;
  
  // 更新统计
  let stats = getDailyStats();
  stats.results.push(`[${new Date().getHours()}点] ${currentResult}`);
  $.write(JSON.stringify(stats), STATS_KEY);

  // 通知逻辑
  if (ARGS.notify) {
    // 开启了每次通知
    $.notify("声荐签到结果", "", currentResult);
  } else if (isLastRun) {
    // 关闭了每次通知，但在22点最后一次运行
    const summary = stats.results.join("\n");
    $.notify("📈 声荐每日汇总通知", `日期: ${stats.date}`, summary);
  } else {
    console.log("静默运行，汇总结果已存入缓存。");
  }

  $.done();
})().catch((e) => {
  console.log("脚本异常: " + e);
  $.done();
});

// ----------------- Env 兼容层 (简易版) -----------------
function Env(name) {
  this.name = name;
  this.read = (k) => (typeof $persistentStore !== "undefined" ? $persistentStore.read(k) : (typeof $prefs !== "undefined" ? $prefs.valueForKey(k) : null));
  this.write = (v, k) => (typeof $persistentStore !== "undefined" ? $persistentStore.write(v, k) : (typeof $prefs !== "undefined" ? $prefs.setValueForKey(v, k) : false));
  this.notify = (t, s, b) => {
    if (typeof $notification !== "undefined") $notification.post(t, s, b);
    else if (typeof $notify !== "undefined") $notify(t, s, b);
    console.log(`[通知] ${t}: ${s}\n${b}`);
  };
  this.put = (r, c) => (typeof $httpClient !== "undefined" ? $httpClient.put(r, c) : (typeof $http !== "undefined" ? $http.put(r, c) : c(null,null,null)));
  this.post = (r, c) => (typeof $httpClient !== "undefined" ? $httpClient.post(r, c) : (typeof $http !== "undefined" ? $http.post(r, c) : c(null,null,null)));
  this.done = (v = {}) => (typeof $done !== "undefined" ? $done(v) : null);
}
