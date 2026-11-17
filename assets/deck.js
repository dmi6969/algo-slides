/*
 * Algo Slides 簡報共用程式
 * 1. 依 <body data-problem-id> 從 problems.js 找到題目，填入標題頁
 * 2. 檢查 5 個段落是否齊全、順序是否正確，不符合 CLAUDE.md 時在頁面頂端顯示警告
 * 3. 在每個段落前插入深藍色分隔頁，並在最後加上 THE END 頁
 * 4. 用 KaTeX 排版 $...$ 與 $$...$$ 公式（載入失敗時改成純文字）
 * 5. 建立左下角的段落導覽列
 * 6. 初始化 reveal.js
 *
 * 新增題目時不需要修改這個檔案（見 CLAUDE.md 第 3 節）。
 */
(function () {
  'use strict';

  // 段落順序與名稱，必須和 CLAUDE.md 第 6.1 節一致
  const PARTS = [
    { key: 'overview', label: 'Problem overview', short: 'Overview' },
    { key: 'sample', label: 'Sample I/O', short: 'Sample' },
    { key: 'idea', label: 'Idea', short: 'Idea' },
    { key: 'coding', label: 'Coding', short: 'Coding' },
    { key: 'complexity', label: 'Complexity', short: 'Complexity' }
  ];
  const PART_KEYS = PARTS.map(function (p) { return p.key; });

  // 範本（data-problem-id="TEMPLATE"）預覽時使用的示範資料
  const TEMPLATE_DEMO = {
    platform: 'Platform',
    number: '#',
    title: '題目名稱',
    url: '#',
    difficulty: 'Easy',
    tags: ['Tag 1', 'Tag 2']
  };

  function cssVar(name) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  }

  // LeetCode 顯示 Easy / Medium / Hard；Codeforces 的 rating 是數字
  function difficultyInfo(problem) {
    const d = String(problem.difficulty || '');
    if (/^\d+$/.test(d)) return { text: 'Rating ' + d, cls: 'rating' };
    return { text: d, cls: d.toLowerCase() };
  }

  function el(tag, cls, text) {
    const node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function getSections() {
    return Array.from(document.querySelectorAll('.reveal .slides > section'));
  }

  // ---------- 1. 標題頁 ----------
  function fillTitleSlide(problem) {
    const slot = function (name) { return document.querySelector('[data-fill="' + name + '"]'); };
    const setText = function (name, text) {
      const node = slot(name);
      if (node) node.textContent = text;
    };

    setText('platform', problem.platform);
    setText('number', problem.number);
    setText('title', problem.title);

    const diff = slot('difficulty');
    if (diff) {
      const info = difficultyInfo(problem);
      diff.textContent = info.text;
      diff.className = 'badge ' + info.cls;
    }

    const tags = slot('tags');
    if (tags) {
      tags.replaceChildren.apply(tags, (problem.tags || []).map(function (t) { return el('span', 'tag', t); }));
    }

    const link = slot('url');
    if (link) link.href = problem.url;

    document.title = problem.platform + ' ' + problem.number + ' · ' + problem.title + ' | Algo Slides';
  }

  // ---------- 2. 結構檢查（在插入分隔頁之前執行） ----------
  function checkStructure(sections) {
    const issues = [];
    const parts = sections.map(function (s) { return s.dataset.part || '（未設定）'; });

    if (parts[0] !== 'title') issues.push('第 1 頁必須是 data-part="title" 的標題頁');

    const body = parts.slice(1);
    body.forEach(function (part, i) {
      if (PART_KEYS.indexOf(part) === -1) {
        issues.push('第 ' + (i + 2) + ' 頁的 data-part="' + part + '" 不是有效的段落名稱');
      }
    });

    PARTS.forEach(function (p) {
      if (body.indexOf(p.key) === -1) issues.push('缺少「' + p.label + '」段落（data-part="' + p.key + '"）');
    });

    // 段落編號只能維持或遞增，不能往回跳
    let last = -1;
    for (let i = 0; i < body.length; i++) {
      const idx = PART_KEYS.indexOf(body[i]);
      if (idx === -1) continue;
      if (idx < last) {
        issues.push('第 ' + (i + 2) + ' 頁「' + PARTS[idx].label + '」的位置錯誤，段落順序必須是 '
          + PARTS.map(function (p) { return p.label; }).join(' → '));
        break;
      }
      last = idx;
    }

    if (document.querySelector('.reveal .slides section section')) {
      issues.push('不要使用巢狀 <section>（垂直投影片）');
    }
    return issues;
  }

  function showWarning(messages) {
    const box = el('div', 'structure-warning');
    box.setAttribute('role', 'alert');
    const list = el('ul');
    messages.forEach(function (m) { list.appendChild(el('li', '', m)); });
    box.append(el('strong', '', '這份簡報不符合 CLAUDE.md 的規則：'), list);
    document.body.appendChild(box);
  }

  // ---------- 3. 分隔頁與結尾頁 ----------
  function insertDividers(sections) {
    const navy = cssVar('--navy');
    PARTS.forEach(function (p, idx) {
      const first = sections.find(function (s) { return s.dataset.part === p.key; });
      if (!first) return;
      const divider = el('section', 'divider-slide');
      divider.dataset.part = p.key;
      divider.setAttribute('data-background-color', navy);
      divider.append(
        el('p', 'divider-index', String(idx + 1).padStart(2, '0')),
        el('h2', '', p.label)
      );
      first.before(divider);
    });
  }

  function appendEndSlide() {
    const end = el('section', 'end-slide');
    end.dataset.part = 'end';
    end.setAttribute('data-background-color', cssVar('--navy'));
    end.appendChild(el('h2', '', 'THE END'));
    document.querySelector('.reveal .slides').appendChild(end);
  }

  // ---------- 4. 段落導覽列 ----------
  function buildPartNav(sections) {
    const nav = el('nav', 'part-nav');
    nav.setAttribute('aria-label', '段落導覽');

    const home = el('a', 'home-link', '← 題目列表');
    home.href = '../index.html';
    nav.appendChild(home);

    const links = {};
    PARTS.forEach(function (p) {
      const first = sections.findIndex(function (s) { return s.dataset.part === p.key; });
      if (first === -1) return;
      const a = el('a', '', p.short);
      a.href = '#/' + first;
      a.addEventListener('click', function (e) {
        e.preventDefault();
        Reveal.slide(first);
      });
      nav.appendChild(a);
      links[p.key] = a;
    });

    document.body.appendChild(nav);
    return links;
  }

  function markActivePart(links, slide) {
    const part = slide && slide.dataset.part;
    Object.keys(links).forEach(function (key) {
      links[key].classList.toggle('is-active', key === part);
    });
  }

  // ---------- 5. 數學公式（KaTeX） ----------
  // 不處理公式的地方：程式碼、範例輸入輸出（都在 pre 或 code 裡）與講者備註
  const MATH_OPTIONS = {
    delimiters: [
      { left: '$$', right: '$$', display: true },
      { left: '$', right: '$', display: false }
    ],
    ignoredTags: ['script', 'noscript', 'style', 'textarea', 'pre', 'code', 'option'],
    ignoredClasses: ['notes'],
    throwOnError: false
  };

  // KaTeX 載入失敗時，把常見的 LaTeX 指令轉成一般符號，讓觀眾至少看得懂
  const TEX_TEXT = {
    '\\le': '≤', '\\leq': '≤', '\\ge': '≥', '\\geq': '≥', '\\ne': '≠', '\\neq': '≠',
    '\\lt': '<', '\\gt': '>', '\\times': '×', '\\cdot': '·', '\\ldots': '…', '\\dots': '…',
    '\\to': '→', '\\rightarrow': '→', '\\Rightarrow': '⇒', '\\approx': '≈', '\\in': '∈',
    '\\sum': 'Σ', '\\infty': '∞', '\\lfloor': '⌊', '\\rfloor': '⌋', '\\lceil': '⌈', '\\rceil': '⌉',
    '\\,': ' ', '\\;': ' ', '\\ ': ' ', '\\quad': '  '
  };

  // 「\{」「\}」是要顯示出來的大括號，先換成暫存字元，刪掉語法用的大括號後再換回來
  function texToText(tex) {
    return tex
      .replace(/\\\{/g, '\u0001')
      .replace(/\\\}/g, '\u0002')
      .replace(/\\frac\{([^{}]*)\}\{([^{}]*)\}/g, '($1)/($2)')
      .replace(/\\(?:text|mathrm|mathit|operatorname|underbrace|overbrace)\{([^{}]*)\}/g, '$1')
      .replace(/\\[a-zA-Z]+|\\[,; ]/g, function (cmd) {
        return TEX_TEXT[cmd] !== undefined ? TEX_TEXT[cmd] : cmd.slice(1);
      })
      .replace(/[{}]/g, '')
      .replace(/\u0001/g, '{')
      .replace(/\u0002/g, '}');
  }

  function fallbackMath(root) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode: function (node) {
        return node.parentElement.closest('pre, code, script, .notes')
          ? NodeFilter.FILTER_REJECT
          : NodeFilter.FILTER_ACCEPT;
      }
    });
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach(function (node) {
      if (node.nodeValue.indexOf('$') === -1) return;
      node.nodeValue = node.nodeValue.replace(/\$\$([\s\S]+?)\$\$|\$([^$]+?)\$/g, function (m, display, inline) {
        return texToText(display || inline);
      });
    });
  }

  function renderMath() {
    const root = document.querySelector('.reveal .slides');
    if (typeof window.renderMathInElement === 'function') {
      renderMathInElement(root, MATH_OPTIONS);
    } else {
      console.warn('KaTeX 沒有載入成功，公式改用純文字顯示');
      fallbackMath(root);
    }
  }

  // ---------- 啟動 ----------
  function init() {
    const id = document.body.dataset.problemId;
    let problem = (window.PROBLEMS || []).find(function (p) { return p.id === id; });
    if (!problem && id === 'TEMPLATE') problem = TEMPLATE_DEMO;

    const authored = getSections();
    const issues = [];
    if (problem) {
      fillTitleSlide(problem);
    } else {
      issues.push('problems.js 裡找不到 id 為「' + id + '」的題目，請依 CLAUDE.md 第 5 節新增');
    }
    issues.push.apply(issues, checkStructure(authored));
    if (issues.length) showWarning(issues);

    insertDividers(authored);
    appendEndSlide();
    renderMath();
    const links = buildPartNav(getSections());

    Reveal.initialize({
      hash: true,
      slideNumber: 'c/t',
      width: 1280,
      height: 720,
      margin: 0,
      center: false,
      controlsLayout: 'edges',
      transition: 'slide',
      plugins: [RevealHighlight, RevealNotes]
    }).then(function () {
      markActivePart(links, Reveal.getCurrentSlide());
      Reveal.on('slidechanged', function (e) {
        markActivePart(links, e.currentSlide);
      });
    });
  }

  init();
})();
