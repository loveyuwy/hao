/*************************
 * 声荐每日签到 + 小红花
 * 支持 notify 静默汇总
 * 22 点汇总
 *************************/

const $ = new Env("声荐每日任务");
const TOKEN_KEY = "shengjian_auth_token";
const STATS_KEY = "shengjian_daily_stats";

/******** 参数解析 ********/
const ARGS = (() => {
  let notify = "true";
  if (typeof $argument !== "undefined") {
    notify = String($argument);
  }
  return {
    notify: notify === "true" || notify === "1"
  };
})();

/******** 时间判断 ********/
const now = new Date();
const hour = now.getHours();
const isSummaryTime = hour === 22;

/******** 统计 ********/
function getStats() {
  const today = now.toISOString().slice(0, 10);
  let stats = {};
  try { stats = JSON.parse($.read(STATS_KEY) || "{}"); } catch {}
  if (stats.date !== today) {
    stats = { date: today, sign: "", flower: "" };
  }
  return stats;
}
function saveStats(s) {
  $.write(JSON.stringify(s), STATS_KEY);
}

/******** Token ********/
const rawToken = $.read(TOKEN_KEY);
const token = rawToken ? (rawToken.startsWith("Bearer ") ? rawToken : `Bearer ${rawToken}`) : null;

const headers = {
  "Authorization": token,
  "Content-Type": "application/json",
  "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 16_2 like Mac OS X)",
  "Referer": "https://servicewechat.com/wxa25139b08fe6e2b6/23/page-frame.html"
};

/******** 请求 ********/
const request = (method, url) => new Promise(resolve => {
  const req = { url, headers, body: "{}" };
  const cb = (e, r, d) => {
    if (e) return resolve({ err: true });
    resolve({ code: r.status || r.statusCode, data: d });
  };
  method === "POST" ? $.post(req, cb) : $.put(req, cb);
});

/******** 主流程 ********/
(async () => {
  if (!token) {
    $.notify("❌ 声荐失败", "未检测到 Token", "请重新打开声荐小程序获取");
    return $.done();
  }

  let stats = getStats();

  /** 签到 **/
  const sign = await request("PUT", "https://xcx.myinyun.com:4438/napi/gift");
  if (sign.code === 401) {
    $.notify("🛑 声荐 Token 失效", "", "请重新打开声荐小程序");
    return $.done();
  }
  try {
    const j = JSON.parse(sign.data);
    stats.sign = j.msg || "未知";
  } catch {
    stats.sign = "解析失败";
  }

  /** 小红花 **/
  const flower = await request("POST", "https://xcx.myinyun.com:4438/napi/flower/get");
  if (flower.code === 401) {
    $.notify("🛑 声荐 Token 失效", "", "请重新打开声荐小程序");
    return $.done();
  }
  if (flower.data === "true") stats.flower = "已领取";
  else if (flower.data === "false") stats.flower = "已领过";
  else {
    try {
      stats.flower = JSON.parse(flower.data).message || "未知";
    } catch {
      stats.flower = "未知";
    }
  }

  saveStats(stats);

  /** 通知逻辑 **/
  const msg = `📋 签到：${stats.sign}\n🌸 小红花：${stats.flower}`;

  if (ARGS.notify) {
    $.notify("✅ 声荐签到完成", "", msg);
  } else if (isSummaryTime) {
    $.notify("📊 声荐 22 点汇总", "", msg);
  }

  $.done();
})();

/******** Env ********/
function Env(name) {
  this.read = k => $persistentStore?.read(k) || $prefs?.valueForKey(k);
  this.write = (v, k) => $persistentStore?.write(v, k) || $prefs?.setValueForKey(v, k);
  this.notify = (t, s, b) => $notification?.post(t, s, b) || $notify?.(t, s, b);
  this.post = (r, c) => $httpClient.post(r, c);
  this.put = (r, c) => $httpClient.put(r, c);
  this.done = () => $done();
}
