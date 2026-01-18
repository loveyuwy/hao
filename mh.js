const body = {
  "code": 200,
  "data": {
    "user_id": "1FE90D5D-99F0-48F1-B5AA-CD84C3714C43",
    "user_id_display": "火华测试脚本", // 自定义显示的用户名
    "environment": "Production",
    "expires_date": "5200-12-10T15:42:19Z", // 过期时间：5200年
    "status": "ACTIVE",
    "auto_renewal_status": "OFF"
  },
  "created_at": 1768546069291
};

$done({
  body: JSON.stringify(body, null, 2)
});

