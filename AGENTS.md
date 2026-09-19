# Tampermonkey Script 專案規範與代理指引 (AGENTS.md)

本文件定義此代碼庫之專案架構、開發原則、代碼規範與安全守則。所有在此專案工作的代理與開發者均須嚴格遵守本規範。

---

## 1. 專案概觀 (Project Overview)

本專案為一套專注於網頁體驗優化、自動化輔助與內容過濾的 **Tampermonkey / Greasemonkey UserScript（使用者腳本）** 集合。
腳本涵蓋各大影音與社群平台（Bilibili、YouTube、HoYoLAB 等）的專屬操作輔助，以及跨網站的通用功能（網址去追蹤淨化、影片過濾屏蔽、複製限制解除、自動翻頁、繁簡動態轉換等）。

---

## 2. 核心工程原則 (Karpathy Guidelines)

1. **動手前先思考 (Think Before Coding)**：修改或新增腳本前，明確分析目標網頁 DOM 結構、非同步行為與潛在副作用。需求若有不明確之處主動釐清，不盲目臆測。
2. **簡潔至上 (Simplicity First)**：嚴格實踐 YAGNI 原則。僅編寫達成目標所需之最精簡代碼，避免不必要的抽象封裝、重型工具庫或推測性功能。
3. **精準修改 (Surgical Changes)**：嚴格將改動範圍限制在目標功能或缺陷修復，嚴禁未經指示主動重構、排版無關檔案或順道改動非目標代碼。
4. **目標導向執行 (Goal-Driven Execution)**：每項變更均須具備明確的驗證邏輯與預期行為，確保腳本在宿主網頁能穩定運作且不引發異常。

---

## 3. UserScript 架構與編寫規範 (Coding Standards)

### 3.1 元資料標頭 (UserScript Metadata Block)
所有 `.user.js` 腳本檔案頂部必須具備完整的 UserScript 元資料聲明：
- 必須包含標準邊界：`// ==UserScript==` 與 `// ==/UserScript==`。
- 必要欄位：
  - `@name`：腳本名稱，格式遵循 `<分類/平台>-<主要功能>[-<快捷鍵>]`（如 `Bilibili-一鍵三連-Shift-F8`、`Universal-網址去追蹤與重定向淨化器`）。
  - `@namespace`：腳本命名空間（如 `https://github.com/` 或專案連結）。
  - `@version`：版本號（遵守語意化版本 SemVer，如 `1.0`、`1.1`）。
  - `@description`：簡明扼要說明腳本功能與觸發方式。
  - `@author`：作者標示。
  - `@match` / `@include`：明確限制生效網址模式，盡量收窄範圍（如 `https://www.bilibili.com/video/*`）；僅跨網站通用腳本才使用 `*://*/*`。
  - `@run-at`：精確指定執行時機（如 `document-start`、`document-end` 或 `document-idle`）。
  - `@grant`：最小權限原則。若無需 GM API 則明確標註 `@grant none`；若需要，僅宣告必要 API（如 `@grant GM_xmlhttpRequest`、`@grant GM_setValue`、`@grant GM_getValue`、`@grant GM_registerMenuCommand`）。
  - `@connect`：若使用 `GM_xmlhttpRequest` 跨域請求，必須宣告授權之目標域名。

### 3.2 封裝與作用域防護
- **IIFE 立即調用函數表達式**：所有腳本代碼必須封裝於 `(function() { 'use strict'; ... })();` 中，嚴格禁止向宿主網頁全域作用域洩漏變數或污染 `window`。
- **嚴格模式**：IIFE 第一行一律宣告 `'use strict';`。

### 3.3 DOM 監控與非同步載入處理
現代網頁（如 Bilibili、YouTube）多為 SPA 單頁應用，內容透過非同步請求與動態渲染生成：
- **重試與終止機制**：透過 `setInterval` 尋找動態元素時，必須設置重試上限（如 `let retry = 0; if (++retry > 30) clearInterval(timer);`），嚴禁無窮輪詢。
- **動態變更監聽**：如需監控長列表或動態流，優先使用 `MutationObserver`，並在必要時加入防抖（debounce）或節流（throttle）處理。
- **資源清理與防洩漏**：定時器在達成目的或超時後必須立即清理（`clearInterval` / `clearTimeout`）；Observer 在不需要時應及時調用 `disconnect()`。
- **SPA 路由監聽**：針對不刷新頁面跳轉的 SPA，應監聽 `popstate`、`hashchange` 或 URL 變更，以確保腳本在路由切換後正確重置或重新掛載。

### 3.4 使用者介面與快捷鍵
- **樣式隔離**：動態注入的 UI 元件（按鈕、彈窗、提示面板）必須使用內聯樣式（inline style）或具備高專屬性前綴之 CSS 類別，避免被宿主網頁樣式覆蓋或破壞宿主版面。
- **快捷鍵設計**：快捷鍵監聽優先採用組合鍵（如 `Shift + F8`、`Shift + F9`），避免與瀏覽器通用快捷鍵或宿主網頁原生操作衝突。
- **日誌與除錯**：`console.log` / `console.warn` / `console.error` 一律加上腳本名稱前綴（例如 `console.log("[VideoBlock] ...")`），便於在開發者工具中過濾除錯。

---

## 4. 檔案命名與目錄結構 (File Conventions)

- **腳本命名格式**：
  - 平台專用：`<platform>-<feature>[-<hotkey>].user.js`（例如 `bilibili-assistant.user.js`、`youtube-batch-add-to-playlist-shift-f8.user.js`）
  - 通用腳本：`universal-<feature>[-<hotkey>].user.js`（例如 `universal-url-cleaner.user.js`、`universal-video-block.user.js`）
- **引用路徑標準**：
  - 專案內部所有配置、文檔、規則與程式碼註解中之檔案引用與路徑標註，**一律使用跨平台相對路徑（以 POSIX 正斜線 `/` 表示）**，嚴格禁止寫入特定本機或作業系統絕對路徑。

---

## 5. 安全與合規守則 (Security & Safety)

1. **敏感資訊防護**：嚴格禁止在任何腳本中寫入或讀取 Token、Cookie、密鑰或認證資訊，嚴禁透過非授權外部伺服器外洩使用者隱私或瀏覽紀錄。
2. **最小特權 (Principle of Least Privilege)**：GM API 僅宣告實際使用的項目，絕不濫用 `@grant unsafeWindow`。
3. **注入安全**：動態建立 DOM 內容時，避免直接使用未過濾的 `innerHTML` 拼接外部數據，防範 XSS（跨站腳本攻擊）。
