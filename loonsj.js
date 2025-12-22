/*
声荐自动签到 - 最终修正版
*/

const $ = new Env("声荐自动签到");
const tokenKey = "shengjian_auth_token";

let isSilent = false;

// --- 标准参数检查 ---
if (typeof $argument !== "undefined" && $argument) {
  const argStr = String($argument).toLowerCase().trim();
  console.log(`[DEBUG] 传入参数: "${argStr}"`);
  
  // 只有当 Loon 传回明确的 true 时才静默
  if (argStr === "true" || argStr === "1") {
    isSilent = true;
    console.log("[DEBUG] 判定结果：静默模式【开启】");
  } else {
    isSilent = false;
    console.log("[DEBUG] 判定结果：静默模式【关闭】");
  }
} else {
  console.log("[DEBUG] 未检测到 argument，默认【关闭】静默");
}

const rawToken = $.read(tokenKey);
const token = rawToken ? (rawToken.startsWith("Bearer ") ? rawToken : `Bearer ${rawToken}`) : null;

const commonHeaders = {
  "Authorization": token,
  "Content-Type": "application/json",
  "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 16_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 MicroMessenger/8.0.64",
  "Referer": "https://servicewechat.com/wxa25139b08fe6e2b6/23/page-frame.html"
};

(async () => {
  if (!token) {
    $.notify("❌ 声荐失败", "未找到Token", "请打开小程序重新获取");
    return $.done();
  }

  const [signResult, flowerResult] = await Promise.all([signIn(), claimFlower()]);
  const body = [signResult.message, flowerResult.message].filter(Boolean).join("\n");

  if (isSilent) {
    console.log(`[静默拦截] 任务完成，内容如下:\n${body}`);
  } else {
    $.notify("声荐任务结果", "", body);
    console.log(`[发送弹窗] 任务完成，内容如下:\n${body}`);
  }
})().catch((e) => {
  console.log(`[异常] ${e}`);
}).finally(() => $.done());

function signIn() {
  return new Promise((resolve) => {
    $.put({ url: "https://xcx.myinyun.com:4438/napi/gift", headers: commonHeaders, body: "{}" }, (err, res, data) => {
      try {
        const result = JSON.parse(data || "{}");
        if (result.msg === "ok") resolve({ message: `✅ 签到: ${result.data?.prizeName || "成功"}` });
        else resolve({ message: `📋 签到: ${result.msg || "已签到"}` });
      } catch (e) { resolve({ message: "📋 签到: 已完成" }); }
    });
  });
}

function claimFlower() {
  return new Promise((resolve) => {
    $.post({ url: "https://xcx.myinyun.com:4438/napi/flower/get", headers: commonHeaders, body: "{}" }, (err, res, data) => {
      if (data === "true") resolve({ message: '🌺 已领小红花' });
      else resolve({ message: '🌸 领花: 已领取或未到时间' });
    });
  });
}

function Env(n){this.name=n;this.notify=(t,s,b)=>{if(typeof $notification!="undefined")$notification.post(t,s,b);else if(typeof $notify!="undefined")$notify(t,s,b);else console.log(`${t}\n${s}\n${b}`)};this.read=k=>{if(typeof $persistentStore!="undefined")return $persistentStore.read(k);if(typeof $prefs!="undefined")return $prefs.valueForKey(k)};this.put=(r,c)=>{if(typeof $httpClient!="undefined")$httpClient.put(r,c)};this.post=(r,c)=>{if(typeof $httpClient!="undefined")$httpClient.post(r,c)};this.done=v=>{if(typeof $done!="undefined")$done(v)}}
