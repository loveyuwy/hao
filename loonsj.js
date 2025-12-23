const $ = new Env("声荐组合任务");
const tokenKey = "shengjian_auth_token";
const statsKey = "shengjian_daily_stats";

// --- 参数解析 (修复关键：识别 {notify} 原始占位符) ---
const ARGS = (() => {
  let args = { notify: "1" };
  if (typeof $argument !== "undefined" && $argument) {
    let pairs = $argument.split("&");
    for (let pair of pairs) {
      let [k, v] = pair.split("=");
      if (k) {
        let val = v ? v.trim() : "";
        // 如果发现传进来的是未替换的占位符 {notify}，默认设为 "1"
        if (val === "{notify}") val = "1";
        args[k.trim()] = val;
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
      if (err) return resolve({ status: 'error', message: '📡 签到: 网络错误' });
      const code = res ? (res.status || res.statusCode) : 0;
      if (code == 401) return resolve({ status: 'token_error', message: 'Token 已过期' });
      try {
        const result = JSON.parse(data);
        if ((code == 200) && result.msg === "ok") {
          resolve({ status: 'success', message: `✅ 签到: ${result.data?.prizeName || "成功"}` });
        } else if (String(result.msg || "").includes("已经")) {
          resolve({ status: 'info', message: '📋 签到: 今天已完成' });
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
      if (err) return resolve({ status: 'info', message: '⏰ 领花: 未到时间' });
      if (data === "true") return resolve({ status: 'success', message: '🌺 已领小红花' });
      try {
        const obj = JSON.parse(data);
        if (obj.statusCode == 401) resolve({ status: 'token_error', message: 'Token 已过期' });
        else resolve({ status: 'info', message: `🌸 领花: ${obj.message || '已领或跳过'}` });
      } catch { resolve({ status: 'info', message: '👍 领花: 已处理' }); }
    });
  });
}

(async () => {
  console.log("--- 声荐任务开始 ---");
  const hour = new Date().getHours();
  
  if (!token) {
    $.notify("❌ 声荐失败", "未找到Token", "请打开小程序获取");
    return $.done();
  }

  const [signRes, flowerRes] = await Promise.all([signIn(), claimFlower()]);
  
  let stats = getDailyStats();
  stats.logs.push(`[${hour}点] ${signRes.message} | ${flowerRes.message}`);
  saveDailyStats(stats);

  if (signRes.status === 'token_error') {
    $.notify("🛑 声荐认证失效", "Token过期", "请重新获取");
    return $.done();
  }

  // --- 通知逻辑 ---
  if (ARGS.notify == "1" || typeof $argument === "undefined") {
    $.notify("声荐签到", "", `${signRes.message}\n${flowerRes.message}`);
  } else if (hour >= 22) {
    $.notify("📊 声荐汇总", `今日执行 ${stats.logs.length} 次`, stats.logs.join("\n"));
  } else {
    console.log(`静默运行: ${signRes.message} | ${flowerRes.message}`);
  }

  console.log("--- 任务结束 ---");
  $.done();
})().catch((e) => { $.done(); });

function Env(name) {
  this.name = name;
  this.read = (k) => (typeof $persistentStore !== "undefined" ? $persistentStore.read(k) : (typeof $prefs !== "undefined" ? $prefs.valueForKey(k) : null));
  this.write = (v, k) => (typeof $persistentStore !== "undefined" ? $persistentStore.write(v, k) : (typeof $prefs !== "undefined" ? $prefs.setValueForKey(v, k) : false));
  this.notify = (t, s, b) => {
    if (typeof $notification !== "undefined") $notification.post(t, s, b);
    else if (typeof $notify !== "undefined") $notify(t, s, b);
    console.log(`${t}: ${s} ${b}`);
  };
  this.put = (r, c) => $httpClient.put(r, c);
  this.post = (r, c) => $httpClient.post(r, c);
  this.done = (v = {}) => typeof $done !== "undefined" && $done(v);
}
