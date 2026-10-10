/*
 * 中国电信小组件（Egern 版）· 移植自移动液态玻璃风格 v23
 * 
 * 环境变量配置 (Env):
 *   CT_ACCOUNT    格式: 手机号:服务密码:token (例如 18888888888:123456:a60c***)
 *   CT_TITLE      小组件标题，默认 "中国电信"
 */

'use strict';

const C_FEE = '#FF9F0A';
const C_FLOW = '#0A84FF';
const C_OTHER = '#64D2FF';
const C_VOICE = '#30D158';
const WARN = '#FF453A';
const TXT = { light: '#000000', dark: '#FFFFFF' };
const SUB = { light: '#3C3C4399', dark: '#EBEBF599' };
const GLASS = { light: '#FFFFFFA6', dark: '#FFFFFF1A' };

function bg() {
  return {
    type: 'linear',
    colors: [{ light: '#EAF3FF', dark: '#0B1A33' }, { light: '#F4F0FF', dark: '#120B24' }, { light: '#E9FBF3', dark: '#03140F' }],
    stops: [0, 0.55, 1],
    startPoint: { x: 0, y: 0 },
    endPoint: { x: 1, y: 1 },
  };
}

function pad2(n) { return n < 10 ? `0${n}` : `${n}`; }

function fmtTime(ts) {
  const d = new Date(ts);
  return `${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

function toMB(d) {
  const n = parseFloat(d && d.number);
  if (!Number.isFinite(n)) return null;
  return d.unit === 'GB' ? n * 1024 : n;
}

function fmtMB(mb) {
  if (mb == null || !Number.isFinite(mb)) return '--';
  return mb >= 1024 ? `${(mb / 1024).toFixed(2)} GB` : `${mb.toFixed(0)} MB`;
}

function insights(ctx, ds) {
  const now = new Date();
  const dayKey = `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`;
  const dim = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const daysLeft = dim - now.getDate() + 1;
  
  const flowMB = toMB(ds.flow);
  let todayMB = null;
  if (flowMB != null) {
    let snap = null;
    try { snap = ctx.storage.getJSON('ct_day_snap'); } catch (e) {}
    if (!snap || snap.date !== dayKey || flowMB > snap.start + 1) {
      snap = { date: dayKey, start: flowMB };
      try { ctx.storage.setJSON('ct_day_snap', snap); } catch (e) {}
    }
    todayMB = Math.max(0, snap.start - flowMB);
  }
  
  const hist = [];
  if (todayMB != null) {
    let h = {};
    try { h = ctx.storage.getJSON('ct_hist') || {}; } catch (e) {}
    h[dayKey] = todayMB;
    const keep = {};
    for (let i = 7; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 86400000);
      const k = `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
      if (h[k] != null) keep[k] = h[k];
      if (i <= 6) hist.push(h[k] == null ? null : h[k]);
    }
    try { ctx.storage.setJSON('ct_hist', keep); } catch (e) {}
  }
  
  let forecast = { text: '用量统计中…', color: SUB };
  if (flowMB != null) {
    const past = hist.slice(0, 6).filter(v => v != null && v > 0);
    const vals = past.length ? past : (todayMB > 0 ? [todayMB] : []);
    if (vals.length) {
      const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
      const days = Math.floor(flowMB / avg);
      forecast = days >= daysLeft
        ? { text: days > 999 ? '按近期速度 充足' : `预计够用 ${days} 天 ✓`, color: C_VOICE }
        : { text: `约 ${days} 天用完 · 早于月底`, color: C_FEE };
    }
  }
  
  return {
    hist,
    forecast,
    daysLeft,
    todayMB,
    dailyMB: flowMB != null ? flowMB / daysLeft : null,
    lowFee: (() => { const n = parseFloat(ds.fee.number); return Number.isFinite(n) && n < 10; })(),
  };
}

/* ---------- 绘图组件 ---------- */

function ringSvg(pct, size, stroke) {
  const h = size / 2;
  const r = h - stroke / 2;
  const p = Math.max(0, Math.min(1, Number(pct) || 0));
  let body = `<circle cx='${h}' cy='${h}' r='${r}' fill='none' stroke='white' stroke-opacity='0.22' stroke-width='${stroke}'/>`;
  if (p > 0) {
    if (p >= 0.999) {
      body += `<circle cx='${h}' cy='${h}' r='${r}' fill='none' stroke='white' stroke-width='${stroke}'/>`;
    } else {
      const a = p * 2 * Math.PI;
      const x = (h + r * Math.sin(a)).toFixed(2), y = (h - r * Math.cos(a)).toFixed(2);
      body += `<path d='M ${h} ${(h - r).toFixed(2)} A ${r} ${r} 0 ${p > 0.5 ? 1 : 0} 1 ${x} ${y}' fill='none' stroke='white' stroke-width='${stroke}' stroke-linecap='round'/>`;
    }
  }
  return 'data:image/svg+xml,' + encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 ${size} ${size}'>${body}</svg>`);
}

