# CLAUDE.md

這份文件寫給在這個專案中工作的 AI（例如 Claude Code）。開始任何修改之前，請先讀完這份文件。如果使用者的要求和這份文件衝突，以使用者的要求為準，並主動詢問是否要同步更新這份文件。

## 1. 專案目的

Algo Slides 是一個「演算法題解簡報網站」。使用者提供一道 LeetCode 或 Codeforces 題目，AI 依照本文件的規則產生一份網頁簡報，介紹這道題的題意、範例、解題想法、程式碼與複雜度。

目標：

- 每一份簡報的結構、風格、檔名都一致，任何一道新題目都能用同一套流程完成。
- 簡報可以直接拿來上台報告（全螢幕、鍵盤翻頁、講者備註）。
- 網站是純靜態檔案，部署在 GitHub Pages。

## 2. 技術架構

| 項目 | 選擇 | 說明 |
|---|---|---|
| 簡報框架 | reveal.js 5.1.0 | 從 jsDelivr CDN 載入，主題用 white 再由 `style.css` 覆寫 |
| 程式碼上色 | reveal.js highlight plugin | 配色用 highlight.js 11.9.0 的 github-dark，從 cdnjs 載入 |
| 講者備註 | reveal.js notes plugin | 簡報中按 `S` 開啟 |
| 數學公式 | KaTeX 0.16.9（含 auto-render） | 從 jsDelivr CDN 載入；載入失敗時 `deck.js` 會把公式轉成純文字，觀眾仍然看得懂 |
| 字型 | Inter、Noto Sans TC、JetBrains Mono | Google Fonts；英文用 Inter，中文用 Noto Sans TC，程式碼用 JetBrains Mono |
| 建置工具 | 無 | 不使用 npm 或 bundler，直接編輯 HTML、CSS、JS |
| 讀題工具 | Node.js 18 以上（`tools/fetch-problem.js`） | 只在新增題目時由 AI 執行；網站本身不需要 Node.js |

- 不要新增其他第三方套件。真的需要時，先問使用者，並把套件加進這張表。
- CDN 網址必須寫死版本號（例如 `reveal.js@5.1.0`），不可以用 `latest` 或省略版本。
- 本機預覽：直接用瀏覽器開啟 `index.html`。題目資料用 `<script>` 載入，不需要啟動本機伺服器。

## 3. 檔案結構

```
algo-slides/
├── CLAUDE.md                  專案規則（本文件）
├── README.md                  給人看的專案介紹
├── index.html                 首頁：題目列表
├── problems.js                所有題目的資料（唯一的資料來源）
├── assets/
│   ├── style.css              全站共用樣式與設計變數（首頁＋簡報）
│   ├── deck.js                簡報共用程式：填入標題頁、插入段落分隔頁與結尾頁、排版公式、段落導覽、結構檢查、初始化 reveal.js
│   └── home.js                首頁程式：讀取 problems.js、搜尋與篩選
├── templates/
│   └── deck-template.html     新簡報的範本（不要直接當成題目頁使用）
├── problems/                  每道題一個 HTML 簡報
│   └── {id}.html
├── tools/
│   └── fetch-problem.js       讀題工具：輸入題目網址，輸出 id、problems.js 資料與題目內容
├── scratch/                   讀題結果與驗證程式碼的暫存資料夾（列在 .gitignore，不會上傳）
├── .gitignore
└── .nojekyll                  讓 GitHub Pages 直接提供原始檔案，不經過 Jekyll 處理
```

新增題目時各檔案能不能動：

| 檔案 | 新增題目時 | 說明 |
|---|---|---|
| `problems/{id}.html` | 新增 | 從範本複製後填寫 |
| `problems.js` | 只新增一筆 | 不要改動其他題目的資料 |
| `assets/*`、`index.html`、`templates/*`、`tools/*` | 不修改 | 只有使用者明確要求調整網站或工具時才能改 |
| `CLAUDE.md` | 不修改 | 只有使用者要求，或規則需要更新時（見第 11 節）才改 |

## 4. 命名規則

題目 id 同時也是檔名（不含 `.html`），格式為：

```
{platform}-{number}-{slug}
```

- `platform`：全小寫，`leetcode` 或 `codeforces`。
- `number`：
  - LeetCode：題號補零到 4 位，例如 `0001`、`0146`、`2385`。
  - Codeforces：比賽編號加題目字母，全小寫，例如 `4a`、`1850c`。
