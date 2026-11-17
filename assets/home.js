/*
 * Algo Slides 首頁程式
 * 讀取 problems.js 的 window.PROBLEMS，產生題目卡片，並提供搜尋與平台篩選。
 * 新增題目時不需要修改這個檔案（見 CLAUDE.md 第 3 節）。
 */
(function () {
  'use strict';

  // 新加入的題目排在前面
  const problems = (window.PROBLEMS || []).slice().sort(function (a, b) {
    return String(b.added || '').localeCompare(String(a.added || ''));
  });

  const grid = document.getElementById('problem-grid');
  const search = document.getElementById('search');
  const count = document.getElementById('count');
  const empty = document.getElementById('empty');
  const filterButtons = Array.from(document.querySelectorAll('[data-platform]'));
  let platform = 'all';

  function el(tag, cls, text) {
    const node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  // 與 deck.js 相同的規則：LeetCode 顯示 Easy / Medium / Hard，Codeforces 顯示 rating
  function difficultyInfo(problem) {
    const d = String(problem.difficulty || '');
    if (/^\d+$/.test(d)) return { text: 'Rating ' + d, cls: 'rating' };
    return { text: d, cls: d.toLowerCase() };
  }

  function card(problem) {
    const li = el('li', 'problem-card');
    const link = el('a');
    link.href = 'problems/' + problem.id + '.html';

    const meta = el('div', 'card-meta');
    const info = difficultyInfo(problem);
    meta.appendChild(el('span', 'badge ' + info.cls, info.text));
    (problem.tags || []).forEach(function (t) { meta.appendChild(el('span', 'tag', t)); });

    link.append(
      el('p', 'eyebrow', problem.platform + ' · ' + problem.number),
      el('h2', '', problem.title),
      meta,
      el('p', 'card-foot', problem.language + ' · ' + problem.added)
    );
    li.appendChild(link);
    return li;
  }

  function matches(problem, query) {
    if (platform !== 'all' && problem.platform !== platform) return false;
    if (!query) return true;
    const haystack = [problem.title, problem.number, problem.platform]
      .concat(problem.tags || [])
      .join(' ')
      .toLowerCase();
    return haystack.indexOf(query) !== -1;
  }

  function render() {
    const query = search.value.trim().toLowerCase();
    const list = problems.filter(function (p) { return matches(p, query); });

    grid.replaceChildren.apply(grid, list.map(card));

    count.textContent = list.length === problems.length
      ? '共 ' + problems.length + ' 題'
      : '顯示 ' + list.length + ' 題（全部 ' + problems.length + ' 題）';

    empty.hidden = list.length > 0;
    empty.textContent = problems.length === 0
      ? '還沒有任何題目。請依照 CLAUDE.md 第 8 節新增第一題。'
      : '沒有符合條件的題目。';
  }

  filterButtons.forEach(function (btn) {
    btn.addEventListener('click', function () {
      platform = btn.dataset.platform;
      filterButtons.forEach(function (b) { b.setAttribute('aria-pressed', String(b === btn)); });
      render();
    });
  });
  search.addEventListener('input', render);

  render();
})();
