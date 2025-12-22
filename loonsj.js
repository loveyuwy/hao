/*
声荐自动签到 - 逻辑强跳版
*/

const $ = new Env("声荐自动签到");
const tokenKey = "shengjian_auth_token";
const forceNotifyKey = "shengjian_force_notify"; // 强制通知锁

let isSilent = false;

// --- 解决 Loon UI 卡死的终极逻辑 ---
const storedForce = $.read(forceNotifyKey);

if (typeof $argument !== "undefined" && $argument) {
  const argStr = String($argument).toLowerCase().trim();
  console.log(`[DEBUG] Loon 传参: "${argStr}"`);
  
  // 如果存储里写了 "1"，则无视参数，强制发通知（用于自救）
  if (storedForce === "1") {
    isSilent = false;
    console.log("[DEBUG] 判定：存储锁开启，强制发送通知。");
  } 
  // 只有当参数真正变成了 "false" 时，才关闭静默
  else if (argStr === "false") {
    isSilent = false;
    console.log("[DEBUG] 判定：参数显式关闭，发送通知。");
  }
  // 如果是占位符或 true，开启静默
  else if (argStr === "{silent_switch}" || argStr === "true") {
    isSilent = true;
    console.log("[DEBUG] 判定：参数为占位符或开启，拦截通知。");
  }
}

const rawToken = $.read(tokenKey);
const token = rawToken ? (rawToken.startsWith("Bearer ") ? rawToken : `Bearer ${rawToken}`) : null;

(async () => {
  if (!token) {
    $.notify("❌ 声荐失败", "未找到Token", "");
    return $.done();
  }

  const [signResult, flowerResult] = await Promise.all([signIn(), claimFlower()]);
  const body = [signResult.message, flowerResult.message].filter(Boolean).join("\n");

  if (isSilent) {
    console.log(`[静默拦截] 内容如下:\n${body}`);
    console.log(`[提示] 如果你想要弹窗，请在 Loon 脚本控制台运行: $persistentStore.write("1", "${forceNotifyKey}")`);
  } else {
    $.notify("声荐任务结果", "", body);
    console.log(`[正常弹窗] 内容如下:\n${body}`);
  }
})().catch((e) => {
  console.log(`[异常] ${e}`);
}).finally(() => $.done());

// --- 内部函数 ---
function signIn() {
  return new Promise((resolve) => {
    $.put({ url: "https://xcx.myinyun.com:4438/napi/gift", headers: {"Authorization": token, "Content-Type": "application/json"}, body: "{}" }, (err, res, data) => {
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
    $.post({ url: "https://xcx.myinyun.com:4438/napi/flower/get", headers: {"Authorization": token, "Content-Type": "application/json"}, body: "{}" }, (err, res, data) => {
      if (data === "true") resolve({ message: '🌺 已领小红花' });
      else resolve({ message: '🌸 领花: 已领取或未到时间' });
    });
  });
}

function Env(n){this.name=n;this.notify=(t,s,b)=>{if(typeof $notification!="undefined")$notification.post(t,s,b);else if(typeof $notify!="undefined")$notify(t,s,b);else console.log(`${t}\n${s}\n${b}`)};this.read=k=>{if(typeof $persistentStore!="undefined")return $persistentStore.read(k);if(typeof $prefs!="undefined")return $prefs.valueForKey(k)};this.put=(r,c)=>{if(typeof $httpClient!="undefined")$httpClient.put(r,c)};this.post=(r,c)=>{if(typeof $httpClient!="undefined")$httpClient.post(r,c)};this.done=v=>{if(typeof $done!="undefined")$done(v)}}