function gaugeSvg(pct, color, w) {
  const stroke = 12, r = (w - stroke) / 2, cx = w / 2, cy = w / 2, h = w / 2 + stroke / 2;
  const p = Math.max(0, Math.min(1, Number(pct) || 0));
  const pt = a => [(cx - r * Math.cos(a)).toFixed(2), (cy - r * Math.sin(a)).toFixed(2)];
  const [x0, y0] = pt(0), [x1, y1] = pt(Math.PI), [xp, yp] = pt(Math.PI * p);
  let body = `<path d='M ${x0} ${y0} A ${r} ${r} 0 0 1 ${x1} ${y1}' fill='none' stroke='${color}' stroke-opacity='0.22' stroke-width='${stroke}' stroke-linecap='round'/>`;
  if (p > 0.005) body += `<path d='M ${x0} ${y0} A ${r} ${r} 0 0 1 ${xp} ${yp}' fill='none' stroke='${color}' stroke-width='${stroke}' stroke-linecap='round'/>`;
  return 'data:image/svg+xml,' + encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 ${w} ${h}'>${body}</svg>`);
}

function sparkSvg(values, color, w, h) {
  const vals = values && values.length ? values : [null, null, null, null, null, null, null];
  const n = vals.length, gap = 3, bw = (w - gap * (n - 1)) / n;
  const max = Math.max(1, ...vals.map(v => v || 0));
  let body = '';
  vals.forEach((v, i) => {
    const bh = v ? Math.max(2, (v / max) * h) : 2;
    const op = v == null ? 0.15 : (i === n - 1 ? 1 : 0.55);
    body += `<rect x='${(i * (bw + gap)).toFixed(1)}' y='${(h - bh).toFixed(1)}' width='${bw.toFixed(1)}' height='${bh.toFixed(1)}' rx='${Math.min(2, bw / 2).toFixed(1)}' fill='${color}' fill-opacity='${op}'/>`;
  });
  return 'data:image/svg+xml,' + encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 ${w} ${h}'>${body}</svg>`);
}

/* ---------- UI 构建块 ---------- */

function t(text, size, weight, color, extra) {
  return Object.assign({ type: 'text', text: String(text), font: { size, weight: weight || 'regular' }, textColor: color || TXT, maxLines: 1, minScale: 0.6 }, extra || {});
}

function glass(children, extra) {
  return Object.assign({ type: 'stack', direction: 'column', alignItems: 'start', gap: 6, padding: 12, borderRadius: 22, backgroundColor: GLASS, children }, extra || {});
}

function header(title, ds, phone) {
  const masked = /^\d{11}$/.test(phone) ? `${phone.slice(0, 3)}****${phone.slice(7)}` : '';
  return {
    type: 'stack', direction: 'row', alignItems: 'center', gap: 4,
    children: [
      { type: 'image', src: 'sf-symbol:antenna.radiowaves.left.and.right', width: 12, height: 12, color: C_FLOW },
      t(title + (masked ? ` (${masked})` : ''), 'footnote', 'semibold'),
      { type: 'spacer' },
      t(`更新 ${ds && ds.updatedAt ? fmtTime(ds.updatedAt) : '--'}`, 10, 'regular', SUB, { minScale: 1 }),
    ],
  };
}

function gaugeCard(icon, color, d, fallbackTitle, opt) {
  const o = opt || {};
  const data = d || { title: fallbackTitle, number: '--', unit: '', percent: 0 };
  const pct = data.percent > 0 ? Math.round(data.percent * 100) : 0;
  const gw = o.gw || 46;
  return glass([
    {
      type: 'stack', direction: 'row', alignItems: 'center', gap: 3,
      children: [
        { type: 'image', src: `sf-symbol:${icon}`, width: 10, height: 10, color },
        t(o.title || data.title || fallbackTitle, 9, 'medium', SUB, { minScale: 1 }),
      ],
    },
    {
      type: 'stack', direction: 'column', alignItems: 'center', gap: -3,
      children: [
        { type: 'image', src: gaugeSvg(data.percent, color, 64), width: gw, height: Math.round(gw * 38 / 64) },
        t(`${pct}%`, 9, 'bold', color, { minScale: 1 }),
      ],
    },
    {
      type: 'stack', direction: 'row', alignItems: 'end', gap: 2,
      children: [
        t(data.number, o.numSize || 15, 'bold', TXT, { minScale: 0.7 }),
        t(data.unit || '', 9, 'semibold', SUB, { minScale: 1 }),
      ],
    },
  ], { flex: 1, alignItems: 'center', gap: 2, padding: [7, 4], borderRadius: 16, ...(o.height ? { height: o.height } : {}) });
}

