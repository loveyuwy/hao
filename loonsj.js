const $ = new Env("声荐组合任务");
const tokenKey = "shengjian_auth_token";
const statsKey = "shengjian_daily_stats";

// --- Loon 参数解析优化 ---
const ARGS = (() => {
  let args = { notify: "1" }; 
  if (typeof $argument !== "undefined" && $argument) {
    // 处理 Loon 可能传入的各种格式
    if ($argument.indexOf("notify=") !== -1) {
      let val = $argument.split("notify=")[1].split("&")[0].trim();
      // 核心修复：排除 Loon 未替换的占位符 {notify}
      if (val !== "{notify}" && val !== "") {
        args.notify = val;
      }
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

// ----------------- 功能函数 -----------------
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

// ----------------- 主程序 -----------------
(async () => {
  console.log("--- 声荐任务开始 ---");
  const now = new Date();
  const hour = now.getHours();
  
  // Loon 环境下判断是否为手动触发
  const isManual = (typeof $argument === "undefined" || !$argument || $argument.includes("{notify}"));

  if (!token) {
    $.notify("❌ 声荐失败", "未找到令牌", "请进入小程序重新捕获");
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

  // --- 通知逻辑 ---
  if (isManual || ARGS.notify == "1") {
    // 手动运行，或设置 notify 为 1 时：弹出通知
    $.notify("声荐签到", "", logEntry);
  } else if (hour >= 22) {
    // 设置为 0 时：仅在 22 点汇总通知
    $.notify("📊 声荐今日汇总", `累计执行 ${stats.logs.length} 次`, stats.logs.join("\n"));
  } else {
    // 正常定时运行（非 22 点）：仅打印日志到 Loon 日志查看器
    console.log(`[静默执行] ${logEntry}`);
  }

  console.log("--- 任务结束 ---");
  $.done();
})().catch((e) => { 
  console.log("脚本崩溃: " + e);
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
