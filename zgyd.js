/**
 * 
 * 
中国移动（Quantumult X BoxJS ）
功能：短信登录凭证捕获 / BoxJS 账号池同步 / 多账号话费与流量查询
订阅boxjs:https://raw.githubusercontent.com/loveyuwy/hao/refs/heads/main/zgyd.json
Quantumult X需在配置[task_local]里手动添加定时运行脚本
[task_local]
# 定时任务：自动从 BoxJS 读取账号并后台保活刷新（默认每 20 分钟）
*/20 * * * * https://raw.githubusercontent.com/loveyuwy/hao/refs/heads/main/zgyd.js, tag=中国移动多卡同步, img-url=https://raw.githubusercontent.com/yuhuohua/tupiao/refs/heads/main/zgyd.png 
[rewrite_local]
# 扩大 MITM 匹配范围，捕获所有中国移动 App 的加密及登录请求
^https?:\/\/(client\.app\.coc\.10086\.cn|10086\.online-cmcc\.cn)(:\d+)?\/(cache_server|biz-orange)\/ url script-request-body https://raw.githubusercontent.com/loveyuwy/hao/refs/heads/main/zgyd.js
^https?:\/\/(client\.app\.coc\.10086\.cn|10086\.online-cmcc\.cn)(:\d+)?\/(cache_server|biz-orange)\/ url script-response-body https://raw.githubusercontent.com/loveyuwy/hao/refs/heads/main/zgyd.js

[mitm]
hostname = client.app.coc.10086.cn, 10086.online-cmcc.cn, *.10086.cn
 */

'use strict';

'use strict';

const isQX = typeof $task !== 'undefined';
const isLoon = typeof $loon !== 'undefined';
const isSurge = typeof $httpClient !== 'undefined' && !isLoon;

if (isQX) {
  globalThis.$persistentStore = {
    read: (key) => $prefs.valueForKey(key),
    write: (val, key) => $prefs.setValueForKey(String(val), key)
  };
  globalThis.$httpClient = {
    post: (options, callback) => {
      const qxOpts = {
        url: options.url,
        method: 'POST',
        headers: options.headers || {},
        body: options.body || ''
      };
      if (options.timeout) qxOpts.timeout = options.timeout;
      $task.fetch(qxOpts).then(
        resp => {
          resp.status = resp.statusCode;
          callback(null, resp, resp.body);
        },
        err => callback(err.error, null, null)
      );
    }
  };
  globalThis.$notification = {
    post: (title, subtitle, body) => $notify(title, subtitle, body)
  };
}

function utf8Bytes(str) {
  const out = [];
  for (let i = 0; i < str.length; i++) {
    let c = str.charCodeAt(i);
    if (c >= 0xd800 && c <= 0xdbff && i + 1 < str.length) {
      const lo = str.charCodeAt(i + 1);
      if (lo >= 0xdc00 && lo <= 0xdfff) {
        c = 0x10000 + ((c - 0xd800) << 10) + (lo - 0xdc00);
        i++;
      }
    }
    if (c < 0x80) out.push(c);
    else if (c < 0x800) out.push(0xc0 | (c >> 6), 0x80 | (c & 0x3f));
    else if (c < 0x10000) out.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 0x3f), 0x80 | (c & 0x3f));
    else out.push(0xf0 | (c >> 18), 0x80 | ((c >> 12) & 0x3f), 0x80 | ((c >> 6) & 0x3f), 0x80 | (c & 0x3f));
  }
  return out;
}

function utf8String(bytes) {
  let s = '';
  for (let i = 0; i < bytes.length;) {
    const b = bytes[i];
    if (b < 0x80) { s += String.fromCharCode(b); i++; }
    else if ((b & 0xe0) === 0xc0) { s += String.fromCharCode(((b & 0x1f) << 6) | (bytes[i + 1] & 0x3f)); i += 2; }
    else if ((b & 0xf0) === 0xe0) { s += String.fromCharCode(((b & 0x0f) << 12) | ((bytes[i + 1] & 0x3f) << 6) | (bytes[i + 2] & 0x3f)); i += 3; }
    else {
      const c = ((b & 0x07) << 18) | ((bytes[i + 1] & 0x3f) << 12) | ((bytes[i + 2] & 0x3f) << 6) | (bytes[i + 3] & 0x3f);
      const v = c - 0x10000;
      s += String.fromCharCode(0xd800 + (v >> 10), 0xdc00 + (v & 0x3ff));
      i += 4;
    }
  }
  return s;
}

function bytesToHex(bytes) {
  return bytes.map((b) => ('0' + (b & 0xff).toString(16)).slice(-2)).join('');
}

const B64MAP = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
function base64Encode(bytes) {
  let s = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i], b1 = i + 1 < bytes.length ? bytes[i + 1] : 0, b2 = i + 2 < bytes.length ? bytes[i + 2] : 0;
    const n = (b0 << 16) | (b1 << 8) | b2;
    s += B64MAP[(n >> 18) & 63] + B64MAP[(n >> 12) & 63] + (i + 1 < bytes.length ? B64MAP[(n >> 6) & 63] : '=') + (i + 2 < bytes.length ? B64MAP[n & 63] : '=');
  }
  return s;
}

