/*
* 声荐每日自动签到 (Modified Version)
* * 参数说明:
* - notify: 1 or true = 每次运行都通知 (默认)
* 0 or false = 仅在 22:00 (最后一次运行) 发送汇总通知
*/

const $ = new Env("声荐组合任务");

// --- 仿照酷我音乐的参数解析逻辑 (最稳健) ---
const ARGS = (() => {
    let args = { notify: "1" };
    let input = null;

    if (typeof $argument !== "undefined") {
        input = $argument;
    } else if (typeof $environment !== "undefined" && $environment.sourcePath) {
        input = $environment.sourcePath.split(/[?#]/)[1];
    }

    if (!input) return args;

    if (typeof input === "object") {
        // 如果是 Surge 对象格式
        if (input.notify !== undefined) {
            args.notify = (input.notify === true || input.notify === "true" || input.notify === "1" || input.notify === 1) ? "1" : "0";
        }
    } else {
        // 如果是字符串格式 (Loon/QX)
        let str = String(input).trim().replace(/^\[|\]$/g, "").replace(/^"|"$/g, "");
        if (str.includes("=") || str.includes("&")) {
            str.split(/&|,/).forEach(item => {
                let [k, v] = item.split("=");
                if (k && v) args[k.trim()] = decodeURIComponent(v.trim());
            });
            if (args.notify) {
                args.notify = (args.notify === "true" || args.notify === "1" || args.notify === true) ? "1" : "0";
            }
        } else {
            // 只有单个参数的情况
            args.notify = (str === "true" || str === "1") ? "1" : "0";
        }
    }
    return args;
})();

const CONFIG = {
    LAST_RUN_HOUR: 22, // 汇总通知的小时 (22点)
    NOTIFY: ARGS.notify || "1"
};

console.log(`🔔 通知模式: ${CONFIG.NOTIFY === "1" ? "开启 (每次运行通知)" : `关闭 (仅${CONFIG.LAST_RUN_HOUR}点汇总)`}`);

// --- 持久化存储 Key ---
const tokenKey = "shengjian_auth_token";
const STATS_KEY = "shengjian_daily_stats";

// --- 辅助函数 ---

// 判断是否为最后一次运行时间段 (22:00 - 22:59)
const isLastRun = (() => {
    const now = new Date();
    const hour = now.getHours();
    return hour === CONFIG.LAST_RUN_HOUR;
})();

// 获取今日统计数据
function getDailyStats() {
    const today = new Date().toISOString().slice(0, 10);
    let stats = {};
    try { 
        stats = JSON.parse($.read(STATS_KEY) || "{}"); 
    } catch (e) { 
        stats = {}; 
    }
    // 如果不是今天的日期，重置数据
    if (stats.date !== today) {
        stats = { date: today, runCount: 0, logs: [] };
    }
    return stats;
}

// 保存统计数据
function saveDailyStats(stats) {
    $.write(JSON.stringify(stats), STATS_KEY);
}

// ----------------- 业务逻辑 -----------------

const rawToken = $.read(tokenKey);
const token = rawToken ? (rawToken.startsWith("Bearer ") ? rawToken : `Bearer ${rawToken}`) : null;

const commonHeaders = {
  "Authorization": token,
  "Content-Type": "application/json",
  "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 16_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 MicroMessenger/8.0.64 NetType/4G Language/zh_CN",
  "Referer": "https://servicewechat.com/wxa25139b08fe6e2b6/23/page-frame.html"
};

// Step 1: 签到
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

// Step 2: 领取小红花
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

// ----------------- 主程序 -----------------
(async () => {
  console.log("--- 声荐组合任务开始执行 ---");

  // 1. 检查 Token
  if (!token) {
    $.notify("❌ 声荐任务失败", "未找到令牌", "请先运行“声荐获取令牌”脚本。");
    return $.done();
  }

  // 2. 读取今日数据
  let dailyStats = getDailyStats();
  dailyStats.runCount++;

  // 3. 执行任务
  const [signResult, flowerResult] = await Promise.all([signIn(), claimFlower()]);
  console.log("--- 执行结果 ---");
  console.log(JSON.stringify([signResult, flowerResult], null, 2));

  // 4. Token 过期处理
  if (signResult.status === 'token_error' || flowerResult.status === 'token_error') {
    const msg = "请重新获取令牌后再执行。";
    if (CONFIG.NOTIFY === "1") {
        $.notify("🛑 声荐认证失败", "Token 已过期", msg);
    } else {
        dailyStats.logs.push(`🛑 Token 已过期: ${msg}`);
        saveDailyStats(dailyStats);
    }
    return $.done();
  }

  // 5. 构建本次结果文本
  const currentLines = [];
  if (signResult.message) currentLines.push(signResult.message);
  if (flowerResult.message) currentLines.push(flowerResult.message);

  const hasError = [signResult, flowerResult].some(r => r.status === 'error');
  const hasSuccess = [signResult, flowerResult].some(r => r.status === 'success');

  let title = "声荐任务结果";
  if (hasError) title = "❌ 声荐任务异常";
  else if (hasSuccess) title = "✅ 声荐签到完成";
  else title = "⚠️ 声荐任务提醒";

  const body = currentLines.join("\n");
  console.log(`本次运行结果:\n${body}`);

  // 6. 记录到今日统计 (去重)
  currentLines.forEach(line => {
      if (!dailyStats.logs.includes(line)) {
          dailyStats.logs.push(line);
      }
  });
  saveDailyStats(dailyStats);

  // 7. 通知逻辑
  if (CONFIG.NOTIFY === "1") {
      // 模式 1: 每次都通知
      console.log("🔔 发送即时通知");
      $.notify(title, "", body);
  } else {
      // 模式 0: 静默，仅日志
      console.log("📝 静默模式，跳过即时通知");
      
      // 如果是 22 点 (汇总时间)，发送汇总
      if (isLastRun) {
          console.log("📈 触发每日汇总通知");
          let summary = [`📊 声荐今日汇总 (${dailyStats.date})`];
          summary.push(`🔄 运行次数: ${dailyStats.runCount}`);
          summary.push(`───────────`);
          if (dailyStats.logs.length > 0) {
              summary.push(dailyStats.logs.join("\n"));
          } else {
              summary.push("无执行记录");
          }
          $.notify("声荐每日汇总", "", summary.join("\n"));
      }
  }

  console.log("--- 声荐组合任务结束 ---");
  $.done();

})().catch((e) => {
  const errMsg = (e && typeof e === 'object') ? (e.message || JSON.stringify(e)) : String(e);
  $.log(`❌ 异常: ${errMsg}`);
  if (CONFIG.NOTIFY === "1") $.notify("💥 声荐脚本异常", "执行错误", errMsg);
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
