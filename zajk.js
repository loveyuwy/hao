const $ = new Env("🏥 众安健康");

(async () => {
  console.log("\n================= 🚀 众安健康 开始执行 =================");
  let tokens = [];
  
  if (typeof $argument !== "undefined" && $argument) {
    console.log(`[环境检查] 成功获取到 $argument，开始解析...`);
    tokens = $argument.split("#")
      .map(t => t.trim().replace(/['" ]/g, ""))
      .filter(t => t !== "");
  } else {
    console.log(`[环境检查] 未获取到 $argument 或其值为空！`);
  }

  if (tokens.length === 0) {
    console.log(`[配置错误] 未检测到任何 Token，请在模块/重写设置中填入参数。`);
    $.notify("🏥 众安健康", "❌ 配置错误", "请先在模块设置中填入至少一个 Token");
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
        notifyMsg = `📡 网络请求超时或失败\n${JSON.stringify(err)}`;
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
            console.log(`[账号 ${idx}] ✂️ 成功截取关键通知文本。`);
          } else {
            console.log(`[账号 ${idx}] ⚠️ 未匹配到设定的起始/结束标记，尝试回退解析方式。`);
            notifyMsg = lines.filter(line => /📝|✅|🎁|💰|---/.test(line)).join('\n') || data.substring(0, 100);
          }
        } else {
          console.log(`[账号 ${idx}] 📭 接口返回数据为空(data is null/undefined)`);
          notifyMsg = `📭 接口返回数据为空`;
        }
      }

      console.log(`[账号 ${idx}] 🧾 最终解析文本:\n${notifyMsg}`);

      let amount = 0;
      const withdrawMatch = notifyMsg.match(/(?:可提现金额)[:：]\s*([\d.]+)/);
      const amountMatch = notifyMsg.match(/(?:奖金|提现|金额)[:：]\s*([\d.]+)/);
      
      if (withdrawMatch) {
        amount = parseFloat(withdrawMatch[1]);
        console.log(`[账号 ${idx}] 🔍 正则匹配到 [可提现金额]: ${amount}`);
      } else if (amountMatch) {
        amount = parseFloat(amountMatch[1]);
        console.log(`[账号 ${idx}] 🔍 正则备用匹配到 [金额]: ${amount}`);
      } else {
        console.log(`[账号 ${idx}] 🔍 正则未匹配到任何金额数据。`);
      }

      if (amount >= 5) {
        console.log(`[账号 ${idx}] 🔔 触发弹窗：金额达标 (${amount}元 >= 5元)`);
        $.notify(`🏥 众安健康 [账号 ${idx}]`, `💎 可提现金额达标: ${amount} 元`, `✨ 快去提现吧！\n\n${notifyMsg}`);
      } else if (notifyMsg.includes("🚫") || notifyMsg.includes("📡") || notifyMsg.includes("📭")) {
        console.log(`[账号 ${idx}] 🔔 触发弹窗：脚本执行异常`);
        $.notify(`🏥 众安健康 [账号 ${idx}]`, "🚨 脚本执行异常", notifyMsg);
      } else {
        console.log(`[账号 ${idx}] 💡 静默运行：提现金额不足 5 元 (当前: ${amount}元)，不弹窗。`);
      }
      
      resolve();
    });
  });
}

function Env(name) {
  const isSurge = typeof $httpClient !== "undefined";
  const isQuanX = typeof $task !== "undefined";
  return {
    name,
    notify: (title, subtitle, message) => {
      if (isSurge) $notification.post(title, subtitle, message);
      if (isQuanX) $notify(title, subtitle, message);
    },
    get: (options, callback) => {
      if (isSurge) $httpClient.get(options, callback);
      if (isQuanX) {
        if (typeof options == "string") options = { url: options };
        options["method"] = "GET";
        $task.fetch(options).then(
          response => {
            response["status"] = response.statusCode;
            callback(null, response, response.body);
          },
          reason => callback(reason.error, null, null)
        );
      }
    },
    done: (val) => {
      if (typeof $done !== "undefined") $done(val);
    }
  };
}
