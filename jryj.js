/*
脚本名称：今日油价 (Surge 面板版)
功能描述：查询每日油价，支持 Surge 面板显示和静默通知开关。
更新时间：2025-12-31
*/

// 解析 Surge 传递的参数
const params = getParams($argument);
const province = params.province || "广东";
const isSilent = params.silent === "#"; // 如果参数为 # 则开启静默
const iconName = params.icon || "fuelpump.fill";
const iconColor = params.color || "#FF2D55";

const apiUrl = `https://api.iosxx.cn/API/yjcx.php?province=${encodeURIComponent(province)}&format=text`;

$httpClient.get(apiUrl, (error, response, data) => {
  if (error) {
    console.log(`❌ 请求失败: ${error}`);
    if (!isSilent) $notification.post("今日油价", "❌ 网络请求失败", error);
    $done();
    return;
  }

  if (!data || data.length < 5) {
    console.log("❌ 数据为空");
    if (!isSilent) $notification.post("今日油价", "❌ 接口返回异常", "未获取到有效数据");
    $done();
    return;
  }

  try {
    // --- 1. 数据清洗 ---
    // 将换行符和多余空格合并为一个空格，方便正则匹配
    let text = data.replace(/\s+/g, " ");

    // --- 2. 提取价格 ---
    const getPrice = (type) => {
      // 匹配 "92#" 或 "92号" 后面紧跟的数字
      const reg = new RegExp(`${type}[#号][^\\d]*(\\d+\\.\\d+)`);
      const match = text.match(reg);
      return match ? match[1] : "--";
    };

    const p92 = getPrice("92");
    const p95 = getPrice("95");
    const p98 = getPrice("98");
    const p0 = getPrice("0");

    // --- 3. 提取预测提示 ---
    let tips = "";
    const tipMatch = text.match(/预测提示[:：]?\s*(.*)/);
    if (tipMatch) {
      // 截取逗号前的内容，去掉废话
      let rawTips = tipMatch[1];
      tips = rawTips.split("，")[0].replace("大家相互转告", "").trim();
    }

    // --- 4. 构建通知内容 (详细) ---
    let notifyLines = [];
    notifyLines.push(`⛽️ 92号: ${p92} 元/升`);
    notifyLines.push(`⛽️ 95号: ${p95} 元/升`);
    notifyLines.push(`🏎️ 98号: ${p98} 元/升`);
    notifyLines.push(`🚜 0号柴: ${p0} 元/升`);
    
    if (tips) {
        // 美化提示文案
        let prettyTips = tips.replace("目前", "\n📈 ").replace("下次", "🗓️ 下次");
        notifyLines.push(""); // 空行
        notifyLines.push(prettyTips);
    }
    
    const notifyBody = notifyLines.join("\n");

    // --- 5. 构建面板内容 (精简) ---
    // 面板空间有限，通常显示核心价格即可
    const panelContent = `92#: ${p92}  95#: ${p95}\n98#: ${p98}  0#: ${p0}\n${tips.replace("目前", "").replace("预计", "")}`;

    // --- 6. 执行输出 ---
    
    // 控制台日志
    console.log(`[今日油价] 省份:${province} 静默:${isSilent}`);
    console.log(notifyBody);

    // 发送通知 (非静默模式下)
    if (!isSilent) {
      $notification.post(`今日油价 · ${province}`, `📅 ${new Date().toLocaleDateString()}`, notifyBody);
    } else {
      console.log("🔕 静默模式：已拦截通知发送");
    }

    // 更新 Surge 面板
    $done({
      title: `今日油价 · ${province}`,
      content: panelContent,
      icon: iconName,
      "icon-color": iconColor
    });

  } catch (err) {
    console.log(`❌ 解析错误: ${err}`);
    if (!isSilent) $notification.post("今日油价", "解析错误", String(err));
    $done();
  }
});

// 辅助函数：解析参数字符串 (key=value&key2=value2)
function getParams(paramString) {
  if (!paramString) return {};
  return Object.fromEntries(
    paramString
      .split("&")
      .map((item) => item.split("="))
      .map(([k, v]) => [k, decodeURIComponent(v)])
  );
}