function feeCard(ds, ins, size, extra) {
  const low = ins.lowFee;
  return glass([
    {
      type: 'stack', direction: 'row', alignItems: 'center', gap: 3,
      children: [
        { type: 'image', src: 'sf-symbol:yensign.circle.fill', width: 10, height: 10, color: low ? WARN : C_FEE },
        t(low ? '话费不足' : '剩余话费', 9, 'medium', low ? WARN : SUB, { minScale: 1 }),
      ],
    },
    { type: 'spacer' },
    {
      type: 'stack', direction: 'row', alignItems: 'end', gap: 1,
      children: [t('¥', 11, 'semibold', low ? WARN : SUB, { minScale: 1 }), t(ds.fee.number, size || 22, 'bold', low ? WARN : TXT, { minScale: 0.6 })],
    },
    t(`本月剩 ${ins.daysLeft} 天`, 9, 'medium', SUB, { minScale: 1 }),
    ...(extra && extra.alignItems === 'center' ? [{ type: 'spacer' }] : []),
  ], Object.assign({ gap: 2, padding: [7, 9], borderRadius: 16 }, extra || {}));
}

function statsStrip(ins, sparkW) {
  return glass([
    {
      type: 'stack', direction: 'row', alignItems: 'center', gap: 6,
      children: [
        { type: 'image', src: sparkSvg(ins.hist, C_FLOW, 70, 14), width: sparkW || 46, height: 11 },
        t(`今日 ${fmtMB(ins.todayMB)}`, 9, 'semibold', TXT, { minScale: 1 }),
        t(`日均可用 ${fmtMB(ins.dailyMB)}`, 9, 'medium', SUB, { minScale: 1 }),
        { type: 'spacer' },
        t(ins.forecast.text, 9, 'semibold', ins.forecast.color, { minScale: 0.8 }),
      ],
    },
  ], { padding: [6, 9], borderRadius: 12, gap: 0 });
}

function pctText(d) { return d && d.percent > 0 ? `${Math.round(d.percent * 100)}%` : ''; }

/* ---------- 核心逻辑层 ---------- */

async function loadData(ctx) {
  const account = (ctx.env.CT_ACCOUNT || '').trim();
  if (!account) return { configured: false, reason: 'no_account' };

  const [phone, pwd, token] = account.split(':').map(s => s.trim());
  if (!phone || !pwd || !token) return { configured: false, reason: 'format_error' };

  const url = `https://api.iosxx.cn/dxcx.php?ChinaTelecom=${phone}*${pwd}*${token}`;

  try {
    const resp = await ctx.http.get(url, { timeout: 15000 });
    const text = typeof resp.text === 'function' ? await resp.text() : String(resp.body || '');
    const res = JSON.parse(text);

    if (res.status === "success" && res.results && res.results.length > 0) {
      const info = res.results[0];
      if (info.success && info.data) {
        const d = info.data;
        
        let totalFlowPercent = 0;
        if (d.total_flow && parseFloat(d.total_flow.total) > 0) {
            totalFlowPercent = parseFloat(d.total_flow.balance) / parseFloat(d.total_flow.total);
        }
        
        let voicePercent = 0;
        if (d.voice && parseFloat(d.voice.total) > 0) {
            voicePercent = parseFloat(d.voice.balance) / parseFloat(d.voice.total);
        }

        const ds = {
          fee: { title: '剩余话费', number: d.balance ? d.balance.amount : '0.00', unit: '元' },
          flow: { 
              title: '通用流量', 
              number: d.common_flow ? d.common_flow.balance : (d.total_flow ? d.total_flow.balance : '0'), 
              unit: d.common_flow ? d.common_flow.unit : 'GB', 
              percent: totalFlowPercent 
          },
          otherFlow: { 
              title: '定向流量', 
              number: d.special_flow ? d.special_flow.balance : '0', 
              unit: d.special_flow ? d.special_flow.unit : 'GB', 
              percent: 0 
          },
          voice: { 
              title: '剩余语音', 
              number: d.voice ? d.voice.balance : '0', 
              unit: d.voice ? d.voice.unit : '分钟', 
              percent: voicePercent 
          },
          updatedAt: Date.now(),
          phone: phone
        };
        return { configured: true, ds };
      }
    }
    return { configured: true, error: "接口返回数据异常" };
  } catch (e) {
    return { configured: true, error: String((e && e.message) || e) };
  }
}

function refresh30() { return new Date(Date.now() + 30 * 60 * 1000).toISOString(); }

