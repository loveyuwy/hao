/*
* 声荐每日自动签到 (Loon Mod版)
* 更新: 适配参数控制通知 (Notify)
* * Argument 参数:
* - notify: true/false (默认true/1)。开启=每次通知，关闭=仅22点汇总
*/

const $ = new Env("声荐组合任务");
const tokenKey = "shengjian_auth_token";
const statsKey = "shengjian_daily_stats"; // 用于存储当天结果，以便汇总

// ================= 参数解析 (仿酷我风格) =================
const ARGS = (() => {
    let args = { notify: "true" }; // 默认开启
    let input = null;

    if (typeof $argument !== "undefined") {
        input = $argument;
    }

    if (input) {
        // 处理 Loon 的键值对参数 (notify=false)
        if (input.includes("=") || input.includes("&")) {
            input.split(/&|,/).forEach(item => {
                let [k, v] = item.split("=");
                if (k && v) args[k.trim()] = decodeURIComponent(v.trim());
            });
        } 
        // 简单的布尔值或字符串处理
        else {
             args.notify = input;
        }
    }
    
    // 规范化 notify 参数
    args.notify = (args.notify === "true" || args.notify === true || args.notify === "1") ? "1" : "0";
    return args;
})();

console.log(`🔔 通知模式: ${ARGS.notify === "1" ? "每次通知" : "静默 (仅22点汇总)"}`);

// 判断是否为汇总时间 (22:00 - 22:59)
const isSummaryTime = (() => {
    const now = new Date();
    return now.getHours() === 22;
})();

// ================= 数据持久化逻辑 =================
function getDailyStats() {
    const today = new Date().toISOString().slice(0, 10);
    let stats = {};
    try { 
        stats = JSON.parse($.read(statsKey) || "{}"); 
    } catch (e) { stats = {}; }
    
    // 如果不是今天的记录，重置
    if (stats.date !== today) {
        stats = { 
            date: today, 
            runCount: 0, 
            signInPrize: "", // 记录签到奖品
            flowerStatus: "" // 记录小红花状态
        };
    }
    return stats;
}

function saveDailyStats(stats) {
    $.write(JSON.stringify(stats), statsKey);
}

// ================= 主程序 =================
let isScriptFinished = false;

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
          resolve({ status: 'success', prize: prize, message: `✅ 签到: ${prize}` });
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
  console.log("--- 声荐组合任务开始执行 ---");

  if (!token) {
    if (ARGS.notify === "1" || isSummaryTime) {
        $.notify("❌ 声荐任务失败", "未找到令牌", "请先运行“声荐获取令牌”脚本。");
    }
    isScriptFinished = true;
    return $.done();
  }

  // 获取今日记录
  let dailyStats = getDailyStats();
  dailyStats.runCount++;

  const [signResult, flowerResult] = await Promise.all([signIn(), claimFlower()]);
  console.log("--- 执行结果 ---");
  console.log(JSON.stringify([signResult, flowerResult], null, 2));

  // --- 更新今日记录 ---
  // 1. 如果本次签到成功拿到奖品，覆盖旧记录
  if (signResult.status === 'success' && signResult.prize) {
      dailyStats.signInPrize = signResult.prize;
  } 
  // 2. 如果之前没记录奖品，但这次提示已签到，尝试标记为已完成
  else if (!dailyStats.signInPrize && signResult.status === 'info' && signResult.message.includes("已用完")) {
      if (!dailyStats.signInPrize) dailyStats.signInPrize = "已签到 (历史记录丢失)";
  }

  // 3. 更新小红花状态 (优先记录成功的状态)
  if (flowerResult.status === 'success') {
      dailyStats.flowerStatus = "🌺 已领取";
  } else if (flowerResult.status === 'info' && flowerResult.message.includes("已领过")) {
      dailyStats.flowerStatus = "🌺 已领取";
  } else if (!dailyStats.flowerStatus || dailyStats.flowerStatus.includes("未到")) {
      // 只有当前还没有成功状态时，才更新为"未到时间"等中间状态
      dailyStats.flowerStatus = flowerResult.message;
  }

  // 保存记录
  saveDailyStats(dailyStats);

  // --- 处理 Token 过期 ---
  if (signResult.status === 'token_error' || flowerResult.status === 'token_error') {
    $.notify("🛑 声荐认证失败", "Token 已过期", "请重新获取令牌后再执行。");
    isScriptFinished = true;
    return $.done();
  }

  // --- 构建通知内容 ---
  const lines = [];
  
  // 判断是"单次通知"还是"汇总通知"
  if (ARGS.notify === "1") {
      // ==== 模式 1: 每次都通知 ====
      if (signResult.message) lines.push(signResult.message);
      if (flowerResult.message) lines.push(flowerResult.message);
      
      const hasError = [signResult, flowerResult].some(r => r.status === 'error');
      const hasSuccess = [signResult, flowerResult].some(r => r.status === 'success');
      let title = "声荐任务结果";
      if (hasError) title = "❌ 声荐任务异常";
      else if (hasSuccess) title = "✅ 声荐签到完成";
      else title = "⚠️ 声荐任务提醒";

      $.notify(title, "", lines.join("\n"));
      console.log(`[通知] 发送单次通知`);
      
  } else {
      // ==== 模式 2: 静默模式 (仅22点汇总) ====
      if (isSummaryTime) {
          // 22 点汇总，使用 dailyStats 中的数据，因为可能早上10点签到成功了，晚上22点只会提示"已签到"
          lines.push(`📅 日期: ${dailyStats.date}`);
          lines.push(`🔄 运行: ${dailyStats.runCount} 次`);
          lines.push("───────────");
          lines.push(`🎁 签到: ${dailyStats.signInPrize || "❌ 未成功或未记录"}`);
          lines.push(`🌸 领花: ${dailyStats.flowerStatus || "❓ 未知"}`);
          
          $.notify("声荐每日汇总 📈", "", lines.join("\n"));
          console.log(`[通知] 发送每日汇总通知`);
      } else {
          console.log(`[静默] 当前不在汇总时间 (22点)，跳过通知。当前结果: ${signResult.message} | ${flowerResult.message}`);
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
