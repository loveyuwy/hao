const $ = new Env("声荐每日任务");
const tokenKey = "shengjian_auth_token";
const STATS_KEY = "sj_daily_stats";

/* ========== 参数解析 ========== */
const NOTIFY = (() => {
  if (typeof $argument === "undefined") return true;
  return ($argument === true || $argument === "true" || $argument === "1");
})();

/* ========== 时间判断（22点汇总） ========== */
const now = new Date();
const isSummaryTime = now.getHours() === 22;

/* ========== 读取 Token ========== */
const rawToken = $.read(tokenKey);
const token = rawToken
  ? (rawToken.startsWith("Bearer ") ? rawToken : `Bearer ${rawToken}`)
  : null;

const headers = {
  "Authorization": token,
  "Content-Type": "application/json",
  "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 16_2 like Mac OS X)",
  "Referer": "https://servicewechat.com/wxa25139b08fe6e2b6/23/page-frame.html"
};

/* ========== 统计数据 ========== */
function loadStats() {
  const today = new Date().toISOString().slice(0, 10);
  let s = {};
  try { s = JSON.parse($.read(STATS_KEY) || "{}"); } catch {}
  if (s.date !== today) s = { date: today, logs: [] };
  return s;
}
function saveStats(s) {
  $.write(JSON.stringify(s), STATS_KEY);
}

/* ========== 签到 ========== */
function signIn() {
  return new Promise(resolve => {
    $.put({
      url: "https://xcx.myinyun.com:4438/napi/gift",
      headers,
      body: "{}"
    }, (e, r, d) => {
      if (e) return resolve({ type: "error", msg: "📡 网络错误" });
      if (r.status === 401) return resolve({ type: "token" });
      try {
        const j = JSON.parse(d);
        if (j.msg === "ok")
          resolve({ type: "success", msg: `✅ 签到成功：${j.data?.prizeName || ""}` });
        else if (String(j.msg).includes("已经"))
          resolve({ type: "info", msg: "📋 今日已签到" });
        else
          resolve({ type: "error", msg: j.msg });
      } catch {
        resolve({ type: "error", msg: "解析失败" });
      }
    });
  });
}

/* ========== 小红花 ========== */
function flower() {
  return new Promise(resolve => {
    $.post({
      url: "https://xcx.myinyun.com:4438/napi/flower/get",
      headers,
      body: "{}"
    }, (e, r, d) => {
      if (r?.status === 401) return resolve({ type: "token" });
      if (d === "true") resolve({ type: "success", msg: "🌺 小红花已领取" });
      else resolve({ type: "info", msg: "🌸 小红花已领取/未到时间" });
    });
  });
}

/* ========== 主流程 ========== */
(async () => {
  if (!token) {
    $.notify("❌ 声荐失败", "未检测到 Token", "请打开声荐小程序获取 Token");
    return $.done();
  }

  const stats = loadStats();
  const res1 = await signIn();
  const res2 = await flower();

  if (res1.type === "token" || res2.type === "token") {
    $.notify("🛑 声荐 Token 失效", "", "请重新打开声荐小程序");
    return $.done();
  }

  [res1, res2].forEach(r => r.msg && stats.logs.push(r.msg));
  saveStats(stats);

  if (NOTIFY) {
    $.notify("✅ 声荐签到完成", "", stats.logs.slice(-2).join("\n"));
  } else if (isSummaryTime) {
    $.notify("📊 声荐 22 点汇总", "", stats.logs.join("\n"));
  }

  $.done();
})();

/* ========== Env ========== */
function Env(n) {
  this.read = k => $persistentStore?.read(k);
  this.write = (v, k) => $persistentStore?.write(v, k);
  this.notify = (t, s, b) => $notification.post(t, s, b);
  this.put = (r, c) => $httpClient.put(r, c);
  this.post = (r, c) => $httpClient.post(r, c);
  this.done = () => $done();
}
