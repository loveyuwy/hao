// 首先定义 Env 函数
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

// 然后创建 Env 实例
const $ = new Env("声荐组合任务");

// 解析参数
const ARGS = (() => {
    let args = { notify: "1" }; // 默认开启通知
    
    // 解析参数 - 兼容多种格式
    if (typeof $argument !== "undefined") {
        // 格式1: Loon格式 $argument为对象
        if (typeof $argument === "object") {
            if ($argument.notify !== undefined) {
                args.notify = ($argument.notify === true || $argument.notify === "true" || $argument.notify === "1") ? "1" : "0";
            }
        } 
        // 格式2: 字符串格式 "true" 或 "false"
        else if (typeof $argument === "string") {
            // 尝试解析数组格式 [true] 或 [false]
            if ($argument.startsWith("[") && $argument.endsWith("]")) {
                try {
                    const arr = JSON.parse($argument);
                    if (arr.length > 0) {
                        const notifyVal = arr[0];
                        args.notify = (notifyVal === true || notifyVal === "true" || notifyVal === "1") ? "1" : "0";
                    }
                } catch (e) {
                    // 解析失败，尝试直接判断
                    if ($argument.includes("true")) args.notify = "1";
                    else if ($argument.includes("false")) args.notify = "0";
                }
            }
            // 格式3: 键值对格式 "notify=true"
            else if ($argument.includes("=")) {
                const params = new URLSearchParams($argument);
                if (params.has("notify")) {
                    const notifyVal = params.get("notify");
                    args.notify = (notifyVal === "true" || notifyVal === "1") ? "1" : "0";
                }
            }
            // 格式4: 直接字符串 "true" 或 "false"
            else {
                args.notify = ($argument === "true" || $argument === "1") ? "1" : "0";
            }
        }
    }
    
    // 备用解析：尝试从环境变量获取
    if (args.notify === undefined) {
        try {
            if (typeof $environment !== "undefined" && $environment.sourcePath) {
                const sourcePath = $environment.sourcePath;
                const queryString = sourcePath.split(/[?#]/)[1];
                if (queryString) {
                    const params = new URLSearchParams(queryString);
                    if (params.has("notify")) {
                        const notifyVal = params.get("notify");
                        args.notify = (notifyVal === "true" || notifyVal === "1") ? "1" : "0";
                    }
                }
            }
        } catch (e) {
            // 忽略解析错误
        }
    }
    
    // 最终回退：如果没有设置，默认为开启通知
    if (args.notify === undefined) {
        args.notify = "1";
    }
    
    console.log(`通知模式: ${args.notify === "1" ? "每次通知" : "仅汇总通知"}`);
    return args;
})();

// 判断是否为最后一次运行（22点运行）
const isLastRun = (() => {
    const now = new Date();
    const hour = now.getHours();
    // 22:00-22:59 之间算最后一次运行
    return hour === 22;
})();

const tokenKey = "shengjian_auth_token";
const statsKey = "shengjian_daily_stats";
let isScriptFinished = false;

const rawToken = $.read(tokenKey);
const token = rawToken ? (rawToken.startsWith("Bearer ") ? rawToken : `Bearer ${rawToken}`) : null;

const commonHeaders = {
  "Authorization": token,
  "Content-Type": "application/json",
  "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 16_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 MicroMessenger/8.0.64 NetType/4G Language/zh_CN",
  "Referer": "https://servicewechat.com/wxa25139b08fe6e2b6/23/page-frame.html"
};

// 获取每日统计
function getDailyStats() {
    const today = new Date().toISOString().slice(0, 10);
    let stats = {};
    try { 
        stats = JSON.parse($.read(statsKey) || "{}"); 
    } catch (e) { 
        stats = {}; 
    }
    
    // 如果是新的一天，重置统计
    if (stats.date !== today) {
        stats = { 
            date: today, 
            runCount: 0, 
            tasks: {
                signIn: { success: 0, failed: 0, messages: [] },
                flower: { success: 0, failed: 0, messages: [] }
            },
            lastResults: []
        };
    }
    return stats;
}

// 保存每日统计
function saveDailyStats(stats) {
    $.write(JSON.stringify(stats), statsKey);
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
      if (err) return resolve({ 
          status: 'error', 
          message: '📡 签到: 网络错误',
          success: false
      });
      
      const code = res ? (res.status || res.statusCode) : 0;
      if (code === 401) return resolve({ 
          status: 'token_error', 
          message: 'Token 已过期',
          success: false
      });
      
      try {
        const result = JSON.parse(data);
        if ((code === 200 || code === "200") && result.msg === "ok") {
          const prize = result.data?.prizeName || "成功";
          resolve({ 
              status: 'success', 
              message: `✅ 签到: ${prize}`,
              success: true
          });
        } else if (String(result.msg || "").includes("已经")) {
          resolve({ 
              status: 'info', 
              message: '📋 签到: 今天签到次数已用完',
              success: false
          });
        } else {
          resolve({ 
              status: 'error', 
              message: `🚫 签到: ${result.msg || "未知错误"}`,
              success: false
          });
        }
      } catch {
        resolve({ 
            status: 'error', 
            message: '🤯 签到: 解析失败',
            success: false
        });
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
      if (err) return resolve({ 
          status: 'info', 
          message: '⏰ 领花: 超时或未到时间',
          success: false
      });
      
      if (data === "true") return resolve({ 
          status: 'success', 
          message: '🌺 已领小红花',
          success: true
      });
      
      try {
        const obj = JSON.parse(data);
        if (obj.statusCode === 401)
          resolve({ 
              status: 'token_error', 
              message: 'Token 已过期',
              success: false
          });
        else if (obj.statusCode === 400 && /未到领取时间/.test(obj.message || ""))
          resolve({ 
              status: 'info', 
              message: '⏰ 领花: 未到时间',
              success: false
          });
        else
          resolve({ 
              status: 'info', 
              message: `🌸 领花: ${obj.message || '未知响应'}`,
              success: false
          });
      } catch {
        if (data === 'false') resolve({ 
            status: 'info', 
            message: '👍 领花: 已领过',
            success: false
        });
        else resolve({ 
            status: 'info', 
            message: '🤔 领花: 未知响应',
            success: false
        });
      }
    });
  });
}