- `slug`：英文原題名轉成 kebab-case，只能使用小寫英文、數字和 `-`，例如 `two-sum`、`lru-cache`、`watermelon`。

範例：`leetcode-0001-two-sum`、`codeforces-4a-watermelon`。

- `tools/fetch-problem.js` 會依這個規則自動產生 id，直接使用它的輸出即可；只有工具無法使用時才自己套用規則。
- id 建立後就不要再改，因為網址會跟著改變。
- `TEMPLATE` 是保留給範本的特殊 id，題目不能使用。
- 要支援其他平台（例如 AtCoder）時，沿用同一格式，但要先依第 11 節更新本文件。

## 5. 題目資料：problems.js

`problems.js` 是題目資訊的唯一來源。首頁的題目卡片由 `assets/home.js` 產生，每份簡報的標題頁由 `assets/deck.js` 自動填入，兩者都讀這個檔案。因此題名、難度、標籤只寫在這裡，不要在簡報 HTML 裡重複寫。

每一筆資料的格式：

```js
{
  id: "leetcode-0001-two-sum",          // 與檔名相同（第 4 節）
  platform: "LeetCode",                 // "LeetCode" 或 "Codeforces"
  number: "1",                          // 平台上顯示的題號，不補零，例如 "1"、"4A"
  title: "Two Sum",                     // 平台上的英文原題名
  url: "https://leetcode.com/problems/two-sum/",
  difficulty: "Easy",                   // LeetCode："Easy" | "Medium" | "Hard"；Codeforces：rating 數字字串，例如 "800"，沒有 rating 時填 "Unrated"
  tags: ["Array", "Hash Table"],        // 平台上的英文標籤名稱，最多 4 個
  language: "C++",                      // Coding 段落使用的語言
  added: "2026-11-15"                   // 新增日期，格式 YYYY-MM-DD
},
```

- 新的一筆加在陣列最後面。
- 字串一律使用雙引號，每一筆結尾都加逗號。

## 6. 簡報結構

### 6.1 固定順序

每份簡報由一張標題頁和 5 個段落組成，順序固定，不能更改：

| 順序 | `data-part` | 段落 | 頁數 |
|---|---|---|---|
| 0 | `title` | 標題頁（自動產生） | 1 |
| 1 | `overview` | Problem overview | 1–2 |
| 2 | `sample` | Sample I/O | 1–2 |
| 3 | `idea` | Idea | 1–3 |
| 4 | `coding` | Coding | 1–3 |
| 5 | `complexity` | Complexity | 1 |

- 不使用流程圖（Algorithm Flow 段落已移除）。演算法的步驟寫在 Idea 段落，需要時用 `ol.steps` 條列。

- 每一頁是 `.slides` 底下的一個 `<section data-part="...">`。同一個段落需要多頁時，就連續放多個 `data-part` 相同的 `<section>`。
- 不要使用巢狀 `<section>`（reveal.js 的垂直投影片）。
- 每個段落開頭的深藍色分隔頁（例如「02 Sample I/O」）、最後的「THE END」頁，以及左下角的段落導覽列，都由 `deck.js` 自動產生，不要手寫。上表的頁數不包含這些自動產生的頁面。
- 如果段落缺漏、順序錯誤，或 `problems.js` 找不到這一題，`deck.js` 會在頁面頂端顯示紅色警告。看到警告就代表這份簡報不符合規則。

### 6.2 各段落必須包含的內容

**標題頁 `title`**

- 直接沿用範本，不要修改。題名、平台、題號、難度、標籤、原題連結都由 `deck.js` 依 `problems.js` 自動填入。

**Problem overview `overview`**

- `<h2>` 用一句話摘要這題要做什麼。
- 用自己的話重述題意，2–4 個重點，不要整段複製原題。
- 寫出輸入和輸出各是什麼。
- 在 `<p class="label">限制</p>` 底下用公式條列資料範圍，例如 `$1 \le n \le 10^5$`。
- 接著在 `.callout` 說明這個範圍代表需要多快的演算法，例如「`$n \le 10^5$` 時 `$O(n^2)$` 會超時，需要 `$O(n \log n)$` 以下」。

**Sample I/O `sample`**

- 至少一組範例，用 `.io-grid` 左右並排 Input 與 Output，內容必須和原題完全相同。
- 用 `table.trace` 逐步說明答案是怎麼算出來的。欄位依題目設計，例如「步驟、目前元素、資料結構狀態、說明」；最後一列加上 `class="is-answer"`，結果要和範例輸出一致。
- 逐步說明頁的 `<h2>` 下方、表格上方，一定要放 `.trace-input`，顯示這頁正在說明的範例 Input 與 Output，讓觀眾不用翻回前一頁找。內容和原題相同。
- 原題範例太長時，挑最能說明想法的一組，或自己設計一組小範例，並在標題註明「自製範例」。

