// ↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓
const ScriptVersion = "1.1.2";
// ↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑

if (typeof require === 'undefined') require = importModule;
const { DmYY, Runing } = require('./DmYY');

const FM = FileManager.local();
const BASE_DIR = FM.joinPath(FM.libraryDirectory(), "Caishow_Data_ONE");
if (!FM.fileExists(BASE_DIR)) FM.createDirectory(BASE_DIR);

try {
  const cachePath = FM.joinPath(BASE_DIR, "weather_cache.json");
  if (FM.fileExists(cachePath)) FM.remove(cachePath);
} catch(e) {}

const ConfigManager = {
  getPath: (name) => FM.joinPath(BASE_DIR, name),
  load: () => {
    const path = FM.joinPath(BASE_DIR, "settings.json");
    if (FM.fileExists(path)) {
      try { return JSON.parse(FM.readString(path)); } catch (e) { return {}; }
    }
    return {};
  },
  save: (data) => {
    try { FM.writeString(FM.joinPath(BASE_DIR, "settings.json"), JSON.stringify(data)); } catch (e) {}
  },
  saveCache: (name, data) => {
    try { FM.writeString(FM.joinPath(BASE_DIR, name), JSON.stringify(data)); } catch(e){}
  },
  readCache: (name) => {
    try {
      const path = FM.joinPath(BASE_DIR, name);
      if(FM.fileExists(path)) return JSON.parse(FM.readString(path));
    } catch(e){}
    return null;
  },
  saveImg: (name, img) => { try { FM.writeImage(FM.joinPath(BASE_DIR, name), img); } catch(e){} },
  getImg: (name) => { const p = FM.joinPath(BASE_DIR, name); return FM.fileExists(p) ? FM.readImage(p) : null; },
  rmImg: (name) => { try { FM.remove(FM.joinPath(BASE_DIR, name)); } catch(e){} },
  clear: () => { try { if(FM.fileExists(BASE_DIR)) { const files = FM.listContents(BASE_DIR); for(const f of files) FM.remove(FM.joinPath(BASE_DIR, f)); } } catch(e){} }
};

// 农历数据 1900-2100
const lunarInfo = [0x04bd8,0x04ae0,0x0a570,0x054d5,0x0d260,0x0d950,0x16554,0x056a0,0x09ad0,0x055d2,0x04ae0,0x0a5b6,0x0a4d0,0x0d250,0x1d255,0x0b540,0x0d6a0,0x0ada2,0x095b0,0x14977,0x04970,0x0a4b0,0x0b4b5,0x06a50,0x06d40,0x1ab54,0x02b60,0x09570,0x052f2,0x04970,0x06566,0x0d4a0,0x0ea50,0x06e95,0x05ad0,0x02b60,0x186e3,0x092e0,0x1c8d7,0x0c950,0x0d4a0,0x1d8a6,0x0b550,0x056a0,0x1a5b4,0x025d0,0x092d0,0x0d2b2,0x0a950,0x0b557,0x06ca0,0x0b550,0x15355,0x04da0,0x0a5d0,0x14573,0x052d0,0x0a9a8,0x0e950,0x06aa0,0x0aea6,0x0ab50,0x04b60,0x0aae4,0x0a570,0x05260,0x0f263,0x0d950,0x05b57,0x056a0,0x096d0,0x04dd5,0x04ad0,0x0a4d0,0x0d4d4,0x0d250,0x0d558,0x0b540,0x0b5a0,0x195a6,0x095b0,0x049b0,0x0a974,0x0a4b0,0x0b27a,0x06a50,0x06d40,0x0af46,0x0ab60,0x09570,0x04af5,0x04970,0x064b0,0x074a3,0x0ea50,0x06b58,0x05ac0,0x0ab60,0x096d5,0x092e0,0x0c960,0x0d954,0x0d4a0,0x0da50,0x07552,0x056a0,0x0abb7,0x025d0,0x092d0,0x0cab5,0x0a950,0x0b4a0,0x0baa4,0x0ad50,0x055d9,0x04ba0,0x0a5b0,0x15176,0x052b0,0x0a930,0x07954,0x06aa0,0x0ad50,0x05b52,0x04b60,0x0a6e6,0x0a4e0,0x0d260,0x0ea65,0x0d530,0x05aa0,0x076a3,0x096d0,0x0bd7,0x04ad0,0x0a4d0,0x1d0b6,0x0d250,0x0d520,0x0dd45,0x0b5a0,0x056d0,0x055b2,0x049b0,0x0a577,0x0a4b0,0x0aa50,0x1b255,0x06d20,0x0ada0];
const weatherIcos = { CLEAR_DAY:"sun.max.fill", CLEAR_NIGHT:"moon.fill", PARTLY_CLOUDY_DAY:"cloud.sun.fill", PARTLY_CLOUDY_NIGHT:"cloud.moon.fill", CLOUDY:"cloud.fill", LIGHT_HAZE:"sun.haze.fill", MODERATE_HAZE:"sun.haze.fill", HEAVY_HAZE:"sun.haze.fill", LIGHT_RAIN:"cloud.drizzle.fill", MODERATE_RAIN:"cloud.rain.fill", HEAVY_RAIN:"cloud.rain.fill", STORM_RAIN:"cloud.heavyrain.fill", FOG:"cloud.fog.fill", LIGHT_SNOW:"cloud.snow.fill", MODERATE_SNOW:"cloud.snow.fill", HEAVY_SNOW:"cloud.snow.fill", STORM_SNOW:"wind.snow.fill", DUST:"cloud.dust.fill", SAND:"cloud.dust.fill", WIND:"wind", SUNSET:"sunset.fill", SUNRISE:"sunrise.fill" };
const weekTitle = ['周日','周一','周二','周三','周四','周五','周六'];
const weekTitleShort = ['日','一','二','三','四','五','六'];
const zodiacAnimals = ["鼠","牛","虎","兔","龙","蛇","马","羊","猴","鸡","狗","猪"];
const heavenlyStems = ["甲","乙","丙","丁","戊","己","庚","辛","壬","癸"];
const earthlyBranches = ["子","丑","寅","卯","辰","巳","午","未","申","酉","戌","亥"];
const yellowBlackDays = ["建","除","满","平","定","执","破","危","成","收","开","闭"];
const twentyEightMansions = ["角","亢","氐","房","心","尾","箕","斗","牛","女","虚","危","室","壁","奎","娄","胃","昴","毕","觜","参","井","鬼","柳","星","张","翼","轸"];
const solarTerms = ["小寒","大寒","立春","雨水","惊蛰","春分","清明","谷雨","立夏","小满","芒种","夏至","小暑","大暑","立秋","处暑","白露","秋分","寒露","霜降","立冬","小雪","大雪","冬至"];

const greetingText = {
  nightGreeting: "🦉火华,可以来一发了~",
  morningGreeting: "💫火华,早上心情美美哒~",
  noonGreeting: "🥳火华,中午好呀~",
  afternoonGreeting: "🐡火华,下午好呀~",
  eveningGreeting: "🐳火华,（傍晚好呀）",
  nightText: "🌙火华,（晚上好呀）"
};

const baseConfigKeys = {
    size_greeting: "100", size_date: "100", size_lunar: "100", size_info: "100", 
    size_weather: "100", size_weatherLarge: "100", size_poetry: "100", size_timeInfo: "100", 
    size_calendar: "100", size_holiday: "100", 
    size_schedule_title: "100", size_schedule_item: "100", 
    
    size_lotteryTitle: "100", size_lotteryItem: "100", size_lotteryInfo: "100",
    
    show_battery: "true", 
    show_poetry: "true",
    birthday_list: "", // 存储生日数据
    
    color_greeting: "#ffffff", color_date: "#ffcc99", color_lunar: "#99ccff", color_info: "#ffffff",
    color_weather: "#ffffff", color_weatherLarge: "#ffffff", color_poetry: "#ffffff", 
    color_timeInfo: "#99ccff", color_calendar: "#ffffff", color_holiday: "#ffffff", 
    color_schedule_title: "#ffffff", 
    color_schedule_bg: "#666666",
    color_schedule_item_1: "#ffffff",
    color_schedule_item_2: "#ffffff",
    color_schedule_item_3: "#ffffff",
    color_schedule_item_4: "#ffffff",
    color_schedule_item_5: "#ffffff",
    color_schedule_item_6: "#ffffff",
    color_lotteryTitle: "#ffffff", color_lotteryItem: "#ffffff", color_lotteryInfo: "#99ccff",
    
    color_bg: "#000000",
    color_bg_2: "", 
    
    color_bg_day: "",
    color_bg_2_day: "",
    color_bg_night: "",
    color_bg_2_night: "",

    layout_med_left_x: "0", layout_med_left_y: "0",
    layout_med_right_x: "0", layout_med_right_y: "0",
    
    layout_lg_tl_x: "0", layout_lg_tl_y: "0",
    layout_lg_tr_x: "0", layout_lg_tr_y: "0",
    
    layout_lg_mid_x: "0", layout_lg_mid_y: "0",
    
    layout_lg_week_x: "0", layout_lg_week_y: "0",
    layout_lg_cal_x: "0", layout_lg_cal_y: "0",
    
    layout_lg_holiday_x: "0", layout_lg_holiday_y: "0",
    layout_lg_schedule_x: "0", layout_lg_schedule_y: "0",

    space_week_w: "28",
    space_cal_w: "28",
    space_cal_h: "3",
    space_holiday_h: "2",
    space_schedule_h: "2",
    
    schedule_count: "4",
    schedule_offset: "0",

    text_greeting_night: "",
    text_greeting_morning: "",
    text_greeting_noon: "",
    text_greeting_afternoon: "",
    text_greeting_evening: ""
};

class CaishowWidget extends DmYY {
  constructor(arg) {
    super(arg);
    this.name = '全能日历天气';
    this.en = 'CalendarWeather';
    this.logo = 'https://raw.githubusercontent.com/Orz-3/task/master/scriptable/icon/caiyun.png';
    
    this.defaultData = {
      apiKey: "",
      lockLocation: false,
      fixedLng: "", fixedLat: "", fixedCity: "", fixedSubCity: "",
      refreshInterval: "60", 
      styleModel: "classic", 
      global_font_size: "100",
      lottery_type: "none"
    };
    
    for (const [key, val] of Object.entries(baseConfigKeys)) {
        this.defaultData[`s1_${key}`] = val;
        this.defaultData[`s2_${key}`] = val;
        this.defaultData[`s3_${key}`] = val;
        this.defaultData[`s4_${key}`] = val; 
    }
    
    this.defaultData[`s1_space_week_w`] = "30";
    this.defaultData[`s1_space_cal_w`] = "29.2";
    
    this.defaultData[`s2_space_week_w`] = "30";
    this.defaultData[`s2_space_cal_w`] = "29.2";

    this.defaultData[`s3_space_week_w`] = "8";
    this.defaultData[`s3_space_cal_w`] = "7.3";
    this.defaultData[`s3_space_cal_h`] = "0";
    this.defaultData[`s3_space_holiday_h`] = "4"; 

    this.defaultData[`s4_space_week_w`] = "8";
    this.defaultData[`s4_space_cal_w`] = "7.3";
    this.defaultData[`s4_space_cal_h`] = "0";
    this.defaultData[`s4_space_schedule_h`] = "0"; 
    this.defaultData[`s4_schedule_count`] = "4"; 
    
    const saved = ConfigManager.load();
    this.settings = Object.assign({}, this.defaultData, saved);
    this.Run();
  }

  // ==========================================
  // 修复保存问题的核心代码 (请复制这一段)
  // ==========================================
  
