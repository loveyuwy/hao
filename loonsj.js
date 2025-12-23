const $ = new Env("声荐每日签到");

// ========= 参数解析 =========
const notifyMode = (() => {
  if (typeof $argument === "undefined") return "1";
  if ($argument === true || $argument === "true" || $argument === "1") return "1";
  return "0";
})();

const tokenKey = "shengjian_auth_token";
const STAT_KEY = "shengjian_daily_stat";
const now = new Date();
const hour = now.getHours();
const isSummaryTime = hour === 22;

// ========= Token =========
const rawToken = $.read(tokenKey);
const token = rawToken ? (rawToken.startsWith("Bearer ") ? rawToken : `Bearer ${rawToken}`) : null;

const headers = {
  Authorization: token,
  "Content-Type": "application/json",
  "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 16_2 like Mac OS X)",
  Referer: "https://servicewechat.com/wxa25139b08fe6e2b6/23/page-frame.html"
};

// ========= 统计 =========
function loadStat() {
  const today = new Date().toISOString().slice(0, 10);
  let stat = {};
  try { stat = JSON.parse($.read(STAT_KEY) || "{}"); } catch {}
  if (stat.date !== today) stat = { date: today, logs: [] };
  return stat;
}
function saveStat(stat) {
  $.write(JSON.stringify(stat), STAT_KEY);
}

// ========= 请求 =========
function request(method, url) {
  return new Promise(resolve => {
    const req = { url, headers, body: "{}" };
    $[method](req, (e, r, d) => {
      if (e) return resolve({ err: true });
      if (r.statusCode === 401) return resolve({ tokenError: true });
      try { resolve(JSON.parse(d)); } catch { resolve({ err: true }); }
    });
  });
}

// ========= 主流程 =========
(async () => {
  if (!token) {
    $.notify("❌ 声荐签到失败", "", "未检测到 Token，请先打开声荐小程序");
    return $.done();
  }

  const stat = loadStat();
  let messages = [];

  // 签到
  const sign = await request("put", "https://xcx.myinyun.com/napi/gift");
  if (sign.tokenError) {
    $.notify("🛑 声荐 Token 失效", "", "请重新打开声荐小程序");
    return $.done();
  }
  if (sign.msg === "ok") messages.push(`✅ 签到成功：${sign.data?.prizeName || ""}`);
  else messages.push(`ℹ️ 签到：${sign.msg || "未知状态"}`);

  // 小红花
  const flower = await request("post", "https://xcx.myinyun.com/napi/flower/get");
  if (flower === true) messages.push("🌺 已领取小红花");
  else messages.push("⏰ 小红花：未到时间或已领取");

  const resultText = messages.join("\n");
  stat.logs.push(resultText);
  saveStat(stat);

  // ========= 通知策略 =========
  if (notifyMode === "1") {
    $.notify("✅ 声荐签到完成", "", resultText);
  } else if (isSummaryTime) {
    $.notify("📊 声荐今日汇总", "", stat.logs.join("\n\n"));
  }

  $.done();
})();

// ========= Env =========
function Env(name) {
  this.read = k => $persistentStore?.read(k) ?? $prefs?.valueForKey(k);
  this.write = (v, k) => $persistentStore?.write(v, k) ?? $prefs?.setValueForKey(v, k);
  this.notify = (t, s, b) => $notification?.post(t, s, b);
  this.put = (r, c) => $httpClient.put(r, c);
  this.post = (r, c) => $httpClient.post(r, c);
  this.done = v => $done(v);
}
