/*
* 声荐组合任务 - 稳定版
* * 配置: argument={notify}
* * 逻辑: 接收 "true" 或 "false" 字符串
*/

const $ = new Env("声荐组合任务");
const tokenKey = "shengjian_auth_token";

// --- 1. 参数解析 ---
const ARGS = (() => {
    let args = { notify: "true" }; // 默认开启
    let input = null;

    if (typeof $argument !== "undefined") {
        input = $argument;
    }

    // 调试日志：打印接收到的原始内容
    console.log(`🔍 [Debug] Loon传入参数: ${input} (类型: ${typeof input})`);

    if (input) {
        // 转换成字符串并去空格
        const str = String(input).trim().toLowerCase();
        
        // 只要是 "false" 或 "0"，就关闭通知
        if (str === "false" || str === "0") {
            args.notify = "false";
        } else {
            args.notify = "true";
        }
    }

    return args;
})();

// --- 2. 业务常量 ---
const CONSTANTS = {
    SUMMARY_HOUR: 22 // 汇总通知触发的小时 (22点)
};

console.log(`🔔 通知开关: ${ARGS.notify === "true" ? "✅ 开启 (每次通知)" : "🔕 关闭 (仅22点汇总)"}`);

// 判断是否为汇总时间点
const isSummaryTime = (() => {
    const now = new Date();
    const hour = now.getHours();
    return hour === CONSTANTS.SUMMARY_HOUR;
})();

let isScriptFinished = false;
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
  
  // 异常情况强制通知 (Token过期)
  if (signResult.status === 'token_error' || flowerResult.status === 'token_error') {
    $.notify("🛑 声荐认证失败", "Token 已过期", "请重新获取令牌后再执行。");
    isScriptFinished = true;
    return $.done();
  }

  // 构建消息
  const lines = [];
  if (signResult.message) lines.push(signResult.message);
  if (flowerResult.message) lines.push(flowerResult.message);
  const body = lines.join("\n");

  const hasError = [signResult, flowerResult].some(r => r.status === 'error');
  const hasSuccess = [signResult, flowerResult].some(r => r.status === 'success');
  
  let title = "声荐任务结果";
  if (hasError) title = "❌ 声荐任务异常";
  else if (hasSuccess) title = "✅ 声荐任务完成";
  else title = "⚠️ 声荐任务提醒";

  // --- 智能通知核心逻辑 ---
  if (ARGS.notify === "true") {
      // 1. 开关开启：无条件通知
      $.notify(title, "", body);
      console.log("🔔 [模式:每次通知] 已发送弹窗");
  } else {
      // 2. 开关关闭：仅在汇总时间通知
      if (isSummaryTime) {
          $.notify("📊 声荐每日汇总", "今日最终状态", body);
          console.log("🔔 [模式:每日汇总] 当前是22点，已发送汇总弹窗");
      } else {
          console.log(`🔕 [模式:静默运行] 当前${new Date().getHours()}点非汇总时间，跳过通知`);
          console.log(`📄 本次运行结果:\n${body}`);
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