**Idea `idea`**

- 一定要包含三個部分：暴力解、關鍵觀察、最佳解。
- 暴力解與最佳解用 `.compare` 左右對照，各自寫出做法與複雜度；最佳解的卡片加上 `is-best`。
- 關鍵觀察放在 `.callout`，用一句話講出讓解法變快的想法；如果想法可以寫成式子，就把關鍵式子寫成獨立一行的公式（`$$...$$`）。
- 第二頁用 `table.trace` 拿一組範例走一次最佳解（例如每一步的變數值、資料結構內容），最後一列加上 `class="is-answer"`。這一頁同樣要在表格上方放 `.trace-input` 顯示範例。

**Coding `coding`**

- 預設語言是 C++，使用者另外指定時才換。
- LeetCode：只放 `class Solution`，和 LeetCode 的提交格式相同；函式名稱與參數要和讀題工具輸出的「LeetCode C++ 函式簽名」一致。
- Codeforces：放完整程式，包含 `main()` 與 fast I/O（`ios::sync_with_stdio(false); cin.tie(nullptr);`）。
- 程式碼必須能直接提交通過，而且能用 `g++ -std=c++14` 編譯。本機的 g++ 6.3 不支援 C++17 的 structured bindings 等語法，所以不要使用 C++17 以後的功能。
- 只在關鍵行加簡短的中文註解。
- 每頁最多 22 行；超過就拆成多頁，並在 `<h2>` 註明這頁是哪個部分。
- 用 `data-line-numbers` 依程式的邏輯分段高亮（例如初始化、主迴圈、輸出答案），例如 `data-line-numbers="1-4|5-9|10-12"`，並在講者備註說明每一段在做什麼。

**Complexity `complexity`**

- 使用 `table.complexity`，列出時間與空間複雜度，並在「原因」欄說明為什麼。
- 複雜度一律寫成公式，例如 `$O(n)$`、`$O(n \log n)$`、`$O(n^2)$`。
- 可以在表格下方用一行獨立公式說明總複雜度的來源，例如 `$$T(n) = \underbrace{n}_{\text{iterations}} \times \underbrace{O(1)}_{\text{lookup}} = O(n)$$`。

### 6.3 HTML 撰寫規則

- **程式碼區塊**：一律把程式碼包在 `<script type="text/template">` 裡，這樣程式碼中的 `<`、`>`、`&` 不需要跳脫：

  ```html
  <pre><code class="language-cpp" data-trim data-line-numbers="1-3|4-8"><script type="text/template">
  // 程式碼直接貼在這裡
  </script></code></pre>
  ```

- **範例輸入輸出**：放在 `.io-grid` 裡的 `<pre>`，或 `.trace-input` 裡的 `<code>`；內容中的 `<`、`>`、`&` 要寫成 `&lt;`、`&gt;`、`&amp;`。
- **講者備註**：每頁可以加 `<aside class="notes">講稿</aside>`，簡報時按 `S` 會在講者視窗顯示。
- **逐步顯示**：需要依序出現的內容加上 `class="fragment"`，每頁最多 3 個。
- 不要寫行內樣式（`style="..."`），也不要自訂顏色，只能使用第 7 節列出的 class。
- 所有路徑都使用相對路徑（例如 `../assets/style.css`），不要用 `/` 開頭，因為 GitHub Pages 的網址會在 `/{repo 名稱}/` 底下。

### 6.4 數學公式

公式由 KaTeX 排版，觀眾看到的是排版好的數學式。原則是**盡量用公式表達**：變數、資料範圍、等式、不等式、組合數、遞迴式、求和、複雜度等數學內容，都寫成公式，不要用純文字拼湊（例如寫 `$n^2$`，不寫 `n^2` 或 `n²`）。

| 寫法 | 用途 | 範例 |
|---|---|---|
| `$...$` | 行內公式 | `$1 \le n \le 10^5$` |
| `$$...$$` | 獨立一行、置中的公式 | `$$\text{need} = \text{target} - \text{nums}[i]$$` |