function md5Hex(str) {
  const msg = utf8Bytes(str);
  const bitLen = msg.length * 8;
  msg.push(0x80);
  while (msg.length % 64 !== 56) msg.push(0);
  for (let i = 0; i < 8; i++) msg.push((bitLen / Math.pow(2, i * 8)) & 0xff);

  let a0 = 0x67452301, b0 = 0xefcdab89, c0 = 0x98badcfe, d0 = 0x10325476;
  const S = [7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22,
             5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20,
             4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23,
             6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21];
  const K = [];
  for (let i = 0; i < 64; i++) K.push(Math.floor(Math.abs(Math.sin(i + 1)) * 4294967296) >>> 0);

  const add = (x, y) => (x + y) >>> 0;
  const rol = (x, n) => ((x << n) | (x >>> (32 - n))) >>> 0;

  for (let off = 0; off < msg.length; off += 64) {
    const M = [];
    for (let i = 0; i < 16; i++) {
      M.push((msg[off + i * 4] | (msg[off + i * 4 + 1] << 8) | (msg[off + i * 4 + 2] << 16) | (msg[off + i * 4 + 3] << 24)) >>> 0);
    }
    let A = a0, B = b0, C = c0, D = d0;
    for (let i = 0; i < 64; i++) {
      let F, g;
      if (i < 16) { F = (B & C) | (~B & D); g = i; }
      else if (i < 32) { F = (D & B) | (~D & C); g = (5 * i + 1) % 16; }
      else if (i < 48) { F = B ^ C ^ D; g = (3 * i + 5) % 16; }
      else { F = C ^ (B | ~D); g = (7 * i) % 16; }
      F = add(add(add(F, A), K[i]), M[g]);
      A = D; D = C; C = B;
      B = add(B, rol(F, S[i]));
    }
    a0 = add(a0, A); b0 = add(b0, B); c0 = add(c0, C); d0 = add(d0, D);
  }
  const le = (x) => [x & 0xff, (x >> 8) & 0xff, (x >> 16) & 0xff, (x >> 24) & 0xff];
  return bytesToHex([].concat(le(a0), le(b0), le(c0), le(d0)));
}

const AES_SBOX = [
  0x63,0x7c,0x77,0x7b,0xf2,0x6b,0x6f,0xc5,0x30,0x01,0x67,0x2b,0xfe,0xd7,0xab,0x76,
  0xca,0x82,0xc9,0x7d,0xfa,0x59,0x47,0xf0,0xad,0xd4,0xa2,0xaf,0x9c,0xa4,0x72,0xc0,
  0xb7,0xfd,0x93,0x26,0x36,0x3f,0xf7,0xcc,0x34,0xa5,0xe5,0xf1,0x71,0xd8,0x31,0x15,
  0x04,0xc7,0x23,0xc3,0x18,0x96,0x05,0x9a,0x07,0x12,0x80,0xe2,0xeb,0x27,0xb2,0x75,
  0x09,0x83,0x2c,0x1a,0x1b,0x6e,0x5a,0xa0,0x52,0x3b,0xd6,0xb3,0x29,0xe3,0x2f,0x84,
  0x53,0xd1,0x00,0xed,0x20,0xfc,0xb1,0x5b,0x6a,0xcb,0xbe,0x39,0x4a,0x4c,0x58,0xcf,
  0xd0,0xef,0xaa,0xfb,0x43,0x4d,0x33,0x85,0x45,0xf9,0x02,0x7f,0x50,0x3c,0x9f,0xa8,
  0x51,0xa3,0x40,0x8f,0x92,0x9d,0x38,0xf5,0xbc,0xb6,0xda,0x21,0x10,0xff,0xf3,0xd2,
  0xcd,0x0c,0x13,0xec,0x5f,0x97,0x44,0x17,0xc4,0xa7,0x7e,0x3d,0x64,0x5d,0x19,0x73,
  0x60,0x81,0x4f,0xdc,0x22,0x2a,0x90,0x88,0x46,0xee,0xb8,0x14,0xde,0x5e,0x0b,0xdb,
  0xe0,0x32,0x3a,0x0a,0x49,0x06,0x24,0x5c,0xc2,0xd3,0xac,0x62,0x91,0x95,0xe4,0x79,
  0xe7,0xc8,0x37,0x6d,0x8d,0xd5,0x4e,0xa9,0x6c,0x56,0xf4,0xea,0x65,0x7a,0xae,0x08,
  0xba,0x78,0x25,0x2e,0x1c,0xa6,0xb4,0xc6,0xe8,0xdd,0x74,0x1f,0x4b,0xbd,0x8b,0x8a,
  0x70,0x3e,0xb5,0x66,0x48,0x03,0xf6,0x0e,0x61,0x35,0x57,0xb9,0x86,0xc1,0x1d,0x9e,
  0xe1,0xf8,0x98,0x11,0x69,0xd9,0x8e,0x94,0x9b,0x1e,0x87,0xe9,0xce,0x55,0x28,0xdf,
  0x8c,0xa1,0x89,0x0d,0xbf,0xe6,0x42,0x68,0x41,0x99,0x2d,0x0f,0xb0,0x54,0xbb,0x16];
const AES_INV_SBOX = new Array(256);
for (let i = 0; i < 256; i++) AES_INV_SBOX[AES_SBOX[i]] = i;
const AES_RCON = [0x01,0x02,0x04,0x08,0x10,0x20,0x40,0x80,0x1b,0x36];

function aesKeyExpand(keyBytes) {
  const Nk = 4, Nb = 4, Nr = 10;
  const W = new Array(4 * (Nr + 1));
  for (let i = 0; i < Nk; i++) {
    W[i] = (keyBytes[4*i] << 24) | (keyBytes[4*i+1] << 16) | (keyBytes[4*i+2] << 8) | keyBytes[4*i+3];
  }
  for (let i = Nk; i < 4 * (Nr + 1); i++) {
    let t = W[i - 1];
    if (i % Nk === 0) {
      t = ((AES_SBOX[(t >> 16) & 0xff] << 24) | (AES_SBOX[(t >> 8) & 0xff] << 16) | (AES_SBOX[t & 0xff] << 8) | AES_SBOX[(t >> 24) & 0xff]) ^ (AES_RCON[i / Nk - 1] << 24);
    }
    W[i] = (W[i - Nk] ^ t) >>> 0;
  }
  return W;
}

