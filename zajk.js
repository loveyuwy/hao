const $ = new Env("🏥 众安健康");

(async () => {
  console.log("\n================= 🚀 众安健康 开始执行 =================");
  let tokens = [];
  
  if (typeof $argument !== "undefined" && $argument) {
    let argStr = $argument.trim();
    console.log(`[环境检查] 获取到参数: ${argStr}`);

    // 自动兼容 Loon 的 [t1,t2] 格式和 Surge 的 t1#t2 格式
    if (argStr.startsWith("[") && argStr.endsWith("]")) {
      console.log(`[解析模式] 检测到 Loon 列表格式`);
      tokens = argStr.substring(1, argStr.length - 1)
        .split(",")
        .map(t => t.trim().replace(/['" ]/g, ""))
        .filter(t => t !== "" && !t.includes("{TOKEN")); // 过滤掉未填写的占位符
    } else {
      console.log(`[解析模式] 检测到标准分隔符 (#) 格式`);
      tokens = argStr.split("#")
        .map(t => t.trim().replace(/['" ]/g, ""))
        .filter(t => t !== "");
    }
  }

  if (tokens.length === 0) {
    console.log(`[配置错误] 未检测到有效 Token，请在插件参数中填写。`);
    // 增加一个延时确保日志输出
    await new Promise(r => setTimeout(r, 500));
    $.done();
    return;
  }

  console.log(`[任务准备] 解析成功，检测到 ${tokens.length} 个账号，开始执行...`);

  const tasks = tokens.map((token, i) => {
    const accountIdx = i + 1;
    return runTask(token, accountIdx).catch(e => {
      console.log(`❌ [账号 ${accountIdx}] 异常: ${e.message || e}`);
    });
  });

  await Promise.all(tasks);

  console.log(`\n================= 🎉 众安健康 执行完毕 =================`);
  // 稍微延迟结束，防止 Loon 日志截断
  setTimeout(() => { $.done(); }, 500);
})();

function runTask(token, idx) {
  return new Promise((resolve) => {
    console.log(`\n▶️ [账号 ${idx}] 开始处理...`);
    const url = `https://api.iosxx.cn/zajkcx.php?token=${token}`;
    const safeUrl = url.replace(/(token=)(.{5}).*(.{5})/, "$1$2***$3");
    
    const headers = {
      "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1",
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
    };

    $.get({ url, headers, timeout: 5000 }, (err, resp, data) => {
      let notifyMsg = "";
      if (err) {
        notifyMsg = `📡 网络请求失败`;
      } else {
        const statusCode = resp ? (resp.status || resp.statusCode) : '未知';
        if (statusCode === 400) {
          notifyMsg = `🚫 Token 无效 (400)`;
        } else if (data) {
          // 简易解析逻辑
          const lines = data.split('\n');
          notifyMsg = lines.filter(line => /账号|奖励金|提现|金额|📝|✅|💰/.test(line)).join('\n') || data.substring(0, 100);
        } else {
          notifyMsg = `📭 接口返回为空`;
        }
      }

      console.log(`[账号 ${idx}] 解析结果:\n${notifyMsg}`);

      // 金额匹配
      let amount = 0;
      const amountMatch = notifyMsg.match(/(?:可提现金额|金额)[:：]\s*([\d.]+)/);
      if (amountMatch) amount = parseFloat(amountMatch[1]);

      if (amount >= 5) {
        $.notify(`🏥 众安 [账号 ${idx}]`, `💎 可提现: ${amount} 元`, notifyMsg);
      } else if (notifyMsg.includes("🚫") || notifyMsg.includes("📡")) {
        $.notify(`🏥 众安 [账号 ${idx}]`, "🚨 脚本异常", notifyMsg);
      }
      resolve();
    });
  });
}

/**
 * 兼容性环境构造
 */
function Env(name) {
  const isSurge = typeof $notification !== "undefined" && typeof $httpClient !== "undefined" && typeof $loon === "undefined";
  const isLoon = typeof $loon !== "undefined" || (typeof $httpClient !== "undefined" && !isSurge);
  const isQuanX = typeof $task !== "undefined";

  return {
    name,
    notify: (title, subtitle, message) => {
      if (isSurge || isLoon) $notification.post(title, subtitle, message);
      if (isQuanX) $notify(title, subtitle, message);
    },
    get: (options, callback) => {
      if (isSurge || isLoon) $httpClient.get(options, callback);
      if (isQuanX) {
        if (typeof options == "string") options = { url: options };
        options["method"] = "GET";
        $task.fetch(options).then(resp => {
          resp["status"] = resp.statusCode;
          callback(null, resp, resp.body);
        }, err => callback(err.error, null, null));
      }
    },
    done: (val) => {
      if (typeof $done !== "undefined") $done(val);
    }
  };
}
