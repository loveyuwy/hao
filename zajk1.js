const $ = new Env("🏥 众安健康");

(async () => {
  console.log("\n================= 🚀 众安健康 开始执行 =================");
  let tokens = [];
  
  // 统一参数解析逻辑（参考应用更新检测脚本）
  const arg = typeof $argument !== 'undefined' ? $argument : "";

  if (arg) {
    if (typeof arg === 'object') {
      // 兼容 Loon 的对象/数组形式：[{TOKEN1},{TOKEN2}...]
      console.log(`[环境检查] 检测到 Loon 对象/数组参数`);
      const rawValues = Array.isArray(arg) ? arg : Object.values(arg);
      tokens = rawValues.map(v => String(v).trim());
    } else if (typeof arg === 'string') {
      // 兼容 Surge 的字符串形式：TOKEN1#TOKEN2
      console.log(`[环境检查] 检测到字符串参数`);
      // 先去除可能存在的中括号，然后按 # 或 , 分割
      tokens = arg.replace(/[\[\]]/g, "").split(/[#,]/);
    }
  }

  // 过滤无效 Token（空值、null、或者是 Loon 未填时的占位符）
  tokens = tokens
    .map(t => t.replace(/['" ]/g, ""))
    .filter(t => t !== "" && t !== "null" && t !== "undefined" && !t.includes("object Object"));

  if (tokens.length === 0) {
    console.log(`[配置错误] 未检测到任何有效 Token，请在插件/模块设置中填入参数。`);
    $.msg("🏥 众安健康", "❌ 配置错误", "请先在配置中填入至少一个 Token");
    $.done();
    return;
  }

  console.log(`[任务准备] 解析成功，检测到 ${tokens.length} 个账号，开始并发执行...`);

  const tasks = tokens.map((token, i) => {
    const accountIdx = i + 1;
    return runTask(token, accountIdx).catch(e => {
      console.log(`❌ [账号 ${accountIdx}] 发生未捕获异常: ${e.message || e}`);
    });
  });

  await Promise.all(tasks);

  console.log(`\n================= 🎉 众安健康 执行完毕 =================`);
  $.done();
})();

/**
 * 核心任务逻辑
 */
function runTask(token, idx) {
  return new Promise((resolve) => {
    console.log(`\n▶️ [账号 ${idx}] 开始处理...`);
    const url = `https://api.iosxx.cn/zajkcx.php?token=${token}`;
    
    // 日志脱敏
    const safeUrl = url.replace(/(token=)(.{5}).*(.{5})/, "$1$2***$3");
    console.log(`[账号 ${idx}] 发起请求: ${safeUrl}`);

    const headers = {
      "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1",
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
    };

    $.get({ url, headers, timeout: 5000 }, (err, resp, data) => {
      let notifyMsg = "";
      
      if (err) {
        console.log(`[账号 ${idx}] ❌ 网络请求失败: ${JSON.stringify(err)}`);
        notifyMsg = `📡 网络请求超时或失败`;
      } else {
        const statusCode = resp ? (resp.status || resp.statusCode) : '未知';
        console.log(`[账号 ${idx}] 🌐 请求完成，HTTP状态码: ${statusCode}`);
        
        if (statusCode === 400) {
          console.log(`[账号 ${idx}] 🚫 Token无效 (HTTP 400)`);
          notifyMsg = `🚫 Token 无效 (HTTP 400)`;
        } else if (data) {
          console.log(`[账号 ${idx}] 📦 原始返回数据片段: ${data.substring(0, 200).replace(/\n/g, ' ')}...`);
          
          const lines = data.split('\n');
          let start = -1, end = -1;
          for (let i = 0; i < lines.length; i++) if (lines[i].includes("📝 任务处理结果")) start = i;
          for (let i = lines.length - 1; i >= 0; i--) if (lines[i].includes("💰 累计活动奖金")) { end = i; break; }

          if (start !== -1 && end !== -1) {
            notifyMsg = lines.slice(start, end + 1).join('\n');
          } else {
            notifyMsg = lines.filter(line => /📝|✅|🎁|💰|---/.test(line)).join('\n') || data.substring(0, 100);
          }
        }
      }

      console.log(`[账号 ${idx}] 🧾 最终解析文本:\n${notifyMsg}`);

      // 金额匹配逻辑
      let amount = 0;
      const withdrawMatch = notifyMsg.match(/(?:可提现金额)[:：]\s*([\d.]+)/);
      const amountMatch = notifyMsg.match(/(?:奖金|提现|金额)[:：]\s*([\d.]+)/);
      
      if (withdrawMatch) amount = parseFloat(withdrawMatch[1]);
      else if (amountMatch) amount = parseFloat(amountMatch[1]);

      if (amount >= 5) {
        $.msg(`🏥 众安健康 [账号 ${idx}]`, `💎 可提现金额达标: ${amount} 元`, `✨ 快去提现吧！\n${notifyMsg}`);
      } else if (notifyMsg.includes("🚫") || notifyMsg.includes("📡")) {
        $.msg(`🏥 众安健康 [账号 ${idx}]`, "🚨 脚本执行异常", notifyMsg);
      } else {
        console.log(`[账号 ${idx}] 💡 金额未达 5 元，不触发弹窗。`);
      }
      
      resolve();
    });
  });
}

// ================= 标准 Env 环境类 =================
function Env(t,e){"undefined"!=typeof process&&JSON.stringify(process.env).indexOf("GITHUB")>-1&&process.exit(0);class s{constructor(t){this.env=t}write(t,e){return this.env.setdata(t,e)}read(t,e){return this.env.getdata(t,e)}fetch(t){return new Promise((e,s)=>{this.env.get(t,(t,r,i)=>{e({error:t,response:r,body:i})})})}}return new class{constructor(t,e){this.name=t,this.http=new s(this),this.data=null,this.dataFile="box.dat",this.logs=[],this.isMute=!1,this.isNeedRewrite=!1,this.logSeparator="\n",this.startTime=(new Date).getTime(),Object.assign(this,e),this.log("",`🔔${this.name}, 开始!`)}isNode(){return"undefined"!=typeof module&&!!module.exports}isQuanX(){return"undefined"!=typeof $task}isSurge(){return"undefined"!=typeof $httpClient&&"undefined"==typeof $loon}isLoon(){return"undefined"!=typeof $loon}toObj(t,e=null){try{return JSON.parse(t)}catch{return e||t}}toStr(t,e=null){try{return JSON.stringify(t)}catch{return e||t}}getjson(t,e){let s=e;const r=this.getdata(t);if(r)try{s=JSON.parse(this.getdata(t))}catch{}return s}setjson(t,e){try{return this.setdata(JSON.stringify(t),e)}catch{return!1}}getScript(t){return new Promise(e=>{this.get({url:t},(t,s,r)=>e(r))})}runScript(t,e){return new Promise(s=>{let r=this.getdata("@chavy_boxjs_userCfgs.httpapi");r=r?r.replace(/\n/g,"").trim():r;let i=this.isSurge()?Object.keys($httpClient).length:0;r=this.isQuanX()||this.isLoon()&&i?r:null,this.getScript(t).then(t=>{this.setdata(t,"__chavy_tmp"),this.runScriptContent(t,e).then(t=>s(t))})})}runScriptContent(t,e){return new Promise(s=>{let r=this.getdata("@chavy_boxjs_userCfgs.httpapi");r=r?r.replace(/\n/g,"").trim():r;let i=this.isSurge()?Object.keys($httpClient).length:0;r=this.isQuanX()||this.isLoon()&&i?r:null;try{$=this,eval(t),s("")}catch(t){this.logErr(t),s("")}})}write(t,e){return this.setdata(t,e)}read(t,e){return this.getdata(t,e)}setdata(t,e){let s=!1;if(this.isSurge()||this.isLoon()){if($persistentStore.write(t,e))s=!0}else this.isNode()&&(this.data=this.loaddata(),this.data[e]=t,this.writedata(),s=!0);if(this.isQuanX()){if($prefs.setValueForKey(t,e))s=!0}return s}getdata(t){let e=null;if(this.isSurge()||this.isLoon())e=$persistentStore.read(t);else if(this.isQuanX())e=$prefs.valueForKey(t);else if(this.isNode()){this.data=this.loaddata(),e=this.data[t]}return e}loaddata(){return new Promise(t=>{let e={};if(this.isNode()){const s=require("fs"),r=require("path"),i=r.resolve(this.dataFile),o=r.resolve(process.cwd(),this.dataFile),n=s.existsSync(i),a=!n&&s.existsSync(o);if(!n&&!a)return;const h=n?i:o;try{e=JSON.parse(s.readFileSync(h))}catch{}}t(e)})}writedata(){if(this.isNode()){const t=require("fs"),e=require("path"),s=e.resolve(this.dataFile),r=e.resolve(process.cwd(),this.dataFile),i=t.existsSync(s),o=!i&&t.existsSync(r),n=i?s:r;t.writeFileSync(n,JSON.stringify(this.data))}}msg(t,e,s,r){if(this.isSurge()||this.isLoon())$notification.post(t,e,s,r);else if(this.isQuanX())$notify(t,e,s,r);else if(this.isNode()){const t=["","==============📣系统通知📣=============="];t.push(e),s&&t.push(s),console.log(t.join("\n"))}this.logs.push("",t,e,s)}log(...t){t.length>0&&(this.logs=[...this.logs,...t]),console.log(t.join(this.logSeparator))}logErr(t,e){const s=!this.isSurge()&&!this.isQuanX()&&!this.isLoon();s?this.log("",`❗️${this.name}, 错误!`,t.stack):this.log("",`❗️${this.name}, 错误!`,t)}wait(t){return new Promise(e=>setTimeout(e,t))}done(t={}){const e=(new Date).getTime(),s=(e-this.startTime)/1e3;this.log("",`🔔${this.name}, 结束! 🕛 ${s} 秒`),this.log(),(this.isSurge()||this.isQuanX()||this.isLoon())&&$done(t)}get(t,e){this.send(t,"GET",e)}post(t,e){this.send(t,"POST",e)}send(t,e,s){if(this.isSurge()||this.isLoon()){const r=$httpClient;r[e.toLowerCase()](t,(t,e,r)=>{!t&&e&&(e.body=r,e.statusCode=e.status),s(t,e,r)})}else this.isQuanX()&&(t.method=e,this.isNeedRewrite&&(t.opts=t.opts||{},Object.assign(t.opts,{hints:!1})),$task.fetch(t).then(t=>{const{statusCode:e,statusCode:r,headers:i,body:o}=t;s(null,{status:e,statusCode:r,headers:i,body:o},o)},t=>s(t)))}}(t,e)}