- 程式裡的名稱（變數、陣列）在公式中用 `\text{}` 包住，例如 `$\text{nums}[i]$`；在一般文字中用 `<code>`。單一字母的數學變數直接寫，例如 `$n$`、`$i$`。
- 小於、大於寫成 `\lt`、`\gt`（或 `\le`、`\ge`），不要直接寫 `<`、`>`，否則 HTML 會把它當成標籤的開頭。
- 公式裡不要放中文，因為 KaTeX 對中文的支援有限；說明文字寫在公式外面，或在 `\text{}` 中使用英文。
- **不會處理公式的地方**：程式碼、範例輸入輸出（`<pre>`）、講者備註、`<code>`。這些地方寫純文字，數學符號用 Unicode（例如 `≤`、`²`）。
- 公式語法錯誤時，畫面上會出現紅色的錯誤訊息，完成前必須確認沒有。

### 6.5 文字規則

- 使用繁體中文；演算法與資料結構術語保留英文，例如 hash map、two pointers、prefix sum、DP、BFS。中文譯名通用時，可以寫成「雜湊表（hash map）」。
- 每頁條列最多 5 點，每點盡量不超過 30 個字。簡報是給聽眾邊聽邊看的，不要放整段文章。
- 詳細的解釋寫在講者備註，不要全部塞在投影片上。

## 7. 視覺風格與元件

整體風格參考使用者提供的課堂簡報，屬於簡潔的學術風格：

- 中灰背景（`#888888`），內容從左上開始排，不垂直置中。大面積的底色不要用純白或很亮的顏色，以免畫面太刺眼。
- 中灰底上只有接近黑色的字夠清楚，所以文字一律用 `style.css` 裡的深色變數；難度徽章用「有色底配白字」。調整任何顏色後，都要確認文字和背景的對比度至少 4.5:1。
- 每頁標題是深藍色，下方有一條橫跨整頁的藍色底線。
- 每個段落前有深藍色分隔頁，最後一頁是「THE END」（由 `deck.js` 產生）。
- 重點用淺綠色框，補充說明用淺藍色框。
- 表格標題列是深藍底白字，內容列有斑馬紋。
- 程式碼區塊是深色底，使用 github-dark 配色。
- 字級以 1280×720 的投影片為準：內文 22px、每頁標題約 34px。不要為了塞進更多內容而縮小字級，內容太多就拆頁。

所有顏色和字型都定義在 `assets/style.css` 開頭 `:root` 的設計變數中，不要在其他地方寫色碼。

簡報中可以使用的元件：

| class | 用途 | 常用段落 |
|---|---|---|
| `.lead` | 大字的一句話重點 | overview、idea |
| `.label` | 藍色小標題，例如「限制」「STEP 1」 | 任何段落 |
| `.callout` | 淺綠色重點框（關鍵觀察、限制分析） | overview、idea |
| `.callout.info` | 淺藍色補充說明框 | 任何段落 |
| `.io-grid` | Input／Output 左右並排 | sample |
| `.trace-input` | 逐步說明頁最上方的範例橫條（`<span class="io-label">INPUT</span><code>…</code>`，Output 同樣寫法） | sample、idea |
| `table.trace`、`tr.is-answer` | 逐步追蹤表；最後一列標出答案 | sample |
| `.compare` + `.card`、`.card.is-best` | 兩欄對照；最佳解卡片加 `is-best` | idea |
| `ol.steps` | 編號步驟（演算法的做法） | idea |
| `table.complexity` | 複雜度表 | complexity |
| `.muted` | 次要文字 | 任何段落 |

需要新元件時，先在 `style.css` 新增，並更新這張表；不要在單一題目頁裡寫只用一次的樣式。

## 8. 新增一道題目的流程

使用者通常只會給一個題目網址。依序執行：

1. **讀取題目**：執行 `node tools/fetch-problem.js {題目網址}`。工具會輸出 id、`problems.js` 資料與題目內容，並存一份到 `scratch/{id}.md`。依結束碼處理：
   - `0`：讀取成功，以工具輸出的題目內容為準。（LeetCode 通常是這種情況）
   - `2`：id 與 `problems.js` 資料可以使用，但沒有題目敘述。Codeforces 的題目頁面不開放程式讀取，所以 Codeforces 一定是這種情況，LeetCode 付費題也會是。請使用者貼上題目敘述、範例與限制，收到之後再繼續。
   - `1`：網址不支援或讀取失敗。請使用者貼上題目內容，id 依第 4 節自己產生。
   - 不論哪一種情況，都不可以憑記憶補上題意或範例。不要嘗試用其他網址、鏡像站或偽裝瀏覽器的方式繞過網站的阻擋。
   - 使用者已經一起貼上題目內容時，以使用者貼的內容為準。