  /**
   * 重写父类的保存方法
   * 强制将数据同步保存到 ConfigManager (FileManager)
   */
  saveSettings(notify = true) {
    // 1. 关键修复：将 DmYY 内存中的 settings 写入到 settings.json 文件
    ConfigManager.save(this.settings);
    
    // 2. 为了保持兼容，同时也存一份到 Keychain (让父类处理)
    // 传入 false 防止父类重复弹窗
    super.saveSettings(false);

    // 3. 如果需要弹窗通知，在这里统一处理
    if (notify) this.notify('设置成功', '配置已保存到本地文件，稍后刷新');
    
    return JSON.stringify(this.settings);
  }

  // ==========================================
  // 修复结束
  // ==========================================

  Run() {
    if (config.runsInApp) {      
      this.registerAction("基础设置", async () => { await this.setBasicConfig(); }, { name: 'gearshape.fill', color: '#007aff', desc: '定位、API、刷新频率' });
      
      this.registerAction("彩票与问候", async () => { await this.handleGreetingSettings(this.getActivePrefix()); }, { name: 'ticket.fill', color: '#FF2D55', desc: '选择显示的彩票或问候语' });
      
      this.registerAction("第一套（三天天气）", async () => { await this.handleStyleSettingsMenu("s1") }, { name: 'doc.text.image', color: '#FF9500', desc: '第一套 (经典)' });
      this.registerAction("第二套（七天天气）", async () => { await this.handleStyleSettingsMenu("s2") }, { name: 'doc.text', color: '#34C759', desc: '第二套 (简约)' });
      this.registerAction("第三套（节假日倒计时）", async () => { await this.handleStyleSettingsMenu("s3") }, { name: 'gift.fill', color: '#FF2D55', desc: '第三套 (节日)' });
      this.registerAction("第四套（日历日程）", async () => { await this.handleStyleSettingsMenu("s4") }, { name: 'calendar.badge.clock', color: '#007AFF', desc: '第四套 (日程)' });

      this.registerAction("组件切换", async () => { await this.handleStyleSwitch(); }, { name: 'arrow.triangle.2.circlepath', color: '#5856d6', desc: '切换当前显示样式' });
      this.registerAction("重置配置", async () => { 
        const a = new Alert();
        a.title = "确认重置？"; a.message = "所有个性化颜色、布局、Key都将丢失。";
        a.addAction("确认重置"); a.addCancelAction("取消");
        const idx = await a.presentAlert();
        if(idx===0){ ConfigManager.clear(); this.settings = Object.assign({}, this.defaultData); this.saveSettings(false); this.notify("已重置", "请重新运行脚本"); }
      }, { name: 'trash.fill', color: '#ff3b30', desc: '修复所有问题' });

      this.registerAction("检查更新", async () => { await this.updateScript() }, { name: 'cloud.fill', color: '#007aff', desc: `当前版本 v${ScriptVersion}` });
    }
  }

