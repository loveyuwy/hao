#!name=声荐每日自动签到
#!desc=静默关闭时实时通知，静默打开时 23:00 后汇总总结。支持自定义 Cron 时间。
#!author=〈ザㄩメ火华
#!icon=https://raw.githubusercontent.com/loveyuwy/hao/refs/heads/main/SJ.png

[Argument]
# 自定义 CRON 执行时间
cron_exp = input, "0 10,11,12,23 * * *", tag = 执行时间, desc = 设置脚本自动签到的 CRON 表达式
# 静默运行开关
silent_switch = switch, false, tag = 静默运行, desc = 开启后：23点前静默，23点后发汇总；关闭后：每次实时通知。

[Script]
# 使用 argument=silent_switch 传递开关变量名
cron {cron_exp} script-path=https://raw.githubusercontent.com/loveyuwy/hao/refs/heads/main/loonsj.js, timeout=60, tag=声荐任务, argument=silent_switch

[MITM]
hostname = xcx.myinyun.com
