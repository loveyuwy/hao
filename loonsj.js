const $ = new Env("声荐每日任务");

// ================= 参数解析 =================
const ARGS = (() => {
  let notify = "1";
  if (typeof $argument !== "undefined") {
    if (Array.isArray($argument)) notify = $argument[0];
    else if (typeof $argument === "object" && $argument.notify !== undefined)
      notify = $argument.notify;
    else notify = $argument;
  }
  notify = (notify === true || notify === "true" || notify === "1") ? "1" : "0";
  return { notify };
})();

const ALWAYS_NOTIFY_ON_ERROR = true;
const SUMMARY_HOUR = 22;
const STATS_KEY = "shengjian_daily_stats";
const tokenKey = "shengjian_auth_token";

// ================= Token =================
const rawToken = $.read(tokenKey);
const token = rawToken
  ? rawToken.startsWith("Bearer ")
    ? rawToken
    : `Bearer ${rawToken}`
  : null;

const headers = {
  Authorization: token,
  "Content-Type": "application/json",
  "User-Agent":
    "Mozilla/5.0 (iPhone; CPU iPhone OS 16_2 like Mac OS X) MicroMessenger/8.0.64",
  Referer:
    "https://servicewechat.com/wxa25139b08fe6e2b6/23/page-frame.html",
};

// ================= 时间判断 =================
function isSummaryTime() {
  const d = new Date();
  return d.getHours() === SUMMARY_HOUR;
}

// ================= 统计 =================
function getStats() {
  const today = new Date().toISOString().slice(0, 10);
  let s = {};
  try {
    s = JSON.parse($.read(STATS_KEY) || "{}");
  } catch {}
  if (s.date !== today) s = { date: today, runs: [] };
  return s;
}
function saveStats(s) {
  $.write(JSON.stringify(s), STATS_KEY);
}

// ================= 业务 =================
function signIn() {
  return new Promise((resolve) => {
    $.put(
      { url: "https://xcx.myinyun.com:4438/napi/gift", headers, body: "{}" },
      (e, r, d) => {
        if (e) return resolve({ type: "error", msg: "签到网络错误" });
        if (r.status == 401) return resolve({ type: "token", msg: "Token 已失效" });
        try {
          const j = JSON.parse(d);
          if (j.msg === "ok")
            resolve({ type: "success", msg: `签到成功：${j.data?.prizeName || ""}` });
          else if (String(j.msg).includes("已经"))
            resolve({ type: "info", msg: "今日已签到" });
          else resolve({ type: "error", msg: j.msg || "签到失败" });
        } catch {
          resolve({ type: "error", msg: "签到解析失败" });
        }
      }
    );
  });
}

function flower() {
  return new Promise((resolve) => {
    $.post(
      { url: "https://xcx.myinyun.com:4438/napi/flower/get", headers, body: "{}" },
      (e, r, d) => {
        if (e) return resolve({ type: "info", msg: "小红花未到时间" });
        if (d === "true") return resolve({ type: "success", msg: "已领小红花" });
        if (d === "false") return resolve({ type: "info", msg: "小红花已领取" });
        try {
          const j = JSON.parse(d);
          if (j.statusCode == 401)
            resolve({ type: "token", msg: "Token 已失效" });
          else resolve({ type: "info", msg: j.message || "小红花返回异常" });
        } catch {
          resolve({ type: "info", msg: "小红花未知响应" });
        }
      }
    );
  });
}

// ================= 主逻辑 =================
(async () => {
  if (!token) {
    $.notify("❌ 声荐失败", "", "未检测到 Token，请重新获取");
    return $.done();
  }

  const stats = getStats();
  const results = await Promise.all([signIn(), flower()]);
  const lines = results.map((r) => r.msg);
  stats.runs.push(lines.join(" | "));
  saveStats(stats);

  // Token / 错误 → 强制通知
  if (results.some((r) => r.type === "token")) {
    $.notify("🛑 声荐 Token 失效", "", "请重新打开声荐小程序获取 Token");
    return $.done();
  }
  if (results.some((r) => r.type === "error")) {
    $.notify("❌ 声荐任务异常", "", lines.join("\n"));
    return $.done();
  }

  // 普通通知
  if (ARGS.notify === "1") {
    $.notify("✅ 声荐任务完成", "", lines.join("\n"));
  }

  // 22 点汇总
  if (ARGS.notify === "0" && isSummaryTime()) {
    const summary = [`📊 声荐今日汇总 (${stats.date})`, "────────"];
    stats.runs.forEach((l, i) => summary.push(`第 ${i + 1} 次：${l}`));
    $.notify("📈 声荐每日汇总", "", summary.join("\n"));
  }

  $.done();
})();

// ================= Env =================
function Env
