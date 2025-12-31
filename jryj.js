/*
脚本名称：今日油价 (V8 调试版)
更新说明：增加参数透视日志，精准排查 Surge 参数传递问题。
*/

const $ = new Env("今日油价");

// --- 🔍 调试日志：看看到底收到了什么 ---
const rawArgs = (typeof $argument !== "undefined") ? $argument : "无参数";
console.log(`\n🛑 [调试信息] Surge 传入的原始参数: ${rawArgs}\n`);

// --- 参数解析 ---
let province = "广东";
let isSilent = false;

if (typeof $argument !== "undefined" && $argument) {
  const args = $argument.trim();
  
  // 1. 检查是否依然是花括号变量 (说明模块替换失败)
  if (args.includes("{province}") || args.includes("{silent}")) {
      console.log("⚠️ 警告: 参数未被 Surge 替换，检测到冲突配置！请删除 [脚本] 列表里的旧条目！");
      // 强行修正以便脚本能跑
      province = "北京"; 
  } 
  // 2. 正常解析 key=value
  else if (args.includes("=")) {
    const params = {};
    args.split("&").forEach((item) => {
      const [key, val] = item.split("=");
      if (key && val) params[key.trim()] = val.trim();
    });

    if (params.province) province = decodeURIComponent(params.province);
    
    // 🤫 静默判断逻辑：只要检测到 # 号，就开启静默
    if (params.silent && params.silent.includes("#")) {
        isSilent = true;
        console.log("🔕 检测到 # 号，已开启静默模式");
    }
  } 
  // 3. 兼容旧版
  else if (args) {
      province = args;
  }
}

const apiUrl = `https://api.iosxx.cn/API/yjcx.php?province=${encodeURIComponent(province)}&format=text`;

!(async () => {
  // ⏳ 超时保护 (20s)
  const timeoutPromise = new Promise((_, reject) => 
    setTimeout(() => reject("请求超时(20s)"), 20000)
  );
  await Promise.race([getOilPrice(), timeoutPromise]);
})()
  .catch((e) => {
    console.log(`❌ 错误: ${e}`);
    if (!isSilent) $.msg("今日油价", "❌ 失败", String(e));
  })
  .finally(() => {
    $.done();
  });

function getOilPrice() {
  return new Promise((resolve, reject) => {
    $.get({ url: apiUrl }, (error, response, data) => {
      if (error) { reject("网络请求失败"); return; }
      if (!data || data.length < 5) { reject("接口数据为空"); return; }

      try {
        let text = data.replace(/\s+/g, " ");
        
        const getPrice = (type) => {
            const reg = new RegExp(`${type}[#号][^\\d]*(\\d+\\.\\d+)`);
            const match = text.match(reg);
            return match ? match[1] : null;
        };

        const p92 = getPrice("92");
        const p95 = getPrice("95");
        const p98 = getPrice("98");
        const p0  = getPrice("0");

        let tips = "";
        const tipMatch = text.match(/预测提示[:：]?\s*(.*)/);
        if (tipMatch) tips = tipMatch[1].split("，")[0].replace("大家相互转告", ""); 

        let lines = [];
        if (p92) lines.push(`⛽️ 92号: ${p92} 元/升`);
        if (p95) lines.push(`⛽️ 95号: ${p95} 元/升`);
        if (p98) lines.push(`🏎️ 98号: ${p98} 元/升`);
        if (p0)  lines.push(`🚜 0号柴: ${p0} 元/升`);

        // 如果没拿到油价，可能是省份名字不对 (比如 '北京' 写成了 '北京市')
        if (lines.length === 0) {
             if(tips) lines.push(tips);
             else { reject("未匹配到数据，请检查省份名称是否正确"); return; }
        } else {
            if (tips) {
                lines.push(""); 
                tips = tips.replace("目前", "\n📈 ").replace("下次", "🗓️ 下次");
                lines.push(tips);
            }
        }

        const body = lines.join("\n");
        console.log(`✅ 查询成功 (省份:${province})\n内容:\n${body}`);
        
        if (!isSilent) {
            $.msg(`今日油价 · ${province}`, `📅 ${new Date().toLocaleDateString()}`, body);
        } else {
            console.log("🔕 静默模式生效：未发送通知");
        }
        resolve();

      } catch (err) {
        reject(`解析错误: ${err}`);
      }
    });
  });
}

function Env(name){return new(class{constructor(name){this.name=name;this.isSurge=typeof $httpClient!=="undefined"&&typeof $loon==="undefined";this.isLoon=typeof $loon!=="undefined";this.isQX=typeof $task!=="undefined"}get(options,callback){if(this.isQX){if(typeof options==="string")options={url:options};options.method="GET";$task.fetch(options).then(r=>callback(null,r,r.body),e=>callback(e.error,null,null))}else{$httpClient.get(options,(e,r,b)=>callback(e,r,b))}}msg(t,s,b){if(this.isSurge||this.isLoon)$notification.post(t,s,b);if(this.isQX)$notify(t,s,b);console.log(`${t}\n${s}\n${b}`)}done(v={}){if(typeof $done!=="undefined")$done(v)}})(name)}
