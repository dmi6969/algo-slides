/*
 * Algo Slides：把簡報匯出成可編輯的 PowerPoint（CLAUDE.md 第 7 節）
 *
 * - 由 deck.js 在按下「下載 PPT」時載入，搭配 PptxGenJS 產生 .pptx
 * - 標題頁、段落分隔頁、THE END 頁依 problems.js 的資料產生，和網頁版一致
 * - 內容頁依 CLAUDE.md 第 7 節的元件，逐一轉換成 PowerPoint 的文字框、表格與圖形，
 *   所以下載後每個字都能在 PowerPoint 裡修改
 * - 公式轉成一般文字（例如 1 ≤ n ≤ 10^4），講者備註轉成 PowerPoint 的備忘稿
 * - 新增元件時，要在 buildBlocks() 加上對應的轉換（CLAUDE.md 第 11 節）
 *
 * 這個檔案不依賴 reveal.js，也可以在 Node.js（jsdom）中測試。
 */
(function (root) {
  'use strict';

  // 投影片尺寸（16:9，單位：英吋）與版面
  const W = 13.333;
  const H = 7.5;
  const MX = 0.6;
  const CW = W - MX * 2;
  const TOP = 1.35;
  const BOTTOM = H - 0.5;
  const GAP = 0.18;
  const FONT = 'Microsoft JhengHei';
  const MONO = 'Consolas';

  // 基本字級（pt）。一頁內容太多時，整頁等比例縮小，最小到 MIN_SCALE
  const SIZE = { body: 16, small: 13, label: 11, callout: 15, table: 12, code: 12, io: 13, display: 17, card: 14 };
  const MIN_SCALE = 0.7;

  function hex(color) {
    return String(color || '').replace('#', '').trim().toUpperCase();
  }

  // ---------- 估算文字大小 ----------
  // 中日韓字與全形符號約 1 個字寬，其他字元約 0.55 個字寬
  function emWidth(str) {
    let w = 0;
    for (const ch of String(str)) w += /[⺀-鿿＀-￯]/.test(ch) ? 1 : 0.55;
    return w;
  }

  function countLines(text, sizePt, widthIn) {
    const avail = Math.max(widthIn * 72 - 14, 20);
    return String(text).split('\n').reduce(function (n, seg) {
      return n + Math.max(1, Math.ceil(emWidth(seg) * sizePt / avail));
    }, 0);
  }

  function lineHeight(sizePt) {
    return sizePt * 1.3 / 72;
  }

  // ---------- 從 HTML 取出文字片段 ----------
  function texOf(katexEl) {
    const ann = katexEl.querySelector('annotation');
    return ann ? ann.textContent : katexEl.textContent;
  }

  // KaTeX 排版後的獨立公式會多包一層：<span><span class="katex-display">…</span></span>
  // 是獨立公式就回傳原始 TeX，否則回傳 null
  function displayTexOf(node) {
    if (node.nodeType !== 1) return null;
    const disp = node.classList.contains('katex-display') ? node : node.querySelector(':scope > .katex-display');
    if (!disp || (disp !== node && node.children.length !== 1)) return null;
    return texOf(disp.querySelector('.katex') || disp);
  }

  // 還沒被 KaTeX 排版的 $...$（例如在 Node.js 測試中）也轉成一般文字
  function mathText(ctx, text) {
    return text.replace(/\$\$([\s\S]+?)\$\$|\$([^$]+?)\$/g, function (m, display, inline) {
      return ctx.texToText(display || inline);
    });
  }

  // 走訪元素，產生 [{ text, bold, code }]；不整理空白
  function collectRuns(node, ctx, bold, code, out) {
    if (node.nodeType === 3) {
      const t = node.nodeValue.replace(/\s+/g, ' ');
      if (t) out.push({ text: code ? t : mathText(ctx, t), bold: bold, code: code });
      return out;
    }
    if (node.nodeType !== 1) return out;
    const tag = node.tagName.toLowerCase();
    if (tag === 'aside' || tag === 'script' || tag === 'style') return out;
    if (node.classList.contains('katex')) {
      out.push({ text: ctx.texToText(texOf(node)), bold: bold, code: false });
      return out;
    }
    if (tag === 'br') {
      out.push({ text: '\n', bold: bold, code: code });
      return out;
    }
    const b = bold || tag === 'strong' || tag === 'b';
    const c = code || tag === 'code';
    node.childNodes.forEach(function (child) { collectRuns(child, ctx, b, c, out); });
    return out;
  }

  // 合併相鄰且樣式相同的片段，並去掉頭尾空白
  function tidy(runs) {
    const out = [];
    runs.forEach(function (r) {
      const last = out[out.length - 1];
      if (last && last.bold === r.bold && last.code === r.code) last.text += r.text;
      else out.push({ text: r.text, bold: r.bold, code: r.code });
    });
    if (out.length) {
      out[0].text = out[0].text.replace(/^\s+/, '');
      out[out.length - 1].text = out[out.length - 1].text.replace(/\s+$/, '');
    }
    return out.filter(function (r) { return r.text !== ''; });
  }

  function runsOf(el, ctx) {
    return tidy(collectRuns(el, ctx, false, false, []));
  }

  function plain(runs) {
    return runs.map(function (r) { return r.text; }).join('');
  }

  // ---------- 轉成 PptxGenJS 的文字格式 ----------
  // paragraphs：[{ runs, bullet, align, bold, color, boldColor }]；段落屬性放在每段的第一個片段
  function textObjects(paragraphs, base) {
    const out = [];
    paragraphs.forEach(function (p, pi) {
      const runs = p.runs.length ? p.runs : [{ text: ' ' }];
      runs.forEach(function (r, ri) {
        const o = {
          fontFace: r.code ? MONO : (base.font || FONT),
          fontSize: r.size || base.size,
          color: r.color || (r.bold && (p.boldColor || base.boldColor)) || p.color || base.color,
          bold: !!(r.bold || p.bold)
        };
        if (r.link) o.hyperlink = { url: r.link };
        if (ri === 0) {
          if (p.bullet) o.bullet = p.bullet;
          if (p.align) o.align = p.align;
          o.paraSpaceAfter = base.spaceAfter || 0;
        }
        if (ri === runs.length - 1 && pi < paragraphs.length - 1) o.breakLine = true;
        out.push({ text: r.text, options: o });
      });
    });
    return out;
  }

  // 每個區塊都提供 height(scale) 與 draw(slide, y, scale)，方便整頁一起縮放
  function textBlock(paragraphs, base, x, w) {
    function height(s) {
      const size = base.size * s;
      return paragraphs.reduce(function (h, p) {
        const indent = p.bullet ? 0.3 : 0;
        return h + countLines(plain(p.runs), size, w - indent) * lineHeight(size) + (base.spaceAfter || 0) / 72;
      }, 0) + 0.1;
    }
    return {
      height: height,
      draw: function (slide, y, s) {
        slide.addText(textObjects(paragraphs, Object.assign({}, base, { size: base.size * s })), {
          x: x, y: y, w: w, h: height(s), valign: 'top', margin: 2, fontFace: base.font || FONT
        });
      }
    };
  }

  // ---------- 各種元件 ----------
  function listBlock(el, ctx, x, w, size) {
    const ordered = el.tagName.toLowerCase() === 'ol';
    const paras = Array.from(el.children)
      .filter(function (c) { return c.tagName.toLowerCase() === 'li'; })
      .map(function (li) {
        return { runs: runsOf(li, ctx), bullet: ordered ? { type: 'number', indent: 20 } : { indent: 18 } };
      });
    return textBlock(paras, { size: size || SIZE.body, color: ctx.c.text, boldColor: ctx.c.textStrong, spaceAfter: 4 }, x, w);
  }

  function paragraphBlock(el, ctx, x, w) {
    const runs = runsOf(el, ctx);
    if (!runs.length) return null;
    const cls = el.classList;
    if (cls.contains('label')) {
      return textBlock([{ runs: runs, bold: true }], { size: SIZE.label, color: ctx.c.accent }, x, w);
    }
    if (cls.contains('muted')) {
      return textBlock([{ runs: runs }], { size: SIZE.small, color: ctx.c.textMuted, boldColor: ctx.c.textStrong }, x, w);
    }
    if (cls.contains('lead')) {
      return textBlock([{ runs: runs }], { size: 19, color: ctx.c.textStrong }, x, w);
    }
    return textBlock([{ runs: runs }], { size: 15, color: ctx.c.text, boldColor: ctx.c.textStrong }, x, w);
  }

  function displayBlock(tex, ctx, x, w) {
    return textBlock([{ runs: [{ text: ctx.texToText(tex).trim() }], align: 'center' }],
      { size: SIZE.display, color: ctx.c.textStrong }, x, w);
  }

  // 重點框：一般文字是一段，獨立公式各自一段並置中
  function calloutParagraphs(el, ctx) {
    const paras = [];
    let current = [];
    function flush() {
      const runs = tidy(current);
      if (runs.length) paras.push({ runs: runs });
      current = [];
    }
    function pushDisplay(tex) {
      flush();
      paras.push({ runs: [{ text: ctx.texToText(tex).trim() }], align: 'center' });
    }
    el.childNodes.forEach(function (node) {
      const displayTex = displayTexOf(node);
      if (displayTex !== null) {
        pushDisplay(displayTex);
      } else if (node.nodeType === 3) {
        node.nodeValue.split(/\$\$([\s\S]+?)\$\$/).forEach(function (part, i) {
          if (i % 2 === 1) pushDisplay(part);
          else current.push({ text: mathText(ctx, part.replace(/\s+/g, ' ')), bold: false, code: false });
        });
      } else {
        collectRuns(node, ctx, false, false, current);
      }
    });
    flush();
    return paras;
  }

  function calloutBlock(el, ctx, x, w) {
    const info = el.classList.contains('info');
    const fill = info ? ctx.c.accentBg : ctx.c.successBg;
    const bar = info ? ctx.c.accent : ctx.c.success;
    const inner = textBlock(calloutParagraphs(el, ctx),
      { size: SIZE.callout, color: ctx.c.text, boldColor: info ? ctx.c.accent : ctx.c.successText, spaceAfter: 2 },
      x + 0.22, w - 0.34);
    function height(s) { return inner.height(s) + 0.16; }
    return {
      height: height,
      draw: function (slide, y, s) {
        slide.addShape(ctx.shapes.rect, { x: x, y: y, w: w, h: height(s), fill: { color: fill }, line: { type: 'none' } });
        slide.addShape(ctx.shapes.rect, { x: x, y: y, w: 0.06, h: height(s), fill: { color: bar }, line: { type: 'none' } });
        inner.draw(slide, y + 0.08, s);
      }
    };
  }

  function ioGridBlock(el, ctx, x, w) {
    const cols = Array.from(el.children).map(function (col) {
      const label = col.querySelector('h3');
      const pre = col.querySelector('pre');
      return {
        label: label ? label.textContent.trim() : '',
        text: pre ? pre.textContent.replace(/^\n+/, '').replace(/\s+$/, '') : ''
      };
    });
    const gap = 0.3;
    const colW = (w - gap * (cols.length - 1)) / cols.length;
    function boxH(c, s) { return countLines(c.text, SIZE.io * s, colW - 0.3) * lineHeight(SIZE.io * s) + 0.25; }
    function height(s) { return 0.32 + Math.max.apply(null, cols.map(function (c) { return boxH(c, s); })); }
    return {
      height: height,
      draw: function (slide, y, s) {
        const bh = height(s) - 0.32;
        cols.forEach(function (c, i) {
          const cx = x + i * (colW + gap);
          slide.addText(c.label, { x: cx, y: y, w: colW, h: 0.3, fontFace: FONT, fontSize: SIZE.label * s, bold: true, color: ctx.c.accent, margin: 2 });
          slide.addText(c.text, {
            x: cx, y: y + 0.32, w: colW, h: bh, fontFace: MONO, fontSize: SIZE.io * s, color: ctx.c.textStrong,
            fill: { color: ctx.c.surface2 }, line: { color: ctx.c.border, width: 0.75 }, valign: 'top', margin: 8
          });
        });
      }
    };
  }

  function traceInputBlock(el, ctx, x, w) {
    const runs = [];
    el.childNodes.forEach(function (node) {
      if (node.nodeType !== 1) return;
      if (node.classList.contains('io-label')) {
        runs.push({ text: (runs.length ? '      ' : '') + node.textContent.trim() + '   ', bold: true, color: ctx.c.accent, size: SIZE.label });
      } else {
        runs.push({ text: node.textContent, code: true, color: ctx.c.textStrong });
      }
    });
    const inner = textBlock([{ runs: runs }], { size: SIZE.io, color: ctx.c.textStrong }, x + 0.2, w - 0.3);
    function height(s) { return inner.height(s) + 0.1; }
    return {
      height: height,
      draw: function (slide, y, s) {
        // 片段自己的字級也要跟著縮放
        runs.forEach(function (r) { if (r.size) r.size = SIZE.label * s; });
        slide.addShape(ctx.shapes.rect, { x: x, y: y, w: w, h: height(s), fill: { color: ctx.c.surface }, line: { color: ctx.c.border, width: 0.75 } });
        slide.addShape(ctx.shapes.rect, { x: x, y: y, w: 0.05, h: height(s), fill: { color: ctx.c.accent }, line: { type: 'none' } });
        inner.draw(slide, y + 0.05, s);
      }
    };
  }

  function tableBlock(el, ctx, x, w) {
    const isComplexity = el.classList.contains('complexity');
    const head = Array.from(el.querySelectorAll('thead tr')).map(function (tr) {
      return Array.from(tr.children).map(function (c) { return plain(runsOf(c, ctx)); });
    });
    const body = Array.from(el.querySelectorAll('tbody tr')).map(function (tr) {
      return {
        answer: tr.classList.contains('is-answer'),
        cells: Array.from(tr.children).map(function (c) { return plain(runsOf(c, ctx)); })
      };
    });
    const all = head.concat(body.map(function (r) { return r.cells; }));
    const nCols = Math.max.apply(null, all.map(function (r) { return r.length; }));

    function layout(s) {
      const size = SIZE.table * s;
      let colW = [];
      for (let i = 0; i < nCols; i++) {
        const widest = Math.max.apply(null, all.map(function (r) { return emWidth(r[i] || ''); }));
        colW.push(Math.max(0.6, widest * size / 72 + 0.3));
      }
      const sum = colW.reduce(function (a, b) { return a + b; }, 0);
      if (sum > w) colW = colW.map(function (cw) { return cw * w / sum; });
      const rowH = all.map(function (r) {
        const lines = Math.max.apply(null, r.map(function (t, i) { return countLines(t, size, colW[i] - 0.1); }));
        return lines * lineHeight(size) + 0.14;
      });
      return { size: size, colW: colW, rowH: rowH };
    }

    return {
      height: function (s) { return layout(s).rowH.reduce(function (a, b) { return a + b; }, 0); },
      draw: function (slide, y, s) {
        const L = layout(s);
        const rows = [];
        head.forEach(function (r) {
          rows.push(r.map(function (t) {
            return { text: t, options: { bold: true, color: ctx.c.onNavy, fill: { color: ctx.c.navy } } };
          }));
        });
        body.forEach(function (r, ri) {
          rows.push(r.cells.map(function (t, ci) {
            const o = { color: ctx.c.text, fill: { color: ri % 2 === 1 ? ctx.c.surface2 : ctx.c.surface } };
            if (ci === 0 && !isComplexity) o.color = ctx.c.textMuted;
            if (isComplexity && ci === 1) { o.color = ctx.c.accent; o.bold = true; }
            if (r.answer) { o.color = ctx.c.successText; o.bold = true; o.fill = { color: ctx.c.successBg }; }
            return { text: t, options: o };
          }));
        });
        slide.addTable(rows, {
          x: x, y: y, colW: L.colW, rowH: L.rowH, fontFace: FONT, fontSize: L.size, valign: 'middle',
          border: { type: 'solid', pt: 0.75, color: ctx.c.border }
        });
      }
    };
  }

  function compareBlock(el, ctx, x, w) {
    const cardEls = Array.from(el.children).filter(function (c) { return c.classList.contains('card'); });
    const gap = 0.3;
    const cardW = (w - gap * (cardEls.length - 1)) / cardEls.length;
    const cards = cardEls.map(function (card, i) {
      const cx = x + i * (cardW + gap);
      const h3 = card.querySelector('h3');
      const list = card.querySelector('ul, ol');
      const best = card.classList.contains('is-best');
      return {
        x: cx,
        best: best,
        title: textBlock([{ runs: h3 ? runsOf(h3, ctx) : [], bold: true }],
          { size: 15, color: best ? ctx.c.accent : ctx.c.textStrong }, cx + 0.15, cardW - 0.3),
        list: list ? listBlock(list, ctx, cx + 0.15, cardW - 0.3, SIZE.card) : null
      };
    });
    function cardH(c, s) { return 0.2 + c.title.height(s) + (c.list ? c.list.height(s) : 0); }
    function height(s) { return Math.max.apply(null, cards.map(function (c) { return cardH(c, s); })); }
    return {
      height: height,
      draw: function (slide, y, s) {
        const h = height(s);
        cards.forEach(function (c) {
          slide.addShape(ctx.shapes.rect, {
            x: c.x, y: y, w: cardW, h: h, fill: { color: ctx.c.surface },
            line: { color: c.best ? ctx.c.accent : ctx.c.border, width: c.best ? 1.5 : 0.75 }
          });
          c.title.draw(slide, y + 0.1, s);
          if (c.list) c.list.draw(slide, y + 0.1 + c.title.height(s), s);
        });
      }
    };
  }

  function codeBlock(el, ctx, x, w) {
    const code = el.querySelector('code') || el;
    let text = code.getAttribute('data-raw-code');
    if (text == null) {
      const tpl = code.querySelector('script[type="text/template"]');
      if (tpl) text = tpl.textContent;
    }
    if (text == null) {
      const lines = code.querySelectorAll('.hljs-ln-code');
      text = lines.length ? Array.from(lines).map(function (l) { return l.textContent; }).join('\n') : code.textContent;
    }
    text = text.replace(/^\s*\n/, '').replace(/\s+$/, '');

    // 「//」之後是註解，用灰色顯示
    const paras = text.split('\n').map(function (line) {
      const at = line.indexOf('//');
      if (at === -1) return { runs: [{ text: line || ' ' }] };
      return {
        runs: [{ text: line.slice(0, at) }, { text: line.slice(at), color: ctx.c.codeComment }]
          .filter(function (r) { return r.text; })
      };
    });
    function height(s) {
      const size = SIZE.code * s;
      return paras.reduce(function (h, p) { return h + countLines(plain(p.runs), size, w - 0.4) * size * 1.2 / 72; }, 0) + 0.3;
    }
    return {
      height: height,
      draw: function (slide, y, s) {
        slide.addText(textObjects(paras, { font: MONO, size: SIZE.code * s, color: ctx.c.codeText }), {
          x: x, y: y, w: w, h: height(s), fontFace: MONO, fill: { color: ctx.c.codeBg },
          valign: 'top', margin: 10, lineSpacingMultiple: 0.95
        });
      }
    };
  }

  // 依照 section 裡的元件順序，轉成一個個區塊（CLAUDE.md 第 7 節的元件表）
  function buildBlocks(section, ctx) {
    const blocks = [];
    section.childNodes.forEach(function (node) {
      if (node.nodeType === 3) {
        // 寫在 section 最外層的 $$...$$（尚未被 KaTeX 排版時）
        node.nodeValue.split(/\$\$([\s\S]+?)\$\$/).forEach(function (part, i) {
          if (i % 2 === 1) blocks.push(displayBlock(part, ctx, MX, CW));
        });
        return;
      }
      if (node.nodeType !== 1) return;
      const tag = node.tagName.toLowerCase();
      const cls = node.classList;
      if (tag === 'h2' || tag === 'aside' || tag === 'script' || cls.contains('part-label')) return;
      const displayTex = displayTexOf(node);
      let block = null;
      if (displayTex !== null) block = displayBlock(displayTex, ctx, MX, CW);
      else if (tag === 'ul' || tag === 'ol') block = listBlock(node, ctx, MX, CW);
      else if (cls.contains('callout')) block = calloutBlock(node, ctx, MX, CW);
      else if (cls.contains('io-grid')) block = ioGridBlock(node, ctx, MX, CW);
      else if (cls.contains('trace-input')) block = traceInputBlock(node, ctx, MX, CW);
      else if (tag === 'table') block = tableBlock(node, ctx, MX, CW);
      else if (cls.contains('compare')) block = compareBlock(node, ctx, MX, CW);
      else if (tag === 'pre') block = codeBlock(node, ctx, MX, CW);
      else block = paragraphBlock(node, ctx, MX, CW);
      if (block) blocks.push(block);
    });
    return blocks;
  }

  // ---------- 各種投影片 ----------
  function addSlideNumber(slide, color) {
    slide.slideNumber = { x: W - 1.0, y: H - 0.42, w: 0.7, h: 0.3, fontFace: FONT, fontSize: 10, color: color, align: 'right' };
  }

  function titleSlide(pptx, ctx) {
    const p = ctx.problem;
    const slide = pptx.addSlide();
    slide.background = { color: ctx.c.bg };

    const eyebrow = (p.platform + ' · ' + p.number).toUpperCase();
    slide.addText(eyebrow, {
      shape: ctx.shapes.roundRect, rectRadius: 0.08,
      x: MX, y: 2.2, w: emWidth(eyebrow) * 13 / 72 + 0.5, h: 0.42,
      fontFace: MONO, fontSize: 13, color: ctx.c.accent, align: 'center', valign: 'middle', margin: 0,
      fill: { color: ctx.c.accentBg }, line: { color: ctx.c.accentBorder, width: 0.75 }
    });

    const titleH = countLines(p.title, 40, CW) * lineHeight(40) + 0.1;
    slide.addText(p.title, { x: MX, y: 2.75, w: CW, h: titleH, fontFace: FONT, fontSize: 40, bold: true, color: ctx.c.textStrong, valign: 'top', margin: 0 });

    let y = 2.75 + titleH + 0.1;
    const info = ctx.difficultyInfo(p);
    const diffColor = { easy: ctx.c.easy, medium: ctx.c.medium, hard: ctx.c.hard }[info.cls] || ctx.c.navy;
    const meta = [{ text: info.text, bold: true, color: diffColor }];
    (p.tags || []).forEach(function (t) { meta.push({ text: '   ·   ' + t, color: ctx.c.textMuted }); });
    slide.addText(textObjects([{ runs: meta }], { size: 15, color: ctx.c.text }), { x: MX, y: y, w: CW, h: 0.45, margin: 0, valign: 'middle' });

    y += 0.6;
    slide.addShape(ctx.shapes.line, { x: MX, y: y, w: CW, h: 0, line: { color: ctx.c.border, width: 1 } });
    if (p.url && p.url !== '#') {
      slide.addText(textObjects([{ runs: [{ text: '原題：', color: ctx.c.textMuted }, { text: p.url, link: p.url, color: ctx.c.accent }] }],
        { size: 14, color: ctx.c.text }), { x: MX, y: y + 0.2, w: CW, h: 0.4, margin: 0 });
    }
    addSlideNumber(slide, ctx.c.textMuted);
  }

  function dividerSlide(pptx, ctx, index, label) {
    const slide = pptx.addSlide();
    slide.background = { color: ctx.c.navy };
    slide.addText(String(index + 1).padStart(2, '0'), { x: MX, y: 2.85, w: 2, h: 0.4, fontFace: MONO, fontSize: 16, color: ctx.c.onNavyMuted, margin: 0 });
    slide.addText(label, { x: MX, y: 3.25, w: CW, h: 0.9, fontFace: FONT, fontSize: 40, bold: true, color: ctx.c.onNavy, valign: 'bottom', margin: 0 });
    slide.addShape(ctx.shapes.line, { x: MX, y: 4.25, w: CW, h: 0, line: { color: ctx.c.accentOnNavy, width: 2 } });
    addSlideNumber(slide, ctx.c.onNavyMuted);
  }

  function endSlide(pptx, ctx) {
    const slide = pptx.addSlide();
    slide.background = { color: ctx.c.navy };
    slide.addText('THE END', { x: 0, y: 3.1, w: W, h: 1.2, fontFace: FONT, fontSize: 48, bold: true, color: ctx.c.onNavy, align: 'center', valign: 'middle' });
    addSlideNumber(slide, ctx.c.onNavyMuted);
  }

  function contentSlide(pptx, section, ctx, index, label) {
    const slide = pptx.addSlide();
    slide.background = { color: ctx.c.bg };

    // 右上角標示段落，方便在 PowerPoint 裡辨認
    slide.addText(String(index + 1).padStart(2, '0') + ' · ' + label, {
      x: W - 4.1, y: 0.15, w: 3.5, h: 0.3, fontFace: FONT, fontSize: 10, color: ctx.c.textMuted, align: 'right', margin: 0
    });

    const h2 = section.querySelector(':scope > h2');
    const titleRuns = h2 ? runsOf(h2, ctx) : [];
    slide.addText(textObjects([{ runs: titleRuns }], { size: 24, color: ctx.c.textStrong }), {
      x: MX, y: 0.4, w: CW, h: 0.65, bold: true, valign: 'bottom', margin: 0
    });
    slide.addShape(ctx.shapes.line, { x: MX, y: 1.12, w: CW, h: 0, line: { color: ctx.c.accent, width: 2 } });

    // 內容太多時整頁等比例縮小，避免超出投影片
    const blocks = buildBlocks(section, ctx);
    const avail = BOTTOM - TOP;
    function total(s) {
      return blocks.reduce(function (sum, b) { return sum + b.height(s); }, 0) + GAP * Math.max(0, blocks.length - 1);
    }
    let s = 1;
    while (s > MIN_SCALE && total(s) > avail) s = Math.round((s - 0.05) * 100) / 100;
    if (s < 1) ctx.report.scaled.push({ slide: ctx.report.slides + 1, title: plain(titleRuns), scale: s });
    if (total(s) > avail) ctx.report.overflow.push({ slide: ctx.report.slides + 1, title: plain(titleRuns) });

    let y = TOP;
    blocks.forEach(function (b) {
      b.draw(slide, y, s);
      y += b.height(s) + GAP;
    });

    const notes = section.querySelector('aside.notes');
    if (notes) {
      slide.addNotes(notes.textContent.replace(/[ \t]+/g, ' ').replace(/\n\s*/g, '\n').trim());
      ctx.report.notes++;
    }
    addSlideNumber(slide, ctx.c.textMuted);
  }

  // ---------- 對外介面 ----------
  // info：{ problem, variantLabel, parts, colors, texToText, difficultyInfo }
  function build(PptxGenJS, doc, info) {
    const pptx = new PptxGenJS();
    pptx.layout = 'LAYOUT_WIDE';
    pptx.author = 'Algo Slides';
    pptx.title = info.problem.platform + ' ' + info.problem.number + ' ' + info.problem.title + '（' + info.variantLabel + '）';

    const c = {};
    Object.keys(info.colors).forEach(function (k) { c[k] = hex(info.colors[k]); });
    const ctx = {
      c: c,
      shapes: pptx.ShapeType,
      texToText: info.texToText,
      difficultyInfo: info.difficultyInfo,
      problem: info.problem,
      variantLabel: info.variantLabel,
      report: { slides: 0, notes: 0, scaled: [], overflow: [] }
    };

    titleSlide(pptx, ctx);
    ctx.report.slides++;

    const keys = info.parts.map(function (p) { return p.key; });
    const sections = Array.from(doc.querySelectorAll('.reveal .slides > section[data-part]')).filter(function (sec) {
      return keys.indexOf(sec.dataset.part) !== -1 && !sec.classList.contains('divider-slide');
    });
    let prev = null;
    sections.forEach(function (sec) {
      const idx = keys.indexOf(sec.dataset.part);
      if (sec.dataset.part !== prev) {
        dividerSlide(pptx, ctx, idx, info.parts[idx].label);
        ctx.report.slides++;
        prev = sec.dataset.part;
      }
      contentSlide(pptx, sec, ctx, idx, info.parts[idx].label);
      ctx.report.slides++;
    });

    endSlide(pptx, ctx);
    ctx.report.slides++;

    pptx.algoSlidesReport = ctx.report;
    return pptx;
  }

  root.AlgoSlidesPptx = { build: build };
})(typeof window !== 'undefined' ? window : globalThis);
