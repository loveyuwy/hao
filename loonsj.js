/*
声荐自动签到 - 智能通知版
*/

const $ = new Env("声荐自动签到");
const tokenKey = "shengjian_auth_token";

let isSummaryMode = false; // 是否开启“仅总结模式”

// --- 参数解析 ---
if (typeof $argument !== "undefined" && $argument) {
  const argStr = String($argument).toLowerCase().trim();
  console.log(`[DEBUG] 传入参数: "${argStr}"`);
  
  // 当开关开启时，判定为“总结模式”
  if (argStr.includes("true") || argStr === "{silent_switch}" || argStr === "silent_switch" || argStr === "1") {
    isSummaryMode = true;
    console.log("[DEBUG] 状态：静默开启 -> 切换至【运行总结通知】模式。");
  } else {
    isSummaryMode = false;
    console.log("[DEBUG] 状态：静默关闭 -> 切换至【实时任务通知】模式。");
  }
}

const rawToken = $.read(tokenKey);
const token = rawToken ? (rawToken.startsWith("Bearer ") ? rawToken : `Bearer ${rawToken}`) : null;

(async () => {
  if (!token) {
    $.notify("❌ 声荐失败", "未找到 Token", "请重新抓包。");
    return $.done();
  }

  // 执行签到
  const signResult = await signIn();
  if (!isSummaryMode) {
    $.notify("声荐签到结果", "", signResult.message);
  }

  // 执行领花
  const flowerResult = await claimFlower();
  if (!isSummaryMode) {
    $.notify("声荐领花结果", "", flowerResult.message);
  }

  // --- 如果是总结模式，在最后统一发一条 ---
  if (isSummaryMode) {
    const summary = `📋 签到: ${signResult.message}\n🌸 领花: ${flowerResult.message}`;
    $.notify("📊 声荐任务总结", "", summary);
    console.log(`[总结模式] 已发送汇总通知:\n${summary}`);
  }

})().catch((e) => {
  console.log(`[异常] ${e}`);
}).finally(() => $.done());

// --- 接口函数 ---
function signIn() {
  const headers = { "Authorization": token, "Content-Type": "application/json" };
  return new Promise((resolve) => {
    $.put({ url: "https://xcx.myinyun.com:4438/napi/gift", headers: headers, body: "{}" }, (err, res, data) => {
      try {
        const result = JSON.parse(data || "{}");
        if (result.msg === "ok") resolve({ message: result.data?.prizeName || "成功" });
        else resolve({ message: result.msg || "已签到" });
      } catch (e) { resolve({ message: "已签到" }); }
    });
  });
}

function claimFlower() {
  const headers = { "Authorization": token, "Content-Type": "application/json" };
  return new Promise((resolve) => {
    $.post({ url: "https://xcx.myinyun.com:4438/napi/flower/get", headers: headers, body: "{}" }, (err, res, data) => {
      if (data === "true") resolve({ message: '🌺 成功' });
      else resolve({ message: '已领取或未到时间' });
    });
  });
}

function Env(n){this.name=n;this.notify=(t,s,b)=>{if(typeof $notification!="undefined")$notification.post(t,s,b);else if(typeof $notify!="undefined")$notify(t,s,b);else console.log(`${t}\n${s}\n${b}`)};this.read=k=>{if(typeof $persistentStore!="undefined")return $persistentStore.read(k);if(typeof $prefs!="undefined")return $prefs.valueForKey(k)};this.put=(r,c)=>{if(typeof $httpClient!="undefined")$httpClient.put(r,c)};this.post=(r,c)=>{if(typeof $httpClient!="undefined")$httpClient.post(r,c)};this.done=v=>{if(typeof $done!="undefined")$done(v)}}