// 发送每日汇总通知
function sendDailySummary(stats) {
    const now = new Date();
    const runTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    
    let summary = [`📊 声荐每日汇总 (${stats.date})`];
    summary.push(`🔄 运行次数: ${stats.runCount}`);
    summary.push(`───────────`);
    
    // 签到统计
    const signTasks = stats.tasks.signIn;
    summary.push(`📋 签到任务:`);
    summary.push(`   ✅ 成功: ${signTasks.success} 次`);
    summary.push(`   ❌ 失败: ${signTasks.failed} 次`);
    
    // 领花统计
    const flowerTasks = stats.tasks.flower;
    summary.push(`🌸 领花任务:`);
    summary.push(`   ✅ 成功: ${flowerTasks.success} 次`);
    summary.push(`   ❌ 失败: ${flowerTasks.failed} 次`);
    
    summary.push(`───────────`);
    summary.push(`⏰ 上次运行: ${runTime}`);
    
    if (signTasks.messages.length > 0) {
        summary.push(`📝 最近签到: ${signTasks.messages[signTasks.messages.length - 1]}`);
    }
    if (flowerTasks.messages.length > 0) {
        summary.push(`📝 最近领花: ${flowerTasks.messages[flowerTasks.messages.length - 1]}`);
    }
    
    $.notify("声荐每日汇总", "", summary.join("\n"));
}

// ----------------- 主逻辑 -----------------
(async () => {
  console.log("--- 声荐组合任务开始执行 ---");
  
  // 获取统计信息
  const dailyStats = getDailyStats();
  dailyStats.runCount++;

  if (!token) {
    // 没有token时，根据设置决定是否通知
    if (ARGS.notify === "1" || isLastRun) {
        $.notify("❌ 声荐任务失败", "未找到令牌", "请先运行\"声荐获取令牌\"脚本。");
    }
    isScriptFinished = true;
    saveDailyStats(dailyStats);
    return $.done();
  }

  const [signResult, flowerResult] = await Promise.all([signIn(), claimFlower()]);
  console.log("--- 执行结果 ---");
  console.log(JSON.stringify([signResult, flowerResult], null, 2));

  // 更新统计
  if (signResult.success) {
      dailyStats.tasks.signIn.success++;
  } else if (signResult.status === 'error') {
      dailyStats.tasks.signIn.failed++;
  }
  dailyStats.tasks.signIn.messages.push(signResult.message);
  
  if (flowerResult.success) {
      dailyStats.tasks.flower.success++;
  } else if (flowerResult.status === 'error') {
      dailyStats.tasks.flower.failed++;
  }
  dailyStats.tasks.flower.messages.push(flowerResult.message);
  
  // 只保留最近5条消息
  if (dailyStats.tasks.signIn.messages.length > 5) {
      dailyStats.tasks.signIn.messages = dailyStats.tasks.signIn.messages.slice(-5);
  }
  if (dailyStats.tasks.flower.messages.length > 5) {
      dailyStats.tasks.flower.messages = dailyStats.tasks.flower.messages.slice(-5);
  }
  
  // 保存统计
  saveDailyStats(dailyStats);

  if (signResult.status === 'token_error' || flowerResult.status === 'token_error') {
    if (ARGS.notify === "1" || isLastRun) {
        $.notify("🛑 声荐认证失败", "Token 已过期", "请重新获取令牌后再执行。");
    }
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

  // 决定是否发送通知
  if (ARGS.notify === "1") {
    // 每次通知模式：每次运行都发送通知
    $.notify(title, "", body);
  } else if (isLastRun) {
    // 仅汇总模式：只有在22点运行时发送汇总通知
    sendDailySummary(dailyStats);
  } else {
    // 非22点且非每次通知模式：不发送通知
    console.log("静默模式，跳过通知");
  }

  console.log(`通知内容:\n${body}`);
  console.log("--- 声荐组合任务结束 ---");
  isScriptFinished = true;
  $.done();
})().catch((e) => {
  const errMsg = (e && typeof e === 'object') ? (e.message || JSON.stringify(e)) : String(e);
  if (!isScriptFinished) {
      if (ARGS.notify === "1" || isLastRun) {
          $.notify("💥 声荐脚本异常", "执行错误", errMsg);
      }
  }
  $.done();
});