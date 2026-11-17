/*
 * Algo Slides 簡報共用程式
 * 1. 依 <body data-problem-id data-variant> 從 problems.js 找到題目，填入標題頁並標示版本（參考解答／我的解法）
 * 2. 檢查段落、版本與檔名是否符合 CLAUDE.md，不符合時在頁面頂端顯示警告
 * 3. 在每個段落前插入深藍色分隔頁，並在最後加上 THE END 頁
 * 4. 用 KaTeX 排版 $...$ 與 $$...$$ 公式（載入失敗時改成純文字）
 * 5. 建立左下角的導覽列：段落、切換版本、下載 PPT
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

  // 同一題的兩個版本（CLAUDE.md 第 4 節）：檔名分別是 {id}.html 與 {id}--mine.html
  const VARIANTS = {
    reference: { label: '參考解答', suffix: '' },
    mine: { label: '我的解法', suffix: '--mine' }
  };

  // 匯出 PPT 時使用的顏色，全部來自 style.css 的設計變數
  const COLOR_VARS = {
    bg: '--bg', surface: '--surface', surface2: '--surface-2', border: '--border',
    text: '--text', textStrong: '--text-strong', textMuted: '--text-muted',
    accent: '--accent', accentBg: '--accent-bg', accentBorder: '--accent-border', accentOnNavy: '--accent-on-navy',
    navy: '--navy', onNavy: '--on-navy', onNavyMuted: '--on-navy-muted',
    success: '--success', successBg: '--success-bg', successText: '--success-text',
    codeBg: '--code-bg', codeText: '--code-text', codeComment: '--code-comment',
    easy: '--easy', medium: '--medium', hard: '--hard'
  };

  // PPT 匯出：按下按鈕時才載入，平常不影響簡報的載入速度
  const PPTX_LIB = 'https://cdn.jsdelivr.net/npm/pptxgenjs@3.12.0/dist/pptxgen.bundle.js';
  const SCRIPT_SRC = document.currentScript ? document.currentScript.src : '';
  const EXPORTER = SCRIPT_SRC ? SCRIPT_SRC.replace(/deck\.js(\?.*)?$/, 'export-pptx.js') : '../assets/export-pptx.js';

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

  function readColors() {
    const colors = {};
    Object.keys(COLOR_VARS).forEach(function (key) { colors[key] = cssVar(COLOR_VARS[key]); });
    return colors;
  }

  // LeetCode 顯示 Easy / Medium / Hard；Codeforces 的 rating 是數字
  function difficultyInfo(problem) {
    const d = String(problem.difficulty || '');
    if (/^\d+$/.test(d)) return { text: 'Rating ' + d, cls: 'rating' };
    return { text: d, cls: d.toLowerCase() };
  }

  function deckFile(id, variant) {
    return id + VARIANTS[variant].suffix + '.html';
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
  function fillTitleSlide(problem, variant) {
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

    // 版本徽章：參考解答／我的解法
    const meta = document.querySelector('.title-slide .meta');
    if (meta) meta.appendChild(el('span', 'badge variant-badge ' + variant, VARIANTS[variant].label));

    const link = slot('url');
    if (link) link.href = problem.url;

    document.title = problem.platform + ' ' + problem.number + ' · ' + problem.title
      + '（' + VARIANTS[variant].label + '）| Algo Slides';
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

  // 版本與檔名是否一致（CLAUDE.md 第 4、5 節）
  function checkVariant(id, variant, problem) {
    const issues = [];
    if (!VARIANTS[variant]) {
      issues.push('data-variant 只能是 reference 或 mine，目前是「' + variant + '」');
      return issues;
    }
    const actual = decodeURIComponent(location.pathname.split('/').pop() || '');
    if (id !== 'TEMPLATE' && /\.html$/.test(actual) && actual !== deckFile(id, variant)) {
      issues.push('檔名應該是 ' + deckFile(id, variant) + '，目前是 ' + actual);
    }
    if (variant === 'mine' && problem && id !== 'TEMPLATE' && !problem.mine) {
      issues.push('這是「我的解法」，但 problems.js 這一題沒有 mine 欄位，請依 CLAUDE.md 第 5 節補上');
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

  // 程式碼高亮會改寫 <code> 的內容，先把原始程式碼存起來給 PPT 匯出使用
  function keepRawCode() {
    document.querySelectorAll('.reveal pre code').forEach(function (code) {
      const tpl = code.querySelector('script[type="text/template"]');
      code.setAttribute('data-raw-code', tpl ? tpl.textContent : code.textContent);
    });
  }

  // ---------- 4. 導覽列：段落、切換版本、下載 PPT ----------
  function buildPartNav(sections, ctx) {
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

    // 另一個版本存在時，提供切換連結
    const other = ctx.variant === 'mine' ? 'reference' : 'mine';
    const hasOther = other === 'reference' || (ctx.problem && ctx.problem.mine);
    if (ctx.id !== 'TEMPLATE' && hasOther) {
      const sw = el('a', 'switch-link', '切換：' + VARIANTS[other].label);
      sw.href = deckFile(ctx.id, other);
      nav.appendChild(sw);
    }

    const ppt = el('button', 'ppt-button', '下載 PPT');
    ppt.type = 'button';
    ppt.addEventListener('click', function () { exportPptx(ppt, ctx); });
    nav.appendChild(ppt);

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

  // KaTeX 載入失敗或匯出 PPT 時，把常見的 LaTeX 指令轉成一般符號
  const TEX_TEXT = {
    '\\le': '≤', '\\leq': '≤', '\\ge': '≥', '\\geq': '≥', '\\ne': '≠', '\\neq': '≠',
    '\\lt': '<', '\\gt': '>', '\\times': '×', '\\cdot': '·', '\\ldots': '…', '\\dots': '…',
    '\\to': '→', '\\rightarrow': '→', '\\Rightarrow': '⇒', '\\leftarrow': '←', '\\approx': '≈', '\\in': '∈',
    '\\sum': 'Σ', '\\infty': '∞', '\\lfloor': '⌊', '\\rfloor': '⌋', '\\lceil': '⌈', '\\rceil': '⌉',
    '\\Sigma': 'Σ', '\\bigl': '', '\\bigr': '', '\\limits': '', '\\displaystyle': '',
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

  // ---------- 6. 下載 PPT ----------
  const scriptCache = {};
  function loadScript(src) {
    if (!scriptCache[src]) {
      scriptCache[src] = new Promise(function (resolve, reject) {
        const s = document.createElement('script');
        s.src = src;
        s.onload = resolve;
        s.onerror = function () {
          delete scriptCache[src];
          reject(new Error('無法載入 ' + src));
        };
        document.head.appendChild(s);
      });
    }
    return scriptCache[src];
  }

  function exportPptx(button, ctx) {
    const original = button.textContent;
    button.disabled = true;
    button.textContent = 'PPT 產生中…';
    loadScript(PPTX_LIB)
      .then(function () { return loadScript(EXPORTER); })
      .then(function () {
        const pptx = window.AlgoSlidesPptx.build(window.PptxGenJS, document, {
          problem: ctx.problem,
          variantLabel: VARIANTS[ctx.variant].label,
          parts: PARTS,
          colors: readColors(),
          texToText: texToText,
          difficultyInfo: difficultyInfo
        });
        const base = ctx.id === 'TEMPLATE' ? 'template' : deckFile(ctx.id, ctx.variant).replace(/\.html$/, '');
        return pptx.writeFile({ fileName: base + '.pptx' });
      })
      .catch(function (err) {
        console.error(err);
        alert('PPT 產生失敗：' + err.message);
      })
      .then(function () {
        button.disabled = false;
        button.textContent = original;
      });
  }

  // 給 PPT 匯出程式與測試程式共用
  window.AlgoSlides = {
    PARTS: PARTS,
    VARIANTS: VARIANTS,
    COLOR_VARS: COLOR_VARS,
    texToText: texToText,
    difficultyInfo: difficultyInfo,
    deckFile: deckFile
  };

  // ---------- 啟動 ----------
  function init() {
    const id = document.body.dataset.problemId;
    const variant = document.body.dataset.variant || 'reference';
    let problem = (window.PROBLEMS || []).find(function (p) { return p.id === id; });
    if (!problem && id === 'TEMPLATE') problem = TEMPLATE_DEMO;

    const authored = getSections();
    const issues = [];
    if (problem) {
      if (VARIANTS[variant]) fillTitleSlide(problem, variant);
    } else {
      issues.push('problems.js 裡找不到 id 為「' + id + '」的題目，請依 CLAUDE.md 第 5 節新增');
    }
    issues.push.apply(issues, checkVariant(id, variant, problem));
    issues.push.apply(issues, checkStructure(authored));
    if (issues.length) showWarning(issues);

    keepRawCode();
    insertDividers(authored);
    appendEndSlide();
    renderMath();
    const links = buildPartNav(getSections(), {
      id: id,
      variant: VARIANTS[variant] ? variant : 'reference',
      problem: problem || TEMPLATE_DEMO
    });

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

  // 只在真的有 reveal.js 時啟動；在 Node.js 測試中只載入上面的共用函式
  if (window.Reveal) init();
})();
