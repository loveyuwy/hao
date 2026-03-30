const $ = new Env("VRKA 众安任务");

(async () => {
  // --- 1. 获取并处理多账号 Token ---
  let tokens = [];
  if (typeof $argument !== "undefined" && $argument) {
    // 按 # 分割并过滤掉空值和引号
    tokens = $argument.split("#")
      .map(t => t.trim().replace(/['" ]/g, ""))
      .filter(t => t !== "");
  }

  if (tokens.length === 0) {
    $.notify("VRKA 众安任务", "❌ 配置错误", "请先在模块设置中填入至少一个 Token");
    $.done();
    return;
  }

  console.log(`🚀 检测到 ${tokens.length} 个账号，开始执行...`);

  // 逐个账号执行（按顺序）
  for (let i = 0; i < tokens.length; i++) {
    const currentToken = tokens[i];
    const accountIdx = i + 1;
    console.log(`\n===== 开始处理账号 [${accountIdx}] =====`);
    
    try {
      await runTask(currentToken, accountIdx);
    } catch (e) {
      console.log(`❌ 账号 [${accountIdx}] 发生未知错误: ${e}`);
    }
    
    // 账号之间稍微停顿 1 秒，防止请求过快被拦截
    if (i < tokens.length - 1) await new Promise(r => setTimeout(r, 1000));
  }

  console.log(`\n✅ 所有任务执行完毕`);
  $.done();
})();

/**
 * 核心任务逻辑
 */
function runTask(token, idx) {
  return new Promise((resolve) => {
    const url = `https://api.iosxx.cn/zajkcx.php?token=${token}`;
    const headers = {
      "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1",
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
    };

    $.get({ url, headers, timeout: 20000 }, (err, resp, data) => {
      let notifyMsg = "";
      
      if (err) {
        notifyMsg = `❌ 账号 [${idx}] 请求失败\n${JSON.stringify(err)}`;
      } else if (resp.status === 400) {
        notifyMsg = `❌ 账号 [${idx}] Token 无效 (400)`;
      } else {
        // 截取逻辑
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

      console.log(`账号 [${idx}] 结果:\n${notifyMsg}`);

      // --- 金额判断 ---
      let amount = 0;
      const amountMatch = notifyMsg.match(/(?:奖金|提现|金额)[:：]\s*([\d.]+)/);
      if (amountMatch) amount = parseFloat(amountMatch[1]);

      if (amount >= 5) {
        $.notify(`众安任务 [账号${idx}]`, `💰 金额: ${amount}元`, notifyMsg);
      } else if (notifyMsg.includes("❌")) {
        $.notify(`众安任务 [账号${idx}]`, "⚠️ 执行报错", notifyMsg);
      } else {
        console.log(`💡 账号 [${idx}] 金额不足 5 元 (${amount}元)，不弹窗。`);
      }
      
      resolve();
    });
  });
}

// Env 函数（保持你原来脚本底部的 Env 不变，但建议包含 get/notify/done）
function Env(name) {
  const isSurge = typeof $httpClient !== "undefined";
  return {
    name,
    notify: (title, subtitle, message) => {
      if (isSurge) $notification.post(title, subtitle, message);
    },
    get: (options, callback) => {
      if (isSurge) $httpClient.get(options, callback);
    },
    done: (val) => {
      if (typeof $done !== "undefined") $done(val);
    }
  };
}
