#!name=声荐每日自动签到
#!desc=微信小程序声荐每日签到加领取小红花。
#!author=〈ザㄩメ火华 (Modified by Gemini)
#!icon=https://raw.githubusercontent.com/loveyuwy/hao/refs/heads/main/SJ.png

[Argument]
# 开启/关闭 自动抓取Token, 默认开启, 抓到后可关闭
enable_token_capture = switch, true, true, tag = 抓取Token开关, desc = 默认开启。抓取Token成功后, 可关闭此开关

# 通知模式: 开启=每次通知, 关闭=仅22点汇总
notify = switch, true, false, tag = 每次通知, desc = 开启后每次脚本运行都发送通知；关闭后仅在22点发送当日汇总通知。

# CRON表达式, 默认 10,16,22 点运行
cron = input, "0 10-22/6 * * *", tag = 执行时间, desc = CRON表达式, 默认10,16,22点运行

[Script]
# 自动抓取Token
http-response ^https:\/\/xcx\.myinyun\.com:4438\/napi\/wx\/login script-path=https://raw.githubusercontent.com/loveyuwy/hao/refs/heads/main/sjtoken.js, requires-body=true, timeout=60, tag=声荐自动抓取token, enable = {enable_token_capture}

# 每日任务 (传入 notify 参数)
cron {cron} script-path=https://raw.githubusercontent.com/loveyuwy/hao/refs/heads/main/loonsj.js, timeout=60, tag=声荐每日任务, argument="notify={notify}"

[MITM]
hostname = xcx.myinyun.com
