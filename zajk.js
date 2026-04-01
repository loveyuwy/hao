const $ = new Env("🏥 众安任务");

(async () => {
  let tokens = [];
  if (typeof $argument !== "undefined" && $argument) {
    tokens = $argument.split("#")
      .map(t => t.trim().replace(/['" ]/g, ""))
      .filter(t => t !== "");
  }

  if (tokens.length === 0) {
    $.notify("🏥 众安任务", "❌ 配置错误", "请先在模块设置中填入至少一个 Token");
    $.done();
    return;
  }

  console.log(`🚀 检测到 ${tokens.length} 个账号，开始并发执行...`);

  const tasks = tokens.map((token, i) => {
    const accountIdx = i + 1;
    return runTask(token, accountIdx).catch(e => {
      console.log(`❌ 账号 [${accountIdx}] 发生未知错误: ${e}`);
    });
  });

  await Promise.all(tasks);

  console.log(`\n🎉 所有任务执行完毕`);
  $.done();
})();

/**
 * 核心任务逻辑
 */
function runTask(token, idx) {
  return new Promise((resolve) => {
    console.log(`▶️ 开始处理账号 [${idx}] ...`);
    const url = `https://api.iosxx.cn/zajkcx.php?token=${token}`;
    const headers = {
      "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1",
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
    };

    $.get({ url, headers, timeout: 4500 }, (err, resp, data) => {
      let notifyMsg = "";
      
      if (err) {
        notifyMsg = `📡 网络请求超时或失败\n${JSON.stringify(err)}`;
      } else if (resp && resp.status === 400) {
        notifyMsg = `🚫 Token 无效 (HTTP 400)`;
      } else if (data) {
        const lines = data.split('\n');
        let start = -1, end = -1;
        for (let i = 0; i < lines.length; i++) if (lines[i].includes("📝 任务处理结果")) start = i;
        for (let i = lines.length - 1; i >= 0; i--) if (lines[i].includes("💰 累计活动奖金")) { end = i; break; }

        if (start !== -1 && end !== -1) {
          notifyMsg = lines.slice(start, end + 1).join('\n');
        } else {
          notifyMsg = lines.filter(line => /📝|✅|🎁|💰|---/.test(line)).join('\n') || data.substring(0, 100);
        }
      } else {
        notifyMsg = `📭 接口返回数据为空`;
      }

      console.log(`🧾 账号 [${idx}] 结果:\n${notifyMsg}`);

      let amount = 0;
      // 兼容你的日志：优先匹配“可提现金额”，如果没有再匹配其他
      const withdrawMatch = notifyMsg.match(/(?:可提现金额)[:：]\s*([\d.]+)/);
      const amountMatch = notifyMsg.match(/(?:奖金|提现|金额)[:：]\s*([\d.]+)/);
      
      if (withdrawMatch) {
        amount = parseFloat(withdrawMatch[1]);
      } else if (amountMatch) {
        amount = parseFloat(amountMatch[1]);
      }

      if (amount >= 5) {
        $.notify(`🏥 众安任务 [账号 ${idx}]`, `💎 可提现金额达标: ${amount} 元`, `✨ 快去提现吧！\n\n${notifyMsg}`);
      } else if (notifyMsg.includes("🚫") || notifyMsg.includes("📡") || notifyMsg.includes("📭")) {
        // 请求失败或报错时弹窗提示
        $.notify(`🏥 众安任务 [账号 ${idx}]`, "🚨 脚本执行异常", notifyMsg);
      } else {
        console.log(`💡 账号 [${idx}] 提现金额不足 5 元 (当前: ${amount}元)，静默不弹窗。`);
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