function buildError(title, message) {
  return { 
    type: 'widget', padding: 14, gap: 6, backgroundGradient: bg(), 
    children: [
      t(title, 'footnote', 'semibold'),
      { type: 'spacer' },
      { type: 'image', src: 'sf-symbol:exclamationmark.triangle.fill', width: 22, height: 22, color: C_FEE },
      t(message, 'caption1', 'medium', TXT, { maxLines: 4, minScale: 0.7 }),
      { type: 'spacer' }
    ] 
  };
}

/* ---------- 渲染模板 ---------- */

function buildSmall(title, ds, ctx) {
  const ins = insights(ctx, ds);
  return {
    type: 'widget', padding: 12, gap: 5, backgroundGradient: bg(), refreshAfter: refresh30(),
    children: [
      {
        type: 'stack', direction: 'row', alignItems: 'center', gap: 4,
        children: [
          { type: 'image', src: 'sf-symbol:antenna.radiowaves.left.and.right', width: 11, height: 11, color: C_FLOW },
          t(title, 'caption1', 'semibold'),
          { type: 'spacer' },
          t(`¥${ds.fee.number}`, 11, 'bold', ins.lowFee ? WARN : C_FEE, { minScale: 1 }),
        ],
      },
      {
        type: 'stack', direction: 'row', alignItems: 'center', gap: 4, flex: 1,
        children: [
          {
            type: 'stack', direction: 'column', alignItems: 'start', gap: 0,
            children: [
              t('剩余流量', 9, 'medium', SUB, { minScale: 1 }),
              { type: 'stack', direction: 'row', alignItems: 'end', gap: 2, children: [t(ds.flow.number, 22, 'bold', TXT), t(ds.flow.unit || '', 9, 'semibold', SUB, { minScale: 1 })] },
            ],
          },
          { type: 'spacer' },
          {
            type: 'stack', direction: 'column', alignItems: 'center', gap: -3,
            children: [
              { type: 'image', src: gaugeSvg(ds.flow.percent, C_FLOW, 64), width: 42, height: 25 },
              t(pctText(ds.flow) || '0%', 9, 'bold', C_FLOW, { minScale: 1 }),
            ],
          },
        ],
      },
      {
        type: 'stack', direction: 'row', alignItems: 'end', gap: 5,
        children: [
          { type: 'image', src: sparkSvg(ins.hist, C_FLOW, 70, 14), width: 44, height: 11 },
          t(`今日 ${fmtMB(ins.todayMB)}`, 9, 'semibold', TXT, { minScale: 1 }),
        ],
      },
      t(`定向 ${ds.otherFlow.number}${ds.otherFlow.unit} · 语音 ${ds.voice.number}${ds.voice.unit}`, 9, 'medium', SUB, { minScale: 0.75 }),
      t(`日均可用 ${fmtMB(ins.dailyMB)} · ${ins.forecast.text}`, 9, 'semibold', ins.forecast.color, { minScale: 0.7 }),
    ],
  };
}

function buildMedium(title, ds, ctx) {
  const ins = insights(ctx, ds);
  return {
    type: 'widget', padding: [10, 11], gap: 6, backgroundGradient: bg(), refreshAfter: refresh30(),
    children: [
      header(title, ds, ds.phone),
      {
        type: 'stack', direction: 'row', alignItems: 'center', gap: 6, flex: 1,
        children: [
          feeCard(ds, ins, 21, { width: 84, height: 82, alignItems: 'center' }),
          gaugeCard('wifi', C_FLOW, ds.flow, '通用流量', { height: 82 }),
          gaugeCard('globe.asia.australia.fill', C_OTHER, ds.otherFlow, '定向流量', { height: 82 }),
          gaugeCard('phone.fill', C_VOICE, ds.voice, '剩余语音', { height: 82 }),
        ],
      },
      statsStrip(ins, 40),
    ],
  };
}

export default async function (ctx) {
  const title = (ctx.env.CT_TITLE || '中国电信').trim() || '中国电信';
  const r = await loadData(ctx);

  if (!r.configured) {
    if (r.reason === 'no_account') return buildError(title, '请在模块 Env 里填写 CT_ACCOUNT（手机号:服务密码:Token）');
    if (r.reason === 'format_error') return buildError(title, 'CT_ACCOUNT 格式错误，请检查是否有漏填');
  }
  
  if (r.error || !r.ds) {
    return buildError(title, `查询失败: ${r.error || '未知错误'}`);
  }

  const family = ctx.widgetFamily || 'systemSmall';
  if (family === 'systemMedium' || family === 'systemLarge' || family === 'systemExtraLarge') {
    return buildMedium(title, r.ds, ctx);
  }
  
  return buildSmall(title, r.ds, ctx);
}