  async updateScript() {
    const url = "https://raw.githubusercontent.com/loveyuwy/hao/refs/heads/main/cytqzyxzj.js";
    const a = new Alert();
    try {
        const req = new Request(url);
        const html = await req.loadString();
        const versionMatch = html.match(/const\s+ScriptVersion\s*=\s*["'](.*?)["']/);
        const remoteVersion = versionMatch ? versionMatch[1] : null;

        if (!remoteVersion) {
            a.title = "⚠️ 无法检测远程版本";
            a.message = "远程文件可能未包含版本号，或者文件格式有误。\n\n是否强制覆盖更新？";
            a.addAction("强制更新"); a.addCancelAction("取消");
            const idx = await a.presentAlert();
            if (idx === 0) await this.doUpdate(html);
            return;
        }

        if (remoteVersion !== ScriptVersion) {
            a.title = `🚀 发现新版本 v${remoteVersion}`;
            a.message = `当前版本: v${ScriptVersion}\n\n建议您立即更新以获得最新功能。`;
            a.addAction("立即更新"); a.addCancelAction("稍后");
            const idx = await a.presentAlert();
            if (idx === 0) await this.doUpdate(html);
        } else {
            a.title = "✅ 已是最新版本";
            a.message = `当前版本: v${ScriptVersion}\n无需更新。`;
            a.addAction("好的");
            await a.presentAlert();
        }
    } catch (e) {
        a.title = "❌ 更新检测失败";
        a.message = "网络请求错误或地址不可达：\n" + e.message;
        a.addAction("确定");
        await a.presentAlert();
    }
  }

  async doUpdate(code) {
     if (code && code.includes("CaishowWidget")) {
        const fm = FileManager.local();
        fm.writeString(module.filename, code);
        const a = new Alert();
        a.title = "✅ 更新成功";
        a.message = "脚本已覆盖，请退出并重新运行脚本以生效。";
        a.addAction("好的");
        await a.presentAlert();
     } else {
        this.notify("更新失败", "下载的内容似乎不正确");
     }
  }

  getActivePrefix() {
    let currentModel = this.settings.styleModel || "classic";
    if (currentModel === "modern") return "s2";
    if (currentModel === "holiday") return "s3";
    if (currentModel === "schedule") return "s4";
    return "s1";
  }

  async handleGreetingSettings(prefix) {
    const lotteryOptions = [
        { t: "🚫 不显示彩票 (使用问候语)", v: "none" },
        { t: "🟡🔵 大乐透 (DLT)", v: "dlt" },
        { t: "🔴🔵 双色球 (SSQ)", v: "ssq" },
        { t: "🔢 排列三 (PL3)", v: "pl3" },
        { t: "🎲 福彩3D (FC3D)", v: "fc3d" },
        { t: "7️⃣ 七星彩 (QXC)", v: "qxc" },
        { t: "🌈 七乐彩 (QLC)", v: "qlc" },
        { t: "🖐 排列五 (PL5)", v: "pl5" }
    ];

    let currentVal = this.settings.lottery_type || "none";
    let currentOption = lotteryOptions.find(o => o.v === currentVal) || lotteryOptions[0];

    await this.renderAppView([
    {
        title: "彩票显示设置",
        menu: [
            { 
                title: "点击选择模式", 
                val: "click_select_lottery_type",
                desc: currentOption.t, 
                icon: { name: "checklist", color: "#FF2D55" },
                onClick: async () => {
                    const a = new Alert();
                    a.title = "选择显示的彩票";
                    a.message = "选择后将替换问候语位置显示开奖信息";
                    
                    lotteryOptions.forEach(o => {
                        if (o.v === currentVal) {
                            a.addAction("✅ " + o.t);
                        } else {
                            a.addAction(o.t);
                        }
                    });
                    
                    a.addCancelAction("取消");
                    const idx = await a.presentSheet();
                    
                    if (idx !== -1) {
                        const selected = lotteryOptions[idx];
                        this.settings.lottery_type = selected.v;
                        this.saveSettings(false);
                        this.notify("设置已更新", `当前模式：${selected.t}`);
                    }
                }
            }
        ]
    },
    { 
        title: `自定义问候语 (当彩票选择"不显示"时生效)`,
        menu: [
            { title: "凌晨/深夜 (23:00-05:00)", type: "input", val: `${prefix}_text_greeting_night`, placeholder: "默认: " + greetingText.nightGreeting },
            { title: "早上 (05:00-11:00)", type: "input", val: `${prefix}_text_greeting_morning`, placeholder: "默认: " + greetingText.morningGreeting },
            { title: "中午 (11:00-13:00)", type: "input", val: `${prefix}_text_greeting_noon`, placeholder: "默认: " + greetingText.noonGreeting },
            { title: "下午 (13:00-18:00)", type: "input", val: `${prefix}_text_greeting_afternoon`, placeholder: "默认: " + greetingText.afternoonGreeting },
            { title: "晚上 (18:00-23:00)", type: "input", val: `${prefix}_text_greeting_evening`, placeholder: "默认: " + greetingText.nightText }
        ]
    }]);
    this.saveSettings(false);
  }

  async handleStyleSettingsMenu(prefix) {
    let pName = "经典";
    if (prefix === "s2") pName = "简约";
    if (prefix === "s3") pName = "节日";
    if (prefix === "s4") pName = "日程";

    let menu = [
        { title: "布局微调", val: "menu_layout", icon: { name: "arrow.up.and.down.and.arrow.left.and.right", color: "#5856D6" }, desc: "调整组件位置", onClick: async () => await this.handleLayoutMenu(prefix) },
        { title: "间距/数量", val: "menu_spacing", icon: { name: "arrow.up.left.and.arrow.down.right", color: "#FF2D55" }, desc: "调整行列间距/数量", onClick: async () => await this.handleSpacingMenu(prefix) },
        { title: "显示开关", val: "menu_vis", icon: { name: "eye.fill", color: "#007AFF" }, desc: "隐藏/显示部分元素", onClick: async () => await this.handleVisibilityMenu(prefix, pName) },
        { title: "字体大小", val: "menu_size", icon: { name: "textformat.size", color: "#FF9500" }, desc: "调整全局或局部缩放", onClick: async () => await this.handleSizeMenu(prefix) },
        { title: "颜色配置", val: "menu_color", icon: { name: "paintpalette.fill", color: "#34C759" }, desc: "自定义文字颜色", onClick: async () => await this.handleColorMenu(prefix) },
        { title: "背景设置", val: "menu_bg", icon: { name: "photo.fill", color: "#007AFF" }, desc: "日夜模式/图片/渐变", onClick: async () => await this.handleBackgroundMenu(prefix) }
    ];
    
    // 【新增】第三套专属：生日管理
    if (prefix === "s3") {
        menu.splice(1, 0, { 
            title: "生日管理", 
            val: "menu_birthday", 
            icon: { name: "cake.fill", color: "#FF2D55" }, 
            desc: "添加/管理家人朋友生日", 
            onClick: async () => await this.handleBirthdaySettings(prefix) 
        });
    }

    await this.renderAppView([{
        title: `${pName}配置菜单`,
        menu: menu
    }]);
  }
  
  // 【修复】生日设置逻辑：修正addTextField参数顺序
  async handleBirthdaySettings(prefix) {
      let key = `${prefix}_birthday_list`;
      let savedData = this.settings[key] || "";
      // 将保存的数据按行分割，存入数组
      let savedLines = savedData.split("\n").filter(l => l.trim() !== "");
      
      const a = new Alert();
      a.title = "🎂 生日管理";
      // 顶部说明
      a.message = "【输入说明】\n请在下方输入框中填写，格式为：\n姓名,日期,类型\n\n【示例】\n老公,10-27,农历\n老婆,05-20,公历\n\n(输入框留空则不显示)";
      
      // 生成10个输入框
      for (let i = 0; i < 10; i++) {
          let val = savedLines[i] || "";
          // 修复：placeholder 在前，value 在后
          a.addTextField("姓名,MM-DD,公历/农历", val);
      }
      
      a.addAction("保存生效");
      a.addCancelAction("取消");
      
      const idx = await a.presentAlert();
      if (idx === 0) {
          let newLines = [];
          // 收集10个输入框的值
          for (let i = 0; i < 10; i++) {
              let text = a.textFieldValue(i).trim();
              if (text) {
                  newLines.push(text);
              }
          }
          // 用换行符连接并保存
          this.settings[key] = newLines.join("\n");
          this.saveSettings();
      }
  }

  async handleVisibilityMenu(prefix, styleName) {
    const keyBat = `${prefix}_show_battery`;
    const keyPoe = `${prefix}_show_poetry`;
    
    const getStatusVal = (k) => {
        let v = this.settings[k];
        return (v === undefined || v === null || v === "true");
    };

    let batIsOn = getStatusVal(keyBat);
    let poeIsOn = getStatusVal(keyPoe);
    
    let batDesc = batIsOn ? "当前状态：✅ 已开启" : "当前状态：🔴 已关闭";
    let poeDesc = poeIsOn ? "当前状态：✅ 已开启" : "当前状态：🔴 已关闭";

    await this.renderAppView([{
        title: `显示设置 - ${styleName}模式`,
        menu: [
            { 
                title: "🔋 电量显示", 
                desc: batDesc, 
                icon: { name: "battery.100", color: batIsOn ? "#34C759" : "#FF3B30" },
                val: "toggle_bat",
                onClick: async () => { 
                    const a = new Alert();
                    a.title = `设置 ${styleName} 电量显示`;
                    a.addAction(batIsOn ? "开启 (当前)" : "开启");
                    a.addAction(!batIsOn ? "关闭 (当前)" : "关闭");
                    a.addCancelAction("取消");
                    const idx = await a.presentSheet();
                    
                    if (idx !== -1) {
                        const newVal = (idx === 0) ? "true" : "false";
                        this.settings[keyBat] = newVal;
                        this.saveSettings(false);
                        this.notify("设置已保存", idx===0 ? "已开启电量显示" : "已关闭电量显示");
                        await this.handleVisibilityMenu(prefix, styleName);
                    }
                } 
            },
            { 
                title: "📜 诗词与天气联动", 
                desc: poeDesc + (poeIsOn ? " (显诗词+3天天气)" : " (隐诗词+7天天气)"), 
                icon: { name: "text.quote", color: poeIsOn ? "#007AFF" : "#FF3B30" },
                val: "toggle_poe",
                onClick: async () => { 
                    const a = new Alert();
                    a.title = `设置 ${styleName} 诗词显示`;
                    a.addAction(poeIsOn ? "开启 (当前)" : "开启");
                    a.addAction(!poeIsOn ? "关闭 (当前)" : "关闭");
                    a.addCancelAction("取消");
                    const idx = await a.presentSheet();
                    
                    if (idx !== -1) {
                        const newVal = (idx === 0) ? "true" : "false";
                        this.settings[keyPoe] = newVal;
                        this.saveSettings(false);
                        this.notify("设置已保存", idx===0 ? "已开启诗词" : "已关闭诗词");
                        await this.handleVisibilityMenu(prefix, styleName);
                    }
                } 
            }
        ]
    }]);
  }

  async handleLayoutMenu(prefix) {
    const items = [
      { title: "[中号] 左侧信息区", code: "med_left" }, { title: "[中号] 右侧天气区", code: "med_right" },
      { title: "[大号] 左上信息区", code: "lg_tl" }, { title: "[大号] 右上天气区", code: "lg_tr" },
      { title: "[大号] 中间黄历条", code: "lg_mid" }, { title: "[大号] 日历-星期栏", code: "lg_week" },
      { title: "[大号] 日历-日期区", code: "lg_cal" }
    ];
    if (prefix === "s3") {
        items.push({ title: "[大号] 左下-假期倒数", code: "lg_holiday" });
    }
    if (prefix === "s4") {
        items.push({ title: "[大号] 左下-日历事件", code: "lg_schedule" });
    }
    await this.renderAppView([{
        title: `选择调整区域 (${prefix})`,
        menu: items.map(i => ({ title: i.title, val: `layout_${i.code}`, icon: { name: "square.dashed", color: "#8E8E93" }, desc: "点击设置XY偏移", onClick: async () => await this.renderLayoutInput(i.title, i.code, prefix) }))
    }]);
  }

  async renderLayoutInput(title, code, prefix) {
    await this.renderAppView([{ 
        title: `${title} - 偏移 (X/Y)`,
        menu: [
            { title: "X轴偏移", desc: "正右负左", type: "input", val: `${prefix}_layout_${code}_x`, placeholder: "0" },
            { title: "Y轴偏移", desc: "正下负上", type: "input", val: `${prefix}_layout_${code}_y`, placeholder: "0" }
        ]
    }]);
    this.saveSettings(false);
  }

  async handleSpacingMenu(prefix) {
    let menu = [
        { title: "星期栏-横向", desc:"(左右间距)", type: "input", val: `${prefix}_space_week_w`, placeholder: "28" },
        { title: "日期区-横向", desc:"(左右间距,调小防溢出)", type: "input", val: `${prefix}_space_cal_w`, placeholder: "28" },
        { title: "日期区-行高", desc:"(上下行距)", type: "input", val: `${prefix}_space_cal_h`, placeholder: "3" }
    ];
    
    // 【新增】关键词过滤和序号选择功能
    menu.push({ title: "日程关键词(重要)", desc:"(只显示含此词的日程,留空显示所有)", type: "input", val: `${prefix}_schedule_keyword`, placeholder: "例如: 柴油" });
    
    // 如果不是第四套(第四套是列表，通常不需要指定第几条，只需过滤)，则添加序号选择
    if (prefix !== "s4") {
        menu.push({ title: "指定显示第几条", desc:"(筛选后的第几条, 0是第一条)", type: "input", val: `${prefix}_schedule_index`, placeholder: "0" });
    }

    if (prefix === "s3") {
        menu.push({ title: "倒计时-行高", type: "input", val: `${prefix}_space_holiday_h`, placeholder: "4" });
    }
    if (prefix === "s4") {
        menu.push({ title: "日程列表-行高", type: "input", val: `${prefix}_space_schedule_h`, placeholder: "0" });
        menu.push({ title: "最大显示数量", desc:"建议3或4", type: "input", val: `${prefix}_schedule_count`, placeholder: "4" });
        menu.push({ title: "跳过指定序号", desc:"如: 2,4 (跳过第2和第4个)", type: "input", val: `${prefix}_schedule_offset`, placeholder: "2,4" });
    }
    await this.renderAppView([{ 
        title: `间距与筛选 (${prefix})`,
        menu: menu
    }]);
    this.saveSettings(false);
  }

  async handleSizeMenu(prefix) {
    const items = [
        {id:"greeting", t:"问候语"}, 
        {id:"lotteryTitle", t:"彩票标题(期号)"},
        {id:"lotteryItem", t:"彩票开奖球号"},
        {id:"lotteryInfo", t:"今日开奖状态"}, 
        {id:"date", t:"公历日期"}, 
        {id:"lunar", t:"农历日期"}, 
        {id:"info", t:"电量与定位"}, 
        {id:"weather", t:"天气描述"}, 
        {id:"weatherLarge", t:"大温度数字"}, 
        {id:"poetry", t:"诗词与预报"}, 
        {id:"timeInfo", t:"底部时间条"}, 
        {id:"calendar", t:"月历区域"}
    ];
    if (prefix === "s3") items.push({id:"holiday", t:"假期倒数"});
    if (prefix === "s4") {
        items.push({id:"schedule_title", t:"日程标题"});
        items.push({id:"schedule_item", t:"日程列表"});
    }
    
    const menuItems = items.map(i => ({ title: i.t, type: "input", val: `${prefix}_size_${i.id}`, placeholder: "100" }));
    const globalMenu = [{ title: "🌐 全局缩放", desc: "所有文字按比例缩放(默认100)", type: "input", val: "global_font_size", placeholder: "100" }];
    
    await this.renderAppView([
        { title: "全局设置 (影响所有组件)", menu: globalMenu },
        {
        title: `局部微调 (${prefix})`,
        menu: [
            { title: "✏️ 修改局部数值", val: "size_edit", icon: { name: "pencil", color: "#007AFF" }, desc: "进入单独调整", onClick: async () => { await this.renderAppView([{ title: "局部缩放 (百分比)", menu: menuItems }]); this.saveSettings(false); }},
            { title: "↩️ 恢复默认", val: "size_reset", icon: { name: "arrow.counterclockwise", color: "#FF3B30" }, desc: "重置当前套系字体", onClick: async () => { items.forEach(k => this.settings[`${prefix}_size_${k.id}`] = "100"); this.settings["global_font_size"] = "100"; this.saveSettings(false); this.notify("已恢复", "字体大小已重置"); }}
        ]
    }]);
  }

  async handleColorMenu(prefix) {
    const items = [
        {id:"greeting", t:"问候语"},
        {id:"lotteryTitle", t:"彩票标题"},
        {id:"lotteryInfo", t:"今日开奖状态"},
        {id:"date", t:"公历日期"}, {id:"lunar", t:"农历日期"}, 
        {id:"info", t:"电量与定位"}, {id:"weather", t:"天气描述"}, 
        {id:"weatherLarge", t:"大温度数字"}, {id:"poetry", t:"诗词与预报"}, 
        {id:"timeInfo", t:"底部时间条"}, {id:"calendar", t:"月历区域"}
    ];
    if (prefix === "s3") items.push({id:"holiday", t:"假期倒数"});
    
    if (prefix === "s4") {
        items.push({id:"schedule_title", t:"日程标题"});
        items.push({id:"schedule_bg", t:"日程背景(底框)"});
        for (let j = 1; j <= 6; j++) {
            items.push({id: `schedule_item_${j}`, t: `日程列表-第${j}行`});
        }
    }

    const menuItems = items.map(i => ({ title: i.t, type: "color", val: `${prefix}_color_${i.id}` }));
    await this.renderAppView([{
        title: `颜色配置 (${prefix})`,
        menu: [
            { title: "🎨 修改颜色", val: "color_edit", icon: { name: "paintpalette", color: "#007AFF" }, desc: "进入选色页面", onClick: async () => { await this.renderAppView([{ title: "自定义颜色", menu: menuItems }]); this.saveSettings(false); }},
            { title: "↩️ 恢复默认", val: "color_reset", icon: { name: "arrow.counterclockwise", color: "#FF3B30" }, desc: "重置当前套系颜色", onClick: async () => { items.forEach(k => this.settings[`${prefix}_color_${k.id}`] = baseConfigKeys[`color_${k.id}`]); this.saveSettings(false); this.notify("已恢复", "颜色已重置"); }}
        ]
    }]);
  }

  async handleBackgroundMenu(prefix) {
    const filename = `bg_${prefix}.jpg`; 
    const filenameDay = `bg_${prefix}_day.jpg`; 
    const filenameNight = `bg_${prefix}_night.jpg`;

    await this.renderAppView([{
        title: `背景模式 (${prefix})`,
        menu: [
            { title: "☀️ 白天模式 - 图片", val: "bg_select_day", icon: { name: "sun.max.fill", color: "#FF9500" }, desc: "选择白天显示的图片", onClick: async () => { try { let i = await Photos.fromLibrary(); ConfigManager.saveImg(filenameDay, i); ConfigManager.saveImg(filename, i); this.notify("成功", "白天图片已保存"); } catch (e) {} }},
            { title: "🌙 夜间模式 - 图片", val: "bg_select_night", icon: { name: "moon.fill", color: "#5856D6" }, desc: "选择深色模式图片", onClick: async () => { try { let i = await Photos.fromLibrary(); ConfigManager.saveImg(filenameNight, i); this.notify("成功", "夜间图片已保存"); } catch (e) {} }},
            
            { title: "☀️ 白天 - 颜色1 (主色)", type: "color", val: `${prefix}_color_bg_day`, desc: "无图片时显示" },
            { title: "☀️ 白天 - 颜色2 (渐变)", type: "color", val: `${prefix}_color_bg_2_day`, desc: "可选: 设置后显示渐变" },
            
            { title: "🌙 夜间 - 颜色1 (主色)", type: "color", val: `${prefix}_color_bg_night`, desc: "无图片时显示" },
            { title: "🌙 夜间 - 颜色2 (渐变)", type: "color", val: `${prefix}_color_bg_2_night`, desc: "可选: 设置后显示渐变" },

            { title: "🗑 清除所有图片", val: "bg_clear", icon: { name: "trash", color: "#FF3B30" }, desc: "恢复纯色背景", onClick: async () => { ConfigManager.rmImg(filename); ConfigManager.rmImg(filenameDay); ConfigManager.rmImg(filenameNight); this.notify("成功", "背景已清除"); }}
        ]
    }]);
    this.saveSettings(false);
  }

  async setBasicConfig() {
     const l=async()=>{try{const lo=await Location.current();const g=await Location.reverseGeocode(lo.latitude,lo.longitude,"zh_cn");this.settings.fixedLat=String(lo.latitude);this.settings.fixedLng=String(lo.longitude);this.settings.fixedCity=g[0].locality;this.settings.fixedSubCity=g[0].subLocality;this.saveSettings(false);this.notify("定位成功","已保存");await this.setBasicConfig();}catch(e){this.notify("定位失败",e.message);await this.setBasicConfig();}};
     const items = [
         { title:"彩云API Key", type:"input", val:"apiKey", placeholder:"请输入Token" },
         { title:"免费申请Token", val:"apply_token", icon: {name: "key", color: "#34C759"}, desc:"点击跳转官网", onClick:async()=>{Safari.open("https://platform.caiyunapp.com/login")} },
         { title:"刷新间隔(分)", type:"input", val:"refreshInterval", placeholder:"60" },
         { title:"📍 获取定位", val:"get_location_btn", icon: {name: "location", color: "#007AFF"}, onClick:l }, 
         { title:"锁定定位", type:"switch", val:"lockLocation" }
     ];
     await this.renderAppView([{ title:"基础设置 (全局生效)", menu:items }, { title:"固定坐标", menu:[{ title:"经度", type:"input", val:"fixedLng" }, { title:"纬度", type:"input", val:"fixedLat" }, { title:"城市", type:"input", val:"fixedCity" }, { title:"区域", type:"input", val:"fixedSubCity" }] }]);
     this.saveSettings(false);
  }

  async handleStyleSwitch() {
    const saved = ConfigManager.load();
    this.settings = Object.assign({}, this.defaultData, saved);
    
    const options = [ 
        { t: "第一套(三天天气)", v: "classic" }, 
        { t: "第二套(七天天气)", v: "modern" },
        { t: "第三套(节日倒计时)", v: "holiday" },
        { t: "第四套(日历事件)", v: "schedule" }
    ];
    
    const currentStyle = this.settings.styleModel || "classic";

    await this.renderAppView([{
        title: "选择组件样式",
        menu: options.map(o => ({
            title: (currentStyle === o.v ? "✅ " : "") + o.t,
            val: `style_${o.v}`,
            icon: { name: "circle.grid.2x2", color: "#5856D6" },
            onClick: async () => {
                const a = new Alert();
                a.title = "确认切换？";
                a.message = `即将切换为：${o.t}\n\n切换后请点击脚本右下角的“运行”按钮以刷新预览。`;
                a.addAction("确认切换");
                a.addCancelAction("取消");
                const idx = await a.presentAlert();
                
                if (idx === 0) {
                    this.settings.styleModel = o.v;
                    this.saveSettings(false);
                    this.notify("✅ 样式已切换", `当前模式：${o.t} (请重新运行)`);
                }
            }
        }))
    }]);
  }

  
  async setKeyConfig() { await this.setBasicConfig(); }
  async setRefreshConfig() { await this.setBasicConfig(); }

  async fetchData() {
    let location = { latitude: 39.90, longitude: 116.40, locality: "定位中", subLocality: "" };
    const freshSettings = ConfigManager.load();
    const isLocked = (freshSettings.lockLocation === true || freshSettings.lockLocation === "true");
    
    if (isLocked) {
      if (freshSettings.fixedLat && freshSettings.fixedLng) {
        location = { latitude: freshSettings.fixedLat, longitude: freshSettings.fixedLng, locality: freshSettings.fixedCity || "固定", subLocality: freshSettings.fixedSubCity || "位置" };
      }
    } else {
      try {
        let l = await Location.current();
        let g = await Location.reverseGeocode(l.latitude, l.longitude, "zh_cn");
        location = { latitude: l.latitude, longitude: l.longitude, locality: g[0].locality, subLocality: g[0].subLocality };
        ConfigManager.saveCache("location_cache.json", location); 
        this.settings.fixedLat = String(l.latitude); this.settings.fixedLng = String(l.longitude);
        this.settings.fixedCity = g[0].locality; this.settings.fixedSubCity = g[0].subLocality;
        this.saveSettings(false);
      } catch(e) { const c = ConfigManager.readCache("location_cache.json"); if (c) location = c; else location.locality = "定位失败"; }
    }
    this.location = location;

    const weatherPromise = this.fetchWeather(freshSettings, location);
    const poetryPromise = this.fetchPoetry(freshSettings);
    const schedulePromise = this.fetchSchedules(freshSettings);
    const lotteryPromise = this.fetchLotteryData();

    const [weather, poetry, schedules, lottery] = await Promise.all([weatherPromise, poetryPromise, schedulePromise, lotteryPromise]);

    return { weather, poetry, schedules, lottery };
  }
  
  async fetchLotteryData() {
    let type = this.settings.lottery_type || "dlt";
    if (!type || type === "none") return null;

    if (type.includes("双色球") || type.includes("SSQ")) type = "ssq";
    else if (type.includes("大乐透") || type.includes("DLT")) type = "dlt";
    else if (type.includes("排列三") || type.includes("PL3")) type = "pl3";
    else if (type.includes("福彩3D") || type.includes("FC3D")) type = "fc3d";
    else if (type.includes("七星彩") || type.includes("QXC")) type = "qxc";
    else if (type.includes("七乐彩") || type.includes("QLC")) type = "qlc";
    else if (type.includes("排列五") || type.includes("PL5")) type = "pl5";

    const cacheKey = `lottery_cache_${type}`;
    const cache = ConfigManager.readCache(cacheKey);
    
    if (cache && cache.timestamp && (Date.now() - cache.timestamp) < 1800000 && cache.data.pool) {
        return cache.data;
    }

    let result = { full: "", pool: "", type: type };
    const mapName = { "ssq": "双色球", "dlt": "大乐透", "pl3": "排列三", "fc3d": "福彩3D", "qxc": "七星彩", "qlc": "七乐彩", "pl5": "排列五" };
    const name = mapName[type] || "彩票";

    const sportteryMap = { "dlt": 85, "pl3": 35, "pl5": 81, "qxc": "04" };
    
    if (sportteryMap[type]) {
        try {
            const gameNo = sportteryMap[type];
            const url = `https://webapi.sporttery.cn/gateway/lottery/getHistoryPageListV1.qry?gameNo=${gameNo}&provinceId=0&pageSize=1&isVerify=1&pageNo=1`;
            const req = new Request(url);
            const res = await req.loadJSON();
            if (res && res.success && res.value && res.value.list && res.value.list.length > 0) {
                const item = res.value.list[0];
                let nums = item.lotteryDrawResult.replace(/ /g, " ");
                if (type === "dlt") {
                   const parts = item.lotteryDrawResult.split(" ");
                   nums = parts.slice(0,5).join(" ") + " + " + parts.slice(5).join(" ");
                }
                result.full = `${name} ${item.lotteryDrawNum}期: ${nums}`;
                
                let pool = item.poolMoney || "0";
                result.pool = this.formatMoney(pool);
            }
        } catch(e) { console.log("Sporttery Error: " + e.message); }
    } else {
        try {
            let cwlCode = type;
            if (type === "fc3d") cwlCode = "3d";
            
            const url = `https://www.cwl.gov.cn/cwl_admin/front/cwlkj/search/kjxx/findDrawNotice?name=${cwlCode}&issueCount=1`;
            const req = new Request(url);
            
            req.headers = {
                "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1",
                "Referer": "https://www.cwl.gov.cn/",
                "Accept": "application/json, text/javascript, */*; q=0.01",
                "X-Requested-With": "XMLHttpRequest"
            };
            
            const res = await req.loadJSON();
            
            if (res && res.result && res.result.length > 0) {
                const item = res.result[0];
                let nums = item.red;
                if (item.blue && item.blue.length > 0) {
                    nums = nums + " + " + item.blue;
                }
                if (type === "fc3d") {
                    nums = nums.replace(/,/g, " ");
                } else {
                    nums = nums.replace(/,/g, " "); 
                }
                
                result.full = `${name} ${item.code}期: ${nums}`;
                
                let pool = item.poolmoney || "0";
                result.pool = this.formatMoney(pool);
            }
        } catch(e) { console.log("CWL Error: " + e.message); }
    }

    if (result.full) {
        ConfigManager.saveCache(cacheKey, { data: result, timestamp: Date.now() });
        return result;
    }
    return null;
  }
  
  formatMoney(numStr) {
      let num = parseFloat(numStr.replace(/,/g, ""));
      if (isNaN(num)) return "统计中";
      if (num > 100000000) {
          return (num / 100000000).toFixed(2) + "亿";
      } else if (num > 10000) {
          return (num / 10000).toFixed(1) + "万";
      }
      return num + "元";
  }
  
  getLotterySchedule(type) {
      const day = new Date().getDay(); // 0 is Sun
      let text = "今日休市";
      
      const map = {
          "ssq": [0, 2, 4],
          "dlt": [1, 3, 6],
          "qlc": [1, 3, 5],
          "qxc": [0, 2, 5],
          "fc3d": [0,1,2,3,4,5,6],
          "pl3": [0,1,2,3,4,5,6],
          "pl5": [0,1,2,3,4,5,6]
      };
      
      let time = "21:30";
      if (["ssq", "qlc", "fc3d"].includes(type)) time = "21:15";
      
      if (map[type] && map[type].includes(day)) {
          return `今日开奖: ${time}`;
      } else {
          return "今日不开奖";
      }
  }

  async fetchWeather(freshSettings, location) {
    let weather = {};
    if (freshSettings.apiKey && location.latitude) {
      try {
        const timeNow = new Date().getTime();
        const url = `https://api.caiyunapp.com/v2.5/${freshSettings.apiKey}/${location.longitude},${location.latitude}/weather.json?alert=true&dailysteps=15&daily_steps=15&_t=${timeNow}`;
        const req = new Request(url); req.timeoutInterval = 15;
        const res = await req.loadJSON();
        weather = this.processWeather(res);
        if(weather.temp) ConfigManager.saveCache("weather_cache.json", weather);
      } catch (e) { const c = ConfigManager.readCache("weather_cache.json"); if(c) weather = c; }
    } else { const c = ConfigManager.readCache("weather_cache.json"); if(c) weather = c; }
    return weather;
  }

  async fetchPoetry(freshSettings) {
    let poetry = {};
    let isStyle2 = (freshSettings.styleModel === "modern" || (args.widgetParameter && args.widgetParameter.indexOf("style2") > -1));
    if (!isStyle2) {
        try {
          const pReq = new Request("https://v2.jinrishici.com/sentence"); pReq.timeoutInterval = 5;
          const pRes = await pReq.loadJSON(); poetry = pRes.data ? pRes : {};
        } catch (e) {}
    }
    return poetry;
  }

  async fetchSchedules(freshSettings) {
    let schedules = [];
    try { 
        const events = await CalendarEvent.today([]); 
        const now = new Date();
        
        let validEvents = events.filter(e => {
            if (e.title.startsWith("Canceled")) return false;
            if (e.isAllDay) return true;
            return e.endDate > now;
        });

        validEvents.sort((a, b) => {
            return a.startDate.getTime() - b.startDate.getTime();
        });

        schedules = validEvents.map(e => ({ title: e.title, isAllDay: e.isAllDay })); 
    } catch (e) {}
    return schedules;
  }

  processWeather(data) {
    if (!data || data.status !== "ok") return {};
    let info = {};
    if (data.result.alert && data.result.alert.content) info.alertTitle = data.result.alert.content.title;
    const daily = data.result.daily;
    if (daily.temperature) { info.min = Math.round(daily.temperature[0].min); info.max = Math.round(daily.temperature[0].max); }
    if (daily.temperature && daily.skycon) {
      info.future = [];
      for (let i = 1; i < 15; i++) {
        try {
          if (!daily.temperature[i]) break; 
          if (info.future.length >= 7) break;
          let dStr = daily.temperature[i].date;
          let dNum = parseInt(dStr.split("-")[2]);
          info.future.push({ day: dNum + "日", min: Math.round(daily.temperature[i].min), max: Math.round(daily.temperature[i].max), ico: weatherIcos[daily.skycon[i].value] || "sun.max.fill" });
        } catch(e){ break; }
      }
    }
    const rt = data.result.realtime;
    if (rt) {
      info.temp = Math.round(rt.apparent_temperature);
      info.ico = weatherIcos[rt.skycon] || "sun.max.fill";
      info.hum = Math.round(rt.humidity * 100) + "%";
      if (rt.life_index) {
        info.comfort = rt.life_index.comfort ? rt.life_index.comfort.desc : "";
        info.uv = rt.life_index.ultraviolet ? rt.life_index.ultraviolet.desc : "";
      }
      if (rt.air_quality && rt.air_quality.aqi) info.aqi = this.airQuality(rt.air_quality.aqi.chn);
    }
    if (data.result.forecast_keypoint) info.desc = data.result.forecast_keypoint;
    if (daily.astro && daily.astro[0]) { info.sunrise = daily.astro[0].sunrise.time; info.sunset = daily.astro[0].sunset.time; }
    return info;
  }

  async render() {
    const freshSettings = ConfigManager.load();
    this.settings = Object.assign({}, this.defaultData, freshSettings);
      
    const data = await this.fetchData();
    const w = new ListWidget();
    
    let currentModel = this.settings.styleModel || "classic";
    
    if (!config.runsInApp && args.widgetParameter) {
        if (args.widgetParameter.indexOf("style2") > -1) currentModel = "modern";
        if (args.widgetParameter.indexOf("style3") > -1) currentModel = "holiday";
        if (args.widgetParameter.indexOf("style4") > -1) currentModel = "schedule";
    }
    
    if (currentModel === "modern") {
        this.activePrefix = "s2_";
    } else if (currentModel === "holiday") {
        this.activePrefix = "s3_";
    } else if (currentModel === "schedule") {
        this.activePrefix = "s4_";
    } else {
        this.activePrefix = "s1_"; 
    }
    
    let refreshMinutes = parseInt(this.settings.refreshInterval) || 60;
    if (refreshMinutes < 5) refreshMinutes = 5;
    w.refreshAfterDate = new Date(new Date().getTime() + refreshMinutes * 60000);

    const isDark = Device.isUsingDarkAppearance();
    const modeSuffix = isDark ? "_night" : "_day";
    const bgNameGeneric = `bg_${this.activePrefix.replace("_","")}.jpg`;
    const bgNameMode = `bg_${this.activePrefix.replace("_","")}${modeSuffix}.jpg`;
    
    let bgImg = ConfigManager.getImg(bgNameMode);
    if (!bgImg) bgImg = ConfigManager.getImg(bgNameGeneric);
    
    if (bgImg) {
        w.backgroundImage = bgImg;
    } else {
        let colorKey1 = isDark ? `${this.activePrefix}color_bg_night` : `${this.activePrefix}color_bg_day`;
        let colorKey2 = isDark ? `${this.activePrefix}color_bg_2_night` : `${this.activePrefix}color_bg_2_day`;
        
        let c1 = this.settings[colorKey1] || this.settings[`${this.activePrefix}color_bg`] || "#000000";
        let c2 = this.settings[colorKey2] || this.settings[`${this.activePrefix}color_bg_2`];
        
        if (c2 && c2.length > 0) {
            let gradient = new LinearGradient();
            gradient.colors = [new Color(c1), new Color(c2)];
            gradient.locations = [0, 1];
            w.backgroundGradient = gradient;
        } else {
            w.backgroundColor = new Color(c1);
        }
    }
    
    w.setPadding(10, 4, 5, 4);
    
    if (this.widgetFamily === 'medium') await this.renderMedium(w, data);
    else await this.renderLarge(w, data);
    return w;
  }



  async renderMedium(w, data) {
    let body = w.addStack(); body.layoutHorizontally(); body.centerAlignContent();
    let left = body.addStack(); left.layoutVertically(); 
    this.applyLayout(left, "med_left", {t:0, l:8, b:0, r:0}); 
    await this.renderInfoSide(left, data);
    
    body.addSpacer();
    let right = body.addStack(); right.size = new Size(this.s(110,"weather"), 0); right.layoutVertically(); 
    this.applyLayout(right, "med_right", {t:0, l:0, b:0, r:5}); 
    await this.renderWeatherSide(right, data.weather);
  }

  async renderLarge(w, data) {
    const isHolidayStyle = (this.activePrefix === "s3_");
    const isScheduleStyle = (this.activePrefix === "s4_");
    const isComplexLayout = isHolidayStyle || isScheduleStyle;

    let top = w.addStack(); 
    top.layoutHorizontally(); 
    top.size = new Size(0, this.s(isComplexLayout ? 149 : 149, "weather"));
    
    let left = top.addStack(); left.layoutVertically(); 
    this.applyLayout(left, "lg_tl", {t:0, l:8, b:0, r:0}); 
    await this.renderInfoSide(left, data);
    
    top.addSpacer();
    
    let right = top.addStack(); right.size = new Size(this.s(110,"weather"), 0); right.layoutVertically(); 
    this.applyLayout(right, "lg_tr", {t:0, l:0, b:0, r:5}); 
    await this.renderWeatherSide(right, data.weather);
    
    w.addSpacer(isComplexLayout ? 0 : 4);
    
    let midStack = w.addStack(); midStack.layoutVertically(); 
    this.applyLayout(midStack, "lg_mid", {t:0, l:0, b:0, r:0}); 
    await this.renderTimeInfo(midStack);
    
    if (isComplexLayout) {
        let bottomWrapper = w.addStack();
        bottomWrapper.layoutHorizontally(); 
        
        let leftBottomContainer = bottomWrapper.addStack();
        leftBottomContainer.layoutVertically();
        
        if (isHolidayStyle) {
            this.applyLayout(leftBottomContainer, "lg_holiday", {t:0, l:9, b:0, r:0});
            await this.renderHolidayBox(leftBottomContainer);
        } else {
            this.applyLayout(leftBottomContainer, "lg_schedule", {t:0, l:9, b:0, r:0});
            await this.renderScheduleBox(leftBottomContainer, data.schedules);
        }
        
        bottomWrapper.addSpacer();

        let calendarContainer = bottomWrapper.addStack();
        calendarContainer.layoutVertically();
        
        let weekWrapper = calendarContainer.addStack();
        weekWrapper.layoutVertically();
        this.applyLayout(weekWrapper, "lg_week", {t:0, l:18, b:0, r:0});
        await this.renderWeekRow(weekWrapper);

        let gridWrapper = calendarContainer.addStack();
        gridWrapper.layoutVertically();
        this.applyLayout(gridWrapper, "lg_cal", {t:0, l:18, b:0, r:0});
        await this.renderCalendarGrid(gridWrapper);
    } else {
        w.addSpacer(4);
        
        let weekStack = w.addStack(); weekStack.layoutVertically(); 
        this.applyLayout(weekStack, "lg_week", {t:0, l:0, b:0, r:0}); 
        await this.renderWeekRow(weekStack);
        
        let calStack = w.addStack(); calStack.layoutVertically(); 
        this.applyLayout(calStack, "lg_cal", {t:0, l:0, b:0, r:0}); 
        await this.renderCalendarGrid(calStack);
    }

    w.addSpacer(); 
  }


  async renderHolidayBox(stack) {
    stack.centerAlignContent();
    let box = stack.addStack();
    box.size = new Size(this.s(100,"holiday"), 0); 
    box.layoutVertically();
    
    let holidayGap = parseFloat(this.settings[`${this.activePrefix}space_holiday_h`] || 2);

    let titleStack = box.addStack(); titleStack.centerAlignContent();
    let iSz = this.s(15,"holiday"); 
    let icon = titleStack.addImage(this.getSFIco("gift.fill")); icon.imageSize = new Size(iSz, iSz); 
    icon.tintColor = new Color("#FF5555");
    titleStack.addSpacer(4);
    this.addText(titleStack, "节日生日", 17, "holiday", true); 
    
    box.addSpacer(holidayGap); 

    // 获取混合了生日的列表
    const holidays = this.getNextHolidays();
    
    for (let h of holidays) {
      let r = box.addStack(); r.centerAlignContent();
      // 截取过长的名字
      let dispName = h.name.length > 4 ? h.name.substring(0,4) : h.name;
      this.addText(r, dispName, 17, "holiday"); 
      r.addSpacer();
      let dayStack = r.addStack(); dayStack.backgroundColor = h.days === 0 ? new Color("#FF5555") : new Color("#ffffff", 0.2);
      dayStack.cornerRadius = 3; dayStack.setPadding(1, 4, 1, 4);
      let t = dayStack.addText(h.days === 0 ? "今天" : h.days + "天"); t.font = Font.boldSystemFont(this.s(13,"holiday")); 
      t.textColor = h.days === 0 ? Color.white() : this.getConfColor("holiday");
      box.addSpacer(holidayGap); 
    }
  }

  async renderScheduleBox(stack, schedules) {
    stack.centerAlignContent();
    let box = stack.addStack();
    box.size = new Size(this.s(100,"schedule_title"), 0); 
    box.layoutVertically();
    
    let gap = parseFloat(this.settings[`${this.activePrefix}space_schedule_h`] || 2);
    let maxCount = parseInt(this.settings[`${this.activePrefix}schedule_count`]) || 3;
    
    let skipStr = this.settings[`${this.activePrefix}schedule_offset`] || "";
    let skipIndices = new Set(
        skipStr.replace(/，/g, ",") 
               .split(/[, ]+/)      
               .map(s => parseInt(s))
               .filter(n => !isNaN(n) && n > 0) 
               .map(n => n - 1)     
    );

    // 【新增】关键词过滤逻辑
    let keyword = this.settings[`${this.activePrefix}schedule_keyword`];
    let filteredSchedules = schedules;
    if (keyword && keyword.trim() !== "") {
        filteredSchedules = schedules.filter(e => e.title.includes(keyword));
    }

    let targetSchedules = filteredSchedules.filter((_, index) => !skipIndices.has(index));

    let titleStack = box.addStack(); titleStack.centerAlignContent();
    let iSz = this.s(15,"schedule_title"); 
    let icon = titleStack.addImage(this.getSFIco("calendar.badge.clock")); 
    icon.imageSize = new Size(iSz, iSz); 
    icon.tintColor = new Color("#55BEF0");
    titleStack.addSpacer(4);
    
    this.addText(titleStack, "日程安排", 17, "schedule_title", true); 
    
    box.addSpacer(gap); 

    if (targetSchedules.length === 0) {
        let r = box.addStack(); r.centerAlignContent();
        let tips = keyword ? "无含关键词日程" : "无后续安排";
        this.addText(r, tips, 12.2, "schedule_item");
    } else {
        let listWrapper = box.addStack();
        listWrapper.layoutVertically();
        let bgKey = `${this.activePrefix}color_schedule_bg`;
        let rawHex = this.settings[bgKey];
        if (!rawHex) rawHex = "#666666";
        let finalColor;
        try {
            let tempC = new Color(rawHex);
            finalColor = new Color(tempC.hex, 0.3);
        } catch (e) {
            finalColor = new Color("#666666", 0.3);
        }
        
        listWrapper.backgroundColor = finalColor;

        listWrapper.cornerRadius = 4;
        listWrapper.setPadding(4, 4, 4, 4);

        let count = Math.min(targetSchedules.length, maxCount);
        for (let i = 0; i < count; i++) {
            let item = targetSchedules[i];
            let r = listWrapper.addStack(); 
            
            r.topAlignContent(); 
            let dotWrapper = r.addStack();
            dotWrapper.setPadding(6, 0, 0, 0); 
            let dot = dotWrapper.addStack(); 
            dot.size = new Size(4,4); 
            dot.cornerRadius=2; 
            
            let itemColor;
            if (i < 6) {
                itemColor = this.getConfColor(`schedule_item_${i+1}`);
            } else {
                itemColor = new Color("#ffffff");
            }
            
            dot.backgroundColor = itemColor;
            r.addSpacer(4);
            
            let title = item.title;
            let splitIdx = -1;
            if (title.includes("柴油")) splitIdx = title.indexOf("柴油") + 2;
            else if (title.includes("汽油")) splitIdx = title.indexOf("汽油") + 2;
            
            if (splitIdx > -1) {
                let vStack = r.addStack();
                vStack.layoutVertically();
                let t1 = title.substring(0, splitIdx);
                let t2 = title.substring(splitIdx).trim();
                this.addText(vStack, t1, 12.2, "schedule_item", false, 0, 1, itemColor);
                this.addText(vStack, t2, 12.2, "schedule_item", false, 0, 1, itemColor);
            } else {
                let t = this.addText(r, title, 12.2, "schedule_item", false, 0, 2, itemColor); 
                t.lineLimit = 2;
            }
            
            if (i < count - 1) {
                listWrapper.addSpacer(gap);
            }
        }
    }
  }

  
  getNextHolidays() {
    const now = new Date(); 
    const currentYear = now.getFullYear();
    
    // 1. 定义公历固定节日
    const publicHolidays = [ 
      { name: "元旦", m: 1, d: 1 }, { name: "情人节", m: 2, d: 14 }, 
      { name: "妇女节", m: 3, d: 8 }, { name: "劳动节", m: 5, d: 1 }, 
      { name: "儿童节", m: 6, d: 1 }, { name: "建军节", m: 8, d: 1 }, 
      { name: "教师节", m: 9, d: 10 }, { name: "国庆节", m: 10, d: 1 }, 
      { name: "万圣节", m: 11, d: 1 }, { name: "圣诞节", m: 12, d: 25 } 
    ];
    
    // 2. 农历/变动节日映射表
    const holidayMap = { 
      2025: ["01-29", "04-04", "05-31", "10-06"], 
      2026: ["02-17", "04-05", "06-19", "09-25"], 
      2027: ["02-06", "04-05", "06-09", "09-15"], 
      2028: ["01-26", "04-04", "05-28", "10-03"], 
      2029: ["02-13", "04-04", "06-16", "09-22"], 
      2030: ["02-03", "04-05", "06-05", "09-12"],
      2031: ["01-23", "04-05", "06-24", "10-01"]
    };

    let allHolidays = [];
    
    // 辅助函数：安全创建日期
    const createDate = (y, m, d) => new Date(y, m - 1, d);
    const parseDateStr = (y, str) => {
        const p = str.split(/[-/]/);
        return new Date(y, parseInt(p[0]) - 1, parseInt(p[1]));
    };

    // 【核心修复】从去年(currentYear-1)开始循环，以捕捉年初时的上一农历年生日
    for (let y = currentYear - 1; y <= currentYear + 1; y++) {
      
      // 添加公历固定节日 (只添加今明两年的，去年的没必要算)
      if (y >= currentYear) {
          publicHolidays.forEach(h => { 
              allHolidays.push({ name: h.name, date: createDate(y, h.m, h.d) }); 
          });
      }

      // 添加变动节日 (春节等)
      if (y >= currentYear && holidayMap[y]) {
          const [spring, qingming, dragon, midAutumn] = holidayMap[y];
          let springDate = parseDateStr(y, spring);
          allHolidays.push({ name: "春节", date: springDate });
          allHolidays.push({ name: "除夕", date: new Date(springDate.getTime() - 24*60*60*1000) });
          allHolidays.push({ name: "元宵", date: new Date(springDate.getTime() + 14*24*60*60*1000) });
          allHolidays.push({ name: "清明", date: parseDateStr(y, qingming) });
          allHolidays.push({ name: "端午", date: parseDateStr(y, dragon) });
          allHolidays.push({ name: "中秋", date: parseDateStr(y, midAutumn) });
      }

      // 添加用户生日 (关键逻辑：无论哪一年都计算，后续靠filter过滤掉过去的)
      let bData = this.settings[`${this.activePrefix}birthday_list`] || "";
      if (bData) {
          let lines = bData.split("\n");
          for (let line of lines) {
              line = line.replace(/，/g, ",");
              let parts = line.split(",");
              if (parts.length < 2) continue;
              
              let name = parts[0].trim();
              let dateStr = parts[1].trim(); 
              let type = (parts.length > 2 && (parts[2].includes("农") || parts[2].includes("Lunar"))) ? "lunar" : "solar";
              
              let dm = dateStr.split(/[-/]/);
              if(dm.length !== 2) continue;
              let m = parseInt(dm[0]);
              let d = parseInt(dm[1]);
              
              let targetDate = null;
              try {
                  if (type === "lunar") {
                      // 这里会计算 2025年的农历11月14日 -> 得到 2026年1月2日
                      targetDate = getSolarFromLunar(y, m, d);
                  } else {
                      targetDate = createDate(y, m, d);
                  }
              } catch(e) {}
              
              if (targetDate && !isNaN(targetDate.getTime())) {
                  allHolidays.push({ name: name, date: targetDate });
              }
          }
      }
    }

    // 计算天数差并排序
    let today = new Date(); 
    today.setHours(0, 0, 0, 0);
    
    let results = allHolidays.map(h => { 
        if (!h.date) return null;
        let diff = (h.date - today) / (1000 * 60 * 60 * 24); 
        return { name: h.name, days: Math.ceil(diff), date: h.date }; 
    })
    .filter(h => h && !isNaN(h.days) && h.days >= 0) // 过滤掉已经过去的
    .sort((a, b) => a.days - b.days);
    
    // 去重逻辑
    let uniqueList = []; let seenKeys = new Set();
    for (let h of results) { 
        let key = h.name + "_" + h.days;
        if (!seenKeys.has(key)) { 
            seenKeys.add(key); 
            uniqueList.push(h); 
        } 
        if (uniqueList.length >= 5) break; 
    }
    return uniqueList;
  }


  applyLayout(s, c, b={t:0,l:0,b:0,r:0}) { 
    let x = parseInt(this.settings[`${this.activePrefix}layout_${c}_x`]) || 0;
    let y = parseInt(this.settings[`${this.activePrefix}layout_${c}_y`]) || 0; 
    
    let ft = b.t + y;
    let fl = b.l + x;
    let fb = b.b;
    let fr = b.r;

    if (ft < 0) { fb += Math.abs(ft); ft = 0; }
    if (fb < 0) { ft += Math.abs(fb); fb = 0; }
    if (fl < 0) { fr += Math.abs(fl); fl = 0; }
    if (fr < 0) { fl += Math.abs(fr); fr = 0; }
    
    s.setPadding(ft, fl, fb, fr); 
  }

  async renderInfoSide(stack, data) {
    const isStyle2 = (this.activePrefix === "s2_");
    
    const rawBat = this.settings[`${this.activePrefix}show_battery`];
    const rawPoe = this.settings[`${this.activePrefix}show_poetry`];
    
    const showBattery = (rawBat === undefined || rawBat === "true");
    const showPoetry = (rawPoe === undefined || rawPoe === "true");
    
    const date = new Date();
    
    let tStack = stack.addStack(); tStack.centerAlignContent();

    let hasLottery = (this.settings.lottery_type && this.settings.lottery_type !== "none" && data.lottery);

    if (hasLottery) {
        let parts = data.lottery.full.split(":"); 
        let titleStr = parts[0];
        let rawNums = parts.length > 1 ? parts[1].trim() : "";
        
        this.addText(tStack, titleStr, 14, "lotteryTitle", true);
        
        tStack.addSpacer(30);
        
        let statusBox = tStack.addStack();
        statusBox.backgroundColor = new Color("#666666", 0.3); 
        statusBox.cornerRadius = 4;
        statusBox.setPadding(1, 4, 1, 4);
        statusBox.centerAlignContent();
        
        let statusText = this.getLotterySchedule(data.lottery.type);
        this.addText(statusBox, statusText, 10, "lotteryInfo", false, 0, 1, this.getConfColor("lotteryInfo"));
        
        stack.addSpacer(2);
        let dStack = stack.addStack(); dStack.centerAlignContent();
        this.renderLotteryBalls(dStack, rawNums, this.settings.lottery_type, isStyle2);
        
        if (isStyle2) stack.addSpacer(2);
        
    } else {
        this.addText(tStack, this.getGreeting(date), 23, "greeting", true);
        let dStack = stack.addStack(); dStack.centerAlignContent();
        this.addText(dStack, this.getDateStr(date), 17, "date");
        dStack.addSpacer(4);
        let lunar = this.getLunarDate_Precise(date);
        this.addText(dStack, lunar.month + lunar.day, 17, "lunar");
    }
    
    stack.addSpacer(2);
    let iStack = stack.addStack(); iStack.centerAlignContent();
    this.addText(iStack, weekTitle[date.getDay()], 17, "info");
    
    if (showBattery) {
        iStack.addSpacer(4);
        this.addText(iStack, `🔋${Math.round(Device.batteryLevel()*100)}%`, 16, "info");
    }
    
    iStack.addSpacer(4);
    let city = this.location.locality || "";
    if(this.location.subLocality) city += ` ${this.location.subLocality}`;
    if(!city) city = "定位中";
    this.addText(iStack, `📍${city}`, 16, "info");
    
    let desc = data.weather.alertTitle || data.weather.desc || "暂无数据";
    this.addText(stack, desc, 13, "weather", false, 2, 3);
    
    stack.addSpacer(2); 
    let mix = stack.addStack(); mix.centerAlignContent();
    
    if (data.weather.future && data.weather.future.length > 0) {
      let fStack = mix.addStack();
      
      let useCompactMode = (isStyle2 || !showPoetry);
      let showLimit = useCompactMode ? 7 : 3;
      let spaceGap = useCompactMode ? 6 : 8;
      
      let count = Math.min(data.weather.future.length, showLimit);

      for(let i=0; i < count; i++) {
        let item = data.weather.future[i];
        let col = fStack.addStack(); col.layoutVertically(); col.centerAlignContent();
        
        if (useCompactMode) {
            let d = col.addText(item.day); d.font = Font.systemFont(this.s(10,"poetry")); d.textColor = this.getConfColor("poetry");
            col.addSpacer(1);
            let iSz = this.s(13,"weather"); 
            let ico = col.addImage(this.getSFIco(item.ico)); ico.imageSize = new Size(iSz,iSz); ico.tintColor = this.getConfColor("weather");
            col.addSpacer(1);
            let t = col.addText(`${item.min}/${item.max}°`); t.font = Font.systemFont(this.s(9,"poetry")); t.textColor = this.getConfColor("poetry");
        } else {
            this.addText(col, item.day, 11, "poetry");
            col.addSpacer(1);
            let ico = col.addImage(this.getSFIco(item.ico)); 
            let iSz = this.s(15,"weather");
            ico.imageSize = new Size(iSz, iSz); 
            ico.tintColor = this.getConfColor("weather");
            col.addSpacer(1);
            this.addText(col, `${item.min}/${item.max}°`, 10, "poetry");
        }

        if(i < count-1) fStack.addSpacer(spaceGap);
      }
      if (isStyle2 && count < 7) {
           mix.addSpacer(4);
           let warn = mix.addText("API仅" + count + "天"); warn.font = Font.systemFont(8); warn.textColor = Color.red();
      }
    } else {
        let e = mix.addText("无预报数据"); e.font = Font.systemFont(10); e.textColor = Color.red();
    }
    mix.addSpacer(10);
    
    if (showPoetry && !isStyle2 && data.poetry && data.poetry.data) {
      let pStack = mix.addStack(); pStack.layoutVertically(); pStack.backgroundColor = new Color("#666", 0.3); pStack.cornerRadius = 4; 
      pStack.setPadding(2, 4, 2, 4); 
      let content = data.poetry.data.content.replace(/[。，！]$/,"");
      let pt = this.addText(pStack, content, 11, "poetry"); pt.lineLimit = 3;
      pStack.addSpacer(2);
      let author = `${data.poetry.data.origin.dynasty}·${data.poetry.data.origin.author}`;
      let at = this.addText(pStack, `— ${author}`, 9, "poetry"); at.rightAlignText();
    }
    
    // 【修改部分】这里处理日程显示逻辑
    if (this.activePrefix !== "s4_" && data.schedules.length > 0) {
      
      // 1. 获取所有日程
      let displayEvents = data.schedules;
      
      // 2. 获取设置的关键词和序号
      let keyword = this.settings[`${this.activePrefix}schedule_keyword`];
      let targetIndex = parseInt(this.settings[`${this.activePrefix}schedule_index`]) || 0;
      
      // 3. 如果设置了关键词，进行过滤
      if (keyword && keyword.trim() !== "") {
          displayEvents = displayEvents.filter(e => e.title.includes(keyword));
      }
      
      // 4. 根据序号获取最终要显示的那一条
      let finalEvent = displayEvents[targetIndex];
      
      // 5. 如果找到了就显示
      if (finalEvent) {
          stack.addSpacer(4);
          let sStack = stack.addStack(); sStack.centerAlignContent();
          let sIco = sStack.addImage(this.getSFIco("megaphone")); sIco.imageSize = new Size(10,10); sIco.tintColor = this.getConfColor("info");
          sStack.addSpacer(4);
          this.addText(sStack, finalEvent.title, 11, "info");
      }
    }
  }

  
  renderLotteryBalls(stack, numString, type, isCompact = false) {
      const cRed = new Color("#FF3B30");
      const cBlue = new Color("#007AFF");
      
      let zones = numString.split("+");
      let frontNums = zones[0].trim().split(/[\s,]+/); 
      let backNums = [];
      if (zones.length > 1) {
          backNums = zones[1].trim().split(/[\s,]+/); 
      }
      
      let baseFontSize = this.s(14, "lotteryItem");
      let ballDiameter = Math.round(baseFontSize * (isCompact ? 1.5 : 1.7));
      
      const renderOneBall = (n, color) => {
          if (!n || n.trim() === "") return;
          let box = stack.addStack();
          box.size = new Size(ballDiameter, ballDiameter); 
          box.cornerRadius = ballDiameter / 2;
          box.backgroundColor = color;
          box.centerAlignContent();
          
          let t = box.addText(n);
          t.font = Font.boldSystemFont(baseFontSize);
          t.textColor = Color.white();
          
          stack.addSpacer(isCompact ? 3 : 4); 
      };
      
      for (let n of frontNums) renderOneBall(n, cRed);
      for (let n of backNums) renderOneBall(n, cBlue);
  }


  async renderWeatherSide(stack, w) {
    let top = stack.addStack(); top.bottomAlignContent(); stack.addSpacer(0); top.addSpacer();
    let ico = top.addImage(this.getSFIco(w.ico)); 
    let bigIcoSz = this.s(30, "weatherLarge");
    ico.imageSize = new Size(bigIcoSz, bigIcoSz); 
    ico.tintColor = this.getConfColor("weatherLarge");
    top.addSpacer(4);
    let temp = this.addText(top, `${w.temp||'-'}°`, 21, "weatherLarge"); temp.font = Font.boldMonospacedSystemFont(this.s(21, "weatherLarge"));
    stack.addSpacer(4);
    
    const addR = (t) => { let r = stack.addStack(); r.addSpacer(); this.addText(r, t, 12, "weather"); };
    addR(`湿度：${w.hum||'-'}`); addR(`舒适：${w.comfort||'-'}`); addR(`紫外：${w.uv||'-'}`); addR(`空气：${w.aqi||'-'}`);
    
    stack.addSpacer(2);
    let hl = stack.addStack(); hl.addSpacer();
    let ht = hl.addText(`↑${w.max||'-'}°`); ht.font = Font.systemFont(this.s(11,"weather")); ht.textColor = new Color("#ff5555");
    hl.addSpacer(4);
    let lt = hl.addText(`↓${w.min||'-'}°`); lt.font = Font.systemFont(this.s(11,"weather")); lt.textColor = new Color("#55ff55");
    stack.addSpacer(1);
    
    let sun = stack.addStack(); sun.addSpacer();
    let smIcoSz = this.s(12, "weather");
    let sunIco = sun.addImage(this.getSFIco("sunrise.fill")); sunIco.imageSize = new Size(smIcoSz,smIcoSz); 
    this.addText(sun, w.sunrise||"--:--", 11, "weather");
    sun.addSpacer(4);
    let setIco = sun.addImage(this.getSFIco("sunset.fill")); setIco.imageSize = new Size(smIcoSz,smIcoSz); 
    this.addText(sun, w.sunset||"--:--", 11, "weather");
    stack.addSpacer(2);
    
    let time = stack.addStack(); time.addSpacer();
    let d = new Date(); let min = d.getMinutes();
    this.addText(time, `更新 ${d.getHours()}:${min<10?'0'+min:min}`, 10, "weather");
  }


  async renderTimeInfo(stack) {
    let timeStack = stack.addStack(); timeStack.layoutHorizontally(); 
    timeStack.setPadding(0, 4, 0, 4);
    const currentDate = new Date();
    const lunarObj = this.getLunarDate_Precise(currentDate);
    const zodiac = zodiacAnimals[(lunarObj.year - 4) % 12];
    const weekNumber = getWeekOfYear(currentDate);
    const dayOfYear = getDayOfYear(currentDate);
    const totalDays = (currentDate.getFullYear() % 4 === 0) ? 366 : 365;

    let yiList = [];
    let jiList = [];
    
    try {
        const events = await CalendarEvent.today([]);
        for (const e of events) {
            if (!e.isAllDay) continue;
            let t = e.title;
            
            if (t.includes("宜")) {
                let content = t.substring(t.indexOf("宜") + 1);
                if (content.includes("忌")) content = content.split("忌")[0];
                content = content.replace(/^[:：\s]+/, ""); 
                let items = content.split(/[\s,，、\.．]+/).filter(x => x.trim().length > 0 && x.length < 6);
                if (items.length > 0) yiList = items;
            }
            
            if (t.includes("忌")) {
                let content = t.substring(t.indexOf("忌") + 1);
                if (content.includes("宜")) content = content.split("宜")[0];
                content = content.replace(/^[:：\s]+/, "");
                let items = content.split(/[\s,，、\.．]+/).filter(x => x.trim().length > 0 && x.length < 6);
                if (items.length > 0) jiList = items;
            }
        }
    } catch (err) {}

    if (yiList.length === 0) yiList = getYiJiSimple(currentDate, 0);
    if (jiList.length === 0) jiList = getYiJiSimple(currentDate, 1);

    let leftStack = timeStack.addStack(); leftStack.layoutVertically();
   leftStack.setPadding(0, 5, 0, 0);
    let zodiacLunarStack = leftStack.addStack(); zodiacLunarStack.centerAlignContent();
    this.addText(zodiacLunarStack, `${zodiac}年 ${lunarObj.month}${lunarObj.day}`, 12, "timeInfo");
    leftStack.addSpacer(0);
    let weekDayStack = leftStack.addStack(); weekDayStack.centerAlignContent();
    this.addText(weekDayStack, `第${weekNumber}/53周 第 ${dayOfYear}/${totalDays}天`, 10, "date");
    timeStack.addSpacer();
    let middleStack = timeStack.addStack(); middleStack.centerAlignContent();
    this.renderYiJi(middleStack, "宜", "#D32F2F", yiList, "#D32F2F");
    timeStack.addSpacer();
    let rightStack = timeStack.addStack(); rightStack.centerAlignContent();
    this.renderYiJi(rightStack, "忌", "#000000", jiList, "#ffffff");
  }



  renderYiJi(stack, title, circleColor, list, textColor) {
    let circle = stack.addStack(); 
    let cSz = this.s(30,"timeInfo");
    circle.size = new Size(cSz, cSz); 
    circle.cornerRadius = cSz/2; 
    circle.backgroundColor = new Color(circleColor); circle.centerAlignContent();
    let t = circle.addText(title); t.font = Font.boldSystemFont(this.s(17, "timeInfo")); t.textColor = Color.white();
    stack.addSpacer(8);
    let contentStack = stack.addStack(); contentStack.layoutVertically();
    if (list.length > 0) {
      let l1 = contentStack.addStack(); this.addText(l1, list.slice(0, 3).join("  "), 10, "timeInfo", false, 0, 1, new Color(textColor));
      if (list.length > 3) {
        let l2 = contentStack.addStack(); this.addText(l2, list.slice(3, 6).join("  "), 10, "timeInfo", false, 0, 1, new Color(textColor));
      }
    }
  }

  async renderWeekRow(stack) {
    let head = stack.addStack(); 
    head.setPadding(0,5,0,3);
    
    let defaultWeekGap = (this.activePrefix === "s3_" || this.activePrefix === "s4_") ? 8 : 30;
    let weekGap = parseFloat(this.settings[`${this.activePrefix}space_week_w`] || defaultWeekGap);

    for(let i=0; i<7; i++) {
      let c = head.addStack(); c.size = new Size(this.s(24,"calendar"), this.s(22,"calendar")); c.centerAlignContent();
      let t = c.addText(weekTitleShort[i]); t.font = Font.boldSystemFont(this.s(14, "calendar"));
      t.textColor = (i===0||i===6) ? new Color("#ff5555") : this.getConfColor("calendar");
      if(i<6) head.addSpacer(weekGap);
    }
  }

  async renderCalendarGrid(stack) {
    let d = new Date(); let year = d.getFullYear(); let month = d.getMonth();
    let grid = getMonthGrid(year, month);
    
    let colGap, rowGap;

    if (this.activePrefix === "s3_" || this.activePrefix === "s4_") {
        colGap = parseFloat(this.settings[`${this.activePrefix}space_cal_w`] || 7.3);
        rowGap = parseFloat(this.settings[`${this.activePrefix}space_cal_h`] || 0);
    } else {
        colGap = parseFloat(this.settings[`${this.activePrefix}space_cal_w`] || 29.2);
        rowGap = parseFloat(this.settings[`${this.activePrefix}space_cal_h`] || 3);
    }

    let cellSz = this.s(25,"calendar");

    for(let w=0; w<grid.length; w++) {
      let row = stack.addStack(); 
      row.setPadding(0,7,0,2);
      for(let i=0; i<7; i++) {
        let day = grid[w][i];
        let c = row.addStack(); c.size = new Size(cellSz, cellSz); c.layoutVertically(); c.centerAlignContent();
        if(day !== null) {
          let dateObj = new Date(year, month, day);
          let isToday = (day === d.getDate());
          let isWk = (i===0||i===6);
          let top = c.addStack(); top.size = new Size(this.s(17,"calendar"), this.s(17,"calendar")); top.centerAlignContent();
          if(isToday) {
            let circle = top.addStack(); circle.size = new Size(this.s(16,"calendar"), this.s(16,"calendar")); circle.cornerRadius = this.s(8,"calendar");
            circle.backgroundColor = new Color("#ffcc00"); circle.centerAlignContent();
            let dt = circle.addText(day.toString()); dt.font = Font.boldSystemFont(this.s(14,"calendar")); dt.textColor = Color.black();
          } else {
            let dt = top.addText(day.toString()); dt.font = Font.boldSystemFont(this.s(14,"calendar"));
            dt.textColor = isWk ? new Color("#ff5555") : this.getConfColor("calendar");
          }
          let lunar = this.getLunarDate_Precise(dateObj); let term = getSolarTerm(dateObj);
          let lStack = c.addStack(); lStack.setPadding(-1,1.5,0,0); lStack.centerAlignContent();
          let lt = lStack.addText(term || lunar.day); lt.font = Font.systemFont(this.s(9,"calendar"));
          lt.textColor = new Color(this.getConfColor("calendar").hex, 0.7);
        }
        if(i<6) row.addSpacer(colGap);
      }
      if(w<grid.length-1) stack.addSpacer(rowGap);
    }
  }

  addText(stack, text, size, type, bold=false, top=0, lines=1, forceColor=null) {
    if(top>0) stack.addSpacer(top);
    let t = stack.addText(String(text));
    t.font = bold ? Font.boldSystemFont(this.s(size, type)) : Font.systemFont(this.s(size, type));
    t.textColor = forceColor || this.getConfColor(type);
    if(lines>1) t.lineLimit = lines;
    return t;
  }
  
  s(size, type) { 
    let key = `${this.activePrefix}size_${type}`;
    let savedVal = this.settings[key];
    let scale = (parseInt(savedVal || "100") || 100) / 100;
    let globalScale = (parseInt(this.settings.global_font_size || "100") || 100) / 100;
    return Math.round(size * scale * globalScale); 
  }
  
  getConfColor(type) { 
    let key = `${this.activePrefix}color_${type}`;
    let c = this.settings[key]; 
    return c ? new Color(c) : new Color(baseConfigKeys[`color_${type}`] || "#ffffff"); 
  }

  getSFIco(name) { try { return SFSymbol.named(name).image } catch { return SFSymbol.named("sun.max.fill").image } }
  getDateStr(d) { let f = new DateFormatter(); f.locale="zh_cn"; f.dateFormat="yyyy年MM月d日"; return f.string(d); }
  getGreeting(d) {
    const h = d.getHours();
    let p = this.activePrefix;
    let custom = "";
    
    if(h < 5 || h >= 23) {
        custom = this.settings[`${p}text_greeting_night`];
        if(!custom) custom = greetingText.nightGreeting;
    } else if(h < 11) {
        custom = this.settings[`${p}text_greeting_morning`];
        if(!custom) custom = greetingText.morningGreeting;
    } else if(h < 13) {
        custom = this.settings[`${p}text_greeting_noon`];
        if(!custom) custom = greetingText.noonGreeting;
    } else if(h < 18) {
        custom = this.settings[`${p}text_greeting_afternoon`];
        if(!custom) custom = greetingText.afternoonGreeting;
    } else {
        custom = this.settings[`${p}text_greeting_evening`];
        if(!custom) custom = greetingText.nightText;
    }
    return custom;
  }

  airQuality(v) { if(v<=50)return "优"; if(v<=100)return "良"; if(v<=150)return "轻"; if(v<=200)return "中"; if(v<=300)return "重"; return "严"; }
  getLunarDate_Precise(date) { const lm=["正月","二月","三月","四月","五月","六月","七月","八月","九月","十月","冬月","腊月"]; const ld=["初一","初二","初三","初四","初五","初六","初七","初八","初九","初十","十一","十二","十三","十四","十五","十六","十七","十八","十九","二十","廿一","廿二","廿三","廿四","廿五","廿六","廿七","廿八","廿九","三十"]; let y=date.getFullYear(),m=date.getMonth()+1,d=date.getDate(); let i,sum=348,offset=(Date.UTC(y,m-1,d)-Date.UTC(1900,0,31))/86400000; for(i=1900;i<2101&&offset>0;i++){sum=lYearDays(i);offset-=sum;} if(offset<0){offset+=sum;i--;} let leap=lunarInfo[i-1900]&0xf,isLeap=false,j,md; for(j=1;j<13&&offset>0;j++){ md=(leap===j-1&&!isLeap)?((lunarInfo[i-1900]&0x10000)?30:29):((lunarInfo[i-1900]&(0x10000>>j))?30:29); if(isLeap&&j===leap+1)isLeap=false;else if(leap>0&&j===leap+1&&!isLeap){isLeap=true;--j;} offset-=md; } if(offset<0){offset+=md;--j;} if(j<1)j=1;if(j>12)j=12; return {year: i, month:(isLeap?"闰":"")+lm[j-1],day:ld[Math.floor(offset)]||"初一"}; }
}

// 【修复版】农历转公历辅助函数 (修复了重复累加闰月导致多出30天的问题)
function getSolarFromLunar(year, month, day) {
    if (year < 1900 || year > 2100) return null;
    let offset = 0;
    // 1. 计算到当年的总天数
    for (let i = 1900; i < year; i++) {
        offset += lYearDays(i);
    }
    // 2. 计算当年闰哪个月
    let leapMonth = lunarInfo[year - 1900] & 0xf;
    
    // 3. 加上当年的月份天数
    for (let m = 1; m < month; m++) {
        let daysInMonth = (lunarInfo[year - 1900] & (0x10000 >> m)) ? 30 : 29;
        offset += daysInMonth;
        
        // 如果当前遍历的月份就是闰月，则加上闰月天数 (例如闰6月，m=6遍历完后，需加闰6月的天数，才能到7月)
        if (leapMonth > 0 && m === leapMonth) {
             offset += ((lunarInfo[year - 1900] & 0x10000) ? 30 : 29);
        }
    }
    
    // 4. 加上日数
    offset += (day - 1);
    
    // 5. 生成公历日期 (1900-1-31 是农历1900年正月初一)
    let baseDate = new Date(1900, 0, 31);
    baseDate.setDate(baseDate.getDate() + offset);
    return baseDate;
}

function lYearDays(y){let i,sum=348;for(i=0x8000;i>0x8;i>>=1)sum+=(lunarInfo[y-1900]&i)?1:0;return sum+((lunarInfo[y-1900]&0xf)?((lunarInfo[y-1900]&0x10000)?30:29):0);}
function getSolarTerm(date) {
  const solarTerms = ["小寒", "大寒", "立春", "雨水", "惊蛰", "春分", "清明", "谷雨", "立夏", "小满", "芒种", "夏至", "小暑", "大暑", "立秋", "处暑", "白露", "秋分", "寒露", "霜降", "立冬", "小雪", "大雪", "冬至"];
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const cVal = [5.4055, 20.12, 3.87, 18.73, 5.63, 20.646, 4.81, 20.1, 5.52, 21.04, 5.678, 21.37, 7.108, 22.83, 7.5, 23.13, 7.646, 23.042, 8.318, 23.438, 7.438, 22.36, 7.18, 21.94];
  if (year < 2000 || year > 2099) return ""; 
  function calcDay(y, index) { return Math.floor((y - 2000) * 0.2422 + cVal[index]) - Math.floor((y - 2000) / 4); }
  let idx1 = (month - 1) * 2;
  let d1 = calcDay(year, idx1);
  if (day === d1) return solarTerms[idx1];
  let idx2 = (month - 1) * 2 + 1;
  let d2 = calcDay(year, idx2);
  if (day === d2) return solarTerms[idx2];
  return null;
}
function getMonthGrid(y,m){const f=new Date(y,m,1);const l=new Date(y,m+1,0);const days=l.getDate();const start=f.getDay();const g=[];let w=Array(start).fill(null);for(let i=1;i<=days;i++){w.push(i);if(w.length===7){g.push(w);w=[];}}if(w.length>0){while(w.length<7)w.push(null);g.push(w);}return g;}
function getStemBranchDay(date){const b=new Date(1900,0,31);const diff=Math.floor((date-b)/86400000);return heavenlyStems[(diff%10+10)%10]+earthlyBranches[(diff%12+12)%12];}
function getYellowBlackDay(date){let ld=getLunarDate_Precise_Simple(date);return yellowBlackDays[(ld.m+ld.d-2)%12];}
function getLunarDate_Precise_Simple(date){let y=date.getFullYear(),m=date.getMonth()+1,d=date.getDate();let i,sum=348,offset=(Date.UTC(y,m-1,d)-Date.UTC(1900,0,31))/86400000;for(i=1900;i<2101&&offset>0;i++){sum=lYearDays(i);offset-=sum;}if(offset<0){offset+=sum;i--;}let leap=lunarInfo[i-1900]&0xf,isLeap=false,j,md;for(j=1;j<13&&offset>0;j++){md=(leap===j-1&&!isLeap)?((lunarInfo[i-1900]&0x10000)?30:29):((lunarInfo[i-1900]&(0x10000>>j))?30:29);if(isLeap&&j===leap+1)isLeap=false;else if(leap>0&&j===leap+1&&!isLeap){isLeap=true;--j;}offset-=md;}if(offset<0){offset+=md;--j;}if(j<1)j=1;if(j>12)j=12;return {m:j,d:Math.floor(offset)+1};}
function getMansion(date){const b=new Date(1900,0,31);const diff=Math.floor((date-b)/86400000);return twentyEightMansions[(diff%28+28)%28];}
function isAuspiciousDay(date) { const yb=getYellowBlackDay(date), man=getMansion(date), goodYb=["除","危","定","执","成","开"], goodMan=["角","房","尾","箕","斗","室","壁","娄","胃","毕","参","井","张","轸"]; return goodYb.includes(yb) && goodMan.includes(man); }
function getTraditionalYiJi(date) { const sb=getStemBranchDay(date), yb=getYellowBlackDay(date), isAus=isAuspiciousDay(date); let yi=[],ji=[], stem=sb[0]; if(["甲","乙"].includes(stem)){yi.push("祭祀","祈福","入学","栽种");ji.push("动土","开市","破屋")}else if(["丙","丁"].includes(stem)){yi.push("嫁娶","开市","出行");ji.push("祭祀","动土","安葬")}else if(["戊","己"].includes(stem)){yi.push("修造","动土","入宅");ji.push("开市","嫁娶","出行")}else if(["庚","辛"].includes(stem)){yi.push("求医","诉讼","交易");ji.push("祈福","祭祀","安床")}else{yi.push("出行","移徙","纳财");ji.push("修造","动土","开仓")} const ybMap={"建":[["祭祀","祈福"],["嫁娶","开市"]],"除":[["治病","扫舍"],["出行","诉讼"]],"满":[["祭祀","开市"],["嫁娶","安葬"]],"平":[["修造","安床"],["开市","交易"]],"定":[["嫁娶","订盟"],["词讼","开渠"]],"执":[["捕捉","破土"],["嫁娶","移徙"]],"破":[["破屋","坏垣"],["嫁娶","开市"]],"危":[["安床","入宅"],["破土","开渠"]],"成":[["嫁娶","开市"],["造桥","安床"]],"收":[["纳财","交易"],["开市","安葬"]],"开":[["开市","交易"],["破土","安葬"]],"闭":[["筑堤","补垣"],["开市","出行"]]}; if(ybMap[yb]){yi.push(...ybMap[yb][0]);ji.push(...ybMap[yb][1])} if(isAus)yi.push("嫁娶","开市","入宅");else ji.push("嫁娶","开市","出行"); return {yi:[...new Set(yi)].slice(0,6),ji:[...new Set(ji)].slice(0,6)} }
function getYiJiSimple(d,t){const r=getTraditionalYiJi(d);return t===0?r.yi:r.ji;}
function getWeekOfYear(d){const D=new Date(Date.UTC(d.getFullYear(),d.getMonth(),d.getDate()));const dayNum=D.getUTCDay()||7;D.setUTCDate(D.getUTCDate()+4-dayNum);const yStart=new Date(Date.UTC(D.getUTCFullYear(),0,1));return Math.ceil((((D-yStart)/86400000)+1)/7);}
function getDayOfYear(d){return Math.floor((d-new Date(d.getFullYear(),0,0))/1000/60/60/24);}
function pad(n){return n<10?"0"+n:n;}

await Runing(CaishowWidget, args.widgetParameter, false);