function xtime(a) { return ((a << 1) ^ (a & 0x80 ? 0x1b : 0)) & 0xff; }
function gmul(a, b) {
  let p = 0;
  for (let i = 0; i < 8; i++) {
    if (b & 1) p ^= a;
    const hi = a & 0x80;
    a = (a << 1) & 0xff;
    if (hi) a ^= 0x1b;
    b >>= 1;
  }
  return p;
}

function aesAddRoundKey(s, W, round) {
  for (let c = 0; c < 4; c++) {
    const w = W[round * 4 + c];
    s[c*4+0] ^= (w >>> 24) & 0xff;
    s[c*4+1] ^= (w >>> 16) & 0xff;
    s[c*4+2] ^= (w >>> 8) & 0xff;
    s[c*4+3] ^= w & 0xff;
  }
}
function aesSubBytes(s, inv) {
  const box = inv ? AES_INV_SBOX : AES_SBOX;
  for (let i = 0; i < 16; i++) s[i] = box[s[i]];
}
function aesShiftRows(s, inv) {
  const t = s.slice();
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 4; c++) {
      const shift = inv ? (4 - r) % 4 : r;
      s[c*4+r] = t[((c + shift) % 4)*4+r];
    }
  }
}
function aesMixColumns(s, inv) {
  for (let c = 0; c < 4; c++) {
    const a = [s[c*4], s[c*4+1], s[c*4+2], s[c*4+3]];
    let b;
    if (!inv) {
      b = [gmul(a[0],2)^gmul(a[1],3)^a[2]^a[3],
            a[0]^gmul(a[1],2)^gmul(a[2],3)^a[3],
            a[0]^a[1]^gmul(a[2],2)^gmul(a[3],3),
            gmul(a[0],3)^a[1]^a[2]^gmul(a[3],2)];
    } else {
      b = [gmul(a[0],14)^gmul(a[1],11)^gmul(a[2],13)^gmul(a[3],9),
            gmul(a[0],9)^gmul(a[1],14)^gmul(a[2],11)^gmul(a[3],13),
            gmul(a[0],13)^gmul(a[1],9)^gmul(a[2],14)^gmul(a[3],11),
            gmul(a[0],11)^gmul(a[1],13)^gmul(a[2],9)^gmul(a[3],14)];
    }
    for (let r = 0; r < 4; r++) s[c*4+r] = b[r];
  }
}

function aesEncryptBlock(block16, W) {
  const s = block16.slice();
  aesAddRoundKey(s, W, 0);
  for (let r = 1; r < 10; r++) {
    aesSubBytes(s, false); aesShiftRows(s, false); aesMixColumns(s, false); aesAddRoundKey(s, W, r);
  }
  aesSubBytes(s, false); aesShiftRows(s, false); aesAddRoundKey(s, W, 10);
  return s;
}

function aesDecryptBlock(block16, W) {
  const s = block16.slice();
  aesAddRoundKey(s, W, 10);
  for (let r = 9; r >= 1; r--) {
    aesShiftRows(s, true); aesSubBytes(s, true); aesAddRoundKey(s, W, r); aesMixColumns(s, true);
  }
  aesShiftRows(s, true); aesSubBytes(s, true); aesAddRoundKey(s, W, 0);
  return s;
}

function aesCbcEncrypt(plainStr, keyStr, ivStr) {
  const key = utf8Bytes(keyStr).slice(0, 16);
  const iv = utf8Bytes(ivStr).slice(0, 16);
  let data = utf8Bytes(plainStr);
  const pad = 16 - (data.length % 16);
  for (let i = 0; i < pad; i++) data.push(pad);
  const W = aesKeyExpand(key);
  let prev = iv;
  const out = [];
  for (let off = 0; off < data.length; off += 16) {
    const block = [];
    for (let i = 0; i < 16; i++) block.push(data[off + i] ^ prev[i]);
    const enc = aesEncryptBlock(block, W);
    out.push(...enc);
    prev = enc;
  }
  return out;
}

function aesCbcDecrypt(cipherBytes, keyStr, ivStr) {
  const key = utf8Bytes(keyStr).slice(0, 16);
  const iv = utf8Bytes(ivStr).slice(0, 16);
  const W = aesKeyExpand(key);
  let prev = iv;
  const out = [];
  for (let off = 0; off < cipherBytes.length; off += 16) {
    const block = cipherBytes.slice(off, off + 16);
    const dec = aesDecryptBlock(block, W);
    for (let i = 0; i < 16; i++) out.push(dec[i] ^ prev[i]);
    prev = block;
  }
  const pad = out[out.length - 1];
  if (pad < 1 || pad > 16) throw new Error('bad padding');
  for (let i = 0; i < pad; i++) {
    if (out[out.length - 1 - i] !== pad) throw new Error('bad padding');
  }
  return out.slice(0, out.length - pad);
}

function cmEncrypt(plainStr, keyStr, ivStr) {
  return base64Encode(aesCbcEncrypt(plainStr, keyStr, ivStr || '9791027341711819'));
}

