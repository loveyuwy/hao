const $ = new Env("声荐组合任务");
const tokenKey = "shengjian_auth_token";
const STATS_KEY = "shengjian_daily_stats";

// --- 增强版参数处理 (参考酷我逻辑) ---
const ARGS = (() => {
    let notifySetting = "true"; // 默认开启通知
    if (typeof $argument !== "undefined" && $argument !== "") {
        // 处理多种格式: "{notify}", "notify=true", "1" 等
        let argStr = String($argument).toLowerCase();
        if (argStr.includes("false") || argStr === "0") {
            notifySetting = "false";
        }
    }
    return { notify: notifySetting === "true" };
})();

// --- 汇总逻辑判断 ---
const LAST_RUN_HOUR = 22; 
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
    const savedData = $.read(STATS_KEY);
    try { 
        if (savedData) stats = JSON.parse(savedData);
    } catch (e) { stats = {}; }

    if (!stats || stats.date !== today || !Array.isArray(stats.results)) {
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
      const code = res ? (res.status || res.statusCode) : 0;
      try {
        const result = JSON.parse(data);
        if (code === 200 && result.msg === "ok") return resolve(`✅ 签到: ${result.data?.prizeName || "成功"}`);
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
      if (err || data === "false") return resolve('👍 领花: 已领或未到时');
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
  console.log(`--- 配置检查: 每次通知=${ARGS.notify}, 是否汇总时间=${isLastRun} ---`);

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

  // 通知逻辑逻辑
  if (ARGS.notify) {
    $.notify("声荐签到结果", "", currentResult);
  } else {
    if (isLastRun) {
      const summary = stats.results.join("\n");
      $.notify("📈 声荐每日汇总", `日期: ${stats.date}`, summary);
    } else {
      console.log("静默模式: 任务已完成，结果已存入缓存，将在22点汇总发送。");
    }
  }

  $.done();
})().catch((e) => {
  console.log("脚本异常: " + e);
  $.done();
});

// ----------------- Env 兼容层 -----------------
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