2. **確認 id**：使用工具輸出的 id，並確認 `problems/` 底下沒有同名檔案。
3. **寫解法並驗證**：依第 9 節，先在 `scratch/` 寫出程式碼，用所有範例測資跑過，確認輸出正確。
4. **建立簡報**：把 `templates/deck-template.html` 複製成 `problems/{id}.html`，將 `<body>` 的 `data-problem-id` 改成新的 id，再依第 6 節填寫 5 個段落。完成後刪除所有 `TODO` 和範本裡的說明註解。
5. **更新資料**：把工具輸出的 `problems.js` 資料加到陣列最後；工具無法使用時，依第 5 節自己寫。
6. **檢查**：逐項完成第 10 節的檢查清單。
7. **回報**：告訴使用者新增了哪些檔案、程式碼的驗證結果，以及有沒有不確定的地方。

## 9. 驗證程式碼

- 用 `g++ -std=c++14 -O2` 編譯，所有暫存檔都放在 `scratch/`。
- Codeforces：直接用範例輸入執行，比對輸出是否和範例輸出相同。
- LeetCode：在 `scratch/` 另外寫一個含 `main()` 的測試程式來呼叫 `Solution`，用範例資料測試。這個測試程式不放進簡報。
- 簡報上的程式碼必須和驗證過的程式碼完全一致。
- 使用者指定其他語言（例如 Python）時，用該語言的直譯器或編譯器驗證，並把 `problems.js` 的 `language` 改成對應的值。
- 無法編譯或執行時，要明確告訴使用者「程式碼尚未驗證」，不可以聲稱已經測試過。

## 10. 完成前檢查清單

- [ ] 檔名與 `data-problem-id` 都符合第 4 節，而且兩者相同。
- [ ] `problems.js` 已新增一筆，id 與檔名一致，欄位齊全。
- [ ] 5 個段落都有，順序正確；開啟頁面時沒有出現紅色警告。
- [ ] 檔案中搜尋不到 `TODO`。
- [ ] Sample I/O 的範例和原題相同，逐步說明的結果和範例輸出一致。
- [ ] 每一個 `table.trace` 的上方都有 `.trace-input`，而且顯示的範例和表格追蹤的是同一組。
- [ ] 程式碼已通過所有範例測資，或已向使用者說明尚未驗證。
- [ ] Complexity 的結論和 Idea 段落一致。
- [ ] 數學內容都已寫成公式；畫面上沒有紅色的 KaTeX 錯誤訊息，也沒有露出原始的 `$...$`。
- [ ] 所有路徑都是相對路徑，沒有 `/` 開頭的路徑。
- [ ] 沒有行內樣式或自訂顏色。
- [ ] 首頁出現新題目的卡片；點進去可以正常翻頁，公式和程式碼都正常顯示。

## 11. 修改與擴充規則

- **修改既有題目**：只改使用者指定的部分，不要順手改寫其他段落；id 與檔名保持不變。
- **調整網站外觀或功能**：只有使用者明確要求時，才修改 `assets/`、`index.html`、`templates/`，改完要確認既有的每一份簡報都還能正常顯示。
- **規則需要改變時**（例如新增平台、新增元件、改變段落的內容要求）：先更新本文件，再依照新規則修改頁面，讓規則和網頁保持一致。
- **發現規則沒寫清楚時**：如果使用者指出某份簡報不符合期待，而原因是規則模糊，要主動建議補進本文件的哪一節。

## 12. 使用者常用指令

| 使用者說 | AI 要做的事 |
|---|---|
| 「新增這題：{題目網址}」（Codeforces 再加上貼上的題目內容） | 執行第 8 節的流程 |
| 「把 {id} 的程式碼改成 Python」 | 只改 Coding 段落與 `problems.js` 的 `language`，並依第 9 節重新驗證 |
| 「檢查 {id} 是否符合 CLAUDE.md」 | 逐項執行第 10 節的檢查清單並回報結果 |
| 「新增一個元件」或「調整配色」 | 依第 11 節修改共用檔案，並更新第 7 節 |

## 13. 部署

- 推送到 GitHub 的 `main` 分支後，GitHub Pages（Settings → Pages → Deploy from a branch → `main` / `(root)`）會自動更新網站。
- 網址格式：`https://{GitHub 帳號}.github.io/{repo 名稱}/`。
- 只有在使用者要求時，才執行 `git commit` 或 `git push`。