function cmDecrypt(b64Str, keyStr, ivStr) {
  const raw = String(b64Str).replace(/[^A-Za-z0-9+/=]/g, '');
  const bytes = [];
  for (let i = 0; i < raw.length; i += 4) {
    const c = [0,1,2,3].map((k) => (raw[i+k] === '=' || !raw[i+k] ? 0 : B64MAP.indexOf(raw[i+k])));
    const n = (c[0] << 18) | (c[1] << 12) | (c[2] << 6) | c[3];
    bytes.push((n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff);
  }
  const padCount = (raw.match(/=+$/) || [''])[0].length;
  const trimmed = bytes.slice(0, bytes.length - padCount);
  return utf8String(aesCbcDecrypt(trimmed, keyStr, ivStr || '9791027341711819'));
}

function cmMd5(str) { return md5Hex(str); }

const REQ_KEY = { '2': 'bAIgvwAuA4tbDr9d', '12': 'V0dSUFZtS1NWRnJa', '14': 'tVkdaRWRY0ZkV1Vr' };
const REQ_IV  = { '2': '9791027341711819', '12': 'UkdWMVpWTVVWaGVq', '14': 'VjFSQ1ZtVkQxRTlQ' };
const REQ1_KEY = 'foorettD7vcBawt3';
const RESP1_KEY = 'UVic06tpXgMNiApm';
const RESP2_KEY = 'GS7VelkJl5IT1uwQ';
const RESP14_KEY = 'RYV0hCV1lV25KYVJ';
const RESP14_IV = 'VjFSQ1ZtVkQxRTlQ';
const DEFAULT_IV = '9791027341711819';

const UA_WAP = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_3_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148/wkwebview leadeon/9.2.5/CMCCIT';

const STORE = {
  paramsEnc: 'cm_params_enc',
  xqen: 'cm_x_qen',
  loginUrl: 'cm_login_url',
  cookie: 'cm_cookie',
  loginTs: 'cm_login_ts',
  loginHeaders: 'cm_login_headers',
  refreshTs: 'cm_refresh_ts',
  multiDs: 'cm_multi_datasource',
  primaryPhone: 'cm_primary_phone',
  cardIndex: 'cm_card_index',
  multiAuth: 'cm_multi_auth'
};

function parseArguments() {
  const args = {};
  if (typeof $argument !== 'undefined' && $argument) {
    $argument.split('&').forEach((item) => {
      const idx = item.indexOf('=');
      if (idx !== -1) {
        const k = item.slice(0, idx).trim();
        const v = item.slice(idx + 1).trim();
        args[k] = decodeURIComponent(v);
      }
    });
  }
  return args;
}

function parseAccounts(accStr) {
  if (!accStr) return [];
  const rawList = accStr.split('@');
  const accounts = [];
  rawList.forEach((item, index) => {
    let t = item ? item.trim() : '';
    if (!t || t.startsWith('//')) return;
    let label = `卡${index + 1}`;
    let phone = t;
    if (t.includes('#')) {
      const parts = t.split('#');
      label = parts[0].trim() || label;
      phone = parts[1].trim();
    }
    const match = phone.match(/\d{11}/);
    if (match) {
      accounts.push({ label, phone: match[0] });
    }
  });
  return accounts;
}

function pad2(n) { return n < 10 ? `0${n}` : `${n}`; }

function fmtTime(ts) {
  const d = new Date(ts);
  return `${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

function randomDigits(n) {
  let s = '';
  for (let i = 0; i < n; i++) s += Math.floor(Math.random() * 10);
  return s;
}

function getHeader(headers, name) {
  if (!headers) return '';
  const want = String(name).toLowerCase();
  for (const k of Object.keys(headers)) {
    if (String(k).toLowerCase() === want) {
      const v = headers[k];
      return Array.isArray(v) ? v.join('; ') : (v || '');
    }
  }
  return '';
}

function httpRequest(options) {
  return new Promise((resolve, reject) => {
    $httpClient.post(options, (err, resp, body) => {
      if (err) return reject(err);
      resolve({ status: resp.status, headers: resp.headers, body });
    });
  });
}

function isAutoLogin(url) {
  const hit = /10086\.online-cmcc\.cn/.test(url) || 
             /client\.app\.coc\.10086\.cn\/(biz-orange|cache_server)\//.test(url);
  return hit;
}


function handleRequestCapture() {
  const url = ($request &&$request.url) || '';
  console.log(`[抓包-请求拦截] 收到 URL: ${url}`);

  const headers = ($request &&$request.headers) || {};
  const xqen = String(getHeader(headers, 'x-qen') || '').trim();
  console.log(`[抓包-请求拦截] x-qen: ${xqen}`);

  if (!isAutoLogin(url)) {
    console.log('[抓包-请求拦截] URL 未匹配 autoLogin 规则，放行');
    return $done({});
  }
  if (!REQ_KEY[xqen]) {
    console.log(`[抓包-请求拦截] x-qen (${xqen}) 不在支持列表，放行`);
    return $done({});
  }

  const body = $request.body;
  if (!body || body.length < 16) {
    console.log('[抓包-请求拦截] 请求 Body 长度不足或为空，放行');
    return $done({});
  }

  console.log(`[抓包-请求拦截] 开始尝试解密 Body (长度: ${body.length})...`);
  let plain = null, usedQen = null;
  const tryOrder = [xqen, '2', '12', '14'].filter((v, i, a) => REQ_KEY[v] && a.indexOf(v) === i);
  for (const q of tryOrder) {
    try {
      const p = cmDecrypt(body, REQ_KEY[q], REQ_IV[q]);
      JSON.parse(p);
      plain = p;
      usedQen = q;
      console.log(`[抓包-请求拦截] 使用 Qen ${q} 成功解密 Body`);
      break;
    } catch (e) {}
  }

  if (!plain) {
    console.log('[抓包-请求拦截] 密钥尝试解密均失败，放行');
    return $done({});
  }

  try {
    const parsedObj = JSON.parse(plain);
    const autoPhone = (parsedObj.reqBody && parsedObj.reqBody.cellNum) || parsedObj.cellNum;
    if (autoPhone && /^\d{11}$/.test(autoPhone)) {
      console.log(`[抓包-请求拦截] 提取到手机号: ${autoPhone}`);
      $persistentStore.write(autoPhone, STORE.primaryPhone);

      let multiAuth = {};
      try { multiAuth = JSON.parse($persistentStore.read(STORE.multiAuth) || '{}'); } catch(e){}

      const keep = {};
      for (const k of Object.keys(headers)) {
        if (/^(cookie|content-length|connection|accept-encoding)$/i.test(k)) continue;
        keep[k] = Array.isArray(headers[k]) ? headers[k].join(', ') : String(headers[k]);
      }

      multiAuth[autoPhone] = {
        paramsEnc: body,
        xqen: usedQen,
        loginUrl: url,
        cookie: String(getHeader(headers, 'cookie') || '').trim(),
        loginHeaders: JSON.stringify(keep),
        loginTs: Date.now()
      };
      
      $persistentStore.write(JSON.stringify(multiAuth), STORE.multiAuth);
      $notification.post('中国移动', `捕获成功: ${autoPhone}`, '该账号的独立凭证已安全存储');
      console.log(`[抓包-请求拦截] 账号 ${autoPhone} 凭证已存入独立池`);
    } else {
      console.log('[抓包-请求拦截] 未在 Body 中解析出 11 位手机号');
    }
  } catch (e) {
    console.log(`[抓包-请求拦截] 解析 JSON 异常: ${e.message}`);
  }

  $persistentStore.write(body, STORE.paramsEnc);
  $persistentStore.write(usedQen, STORE.xqen);$persistentStore.write(url, STORE.loginUrl);

  const cookie = String(getHeader(headers, 'cookie') || '').trim();
  if (cookie) $persistentStore.write(cookie, STORE.cookie);

  const keep = {};
  for (const k of Object.keys(headers)) {
    if (/^(cookie|content-length|connection|accept-encoding)$/i.test(k)) continue;
    keep[k] = Array.isArray(headers[k]) ? headers[k].join(', ') : String(headers[k]);
  }
  $persistentStore.write(JSON.stringify(keep), STORE.loginHeaders);$persistentStore.write(String(Date.now()), STORE.loginTs);

  console.log('[抓包-请求拦截] 捕获逻辑执行完毕，正常退出');
  $done({});
}

function handleResponseCapture() {
  const url = (typeof $request !== 'undefined' &&$request && $request.url) ?$request.url : '';
  console.log(`[抓包-响应拦截] 收到 URL: ${url}`);
  if (!isAutoLogin(url)) {
    return $done({});
  }
  const respHeaders = ($response &&$response.headers) || {};
  const setCookie = String(getHeader(respHeaders, 'set-cookie') || '').trim();
  if (setCookie && $persistentStore.read(STORE.cookie) !== setCookie) {
    console.log('[抓包-响应拦截] 捕获到新的 Set-Cookie，已更新');
    $persistentStore.write(setCookie, STORE.cookie);
  }
  $done({});
}

function buildQuery(params, kind, targetPhone, authObj) {
  const cookie = authObj ? authObj.cookie : ($persistentStore.read(STORE.cookie) || '');
  const ts = Date.now();
  const nonce = randomDigits(8);
  const pathname = kind === 'fee'
    ? '/biz-orange/BN/realFeeQuery/getRealFee'
    : '/biz-orange/BH/newPlanRemainQry/getNewPlanRemainQry';

  const bodyObj = Object.assign({}, params, { reqBody: { cellNum: targetPhone }, t: cookie });
  if (kind === 'fee') bodyObj.nt = '5';
  const encBody = cmEncrypt(JSON.stringify(bodyObj), REQ1_KEY, DEFAULT_IV);

  const xk = params.xk || '';
  const tokenEnc = cmEncrypt(`${xk}_${pathname}_${ts}_${nonce}`, REQ1_KEY, DEFAULT_IV);

  const m = cookie.match(/JSESSIONID=(.+?);/);
  const jsid = m ? m[1] : 'null';
  const xsign = cmMd5(`${tokenEnc}_${ts}_${nonce}_${jsid}`);

  const headers = {
    'Host': 'app.10086.cn',
    'x-qen': '1',
    'Content-Type': 'application/x-www-form-urlencoded',
    'Accept': 'application/json',
    'x-sign': xsign,
    'x-nonce': nonce,
    'x-token': tokenEnc,
    'Sec-Fetch-Mode': 'cors',
    'Origin': 'https://h.app.coc.10086.cn',
    'User-Agent': UA_WAP,
    'x-time': String(ts),
    'Sec-Fetch-Des': 'empty',
  };
  return {
    url: `https://app.10086.cn${pathname}?` + encodeURI(cookie),
    headers,
    body: encBody,
  };
}

