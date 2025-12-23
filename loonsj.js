const $ = new Env("声荐组合任务");

// ================= 参数解析 (最简稳健版) =================
// 只要参数里包含 "true" 或 "1" 就视为开启，不用管格式
const argRaw = typeof $argument !== "undefined" ? String($argument) : "";
const IS_NOTIFY_ON = argRaw.includes("true") || argRaw.includes("1");

console.log(`[DEBUG] 接收到的参数: ${argRaw}`);
console.log(`[DEBUG] 通知模式判定: ${IS_NOTIFY_ON ? "🟢 全程通知" : "🟡 仅汇总通知"}`);

const tokenKey = "shengjian_auth_token";
const STATS_KEY = "shengjian_daily_stats";
const LAST_RUN_HOUR = 22; // 汇总通知时间: 22点

let isScriptFinished = false;

// 判断是否为最后一次运行（用于汇总通知）
const isLastRun = (() => {
    const now = new Date();
    const hour = now.getHours();
    // 只要是22点里的任何时间运行，都算最后一次
    return hour === LAST_RUN_HOUR;
})();

const rawToken = $.read(tokenKey);
const token = rawToken ? (rawToken.startsWith("Bearer ") ? rawToken : `Bearer ${rawToken}`) : null;

const commonHeaders = {
  "Authorization": token,
  "Content-Type": "application/json",
  "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 16_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 MicroMessenger/8.0.64 NetType/4G Language/zh_CN",
  "Referer": "https://servicewechat.com/wxa25139b08fe6e2b6/23/page-frame.html"
};

// ================= 数据持久化 =================
function getDailyStats() {
    const today = new Date().toISOString().slice(0, 10);
    let stats = {};
    try { stats = JSON.parse($.read(STATS_KEY) || "{}"); } catch (e) { stats = {}; }
    if (stats.date !== today) {
        stats = { date: today, runCount: 0 };
    }
    return stats;
}

function saveDailyStats(stats) {
    $.write(JSON.stringify(stats), STATS_KEY);
}

// ================= 业务逻辑 =================

// ----------------- Step 1: 签到 -----------------
function signIn() {
  return new Promise((resolve) => {
    const req = {
      url: "https://xcx.myinyun.com:4438/napi/gift",
      headers: commonHeaders,
      body: "{}"
    };
    $.put(req, (err, res, data) => {
      if (err) return resolve({ status: 'error', message: '📡 签到: 网络错误' });
      const code = res ? (res.status || res.statusCode) : 0;
      if (code === 401) return resolve({ status: 'token_error', message: 'Token 已过期' });
      try {
        const result = JSON.parse(data);
        if ((code === 200 || code === "200") && result.msg === "ok") {
          const prize = result.data?.prizeName || "成功";
          resolve({ status: 'success', message: `✅ 签到: ${prize}` });
        } else if (String(result.msg || "").includes("已经")) {
          resolve({ status: 'info', message: '📋 签到: 今天签到次数已用完' });
        } else {
          resolve({ status: 'error', message: `🚫 签到: ${result.msg || "未知错误"}` });
        }
      } catch {
        resolve({ status: 'error', message: '🤯 签到: 解析失败' });
      }
    });
  });
}

// ----------------- Step 2: 领取小红花 -----------------
function claimFlower() {
  return new Promise((resolve) => {
    const req = {
      url: "https://xcx.myinyun.com:4438/napi/flower/get",
      headers: commonHeaders,
      body: "{}"
    };
    $.post(req, (err, res, data) => {
      if (err) return resolve({ status: 'info', message: '⏰ 领花: 超时或未到时间' });
      if (data === "true") return resolve({ status: 'success', message: '🌺 已领小红花' });
      try {
        const obj = JSON.parse(data);
        if (obj.statusCode === 401)
          resolve({ status: 'token_error', message: 'Token 已过期' });
        else if (obj.statusCode === 400 && /未到领取时间/.test(obj.message || ""))
          resolve({ status: 'info', message: '⏰ 领花: 未到时间' });
        else
          resolve({ status: 'info', message: `🌸 领花: ${obj.message || '未知响应'}` });
      } catch {
        if (data === 'false') resolve({ status: 'info', message: '👍 领花: 已领过' });
        else resolve({ status: 'info', message: '🤔 领花: 未知响应' });
      }
    });
  });
}

