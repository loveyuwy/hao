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

// ... 其他代码保持不变 ...

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

// ... 其他函数保持不变 ...