function absorbSetCookie(headers, phone) {
  const sc = String(getHeader(headers, 'set-cookie') || '').trim();
  if (sc && /JSESSIONID=/i.test(sc)) {
    $persistentStore.write(sc, STORE.cookie);
    if (phone) {
      let multiAuth = {};
      try { multiAuth = JSON.parse($persistentStore.read(STORE.multiAuth) || '{}'); } catch(e){}
      if (multiAuth[phone]) {
        multiAuth[phone].cookie = sc;
        $persistentStore.write(JSON.stringify(multiAuth), STORE.multiAuth);
      }
    }
    return true;
  }
  return false;
}

async function autoRefreshSession(phone) {
  let multiAuth = {};
  try { multiAuth = JSON.parse($persistentStore.read(STORE.multiAuth) || '{}'); } catch(e){}
  let auth = multiAuth[phone];

  const url = auth ? auth.loginUrl : ($persistentStore.read(STORE.loginUrl) || '');
  const body = auth ? auth.paramsEnc : ($persistentStore.read(STORE.paramsEnc) || '');
  if (!url || !body) return false;
  
  const lastKey = auth ? `cm_refresh_ts_${phone}` : STORE.refreshTs;
  const last = parseInt($persistentStore.read(lastKey) || '0', 10);
  if (Date.now() - last < 10 * 60 * 1000) return false;
  $persistentStore.write(String(Date.now()), lastKey);

  let headers = {};
  let headStr = auth ? auth.loginHeaders : ($persistentStore.read(STORE.loginHeaders) || '{}');
  try { headers = JSON.parse(headStr); } catch (e) {}

  if (!Object.keys(headers).some((k) => /^x-qen$/i.test(k))) headers['x-qen'] = auth ? auth.xqen : ($persistentStore.read(STORE.xqen) || '2');
  if (!Object.keys(headers).some((k) => /^content-type$/i.test(k))) headers['Content-Type'] = 'application/json';
  if (!Object.keys(headers).some((k) => /^user-agent$/i.test(k))) headers['User-Agent'] = UA_WAP;
  
  const oldCookie = auth ? auth.cookie : ($persistentStore.read(STORE.cookie) || '');
  if (oldCookie) headers['Cookie'] = oldCookie;

  try {
    const resp = await httpRequest({ url, headers, body, timeout: 15000 });
    return !!resp && resp.status === 200 && absorbSetCookie(resp.headers, phone);
  } catch (e) {
    return false;
  }
}