// ----------------- 主逻辑 -----------------
(async () => {
  console.log(`--- 声荐组合任务开始执行 ---`);

  if (!token) {
    $.notify("❌ 声荐任务失败", "未找到令牌", "请先运行“声荐获取令牌”脚本。");
    isScriptFinished = true;
    return $.done();
  }
  
  // 更新运行统计
  let dailyStats = getDailyStats();
  dailyStats.runCount++;
  saveDailyStats(dailyStats);

  const [signResult, flowerResult] = await Promise.all([signIn(), claimFlower()]);
  console.log("--- 执行结果 ---");
  console.log(JSON.stringify([signResult, flowerResult], null, 2));

  if (signResult.status === 'token_error' || flowerResult.status === 'token_error') {
    $.notify("🛑 声荐认证失败", "Token 已过期", "请重新获取令牌后再执行。");
    isScriptFinished = true;
    return $.done();
  }

  const lines = [];
  if (signResult.message) lines.push(signResult.message);
  if (flowerResult.message) lines.push(flowerResult.message);

  const hasError = [signResult, flowerResult].some(r => r.status === 'error');
  const hasSuccess = [signResult, flowerResult].some(r => r.status === 'success');

  let title = "声荐任务结果";
  if (hasError) title = "❌ 声荐任务异常";
  else if (hasSuccess) title = "✅ 声荐签到完成";
  else title = "⚠️ 声荐任务提醒";

  const body = lines.join("\n");
  
  // ================= 通知核心逻辑 =================
  if (IS_NOTIFY_ON) {
      // 模式1: 开关开启 -> 每次必推
      $.notify(title, "", body);
      console.log(`[通知] ✅ 开关已开启，发送实时通知`);
  } else if (isLastRun) {
      // 模式2: 开关关闭 -> 仅22点推汇总
      let summaryTitle = "声荐每日汇总";
      let summaryBody = `📅 日期: ${dailyStats.date}\n🔄 今日运行: ${dailyStats.runCount}次\n───────────\n${body}`;
      $.notify(summaryTitle, "", summaryBody);
      console.log(`[通知] 🌙 汇总时间(22点)，发送汇总通知`);
  } else {
      // 模式3: 开关关闭 + 非22点 -> 静默
      console.log(`[通知] 🔕 静默模式 (开关关闭且非22点)，跳过通知`);
      console.log(`[预览] 本该发送的内容:\n${title}\n${body}`);
  }

  console.log("--- 声荐组合任务结束 ---");
  isScriptFinished = true;
  $.done();
})().catch((e) => {
  const errMsg = (e && typeof e === 'object') ? (e.message || JSON.stringify(e)) : String(e);
  if (!isScriptFinished) $.notify("💥 声荐脚本异常", "执行错误", errMsg);
  $.done();
});

// ----------------- Env 兼容层 -----------------
function Env(name) {
  this.name = name;
  this.log = (...a) => console.log(...a);
  this.notify = (t, s, b) => {
    if (typeof $notification !== "undefined") $notification.post(t, s, b);
    else if (typeof $notify !== "undefined") $notify(t, s, b);
    else console.log(`[通知] ${t}\n${s}\n${b}`);
  };
  this.read = (k) => {
    if (typeof $persistentStore !== "undefined") return $persistentStore.read(k);
    if (typeof $prefs !== "undefined") return $prefs.valueForKey(k);
    return null;
  };
  this.write = (v, k) => {
    if (typeof $persistentStore !== "undefined") return $persistentStore.write(v, k);
    if (typeof $prefs !== "undefined") return $prefs.setValueForKey(v, k);
    return false;
  };
  this.put = (r, c) => {
    if (typeof $httpClient !== "undefined") $httpClient.put(r, c);
    else if (typeof $http !== "undefined") $http.put(r, c);
    else c && c("No HTTP PUT", null, null);
  };
  this.post = (r, c) => {
    if (typeof $httpClient !== "undefined") $httpClient.post(r, c);
    else if (typeof $http !== "undefined") $http.post(r, c);
    else c && c("No HTTP POST", null, null);
  };
  this.done = (v = {}) => typeof $done !== "undefined" && $done(v);
}
