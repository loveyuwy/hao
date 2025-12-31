/*
脚本名称：今日油价 (最终完美版)
脚本作者：Grok
功能描述：每日查询油价，支持 Surge 模块 UI 参数编辑。
更新说明：增加参数智能纠错、超时保护、静默模式支持。

[Surge 模块参数说明]
argument=province=北京&silent=#
*/

const $ = new Env("今日油价");

// --- 1. 参数解析与智能纠错 ---
let province = "北京"; // 默认兜底
let isSilent = false;

if (typeof $argument !== "undefined" && $argument) {
  const args = $argument.trim();
  
  // A. 优先处理 Surge 传参失败的情况 (即传入了 literal 字符串)
  if (args.includes("{province}") || args.includes("province=") === false) {
      console.log(`⚠️ 检测到配置未被替换 (Raw: ${args})，已自动修正为默认：北京`);
      province = "北京"; // 强制兜底，保证能跑
  } 
  // B. 正常解析参数
  else {
    const params = {};
    args.split("&").forEach((item) => {
      const [key, val] = item.split("=");
      if (key && val) params[key.trim()] = val.trim();
    });

    if (params.province) province = decodeURIComponent(params.province);
    
    // 静默判断：包含 # 号即静默
    if (params.silent && params.silent.includes("#")) {
        isSilent = true;
    }
  }
}

const apiUrl = `https://api.iosxx.cn/API/yjcx.php?province=${encodeURIComponent(province)}&format=text`;

!(async () => {
  // ⏳ 20秒超时竞速，防止脚本卡死
  const timeoutPromise = new Promise((_, reject) => 
    setTimeout(() => reject("请求超时 (20s)"), 20000)
  );
  await Promise.race([getOilPrice(), timeoutPromise]);
})()
  .catch((e) => {
    console.log(`❌ 运行错误: ${e}`);
    if (!isSilent) $.msg("今日油价", "❌ 查询失败", String(e));
  })
  .finally(() => {
    $.done();
  });

function getOilPrice() {
  return new Promise((resolve, reject) => {
    $.get({ url: apiUrl }, (error, response, data) => {
      if (error) { reject("网络请求失败"); return; }
      if (!data || data.length < 5) { reject("接口返回数据为空"); return; }

      try {
        // 数据清洗：去除多余空格和换行
        let text = data.replace(/\s+/g, " ");
        
        // 正则提取：匹配 "92号" 或 "92#"
        const getPrice = (type) => {
            const reg = new RegExp(`${type}[#号][^\\d]*(\\d+\\.\\d+)`);
            const match = text.match(reg);
            return match ? match[1] : null;
        };

        const p92 = getPrice("92");
        const p95 = getPrice("95");
        const p98 = getPrice("98");
        const p0  = getPrice("0");

        // 提取预测信息
        let tips = "";
        const tipMatch = text.match(/预测提示[:：]?\s*(.*)/);
        if (tipMatch) {
            tips = tipMatch[1].split("，")[0].replace("大家相互转告", ""); 
        }

        let lines = [];
        if (p92) lines.push(`⛽️ 92号: ${p92} 元/升`);
        if (p95) lines.push(`⛽️ 95号: ${p95} 元/升`);
        if (p98) lines.push(`🏎️ 98号: ${p98} 元/升`);
        if (p0)  lines.push(`🚜 0号柴: ${p0} 元/升`);

        // 数据完整性检查
        if (lines.length === 0) {
             if (tips) {
                 lines.push(tips); // 只有预测也能发
             } else {
                 reject("未匹配到有效油价数据"); 
                 return;
             }
        } else {
            if (tips) {
                lines.push(""); // 空行分隔
                tips = tips.replace("目前", "\n📈 ").replace("下次", "🗓️ 下次");
                lines.push(tips);
            }
        }

        const body = lines.join("\n");
        console.log(`✅ 查询成功 (省份:${province}, 静默:${isSilent})\n${body}`);
        
        if (!isSilent) {
            $.msg(`今日油价 · ${province}`, `📅 ${new Date().toLocaleDateString()}`, body);
        } else {
            console.log("🔕 静默模式：已跳过通知");
        }
        resolve();

      } catch (err) {
        reject(`数据解析异常: ${err}`);
      }
    });
  });
}

// 通用 Env 工具
function Env(name){return new(class{constructor(name){this.name=name;this.isSurge=typeof $httpClient!=="undefined"&&typeof $loon==="undefined";this.isLoon=typeof $loon!=="undefined";this.isQX=typeof $task!=="undefined"}get(options,callback){if(this.isQX){if(typeof options==="string")options={url:options};options.method="GET";$task.fetch(options).then(r=>callback(null,r,r.body),e=>callback(e.error,null,null))}else{$httpClient.get(options,(e,r,b)=>callback(e,r,b))}}msg(t,s,b){if(this.isSurge||this.isLoon)$notification.post(t,s,b);if(this.isQX)$notify(t,s,b);console.log(`${t}\n${s}\n${b}`)}done(v={}){if(typeof $done!=="undefined")$done(v)}})(name)}