async function queryKind(kind, phone) {
  let multiAuth = {};
  try { multiAuth = JSON.parse($persistentStore.read(STORE.multiAuth) || '{}'); } catch(e){}
  let auth = multiAuth[phone];

  let enc = auth ? auth.paramsEnc : ($persistentStore.read(STORE.paramsEnc) || '');
  let xqen = auth ? (auth.xqen || '').trim() : ($persistentStore.read(STORE.xqen) || '').trim();

  if (!enc || !REQ_KEY[xqen]) {
    const e = new Error('no-params');
    e.stage = 'capture';
    throw e;
  }
  const plain = cmDecrypt(enc, REQ_KEY[xqen], REQ_IV[xqen]);
  const params = JSON.parse(plain);
  const q = buildQuery(params, kind, phone, auth);
  const resp = await httpRequest({ url: q.url, headers: q.headers, body: q.body, timeout: 15000 });

  if (!resp || resp.status !== 200) {
    const e = new Error(`HTTP ${resp ? resp.status : '无响应'}`);
    e.stage = 'network';
    throw e;
  }
  absorbSetCookie(resp.headers, phone);
  const text = String(resp.body || '');
  const xpen = String(getHeader(resp.headers, 'x-pen') || '').trim();
  let data;
  try {
    if (xpen === '1') {
      const inner = JSON.parse(text);
      data = JSON.parse(cmDecrypt(inner.body, RESP1_KEY, DEFAULT_IV));
    } else if (xpen === '2') {
      data = JSON.parse(cmDecrypt(text, RESP2_KEY, DEFAULT_IV));
    } else if (xpen === '14') {
      data = JSON.parse(cmDecrypt(text, RESP14_KEY, RESP14_IV));
    } else {
      data = JSON.parse(text);
    }
  } catch (e) {
    const err = new Error('decrypt-failed');
    err.stage = 'decrypt';
    throw err;
  }
  return data;
}

function toFlowUnit(remain, unit) {
  if (unit === '03') {
    return remain >= 1024
      ? { number: (remain / 1024).toFixed(2), unit: 'GB' }
      : { number: remain.toFixed(2), unit: 'MB' };
  }
  if (unit === '04') return { number: remain.toFixed(2), unit: 'GB' };
  return { number: remain.toFixed(2), unit: String(unit || 'MB') };
}

function deepFindAllFlows(obj, out, seen) {
  if (!obj || typeof obj !== 'object') return;
  if (seen.has(obj)) return;
  seen.add(obj);

  if (Array.isArray(obj)) {
    for (const item of obj) {
      if (item && typeof item === 'object' && item.flowRemainNum !== undefined) {
        out.push(item);
      } else {
        deepFindAllFlows(item, out, seen);
      }
    }
  } else {
    for (const k of Object.keys(obj)) {
      deepFindAllFlows(obj[k], out, seen);
    }
  }
}

