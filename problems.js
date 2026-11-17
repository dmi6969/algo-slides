/*
 * 題目資料：整個網站唯一的資料來源（CLAUDE.md 第 5 節）
 * - 首頁 index.html 用它產生題目卡片
 * - 每份簡報的標題頁用它自動填入題名、平台、題號、難度、標籤與原題連結
 *
 * 新題目加在陣列最後面，格式如下：
 *
 * {
 *   id: "leetcode-0001-two-sum",
 *   platform: "LeetCode",
 *   number: "1",
 *   title: "Two Sum",
 *   url: "https://leetcode.com/problems/two-sum/",
 *   difficulty: "Easy",
 *   tags: ["Array", "Hash Table"],
 *   language: "C++",
 *   added: "2026-11-15"
 * },
 */
window.PROBLEMS = [
  {
    id: "leetcode-0001-two-sum",
    platform: "LeetCode",
    number: "1",
    title: "Two Sum",
    url: "https://leetcode.com/problems/two-sum/",
    difficulty: "Easy",
    tags: ["Array", "Hash Table"],
    language: "C++",
    added: "2026-11-15"
  },
  {
    id: "leetcode-0020-valid-parentheses",
    platform: "LeetCode",
    number: "20",
    title: "Valid Parentheses",
    url: "https://leetcode.com/problems/valid-parentheses/",
    difficulty: "Easy",
    tags: ["String", "Stack", "Bracket Sequences"],
    language: "C++",
    added: "2026-11-15"
  },
  {
    id: "leetcode-0053-maximum-subarray",
    platform: "LeetCode",
    number: "53",
    title: "Maximum Subarray",
    url: "https://leetcode.com/problems/maximum-subarray/",
    difficulty: "Medium",
    tags: ["Array", "Divide and Conquer", "Dynamic Programming"],
    language: "C++",
    added: "2026-11-15"
  },
  {
    id: "leetcode-0003-longest-substring-without-repeating-characters",
    platform: "LeetCode",
    number: "3",
    title: "Longest Substring Without Repeating Characters",
    url: "https://leetcode.com/problems/longest-substring-without-repeating-characters/",
    difficulty: "Medium",
    tags: ["Hash Table", "String", "Sliding Window"],
    language: "C++",
    added: "2026-11-15"
  },
];
