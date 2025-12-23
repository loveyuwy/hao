const $ = new Env("声荐组合任务");
const tokenKey = "shengjian_auth_token";
const STATS_KEY = "shengjian_daily_stats";
let isScriptFinished = false;

// --- 参数解析 (参考酷我脚本逻辑) ---
const ARGS = (() => {
    let args = { notify: "true" };
    let input = null;
    if (typeof $argument !== "undefined") {
        input = $argument;
    } else if (typeof $environment !== "undefined" && $environment.sourcePath) {
        input = $environment.sourcePath.split(/[?#]/)[1];
    }
    
    if (input) {
        // 处理 argument=notify=true 这种形式
        if (input.includes("=")) {
            input.split(/&|,/).forEach(item => {
                let [k, v] = item.split("=");
                if (k && v) args[k.trim()] = decodeURIComponent(v.trim());
            });
        } 
    }
    return args;
})();

const isNotifyEnabled = ARGS.notify === "true" || ARGS.notify === true;
const SUMMARY_HOUR = 22; // 汇总通知时间

const rawToken = $.read(tokenKey);
const token = rawToken ? (rawToken.startsWith("Bearer ") ? rawToken : `Bearer ${rawToken}`) : null;

const commonHeaders = {
  "Authorization": token,
  "Content-Type": "application/json",
  "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 16_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 MicroMessenger/8.0.64 NetType/4G Language/zh_CN",
  "Referer": "https://servicewechat.com/wxa25139b08fe6e2b6/23/page-frame.html"
};

// --- 持久化与汇总函数 ---
function updateDailyStats(logText) {
    const now = new Date();
    const today = now.toISOString().slice(0, 10); // YYYY-MM-DD
    const timeStr = now.toTimeString().slice(0, 5); // HH:MM
    
    let stats = { date: today, logs: [] };
    try {
        const stored = JSON.parse($.read(STATS_KEY) || "{}");
        if (stored.date === today) {
            stats = stored;
        }
    } catch (e) {}

    // 添加本次日志
    stats.logs.push(`[${timeStr}] ${logText.replace(/\n/g, " | ")}`); // 将换行替换为分隔符以便汇总显示
    $.write(JSON.stringify(stats), STATS_KEY);
    return stats;
}

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
          resolve({ status: 'info', message: '📋 签到: 次数已用完' });
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
  console.log(`--- 声荐任务开始 (通知模式: ${isNotifyEnabled ? "每次" : "22点汇总"}) ---`);

  if (!token) {
    $.notify("❌ 声荐任务失败", "未找到令牌", "请先运行“声荐获取令牌”脚本。");
    isScriptFinished = true;
    return $.done();
  }

  const [signResult, flowerResult] = await Promise.all([signIn(), claimFlower()]);
  
  if (signResult.status === 'token_error' || flowerResult.status === 'token_error') {
    $.notify("🛑 声荐认证失败", "Token 已过期", "请重新获取令牌后再执行。");
    isScriptFinished = true;
    return $.done();
  }

  const lines = [];
  if (signResult.message) lines.push(signResult.message);
  if (flowerResult.message) lines.push(flowerResult.message);
  
  const body = lines.join("\n");
  const hasError = [signResult, flowerResult].some(r => r.status === 'error');
  
  // 更新当日记录
  const dailyStats = updateDailyStats(body);

  // --- 通知决策逻辑 ---
  const currentHour = new Date().getHours();
  let shouldNotify = false;
  let notifyTitle = "声荐任务结果";
  let notifyBody = body;

  if (isNotifyEnabled) {
      // 模式1：每次都通知
      shouldNotify = true;
      if (hasError) notifyTitle = "❌ 声荐任务异常";
      else notifyTitle = "✅ 声荐任务完成";
  } else {
      // 模式2：汇总通知
      console.log(`当前时间: ${currentHour}点, 设定汇总: ${SUMMARY_HOUR}点`);
      if (currentHour === SUMMARY_HOUR) {
          shouldNotify = true;
          notifyTitle = `📊 声荐今日汇总 (${dailyStats.date})`;
          notifyBody = dailyStats.logs.join("\n");
      } else {
          console.log("非汇总时间，静默运行。");
      }
  }

  if (shouldNotify) {
      $.notify(notifyTitle, "", notifyBody);
      console.log(`已发送通知:\n${notifyTitle}\n${notifyBody}`);
  }

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
