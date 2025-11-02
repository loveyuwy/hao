// 名称: 增强版代理工具更新检测
// 描述: 代理工具更新检测脚本
// 版本: 夏天专用
 
const appList = [
  // 代理工具
  {
    name: "Shadowrocket",
    bundleId: "com.liguangming.Shadowrocket",
    icon: "🚀",
    category: "代理工具"
  },
  {
    name: "Surge",
    bundleId: "com.nssurge.inc.surge-ios",
    icon: "⚡️",
    category: "代理工具",
    // 使用备用 bundleId 提高成功率
    fallbackUrl: "https://itunes.apple.com/hk/lookup?bundleId=com.nssurge.inc.surge"
  },
  {
    name: "Loon",
    bundleId: "com.ruikq.decar",
    icon: "🎈",
    category: "代理工具",
    fallbackUrl: "https://itunes.apple.com/hk/lookup?bundleId=com.ruikq.decar" 
  }
];

// 增强版请求函数 - 优化超时和错误处理
async function enhancedFetch(app) {
  const isSurge = app.name === "Surge";
  
  // 为 Surge 添加备用 bundleId
  const surgeAlternativeBundleId = "com.nssurge.inc.surge";
  
  let urls;
  
  if (isSurge) {
    // Surge 特殊处理：尝试多个 bundleId
    urls = [
      `https://itunes.apple.com/hk/lookup?bundleId=${app.bundleId}`,
      `https://itunes.apple.com/hk/lookup?bundleId=${surgeAlternativeBundleId}`,
      `https://itunes.apple.com/cn/lookup?bundleId=${app.bundleId}`,
      `https://itunes.apple.com/cn/lookup?bundleId=${surgeAlternativeBundleId}`,
      `https://itunes.apple.com/us/lookup?bundleId=${app.bundleId}`,
      `https://itunes.apple.com/us/lookup?bundleId=${surgeAlternativeBundleId}`
    ];
  } else {
    urls = [
      app.fallbackUrl || `https://itunes.apple.com/lookup?bundleId=${app.bundleId}`,
      `https://itunes.apple.com/cn/lookup?bundleId=${app.bundleId}`,
      `https://itunes.apple.com/us/lookup?bundleId=${app.bundleId}`
    ];
  }
  
  let lastError;
  
  for (const [index, url] of urls.entries()) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000); // 4秒超时
      
      // 增加请求间隔，避免被限流
      if (index > 0) {
        await new Promise(resolve => setTimeout(resolve, 300 + Math.random() * 300));
      }
      
      const response = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);
      
      if (response.status === 200) {
        const data = await response.json();
        if (data.results && data.results.length > 0) {
          const version = data.results[0].version;
          const usedBundleId = url.includes(surgeAlternativeBundleId) ? surgeAlternativeBundleId : app.bundleId;
          console.log(`✅ ${app.icon} ${app.name} 成功获取版本: ${version} (${url})`);
          return { app, version, usedBundleId };
        } else {
          throw new Error(`API返回空数据`);
        }
      } else {
        throw new Error(`HTTP ${response.status}`);
      }
    } catch (error) {
      lastError = error;
      console.log(`⚠️ ${app.icon} ${app.name} 请求异常 [${index + 1}/${urls.length}]: ${error.message}`);
    }
  }
  
  throw new Error(`所有API请求失败: ${lastError?.message || '未知错误'}`);
}

