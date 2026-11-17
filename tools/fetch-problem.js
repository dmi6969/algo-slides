#!/usr/bin/env node
/*
 * 讀取題目：node tools/fetch-problem.js <題目網址>
 *
 * 支援的網址：
 *   LeetCode    https://leetcode.com/problems/{slug}/
 *   Codeforces  https://codeforces.com/problemset/problem/{contest}/{index}
 *               https://codeforces.com/contest/{contest}/problem/{index}
 *
 * 能讀到什麼：
 *   LeetCode    題號、題名、難度、標籤、題目敘述、範例、限制、C++ 函式簽名
 *   Codeforces  題號、題名、rating、標籤（官方 API）。
 *               Codeforces 的題目頁面不開放程式讀取，題目敘述要由使用者貼上。
 *
 * 輸出（CLAUDE.md 第 8 節步驟 1）：
 *   1. 依 CLAUDE.md 第 4 節產生的題目 id
 *   2. 要加進 problems.js 的資料（第 5 節）
 *   3. 題目敘述（讀得到時），同時存到 scratch/{id}.md
 *
 * 結束碼：
 *   0  全部讀取成功
 *   1  網址格式不支援，或完全讀不到題目
 *   2  讀到題目資料（id、難度、標籤），但沒有題目敘述，需要使用者貼上
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const USER_AGENT = 'algo-slides-fetch/1.0';
const TIMEOUT_MS = 20000;
const MAX_TAGS = 4;

// ---------- 網址解析 ----------
function parseUrl(raw) {
  let url;
  try {
    url = new URL(raw);
  } catch (e) {
    return null;
  }
  const host = url.hostname.replace(/^www\./, '');
  const parts = url.pathname.split('/').filter(Boolean);

  if (host === 'leetcode.com' && parts[0] === 'problems' && parts[1]) {
    return { platform: 'LeetCode', slug: parts[1].toLowerCase() };
  }
  if (host === 'codeforces.com') {
    let contest = null;
    let index = null;
    if (parts[0] === 'problemset' && parts[1] === 'problem') {
      contest = parts[2];
      index = parts[3];
    } else if (parts[0] === 'contest' && parts[2] === 'problem') {
      contest = parts[1];
      index = parts[3];
    }
    if (/^\d+$/.test(contest || '') && /^[A-Za-z]\d?$/.test(index || '')) {
      return { platform: 'Codeforces', contest: contest, index: index.toUpperCase() };
    }
  }
  return null;
}

// ---------- 網路 ----------
async function requestJson(url, options) {
  const opts = options || {};
  const res = await fetch(url, {
    method: opts.method || 'GET',
    body: opts.body,
    headers: Object.assign({ 'User-Agent': USER_AGENT }, opts.headers || {}),
    signal: AbortSignal.timeout(TIMEOUT_MS)
  });
  if (!res.ok) throw new Error('HTTP ' + res.status + '：' + url);
  return res.json();
}

// ---------- HTML 轉純文字（LeetCode 的題目敘述是 HTML） ----------
const NAMED_ENTITIES = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
  le: '≤', ge: '≥', ne: '≠', times: '×', minus: '−', hellip: '…',
  ldquo: '“', rdquo: '”', lsquo: '‘', rsquo: '’', mdash: '—', ndash: '–'
};

function decodeEntities(text) {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, function (match, entity) {
    if (entity[0] === '#') {
      const isHex = entity[1] === 'x' || entity[1] === 'X';
      const code = isHex ? parseInt(entity.slice(2), 16) : parseInt(entity.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : match;
    }
    const value = NAMED_ENTITIES[entity.toLowerCase()];
    return value !== undefined ? value : match;
  });
}

function htmlToText(html) {
  let s = html.replace(/\r/g, '');
  s = s.replace(/<sup>\s*([\s\S]*?)\s*<\/sup>/gi, '^$1');
  s = s.replace(/<sub>\s*([\s\S]*?)\s*<\/sub>/gi, '_$1');
  s = s.replace(/<img[^>]*src="([^"]*)"[^>]*>/gi, '[圖片：$1]');
  s = s.replace(/<code>([\s\S]*?)<\/code>/gi, '`$1`');
  s = s.replace(/<br\s*\/?>/gi, '\n');
  s = s.replace(/<li[^>]*>/gi, '\n- ');
  s = s.replace(/<\/?(p|div|pre|ul|ol|h\d|table|tr)(\s[^>]*)?>/gi, '\n');
  s = s.replace(/<\/?(td|th)(\s[^>]*)?>/gi, ' ');
  s = s.replace(/<[^>]+>/g, '');
  s = decodeEntities(s);
  s = s.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n');
  return s.trim();
}

// ---------- 共用工具 ----------
function slugify(text) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

function today() {
  const d = new Date();
  const pad = function (n) { return String(n).padStart(2, '0'); };
  return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
}

// ---------- LeetCode ----------
const LEETCODE_QUERY = [
  'query questionData($titleSlug: String!) {',
  '  question(titleSlug: $titleSlug) {',
  '    questionFrontendId title titleSlug difficulty isPaidOnly content exampleTestcases',
  '    topicTags { name }',
  '    codeSnippets { langSlug code }',
  '  }',
  '}'
].join('\n');

async function fetchLeetCode(info) {
  const json = await requestJson('https://leetcode.com/graphql', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Referer: 'https://leetcode.com/problems/' + info.slug + '/'
    },
    body: JSON.stringify({
      operationName: 'questionData',
      variables: { titleSlug: info.slug },
      query: LEETCODE_QUERY
    })
  });
  const q = json && json.data && json.data.question;
  if (!q) throw new Error('LeetCode 找不到這一題：' + info.slug);

  const cpp = (q.codeSnippets || []).find(function (s) { return s.langSlug === 'cpp'; });
  return {
    id: 'leetcode-' + String(q.questionFrontendId).padStart(4, '0') + '-' + q.titleSlug,
    platform: 'LeetCode',
    number: String(q.questionFrontendId),
    title: q.title,
    url: 'https://leetcode.com/problems/' + q.titleSlug + '/',
    difficulty: q.difficulty,
    tags: (q.topicTags || []).map(function (t) { return t.name; }).slice(0, MAX_TAGS),
    statement: q.content ? htmlToText(q.content) : null,
    statementNote: q.isPaidOnly ? '這是 LeetCode 付費題目，未登入讀不到題目敘述。' : 'LeetCode 沒有回傳題目敘述。',
    signature: cpp ? cpp.code : null,
    rawTests: q.exampleTestcases || null
  };
}

// ---------- Codeforces（只用官方 API） ----------
async function fetchCodeforcesMeta(info) {
  // 先查這場比賽的題目清單（資料量小），失敗再查整個題庫
  try {
    const json = await requestJson('https://codeforces.com/api/contest.standings?contestId=' + info.contest + '&from=1&count=1&lang=en');
    if (json.status === 'OK') {
      const p = json.result.problems.find(function (x) { return String(x.index).toUpperCase() === info.index; });
      if (p) return p;
    }
  } catch (e) {
    // 改用下面的 problemset.problems
  }
  const all = await requestJson('https://codeforces.com/api/problemset.problems?lang=en');
  if (all.status !== 'OK') throw new Error('Codeforces API 回傳錯誤：' + (all.comment || all.status));
  const p = all.result.problems.find(function (x) {
    return String(x.contestId) === info.contest && String(x.index).toUpperCase() === info.index;
  });
  if (!p) throw new Error('Codeforces 找不到這一題：' + info.contest + info.index);
  return p;
}

async function fetchCodeforces(info) {
  const meta = await fetchCodeforcesMeta(info);
  return {
    id: 'codeforces-' + info.contest + info.index.toLowerCase() + '-' + slugify(meta.name),
    platform: 'Codeforces',
    number: info.contest + info.index,
    title: meta.name,
    url: 'https://codeforces.com/problemset/problem/' + info.contest + '/' + info.index,
    difficulty: meta.rating ? String(meta.rating) : 'Unrated',
    tags: (meta.tags || []).slice(0, MAX_TAGS),
    statement: null,
    statementNote: 'Codeforces 的題目頁面不開放程式讀取，官方 API 也不提供題目敘述。',
    signature: null,
    rawTests: null
  };
}

// ---------- 輸出 ----------
function formatEntry(p) {
  const fields = [
    ['id', p.id], ['platform', p.platform], ['number', p.number], ['title', p.title],
    ['url', p.url], ['difficulty', p.difficulty], ['tags', p.tags],
    ['language', 'C++'], ['added', today()]
  ];
  const lines = fields.map(function (f) {
    const value = Array.isArray(f[1])
      ? '[' + f[1].map(function (t) { return JSON.stringify(t); }).join(', ') + ']'
      : JSON.stringify(f[1]);
    return '  ' + f[0] + ': ' + value;
  });
  return '{\n' + lines.join(',\n') + '\n},';
}

function buildReport(p, savedPath) {
  const out = [];
  out.push('# ' + p.platform + ' ' + p.number + '. ' + p.title, '');
  out.push('- id：`' + p.id + '`');
  out.push('- 簡報檔案：`problems/' + p.id + '.html`');
  out.push('- 原題：' + p.url);
  out.push('- 難度：' + p.difficulty + '；標籤：' + (p.tags.join(', ') || '（無）'));
  out.push('- 已存成：`' + savedPath + '`');
  out.push('', '## 要加進 problems.js 的資料', '', '```js', formatEntry(p), '```', '');

  if (p.statement) {
    out.push('## 題目內容（讀取自原題，簡報中要用自己的話改寫）', '', p.statement, '');
  } else {
    out.push('## 沒有題目敘述', '', p.statementNote,
      '請使用者貼上題目敘述、範例與限制（CLAUDE.md 第 8 節），不可以憑記憶補上。', '');
  }
  if (p.signature) {
    out.push('## LeetCode C++ 函式簽名（Coding 段落要沿用）', '', '```cpp', p.signature.trim(), '```', '');
  }
  if (p.rawTests) {
    out.push('## 範例測資的原始輸入（LeetCode 格式，每個參數一行）', '', '```', p.rawTests.trim(), '```', '');
  }
  return out.join('\n');
}

async function main() {
  const raw = process.argv[2];
  const info = raw && parseUrl(raw);
  if (!info) {
    console.error('用法：node tools/fetch-problem.js <題目網址>');
    console.error('支援 https://leetcode.com/problems/{slug}/、');
    console.error('https://codeforces.com/problemset/problem/{contest}/{index}、');
    console.error('https://codeforces.com/contest/{contest}/problem/{index}');
    process.exitCode = 1;
    return;
  }

  let problem;
  try {
    problem = info.platform === 'LeetCode' ? await fetchLeetCode(info) : await fetchCodeforces(info);
  } catch (e) {
    console.error('讀取失敗：' + e.message);
    console.error('請使用者貼上題目內容（CLAUDE.md 第 8 節）。');
    process.exitCode = 1;
    return;
  }

  const savedPath = 'scratch/' + problem.id + '.md';
  fs.mkdirSync(path.join(ROOT, 'scratch'), { recursive: true });
  const report = buildReport(problem, savedPath);
  fs.writeFileSync(path.join(ROOT, savedPath), report + '\n', 'utf8');
  console.log(report);

  // 用 exitCode 讓程式自然結束：在 Windows 上，網路連線未關閉時呼叫 process.exit() 會讓 Node.js 當掉
  process.exitCode = problem.statement ? 0 : 2;
}

main();
