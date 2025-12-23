/*
* 声荐每日自动签到 (Fix Version)
* * 更新说明:
* 1. 增加了参数解析的容错性 (自动去除可能存在的引号)
* 2. 增加了 [DEBUG] 日志，方便查看 Loon 实际传入了什么参数
*/

const $ = new Env("声荐组合任务");

// --- 参数解析 (增强版) ---
const ARGS = (() => {
    let args = { notify: "1" }; // 默认开启通知
    let input = null;

    if (typeof $argument !== "undefined") {
        input = $argument;
    } else if (typeof $environment !== "undefined" && $environment.sourcePath) {
        input = $environment.sourcePath.split(/[?#]/)[1];
    }

    if (input) {
        console.log(`[DEBUG] 接收到的原始参数: ${input}`); // 打印日志方便调试
        
        // 处理 Loon 可能传入的对象格式
        if (typeof input === "object") {
             if (input.notify !== undefined) {
                args.notify = String(input.notify);
             }
        } else {
            // 处理字符串格式: notify={notify} 或 notify="true"
            let str = String(input).trim();
            // 移除首尾可能存在的方括号或引号 (针对整个字符串)
            str = str.replace(/^\[|\]$/g, "").replace(/^"|"$/g, "");
            
            if (str.includes("=") || str.includes("&")) {
                str.split(/&|,/).forEach(item => {
                    let [k, v] = item.split("=");
                    if (k && v) {
                        // 关键修复: 移除值周围可能存在的引号 (例如 "true" -> true)
                        let val = decodeURIComponent(v.trim()).replace(/^"|"$/g, "");
                        args[k.trim()] = val;
                    }
                });
            } else {
                // 只有一个值的情况
                args.notify = str;
            }
        }
    }

    // 统一转换为 "1" (开启) 或 "0" (关闭)
    // 兼容: true, "true", 1, "1", "TRUE"
    let rawNotify = String(args.notify).toLowerCase();
    if (rawNotify === "true" || rawNotify === "1") {
        args.notify = "1";
    } else {
        args.notify = "0";
    }

    return args;
})();

const CONFIG = {
    LAST_RUN_HOUR: 22, // 汇总通知的小时 (22点)
    NOTIFY: ARGS.notify
};

console.log(`🔔 通知配置状态: ${CONFIG.NOTIFY === "1" ? "✅ 开启 (每次都通知)" : "🔕 关闭 (仅汇总)"}`);

// --- 持久化存储 Key ---
const tokenKey = "shengjian_auth_token";
const STATS_KEY = "shengjian_daily_stats";

// --- 辅助函数 ---

const isLastRun = (() => {
    const now = new Date();
    const hour = now.getHours();
    return hour === CONFIG.LAST_RUN_HOUR;
})();

function getDailyStats() {
    const today = new Date().toISOString().slice(0, 10);
    let stats = {};
    try { 
        stats = JSON.parse($.read(STATS_KEY) || "{}"); 
    } catch (e) { 
        stats = {}; 
    }
    if (stats.date !== today) {
        stats = { date: today, runCount: 0, logs: [] };
    }
    return stats;
}

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

function claimFlower() {
  return new Promise((resolve) => {
    const req = {
      url: "https://xcx.myinyun.com:4438/napi/flower/get",
      headers: commonHeaders,
      body: "{}"
    };
    $.post(req, (err, res, data) => {
      if (err) return resolve({ status: 'info', message: '⏰ 领花: 超时' });
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

  if (!token) {
    $.notify("❌ 声荐任务失败", "未找到令牌", "请先运行“声荐获取令牌”脚本。");
    return $.done();
  }

  let dailyStats = getDailyStats();
  dailyStats.runCount++;

  const [signResult, flowerResult] = await Promise.all([signIn(), claimFlower()]);
  console.log("--- 执行结果 ---");
  console.log(JSON.stringify([signResult, flowerResult], null, 2));

  if (signResult.status === 'token_error' || flowerResult.status === 'token_error') {
    const msg = "Token 已过期，请重新获取";
    if (CONFIG.NOTIFY === "1") {
        $.notify("🛑 声荐认证失败", "", msg);
    } else {
        dailyStats.logs.push(`🛑 ${msg}`);
        saveDailyStats(dailyStats);
    }
    return $.done();
  }

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
  console.log(`本次通知内容:\n${body}`);

  currentLines.forEach(line => {
      if (!dailyStats.logs.includes(line)) {
          dailyStats.logs.push(line);
      }
  });
  saveDailyStats(dailyStats);

  if (CONFIG.NOTIFY === "1") {
      console.log("🔔 触发即时通知");
      $.notify(title, "", body);
  } else {
      console.log("📝 静默模式，跳过即时通知");
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