(async () => {
  let hasUpdate = false;
  const results = {
    updated: { "代理工具": [] },
    failed: [],
    current: []
  };
  
  const startTime = Date.now();
  
  // 并行执行所有请求
  const promises = appList.map(app => enhancedFetch(app));
  const outcomes = await Promise.allSettled(promises);
  
  const writePromises = [];

  // 处理所有结果
  outcomes.forEach((outcome, index) => {
    const app = appList[index];
    
    if (outcome.status === 'fulfilled') {
      const { version: latest } = outcome.value;
      const key = `app_ver_${app.bundleId}`;
      const savedVersion = $persistentStore.read(key);
      
      if (!savedVersion) {
        writePromises.push($persistentStore.write(latest, key));
        results.current.push({
          app,
          version: latest,
          status: '首次记录'
        });
      } else if (savedVersion !== latest) {
        hasUpdate = true;
        results.updated[app.category].push({
          app,
          oldVersion: savedVersion,
          newVersion: latest
        });
        writePromises.push($persistentStore.write(latest, key));
      } else {
        results.current.push({
          app,
          version: latest,
          status: '最新版'
        });
      }
    } else {
      results.failed.push({
        app,
        error: outcome.reason.message
      });
    }
  });

  // 等待所有存储操作完成
  await Promise.all(writePromises);

  // 生成通知内容
  const now = new Date();
  const executionTime = ((Date.now() - startTime) / 1000).toFixed(1);
  
  // 仅在 hasUpdate 为 true 或有失败的应用时才发送通知
  if (hasUpdate || results.failed.length > 0) {
    const title = hasUpdate ? "🚀 代理工具更新" : "📱 代理工具检测";
    let subtitle = hasUpdate ? "✨ 发现代理工具更新" : "ℹ️ 检测完成";
    
    let body = "";
    let hasContent = false;
    
    // 更新详情
    if (hasUpdate) {
      const updates = results.updated["代理工具"];
      if (updates.length > 0) {
        body += `🆕 代理工具更新:\n`;
        body += updates.map(u => 
          `${u.app.icon} ${u.app.name}: ${u.oldVersion} → ${u.newVersion}`
        ).join("\n");
        hasContent = true;
      }
    }
    
    // 当前版本
    if (results.current.length > 0) {
      if (hasContent) body += "\n\n";
      body += `✅ 最新版工具:\n`;
      body += results.current.map(c => 
        `${c.app.icon} ${c.app.name}: ${c.version}${c.status === '首次记录' ? ' (首次记录)' : ''}`
      ).join("\n");
      hasContent = true;
    }
    
    // 失败应用
    if (results.failed.length > 0) {
      if (hasContent) body += "\n\n";
      body += `❌ 查询失败:\n`;
      body += results.failed.map(f => 
        `${f.app.icon} ${f.app.name}: 请检查网络或应用状态`
      ).join("\n");
      hasContent = true;
    }
    
    // 统计信息
    body += `\n\n⏱️ 检测耗时: ${executionTime}秒`;
    body += `\n📅 ${now.toLocaleString("zh-CN", { 
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    })}`;
    
    // 添加提示
    if (results.failed.length > 0) {
      body += `\n\n💡 提示: ${results.failed.length}个工具查询失败，可能因区域限制或网络问题`;
    }
    
    body += "\n🔔 自动检测 | 发现更新时通知";
    
    $notification.post(title, subtitle, body);
  } else {
    // 没有更新且没有失败时，只记录日志
    console.log("✅ 所有代理工具均为最新版本，无需通知");
  }
  
  // 调试日志
  console.log("=".repeat(40));
  console.log(`代理工具更新检测完成 (${executionTime}s)`);
  
  if (results.updated["代理工具"].length > 0) {
    console.log("✨ 发现以下更新:");
    results.updated["代理工具"].forEach(u => {
      console.log(`  ${u.app.icon} ${u.app.name}: ${u.oldVersion} → ${u.newVersion}`);
    });
  } else {
    console.log("✨ 未发现代理工具更新");
  }
  
  if (results.current.length > 0) {
    console.log("✅ 检查成功的工具:");
    results.current.forEach(c => {
      console.log(`  ${c.app.icon} ${c.app.name}: ${c.version}${c.status === '首次记录' ? ' (首次记录)' : ''}`);
    });
  }
  
  if (results.failed.length > 0) {
    console.log("❌ 查询失败的工具:");
    results.failed.forEach(f => {
      console.log(`  ${f.app.icon} ${f.app.name}: ${f.error}`);
    });
  }
  
  console.log("=".repeat(40));
  $done();
})();