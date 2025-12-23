const $ = new Env("声荐每日任务");

// ================= 参数解析 =================
const notifySwitch = (() => {
  if (typeof $argument === "undefined") return true;
  if ($argument === true || $argument === "true" || $argument === "1") return true;
  return false;
})();

// ================= 常量 =================
const TOKEN_KEY = "shengjian_auth_token";
const STAT_KEY = "shengjian_daily_stat";
const LAST_RUN_HOUR = 22;

// ================= Token =================
const rawToken = $.read(TOKEN_KEY);
const token = rawToken ? (rawToken.startsWith("Bearer ") ? rawToken : `Bearer ${rawToken}`) : null;

// ================= Headers =================
const headers = {
  Authorization: token,
  "Content-Type": "application/json",
  "User-Agent":
    "Mozilla/5.0 (iPhone; CPU iPhone OS 16_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 MicroMessenger/8.0.64",
  Referer:
    "https://servicewechat.com/wxa25139b08fe6e2b6/23/page-frame.html",
};

// ================= 时间判断 =================
const now = new Date();
const isLastRun = now.getHours() === LAST_RUN_HOUR;

// ================= 统计 =================
function loadStat() {
  const today = now.toISOString().slice(0, 10);
  let stat = {};
  try {
    stat = JSON.parse($.read(STAT_KEY) || "{}");
  } catch {}
  if (stat.date !== today) {
    stat = { date: today, sign: 0, flower: 0, error: 0 };
  }
  return stat;
}
function saveStat(stat) {
  $.write(JSON.stringify(stat), STAT_KEY);
}

// ================= 网络请求 =================
function request(method, url) {
  return new Promise((resolve) => {
    const req = { url, headers, body: "{}" };
    const fn = method === "POST" ? $.post : $.put;
    fn(req, (err, res, data) => {
      if (err) return resolve({ error: "网络错误" });
      const code = res?.status || res?.statusCode;
      if (code === 401) return resolve({ tokenError: true });
      try {
        resolve(JSON.parse(data));
      } catch {
        resolve({ error: "解析失败" });
      }
    });
  });
}

// ================= 主逻辑 =================
(async () => {
  if (!token) {
    $.notify("❌ 声荐失败", "未检测到 Token", "请先打开声荐小程序获取 Token");
    return $.done();
  }

  const stat = loadStat();
  let msgs = [];

  // ---- 签到 ----
  const sign = await request("PUT", "https://xcx.myinyun.com:4438/napi/gift");
  if (sign.tokenError) {
    $.notify("🛑 声荐 Token 失效", "", "请重新打开声荐小程序");
    stat.error++;
    saveStat(stat);
    return $.done();
  }
  if (sign.msg === "ok") {
    stat.sign++;
    msgs.push(`✅ 签到成功`);
  } else if (String(sign.msg).includes("已经")) {
    msgs.push(`📋 今日已签到`);
  }

  // ---- 小红花 ----
  const flower = await request(
    "POST",
    "https://xcx.myinyun.com:4438/napi/flower/get"
  );
  if (flower === true || flower === "true") {
    stat.flower++;
    msgs.push(`🌺 小红花已领取`);
  }

  saveStat(stat);

  // ================= 通知策略 =================
  if (notifySwitch) {
    $.notify("声荐任务完成", "", msgs.join("\n"));
  } else if (isLastRun) {
    $.notify(
      "📊 声荐 22 点汇总",
      "",
      `签到成功：${stat.sign}\n小红花：${stat.flower}\n异常：${stat.error}`
    );
  }

  $.done();
})();

// ================= Env =================
function Env(name) {
  this.name = name;
  this.notify = (t, s, b) => {
    if (typeof $notification !== "undefined") $notification.post(t, s, b);
    else if (typeof $notify !== "undefined") $notify(t, s, b);
  };
  this.read = (k) =>
    typeof $persistentStore !== "undefined"
      ? $persistentStore.read(k)
      : $prefs?.valueForKey(k);
  this.write = (v, k) =>
    typeof $persistentStore !== "undefined"
      ? $persistentStore.write(v, k)
      : $prefs?.setValueForKey(v, k);
  this.put = (r, c) =>
    $httpClient ? $httpClient.put(r, c) : $http.put(r, c);
  this.post = (r, c) =>
    $httpClient ? $httpClient.post(r, c) : $http.post(r, c);
  this.done = (v = {}) => $done(v);
}
