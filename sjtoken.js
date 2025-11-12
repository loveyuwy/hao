/*
 * =================================================================
 * 声荐小程序获取令牌 (Surge/Loon/Quantumult X 全兼容)
 * =================================================================
 */

const $ = new Env("声荐令牌");
const tokenKey = "shengjian_auth_token";

$.log("🔍 声荐令牌脚本启动 (通用版)");

if (typeof $response !== "undefined" && $response && $response.body) {
  $.log("📩 捕获到响应体，开始解析...");

  try {
    const body = JSON.parse($response.body);
    const token = body.access_token;

    if (token) {
      const formattedToken = token.startsWith("Bearer ") ? token : `Bearer ${token}`;
      const oldToken = $.read(tokenKey);

      if (formattedToken !== oldToken) {
        $.write(formattedToken, tokenKey);
        $.log(`✅ 已写入新令牌: ${formattedToken.substring(0, 25)}...`);
        $.notify("声荐令牌", "✅ 获取/更新成功", "令牌已保存，请运行签到脚本测试。");
      } else {
        $.log("ℹ️ 令牌未变化，无需更新。");
      }
    } else {
      $.log("❌ 响应中未找到 access_token 字段");
      $.notify("声荐令牌", "⚠️ 获取失败", "响应中未包含 access_token");
    }
  } catch (e) {
    $.log(`❌ JSON 解析失败: ${e}`);
    $.notify("声荐令牌", "💥 解析错误", "请检查接口返回是否正常。");
  }
} else {
  $.log("⚠️ 非响应捕获环境，跳过处理。");
}

$.done($response);

/*
 * =================================================================
 * Env 环境兼容封装（支持 Surge / Loon / Quantumult X）
 * =================================================================
 */
function Env(name) {
  this.name = name;
  this.log = (...args) => console.log(...args);
  this.notify = (title, sub, body) => {
    if (typeof $notification !== "undefined") {
      $notification.post(title, sub, body);
    } else if (typeof $notify !== "undefined") {
      $notify(title, sub, body);
    } else {
      console.log(`[通知] ${title}\n${sub}\n${body}`);
    }
  };
  this.read = (key) => {
    try {
      if (typeof $persistentStore !== "undefined") return $persistentStore.read(key);
      if (typeof $prefs !== "undefined") return $prefs.valueForKey(key);
      if (typeof $kvStorage !== "undefined") return $kvStorage.get(key);
      return null;
    } catch {
      return null;
    }
  };
  this.write = (val, key) => {
    try {
      if (typeof $persistentStore !== "undefined") return $persistentStore.write(val, key);
      if (typeof $prefs !== "undefined") return $prefs.setValueForKey(val, key);
      if (typeof $kvStorage !== "undefined") return $kvStorage.set(key, val);
      return false;
    } catch {
      return false;
    }
  };
  this.done = (val = {}) => {
    if (typeof $done !== "undefined") $done(val);
  };
}
