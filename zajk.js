const $ = new Env("🏥 众安健康");

(async () => {
  let tokens = [];
  const arg = typeof $argument !== 'undefined' ? $argument : "";

  if (arg) {
    if (typeof arg === 'object') {
      const rawValues = Array.isArray(arg) ? arg : Object.values(arg);
      tokens = rawValues.map(v => String(v).trim());
    } else if (typeof arg === 'string') {
      tokens = arg.replace(/[\[\]]/g, "").split(/[#,]/);
    }
  }

  tokens = tokens
    .map(t => t.replace(/['" ]/g, ""))
    .filter(t => t !== "" && t !== "null" && t !== "undefined" && !t.includes("object Object"));

  if (tokens.length === 0) {
    $.msg($.name, "❌ 配置错误", "请先在配置中填入至少一个 Token");
    $.done();
    return;
  }

  console.log(`🏥 ${$.name}: 检测到 ${tokens.length} 个账号，开始顺序执行...`);

  for (let i = 0; i < tokens.length; i++) {
    const accountIdx = i + 1;
    console.log(`\n--- 开始处理账号 [${accountIdx}] ---`);
    try {
      await runTask(tokens[i], accountIdx);
    } catch (e) {
      console.log(`❌ [账号 ${accountIdx}] 运行异常: ${e.message || e}`);
    }
    
    if (i < tokens.length - 1) {
      const waitTime = Math.floor(Math.random() * 3000) + 2000;
      console.log(`等待 ${waitTime/1000} 秒后继续...`);
      await $.wait(waitTime);
    }
  }

  $.done();
})();

function runTask(token, idx) {
  return new Promise((resolve) => {
    const url = `https://api.iosxx.cn/zajkcx.php?token=${token}`;
    const headers = {
      "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1",
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
    };

    $.get({ url, headers, timeout: 15000 }, (err, resp, data) => {
      let notifyMsg = "";
      if (err) {
        notifyMsg = `📡 网络请求失败，可能接口超时`;
        console.log(`[账号 ${idx}] 错误: ${err}`);
      } else {
        const statusCode = resp ? (resp.status || resp.statusCode) : '未知';
        if (statusCode === 400) {
          notifyMsg = `🚫 Token 无效 (HTTP 400)`;
        } else if (data) {
          console.log(`[账号 ${idx}] 返回结果: \n${data}`);
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

      let amount = 0;
      const amountMatch = notifyMsg.match(/(?:金额|奖金)[:：]\s*([\d.]+)/);
      if (amountMatch) amount = parseFloat(amountMatch[1]);

      if (amount >= 5) {
        $.msg(`${$.name} [账号 ${idx}]`, `💎 可提现金额: ${amount} 元`, `✨ 达标啦！\n${notifyMsg}`);
      } else if (notifyMsg.includes("🚫") || notifyMsg.includes("📡")) {
        $.msg(`${$.name} [账号 ${idx}]`, "🚨 运行异常", notifyMsg);
      }
      
      resolve();
    });
  });
}

function Env(t,e){"undefined"!=typeof process&&JSON.stringify(process.env).indexOf("GITHUB")>-1&&process.exit(0);class s{constructor(t){this.env=t}write(t,e){return this.env.setdata(t,e)}read(t,e){return this.env.getdata(t,e)}fetch(t){return new Promise((e,s)=>{this.env.get(t,(t,r,i)=>{e({error:t,response:r,body:i})})})}}return new class{constructor(t,e){this.name=t,this.http=new s(this),this.data=null,this.dataFile="box.dat",this.logs=[],this.isMute=!1,this.isNeedRewrite=!1,this.logSeparator="\n",this.startTime=(new Date).getTime(),Object.assign(this,e)}isNode(){return"undefined"!=typeof module&&!!module.exports}isQuanX(){return"undefined"!=typeof $task}isSurge(){return"undefined"!=typeof $httpClient&&"undefined"==typeof $loon}isLoon(){return"undefined"!=typeof $loon}toObj(t,e=null){try{return JSON.parse(t)}catch{return e||t}}toStr(t,e=null){try{return JSON.stringify(t)}catch{return e||t}}getjson(t,e){let s=e;const r=this.getdata(t);if(r)try{s=JSON.parse(this.getdata(t))}catch{}return s}setjson(t,e){try{return this.setdata(JSON.stringify(t),e)}catch{return!1}}getScript(t){return new Promise(e=>{this.get({url:t},(t,s,r)=>e(r))})}runScript(t,e){return new Promise(s=>{let r=this.getdata("@chavy_boxjs_userCfgs.httpapi");r=r?r.replace(/\n/g,"").trim():r;let i=this.isSurge()?Object.keys($httpClient).length:0;r=this.isQuanX()||this.isLoon()&&i?r:null,this.getScript(t).then(t=>{this.setdata(t,"__chavy_tmp"),this.runScriptContent(t,e).then(t=>s(t))})})}runScriptContent(t,e){return new Promise(s=>{let r=this.getdata("@chavy_boxjs_userCfgs.httpapi");r=r?r.replace(/\n/g,"").trim():r;let i=this.isSurge()?Object.keys($httpClient).length:0;r=this.isQuanX()||this.isLoon()&&i?r:null;try{$=this,eval(t),s("")}catch(t){this.logErr(t),s("")}})}write(t,e){return this.setdata(t,e)}read(t,e){return this.getdata(t,e)}setdata(t,e){let s=!1;if(this.isSurge()||this.isLoon()){if($persistentStore.write(t,e))s=!0}else this.isNode()&&(this.data=this.loaddata(),this.data[e]=t,this.writedata(),s=!0);if(this.isQuanX()){if($prefs.setValueForKey(t,e))s=!0}return s}getdata(t){let e=null;if(this.isSurge()||this.isLoon())e=$persistentStore.read(t);else if(this.isQuanX())e=$prefs.valueForKey(t);else if(this.isNode()){this.data=this.loaddata(),e=this.data[t]}return e}loaddata(){return new Promise(t=>{let e={};if(this.isNode()){const s=require("fs"),r=require("path"),i=r.resolve(this.dataFile),o=r.resolve(process.cwd(),this.dataFile),n=s.existsSync(i),a=!n&&s.existsSync(o);if(!n&&!a)return;const h=n?i:o;try{e=JSON.parse(s.readFileSync(h))}catch{}}t(e)})}writedata(){if(this.isNode()){const t=require("fs"),e=require("path"),s=e.resolve(this.dataFile),r=e.resolve(process.cwd(),this.dataFile),i=t.existsSync(s),o=!i&&t.existsSync(r),n=i?s:r;t.writeFileSync(n,JSON.stringify(this.data))}}msg(t,e,s,r){if(this.isSurge()||this.isLoon())$notification.post(t,e,s,r);else if(this.isQuanX())$notify(t,e,s,r);else if(this.isNode()){console.log(e);if(s)console.log(s)}this.logs.push("",t,e,s)}log(...t){t.length>0&&(this.logs=[...this.logs,...t]),console.log(t.join(this.logSeparator))}logErr(t,e){const s=!this.isSurge()&&!this.isQuanX()&&!this.isLoon();s?this.log("",`❗️${this.name}, 错误!`,t.stack):this.log("",`❗️${this.name}, 错误!`,t)}wait(t){return new Promise(e=>setTimeout(e,t))}done(t={}){const e=(new Date).getTime(),s=(e-this.startTime)/1e3;this.log("",`🔔${this.name}, 结束! 🕛 ${s} 秒`),this.log(),(this.isSurge()||this.isQuanX()||this.isLoon())&&$done(t)}get(t,e){this.send(t,"GET",e)}post(t,e){this.send(t,"POST",e)}send(t,e,s){if(this.isSurge()||this.isLoon()){const r=$httpClient;r[e.toLowerCase()](t,(t,e,r)=>{!t&&e&&(e.body=r,e.statusCode=e.status),s(t,e,r)})}else this.isQuanX()&&(t.method=e,this.isNeedRewrite&&(t.opts=t.opts||{},Object.assign(t.opts,{hints:!1})),$task.fetch(t).then(t=>{const{statusCode:e,statusCode:r,headers:i,body:o}=t;s(null,{status:e,statusCode:r,headers:i,body:o},o)},t=>s(t)))}}(t,e)}
