// sjqd1_control.js —— Surge 次任务控制脚本
const enabled = $persistentStore.read("SJ_SJQD1_ENABLED");
const flag = (enabled || "{{{SJ_SJQD1_ENABLED}}}").toString().toLowerCase();

if (flag === "true") {
  console.log("✅ [声荐每日任务1] 开关已开启，执行 sjqd1.js");
  $httpClient.get("https://github.com/loveyuwy/hao/raw/refs/heads/main/sjqd1.js", (err, resp, body) => {
    if (err) {
      console.log("❌ [声荐每日任务1] 拉取任务脚本失败: " + err);
      $done();
    } else {
      try {
        eval(body);
      } catch (e) {
        console.log("❌ [声荐每日任务1] 执行脚本出错: " + e);
      }
      $done();
    }
  });
} else {
  console.log("⏸️ [声荐每日任务1] 开关关闭，跳过执行。");
  $done();
}
