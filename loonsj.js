const $ = new Env("声荐组合任务");

// --- 参数解析模块 (移植自酷我脚本) ---
const ARGS = (() => {
    let args = { notify: "true" }; // 默认开启通知
    let input = null;

    if (typeof $argument !== "undefined") {
        input = $argument;
    } else if (typeof $environment !== "undefined" && $environment.sourcePath) {
        input = $environment.sourcePath.split(/[?#]/)[1];
    }

    if (input) {
        if (typeof input === "object") {
            // 处理 argument 为对象的情况 (Loon/Surge 某些版本)
            if (input.notify !== undefined) {
                 args.notify = (input.notify === true || input.notify === "true" || input.notify === "1" || input.notify === 1) ? "true" : "false";
            }
        } else {
            // 处理字符串形式 (Surge/QuantumultX)
            let str = String(input).trim().replace(/^\[|\]$/g, "").replace(/^"|"$/g, "");
            if (str.includes("=") || str.includes("&")) {
                str.split(/&|,/).forEach(item => {
                    let [k, v] = item.split("=");
                    if (k && v) args[k.trim()] = decodeURIComponent(v.trim());
                });
            } else {
                // 如果只有一个参数且不是kv对，尝试直接解析
                 args.notify = (str === "true" || str === "1") ? "true" : "false";
            }
        }
    }
    
    // 再次确保 notify 是字符串 "true" 或 "false"
    if (args.notify === true || args.notify === "1") args.notify = "true";
    if (args.notify === false || args.notify === "0") args.notify = "false";

    return args;
})();

console.log(`通知模式: ${ARGS.notify === "true" ? "每次通知" : "静默 (仅22点汇总)"}`);

// 判断是否为汇总时间 (22点)
const isLastRun = (() => {
    const now = new Date();
    const hour = now.getHours();
    // 判定 22:00-22:59 为最后一次运行/汇总时间
    return hour === 22;
})();

const tokenKey = "shengjian_auth_token";
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
  console.log("--- 声荐组合任务开始执行 ---");

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

  const lines = [];
  if (signResult.message) lines.push(signResult.message);
  if (flowerResult.message) lines.push(flowerResult.message);

  const hasError = [signResult, flowerResult].some(r => r.status === 'error');
  const hasSuccess = [signResult, flowerResult].some(r => r.status === 'success');

  let title = "声荐任务结果";
  if (hasError) title = "❌ 声荐任务异常";
  else if (hasSuccess) title = "✅ 声荐签到完成";
  else title = "⚠️ 声荐任务提醒";

  // 如果是汇总通知(22点)，修改一下标题以示区分
  if (isLastRun && ARGS.notify === "false") {
      title = "声荐任务汇总 (22点)";
  }

  const body = lines.join("\n");

  console.log(`通知内容:\n${title}\n${body}`);

  // --- 通知逻辑控制 ---
  // 1. 如果 notify 开关为 true -> 发送通知
  // 2. 如果 notify 开关为 false 但当前是 22点 (isLastRun) -> 发送通知 (作为汇总)
  // 3. 否则 -> 仅打印日志
  if (ARGS.notify === "true" || isLastRun) {
      $.notify(title, "", body);
      console.log("✅ 已发送通知");
  } else {
      console.log("🔕 静默模式: 非汇总时间，跳过通知");
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
