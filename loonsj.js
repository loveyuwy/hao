/*
* 声荐组合任务 - 酷我逻辑复刻版
* * [Argument] 
* notify = switch, "true", "false", ...
* * [Script]
* argument="[{notify}]"
* */

const $ = new Env("声荐组合任务");
const tokenKey = "shengjian_auth_token";

// --- 1. 参数解析 (完全复刻酷我音乐逻辑) ---
const ARGS = (() => {
    // 默认值
    let args = { notify: "true" };
    let input = null;

    // 获取 argument
    if (typeof $argument !== "undefined") {
        input = $argument;
    }

    // 打印原始参数，方便调试 (排查问题的关键)
    console.log(`🔍 [Debug] 原始Input: ${input}`);

    if (input) {
        // 移除方括号 [] 和 双引号 " (酷我逻辑)
        // 例子: "[false]" -> "false"
        let str = String(input).trim().replace(/[\[\]"]/g, "");
        
        // 赋值
        if (str === "false" || str === "0") {
            args.notify = "false";
        } else {
            args.notify = "true";
        }
    }

    return args;
})();

// --- 2. 业务配置 ---
const CONSTANTS = {
    SUMMARY_HOUR: 22 // 汇总通知触发的小时 (22点)
};

console.log(`🔔 通知开关状态: ${ARGS.notify}`);
console.log(`🔔 当前模式: ${ARGS.notify === "true" ? "✅ 每次都通知" : "🔕 静默 (仅22点汇总)"}`);

// 判断是否为汇总时间点 (22:00 - 22:59)
const isSummaryTime = (() => {
    const now = new Date();
    const hour = now.getHours();
    return hour === CONSTANTS.SUMMARY_HOUR;
})();

let isScriptFinished = false;

// 读取 Token
const rawToken = $.read(tokenKey);
const token = rawToken ? (rawToken.startsWith("Bearer ") ? rawToken : `Bearer ${rawToken}`) : null;

const commonHeaders = {
  "Authorization": token,
  "Content-Type": "application/json",
  "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 16_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 MicroMessenger/8.0.64 NetType/4G Language/zh_CN",
  "Referer": "https://servicewechat.com/wxa25139b08fe6e2b6/23/page-frame.html"
};

// ----------------- 签到逻辑 -----------------
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

// ----------------- 领花逻辑 -----------------
function claimFlower() {
  return new Promise((resolve) => {
    const req = {
      url: "https://xcx.myinyun.com:4438/napi/flower/get",
      headers: commonHeaders,
      body: "{}"
    };
    $.post(req, (err, res, data) => {
      if (err) return resolve({ status: 'info', message: '⏰ 领花: 超时或未到时间' });
      if (data === "true") return resolve({ status: 'success', message: '🌺 领花: 领取成功' });
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

// ----------------- 主流程 -----------------
(async () => {
  console.log("--- 声荐组合任务开始执行 ---");

  if (!token) {
    $.notify("❌ 声荐任务失败", "未找到令牌", "请先运行“声荐获取令牌”脚本。");
    isScriptFinished = true;
    return $.done();
  }

  const [signResult, flowerResult] = await Promise.all([signIn(), claimFlower()]);
  
  // 强制Token过期通知
  if (signResult.status === 'token_error' || flowerResult.status === 'token_error') {
    $.notify("🛑 声荐认证失败", "Token 已过期", "请重新获取令牌后再执行。");
    isScriptFinished = true;
    return $.done();
  }

  // 构建消息体
  const lines = [];
  if (signResult.message) lines.push(signResult.message);
  if (flowerResult.message) lines.push(flowerResult.message);
  const body = lines.join("\n");

  // 判定标题
  const hasError = [signResult, flowerResult].some(r => r.status === 'error');
  const hasSuccess = [signResult, flowerResult].some(r => r.status === 'success');
  
  let title = "声荐任务结果";
  if (hasError) title = "❌ 声荐任务异常";
  else if (hasSuccess) title = "✅ 声荐任务完成";
  else title = "⚠️ 声荐任务提醒";

  // --- 核心通知逻辑 ---
  if (ARGS.notify === "true") {
      // 模式1: 开启通知 -> 每次都发
      $.notify(title, "", body);
      console.log(`🔔 [通知已发送] 原因: 每次通知模式开启`);
  } else {
      // 模式2: 关闭通知 -> 判断时间
      if (isSummaryTime) {
          // 是22点 -> 发送汇总
          $.notify("📊 声荐每日汇总", "今日最终状态", body);
          console.log(`🔔 [通知已发送] 原因: 22点汇总时间`);
      } else {
          // 不是22点 -> 静默
          console.log(`🔕 [通知已跳过] 原因: 静默模式且非22点 (当前${new Date().getHours()}点)`);
          console.log(`📝 本次运行结果:\n${body}`);
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