function parseMobile(feeData, planData) {
  const feeInfo = (feeData && (feeData.rspBody || (feeData.body && feeData.body.rspBody))) || {};
  const planBody = (planData && (planData.rspBody || (planData.body && planData.body.rspBody))) || {};
  const planInfo = planBody.newPlanRemainQryRes || planBody;

  const feeNum = parseFloat(feeInfo.realBalanceFee || feeInfo.curFee || '0');
  const fee = {
    title: '剩余话费',
    number: Number.isFinite(feeNum) ? feeNum.toFixed(2) : '0.00',
    unit: '元',
  };

  const rawFlowList = [];
  deepFindAllFlows(planData, rawFlowList, new Set());

  let genRemain = 0;
  let genUnit = '03';
  let hasGen = false;
  let genSum = 0;

  let otherTotalMb = 0;
  let otherSumMb = 0;
  let hasOther = false;

  rawFlowList.forEach((f) => {
    const remain = parseFloat(f.flowRemainNum || '0');
    if (!Number.isFinite(remain)) return;
    const isDirect = String(f.flowtype) === '0';
    const k = String(f.unit || '03') === '04' ? 1024 : 1;
    const s = parseFloat(f.flowSumNum || '0');

    if (isDirect) {
      if (!hasGen) {
        genRemain = remain;
        genUnit = String(f.unit || '03');
        hasGen = true;
        if (Number.isFinite(s) && s > 0) genSum = s * k;
      }
    } else {
      otherTotalMb += remain * k;
      if (Number.isFinite(s)) otherSumMb += s * k;
      hasOther = true;
    }
  });

  let flow = { title: '通用', number: '--', unit: '', percent: 0 };
  if (hasGen) {
    const u = toFlowUnit(genRemain, genUnit);
    const curMb = genRemain * (genUnit === '04' ? 1024 : 1);
    flow = {
      title: '通用',
      number: u.number,
      unit: u.unit,
      percent: genSum > 0 ? Math.max(0, Math.min(1, curMb / genSum)) : 0.8
    };
  }

  let otherFlow = { title: '定向', number: '--', unit: '', percent: 0 };
  if (hasOther) {
    const u = otherTotalMb >= 1024
      ? { number: (otherTotalMb / 1024).toFixed(2), unit: 'GB' }
      : { number: otherTotalMb.toFixed(2), unit: 'MB' };
    otherFlow = {
      title: '定向',
      number: u.number,
      unit: u.unit,
      percent: otherSumMb > 0 ? Math.max(0, Math.min(1, otherTotalMb / otherSumMb)) : 0.7
    };
  }

  let voice = { title: '语音', number: '--', unit: '分钟', percent: 1.0 };
  const voiceArrDirect = Array.isArray(planInfo.planRemianVoiceListRes) ? planInfo.planRemianVoiceListRes : [];
  if (voiceArrDirect.length) {
    const vRemain = parseInt(voiceArrDirect[0].voiceRemainNum || '0', 10);
    voice.number = String(Number.isFinite(vRemain) ? vRemain : 0);
    const vs = parseInt(voiceArrDirect[0].voiceSumNum || '0', 10);
    if (Number.isFinite(vs) && vs > 0) voice.percent = Math.max(0, Math.min(1, vRemain / vs));
  } else if (planData) {
    const vMatch = JSON.stringify(planData).match(/"voiceRemainNum":"?(\d+)"?/);
    if (vMatch) voice.number = vMatch[1];
  }

  const feeOk = feeInfo && (feeInfo.realBalanceFee != null || feeInfo.curFee != null);
  const valid = feeOk || hasGen || hasOther || voice.number !== '--';
  return { fee, flow, otherFlow, voice, updatedAt: Date.now(), valid };
}

async function fetchAccountData(phone) {
  const fetchSingle = async () => {
    const feeData = await queryKind('fee', phone);
    const planData = await queryKind('plan', phone);
    return parseMobile(feeData, planData);
  };

  let ds = await fetchSingle();
  if (!ds.valid && (await autoRefreshSession(phone))) {
    ds = await fetchSingle();
  }
  if (!ds.valid) throw new Error('登录态失效');
  return ds;
}

async function loadMultiData(accounts) {
  const hasParams = !!($persistentStore.read(STORE.paramsEnc));
  if (!hasParams) return { configured: false, reason: 'capture' };
  if (!accounts || accounts.length === 0) return { configured: false, reason: 'phone' };

  let cachedMap = {};
  try {
    cachedMap = JSON.parse($persistentStore.read(STORE.multiDs) || '{}');
  } catch (e) {}

  const results = [];
  let hasUpdated = false;

  for (const acc of accounts) {
    try {
      const ds = await fetchAccountData(acc.phone);
      ds.phone = acc.phone;
      ds.label = acc.label;
      results.push({ label: acc.label, phone: acc.phone, ds, success: true });
      cachedMap[acc.phone] = ds;
      hasUpdated = true;
    } catch (e) {
      if (cachedMap[acc.phone]) {
        results.push({ label: acc.label, phone: acc.phone, ds: cachedMap[acc.phone], success: true, fromCache: true });
      } else {
        results.push({ label: acc.label, phone: acc.phone, success: false, error: e.message || '查询失败' });
      }
    }
  }

  if (hasUpdated) {
    $persistentStore.write(JSON.stringify(cachedMap), STORE.multiDs);
    results.forEach((item, idx) => {
      if (item.ds) {
        $persistentStore.write(JSON.stringify(item.ds), `cm_card_${idx + 1}`);
        $persistentStore.write(JSON.stringify(item.ds), `cm_card_${item.phone}`);
      }
    });
    if (results[0] && results[0].ds) {
      $persistentStore.write(JSON.stringify(results[0].ds), 'cm_datasource');
    }
  }

  return { configured: true, results };
}

function toMB(d) {
  const n = parseFloat(d && d.number);
  if (!Number.isFinite(n)) return null;
  return d.unit === 'GB' ? n * 1024 : n;
}

function fmtMB(mb) {
  if (mb == null || !Number.isFinite(mb)) return '--';
  return mb >= 1024 ? `${(mb / 1024).toFixed(2)}GB` : `${mb.toFixed(0)}MB`;
}

