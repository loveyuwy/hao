/*
* 声荐每日自动签到 (通知增强版)
* * 参数说明:
* notify: true/false (true=每次通知, false=仅22点汇总)
* * 逻辑:
* - 10点, 16点: 正常执行任务。如果 notify=false，则不弹窗，只记录结果。
* - 22点: 执行任务。如果 notify=false，读取当天所有记录，发送汇总通知。
*/

const $ = new Env("声荐组合任务");
const tokenKey = "shengjian_auth_token";
const statsKey = "shengjian_daily_record"; // 用于存储每日运行记录
let isScriptFinished = false;

// -------------- 参数获取与配置 --------------
const ARGS = (() => {
    let args = { notify: "true" }; // 默认开启
    let input = null;
    if (typeof $argument !== "undefined") input = $argument;
    else if (typeof $environment !== "undefined" && $environment.sourcePath) input = $environment.sourcePath.split(/[?#]/)[1];
    
    if (input) {
        if (input.includes("=")) {
            input.split(/&|,/).forEach(item => {
                let [k, v] = item.split("=");
                if (k && v) args[k.trim()] = decodeURIComponent(v.trim());
            });
        } else {
            // 处理只传布尔值的情况 (针对部分旧配置兼容)
            args.notify = input.trim();
        }
    }
    // 规范化 boolean 字符串
    args.notify = (args.notify === "true" || args.notify === true || args.notify === "1") ? true : false;
    return args;
})();

// 判断是否为汇总时间 (22:00 - 22:59)
const isSummaryTime = (() => {
    const now = new Date();
    return now.getHours() === 22;
})();

const rawToken = $.read(tokenKey);
const token = rawToken ? (rawToken.startsWith("Bearer ") ? rawToken : `Bearer ${rawToken}`) : null;

const commonHeaders = {
  "Authorization": token,
  "Content-Type": "application/json",
  "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 16_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 MicroMessenger/8.0.64 NetType/4G Language/zh_CN",
  "Referer": "https://servicewechat.com/wxa25139b08fe6e2b6/23/page-frame.html"
};

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
          resolve({ status: 'info', message: '📋 签到: 今天已签过' });
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

// ----------------- 记录管理 -----------------
function updateDailyStats(currentResult) {
    const today = new Date().toISOString().slice(0, 10);
    const nowTime = new Date().toLocaleTimeString('zh-CN', { hour12: false, hour: '2-digit', minute: '2-digit' });
    
    let stats = {};
    try { stats = JSON.parse($.read(statsKey) || "{}"); } catch (e) { stats = {}; }
    
    // 如果是新的一天，重置记录
    if (stats.date !== today) {
        stats = { date: today, logs: [] };
    }
    
    // 添加本次运行记录
    stats.logs.push({
        time: nowTime,
        message: currentResult
    });
    
    $.write(JSON.stringify(stats), statsKey);
    return stats;
}

// ----------------- 主逻辑 -----------------
(async () => {
  console.log(`--- 声荐组合任务开始执行 (Notify: ${ARGS.notify}, IsSummaryTime: ${isSummaryTime}) ---`);

  if (!token) {
    $.notify("❌ 声荐任务失败", "未找到令牌", "请先运行“声荐获取令牌”脚本。");
    isScriptFinished = true;
    return $.done();
  }

  const [signResult, flowerResult] = await Promise.all([signIn(), claimFlower()]);
  console.log("--- 执行结果 ---");
  console.log(JSON.stringify([signResult, flowerResult], null, 2));

  if (signResult.status === 'token_error' || flowerResult.status === 'token_error') {
    $.notify("🛑 声荐认证失败", "Token 已过期", "请重新获取令牌后再执行。");
    isScriptFinished = true;
    return $.done();
  }

  // 构建本次运行的消息体
  const lines = [];
  if (signResult.message) lines.push(signResult.message);
  if (flowerResult.message) lines.push(flowerResult.message);
  const currentBody = lines.join("\n");

  const hasError = [signResult, flowerResult].some(r => r.status === 'error');
  const hasSuccess = [signResult, flowerResult].some(r => r.status === 'success');
  
  let title = "声荐任务结果";
  if (hasError) title = "❌ 声荐任务异常";
  else if (hasSuccess) title = "✅ 声荐签到完成";
  else title = "⚠️ 声荐任务提醒";

  // 更新每日记录
  const dailyStats = updateDailyStats(currentBody);

  // --- 通知逻辑分支 ---
  
  if (ARGS.notify) {
      // 模式 1: 每次都通知
      $.notify(title, "", currentBody);
      console.log(`[通知已发送] 模式: 每次通知`);
  } else {
      // 模式 2: 静默，仅 22 点汇总
      if (isSummaryTime) {
          // 发送汇总
          let summary = [`📅 日期: ${dailyStats.date}`];
          summary.push("─────────────");
          if (dailyStats.logs && dailyStats.logs.length > 0) {
              dailyStats.logs.forEach((log, index) => {
                  summary.push(`⏱ ${log.time}`);
                  summary.push(log.message);
                  if (index < dailyStats.logs.length - 1) summary.push(" -");
              });
          } else {
              summary.push("无今日运行记录");
          }
          
          $.notify("📈 声荐每日汇总", "", summary.join("\n"));
          console.log(`[通知已发送] 模式: 每日汇总`);
      } else {
          console.log(`[通知跳过] 模式: 静默 (非22点)`);
          console.log(`本次结果:\n${currentBody}`);
      }
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
