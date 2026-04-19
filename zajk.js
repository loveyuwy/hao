const $ = new Env("🏥 众安健康");

(async () => {
  console.log("\n================= 🚀 众安健康 开始执行 =================");
  let tokens = [];
  
  // 1. 详细打印参数，方便排查
  if (typeof $argument !== "undefined" && $argument) {
    let argStr = $argument.trim();
    console.log(`[环境检查] 原始参数内容: ${argStr}`);

    if (argStr.startsWith("[") && argStr.endsWith("]")) {
      console.log(`[解析模式] 检测到 Loon 列表格式`);
      tokens = argStr.substring(1, argStr.length - 1)
        .split(",")
        .map(t => t.trim().replace(/['" ]/g, ""))
        // 过滤掉：空字符串、未填写的占位符、以及 Loon 默认生成的 {TOKENx}
        .filter(t => t !== "" && !t.includes("{TOKEN") && !t.includes("input"));
    } else {
      console.log(`[解析模式] 检测到标准分隔符 (#) 格式`);
      tokens = argStr.split("#")
        .map(t => t.trim().replace(/['" ]/g, ""))
        .filter(t => t !== "");
    }
  } else {
    console.log(`[环境检查] 未获取到 $argument 参数`);
  }

  // 2. 如果没解析到 Token，给个提示并结束
  if (tokens.length === 0) {
    console.log(`[配置错误] 解析后未发现有效 Token！`);
    console.log(`💡 请检查 Loon 插件设置中的 TOKEN1-5 是否已填入内容。`);
    // 延迟 500ms 确保日志在 Loon 中能打印出来
    await new Promise(r => setTimeout(r, 500));
    $.done();
    return;
  }

  console.log(`[任务准备] 解析成功，检测到 ${tokens.length} 个账号，开始并发执行...`);

  const startTime = Date.now();
  const tasks = tokens.map((token, i) => runTask(token, i + 1));

  await Promise.all(tasks);

  console.log(`\n================= 🎉 执行完毕 (耗时: ${(Date.now() - startTime) / 1000}s) =================`);
  
  // 强制给 Loon 留一点刷日志的时间
  setTimeout(() => { $.done(); }, 500);
})();

function runTask(token, idx) {
  return new Promise((resolve) => {
    const start = Date.now();
    const url = `https://api.iosxx.cn/zajkcx.php?token=${token}`;
    
    // Loon/Surge 统一使用 $httpClient
    $.get({ url, timeout: 5000 }, (err, resp, data) => {
      const elapsed = (Date.now() - start) / 1000;
      let notifyMsg = "";

      if (err) {
        console.log(`[账号 ${idx}] ❌ 请求失败 (${elapsed}s): ${JSON.stringify(err)}`);
        notifyMsg = `📡 网络请求失败`;
      } else {
        const statusCode = resp ? (resp.status || resp.statusCode) : '未知';
        if (statusCode == 200 && data) {
          const lines = data.split('\n');
          notifyMsg = lines.filter(line => /账号|奖励金|提现|金额|📝|✅|💰/.test(line)).join('\n');
        } else {
          notifyMsg = `🚫 接口异常 (状态码: ${statusCode})`;
        }
      }

      console.log(`[账号 ${idx}] 解析结果 (${elapsed}s):\n${notifyMsg}`);

      let amount = 0;
      const amountMatch = notifyMsg.match(/(?:可提现金额|金额)[:：]\s*([\d.]+)/);
      if (amountMatch) amount = parseFloat(amountMatch[1]);

      if (amount >= 5) {
        $.notify(`🏥 众安 [账号 ${idx}]`, `💎 可提现: ${amount} 元`, notifyMsg);
      }
      resolve();
    });
  });
}

function Env(name) {
  const isSurge = typeof $notification !== "undefined" && typeof $httpClient !== "undefined" && typeof $loon === "undefined";
  const isLoon = typeof $loon !== "undefined" || (typeof $httpClient !== "undefined" && !isSurge);
  const isQuanX = typeof $task !== "undefined";

  return {
    name,
    notify: (t, s, m) => {
      if (isSurge || isLoon) $notification.post(t, s, m);
      if (isQuanX) $notify(t, s, m);
    },
    get: (opts, cb) => {
      if (isSurge || isLoon) $httpClient.get(opts, cb);
      if (isQuanX) {
        if (typeof opts == "string") opts = { url: opts };
        opts["method"] = "GET";
        $task.fetch(opts).then(r => { r["status"] = r.statusCode; cb(null, r, r.body); }, e => cb(e.error, null, null));
      }
    },
    done: (v) => { if (typeof $done !== "undefined") $done(v); }
  };
}