function calculateInsights(ds, phone) {
  const now = new Date();
  const pad2 = function(n) { return n < 10 ? '0'+n : ''+n; };
  const dayKey = `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`;
  const dim = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const daysLeft = dim - now.getDate() + 1;

  const _g = toMB(ds.flow), _o = toMB(ds.otherFlow);
  const flowMB = (_g == null && _o == null) ? null : ((_g || 0) + (_o || 0));

  const snapKey = `cm_day_snap_${phone}`;
  let todayMB = null;
  if (flowMB != null) {
    let snap = null;
    try { snap = JSON.parse($persistentStore.read(snapKey) || 'null'); } catch (e) {}
    if (!snap || snap.date !== dayKey || flowMB > snap.start + 1) {
      snap = { date: dayKey, start: flowMB };
      $persistentStore.write(JSON.stringify(snap), snapKey);
    }
    todayMB = Math.max(0, snap.start - flowMB);
  }

  return {
    daysLeft,
    todayMB,
    dailyMB: flowMB != null ? flowMB / daysLeft : null,
    lowFee: parseFloat(ds.fee.number) < 10
  };
}

function getVisualWidth(str) {
  let len = 0;
  for (let i = 0; i < str.length; i++) {
    const c = str.charCodeAt(i);
    if ((c >= 0x4e00 && c <= 0x9fa5) || (c >= 0xff00 && c <= 0xffef)) {
      len += 2;
    } else {
      len += 1;
    }
  }
  return len;
}

function padRight(str, targetWidth) {
  let cur = getVisualWidth(str);
  while (cur < targetWidth) {
    str += ' ';
    cur += 1;
  }
  return str;
}

async function renderPanel() {
  const args = parseArguments();
  const panelTitle = args.title || '中国移动';
  
  let accountStr = args.accounts || $persistentStore.read('cm_accounts');
  const accounts = parseAccounts(accountStr);

  if (accounts.length === 0) {
    const primary = $persistentStore.read(STORE.primaryPhone);
    if (primary) accounts.push({ label: '卡1', phone: primary });
  }

  try {
    const res = await loadMultiData(accounts);

    if (!res.configured) {
      const msg = res.reason === 'phone' ? '⚠️ 请在 BoxJS/参数中填入账号' : '📲 请在App用短信验证码登录一次';
      $done({
        title: panelTitle,
        content: msg,
        icon: 'exclamationmark.triangle',
        'icon-color': '#FF9F0A'
      });
      return;
    }

    let curIdx = parseInt($persistentStore.read(STORE.cardIndex) || '0', 10);
    if (curIdx >= res.results.length) curIdx = 0;
    const item = res.results[curIdx];
    const nextIdx = (curIdx + 1) % res.results.length;
    $persistentStore.write(String(nextIdx), STORE.cardIndex);

    if (!item.success || !item.ds) {
      $done({
        title: `${panelTitle} · ${item.label}`,
        content: `⚠️ 拉取失败: ${item.error || '登录过期'}\n👉 打开App刷新后重试`,
        icon: 'exclamationmark.triangle',
        'icon-color': '#FF453A'
      });
      return;
    }

    const ds = item.ds;
    const phone = item.phone;
    const ins = calculateInsights(ds, phone);
    const phoneMask = `${phone.slice(0, 3)}****${phone.slice(7)}`;

    const feeStr = `¥${ds.fee.number}`;
    const voiceStr = ds.voice ? `${ds.voice.number} 分钟` : '--';
    const flowStr = ds.flow.number !== '--' ? `${ds.flow.number} ${ds.flow.unit}` : '--';
    const combatFlow = ds.otherFlow.number !== '--' ? `${ds.otherFlow.number} ${ds.otherFlow.unit}` : '--';
    const todayStr = fmtMB(ins.todayMB);
    const dailyStr = fmtMB(ins.dailyMB);

    const col1 = padRight(`💰 话费: ${feeStr}`, 18) + `📞 语音: ${voiceStr}`;
    const col2 = padRight(`📶 通用: ${flowStr}`, 18) + `🌐 定向: ${combatFlow}`;
    const col3 = padRight(`📊 今日: ${todayStr}`, 18) + `⏳ 日均: ${dailyStr}`;
    const col4 = padRight(`🗓️ 剩余: ${ins.daysLeft} 天`, 18) + `🕒 更新: ${fmtTime(ds.updatedAt)}`;

    const titleTag = res.results.length > 1
      ? `${panelTitle} · ${item.label} ${phoneMask} (${curIdx + 1}/${res.results.length})`
      : `${panelTitle} · ${phoneMask}`;

    $done({
      title: titleTag,
      content: `${col1}\n${col2}\n${col3}\n${col4}`,
      icon: ins.lowFee ? 'exclamationmark.circle.fill' : 'antenna.radiowaves.left.and.right',
      'icon-color': ins.lowFee ? '#FF3B30' : '#0A84FF'
    });
  } catch (err) {
    $done({
      title: panelTitle,
      content: `❌ 异常: ${err.message || err}`,
      icon: 'exclamationmark.triangle',
      'icon-color': '#FF453A'
    });
  }
}

async function keepAliveTask() {
  const args = parseArguments();
  let accountStr = args.accounts || $persistentStore.read('cm_accounts');
  const accounts = parseAccounts(accountStr);
  try {
    await loadMultiData(accounts);
  } catch (e) {}
  $done({});
}

try {
  const isResp = typeof $response !== 'undefined';
  const isReq = typeof $request !== 'undefined' && $request &&$request.url;

  if (isResp) { 
    handleResponseCapture(); 
  } else if (isReq) {
    handleRequestCapture();
  } else {
    const args = parseArguments();
    if (args.action === 'task') {
      keepAliveTask();
    } else {
      renderPanel();
    }
  }
} catch (globalErr) {
  console.log(`[全局异常] ${globalErr.message || globalErr}`);
  $done({});
}
