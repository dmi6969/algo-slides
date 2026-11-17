# Algo Slides

LeetCode 與 Codeforces 的演算法題解簡報網站。每道題目一份網頁簡報，固定包含五個段落：

1. Problem overview
2. Sample I/O
3. Idea
4. Coding
5. Complexity

- 網站：https://dmi6969.github.io/algo-slides/
- GitHub：https://github.com/dmi6969/algo-slides
- 專案規則：[CLAUDE.md](CLAUDE.md)

## 本機預覽

直接用瀏覽器開啟 `index.html`，不需要安裝任何套件或啟動伺服器。

## 新增一道題目

LeetCode 題目只要貼網址。在 Claude Code 中輸入：

```
新增這題：https://leetcode.com/problems/two-sum/
```

Codeforces 的題目頁面不開放程式讀取，所以除了網址，還要貼上題目內容：

```
新增這題：https://codeforces.com/problemset/problem/4/A
題目內容：
{貼上題目敘述、範例與限制}
```

AI 會依 CLAUDE.md 第 8 節的流程，先用 `tools/fetch-problem.js` 讀取題目資料，驗證程式碼後建立 `problems/{id}.html`，並在 `problems.js` 新增一筆資料，首頁就會自動出現新題目。讀題工具需要 Node.js 18 以上。

## 簡報操作

| 按鍵 | 功能 |
|---|---|
| ← → / 空白鍵 | 翻頁 |
| `F` | 全螢幕 |
| `S` | 開啟講者備註視窗 |
| `Esc` | 投影片總覽 |

## 技術

reveal.js 5.1.0、KaTeX 0.16.9，皆由 CDN 載入；純靜態網站，部署在 GitHub Pages。
