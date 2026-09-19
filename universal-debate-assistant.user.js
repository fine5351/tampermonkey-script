// ==UserScript==
// @name         Universal-全網AI筆戰吵架助手-Alt-B
// @namespace    https://github.com/
// @version      2.0
// @description  全網泛用型 AI 言詞交鋒助手（支援 Threads、Bilibili、YouTube 及全網任意網頁）。融合米哈遊辯論哲學，提供模組化平台適配器（Adapter）、全網劃詞一鍵反駁、邏輯漏洞解構與 3~4 句極致回擊，支援一鍵填入回覆。
// @author       Antigravity
// @match        *://*/*
// @run-at       document-end
// @grant        GM_xmlhttpRequest
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_registerMenuCommand
// @connect      generativelanguage.googleapis.com
// ==/UserScript==

(function () {
    'use strict';

    // --- 設定鍵名 ---
    const STORAGE_KEY_API_KEY = 'uda_gemini_api_key';
    const STORAGE_KEY_MODEL = 'uda_gemini_model';
    const STORAGE_KEY_MY_HANDLE = 'uda_my_handle';
    const STORAGE_KEY_CUSTOM_STANCE = 'uda_custom_stance';

    const DEFAULT_MODEL = 'gemini-2.5-flash';
    const DEFAULT_MY_HANDLE = 'fine1101105351';

    // --- 內建米哈遊言詞交鋒核心系統提示詞 (Mihoyo Debater Philosophy) ---
    const SYSTEM_PROMPT = `你是一位頂尖的社群言論交鋒專家與邏輯謬誤解構大師（精通米哈遊旗下遊戲底層機制與社群生態）。
你的任務是針對目標言論的邏輯漏洞進行無情拆解與致命打擊。

## 核心人設與原則（Strict Invariants）
1. 善良本質與禁止人身攻擊：所有回擊必須且只能針對「對方的言論邏輯漏洞、認知盲點與雙標行為」進行精準打擊。嚴格禁止針對家世、長相、智商或現實人格進行無關人身攻擊。
2. 字數極限控制（鐵律）：每個回擊選項嚴格控制在 3 到 4 句以內！刀刀見血、節奏短促、穿透力強，杜絕長篇大論與冗長說教。
3. 精湛修辭手法：偏好「正話反說 (Irony)」、「反問 (Rhetorical Question)」與「以彼之矛攻彼之盾」，以冷靜、高姿態的審查者角度戳破對方的自我感動、雙標與扣帽子行為。
4. 機制隱喻精確性：
   - 「大保底」：諷刺指望他人或系統無條件兜底、自身無能卻要保障、脆弱逃避的心態。
   - 「詞條歪了」：諷刺抓不到核心重點、邏輯跑偏、腦迴路清奇、產出大量無用廢話。
   - 「破韌/對策卡/機制」：諷刺無視基本規則、逆環境硬刮卻反過來怪遊戲或怪環境。
   - 「零命無專武/聖遺物湊合」：諷刺自己把弱點佔齊卻反咬外部環境的卸責行為。
5. 金錢反擊門禁（Critical）：只有在對方主動提及「流水、課金、花錢、商業表現、氪佬、炫耀」等金錢議題時，才允許啟用身份落差與經濟維度降維打擊（如質疑對方身份資格：「你操心氪佬能不能炫耀幹嘛？你大概也不是那個氪佬吧」）。對方未提金錢時，嚴禁主動使用金錢辱罵。
6. 嚴防代表大眾謬誤：自身嚴禁使用「大家都...」、「我們一般玩家...」等試圖代表群體的詞語，必須始終保持獨立審判者姿態。
7. 「三無」定性與高姿態勸退：在揭穿對方精神勝利後，可使用「沒錢、沒腦、沒手」排比大白話直拳，並以「勸你趁早別玩了」或「勸你別浪費時間了」高姿態宣判終結對話。
8. 語言：一律使用繁體中文（台灣）。

## 輸出結構規範（必須包含以下格式）
【對手邏輯漏洞剖析】
- 列出 1~2 點對手最致命的邏輯謬誤（如：稻草人謬誤、轉移焦點/偷換概念、代表大眾、自相矛盾、訴諸道德等）。

【回擊選項】
### 選項 A（反問 + 邏輯拆解：切入點簡述）
> 「（3~4 句極致精煉的致命回擊）」

### 選項 B（正話反說 / 以彼之矛攻彼之盾：切入點簡述）
> 「（3~4 句極致精煉的致命回擊）」

### 選項 C（高姿態審判 / 大白話直拳勸退：切入點簡述）
> 「（3~4 句極致精煉的致命回擊）」`;

    // ==========================================
    // 模組化平台適配器架構 (Platform Adapters)
    // 可輕易在此新增支援任何網站 (Bilibili, Threads, YouTube, X, etc.)
    // ==========================================
    const PLATFORM_ADAPTERS = [
        // 1. Threads 適配器
        {
            id: 'threads',
            name: 'Threads',
            matches: () => location.hostname.includes('threads.net') || location.hostname.includes('threads.com'),
            getPageContext: () => {
                return `當前頁面：Threads 串文 (${document.title})`;
            },
            scrapeContext: () => {
                const posts = [];
                const articles = document.querySelectorAll('div[data-pressable-container="true"], article, div[role="article"]');
                const seen = new Set();
                articles.forEach(art => {
                    const userLink = art.querySelector('a[href*="/@"]');
                    let handle = '參與者';
                    if (userLink) {
                        const href = userLink.getAttribute('href') || '';
                        const m = href.match(/@([a-zA-Z0-9._]+)/);
                        handle = m ? m[1] : userLink.textContent.trim().replace(/^@/, '');
                    }
                    const textContainers = art.querySelectorAll('div[dir="auto"], span[dir="auto"]');
                    const parts = [];
                    textContainers.forEach(tc => {
                        const t = tc.textContent.trim();
                        if (t.length > 1 && !t.match(/^(\d+[smhdwy]|讚|回覆|轉發|分享)$/) && !t.startsWith('http')) {
                            parts.push(t);
                        }
                    });
                    const content = parts.join('\n').trim();
                    if (content && !seen.has(content)) {
                        seen.add(content);
                        posts.push({ handle, content });
                    }
                });
                return posts;
            },
            injectButtons: (onSelectTarget) => {
                const articles = document.querySelectorAll('div[data-pressable-container="true"], article, div[role="article"]');
                articles.forEach(art => {
                    if (art.querySelector('.uda-inline-btn')) return;
                    const textContainers = art.querySelectorAll('div[dir="auto"], span[dir="auto"]');
                    let postText = '';
                    textContainers.forEach(tc => {
                        const t = tc.textContent.trim();
                        if (t.length > 1 && !t.match(/^(\d+[smhdwy]|讚|回覆|轉發|分享)$/) && !t.startsWith('http')) {
                            if (postText.length < 500) postText += (postText ? '\n' : '') + t;
                        }
                    });
                    if (!postText || postText.length < 3) return;

                    const mountPoint = art.querySelector('div[data-pressable-container="true"] > div, a[href*="/@"]');
                    if (mountPoint && mountPoint.parentElement) {
                        const btn = createActionBadge('⚔️ 反駁', () => onSelectTarget(postText));
                        mountPoint.parentElement.appendChild(btn);
                    }
                });
            },
            fillComposer: (text) => {
                const composer = document.querySelector('div[contenteditable="true"][role="textbox"], textarea[placeholder*="回覆"], textarea[placeholder*="Reply"]');
                if (composer) {
                    composer.focus();
                    if (composer.getAttribute('contenteditable') === 'true') {
                        document.execCommand('selectAll', false, null);
                        document.execCommand('insertText', false, text);
                    } else {
                        composer.value = text;
                        composer.dispatchEvent(new Event('input', { bubbles: true }));
                    }
                    return true;
                }
                // 嘗試觸發回覆按鈕
                const replyBtns = document.querySelectorAll('svg[aria-label*="回覆"], svg[aria-label*="Reply"]');
                for (const btn of replyBtns) {
                    btn.closest('div[role="button"]')?.click();
                    setTimeout(() => {
                        const late = document.querySelector('div[contenteditable="true"][role="textbox"]');
                        if (late) {
                            late.focus();
                            document.execCommand('insertText', false, text);
                        }
                    }, 400);
                    return true;
                }
                return false;
            }
        },

        // 2. Bilibili 適配器 (B站視頻、動態、評論區)
        {
            id: 'bilibili',
            name: 'Bilibili',
            matches: () => location.hostname.includes('bilibili.com'),
            getPageContext: () => {
                const title = document.querySelector('h1.video-title, .video-info-title, .opus-module-title')?.textContent?.trim() || document.title;
                const up = document.querySelector('.up-name, .username')?.textContent?.trim() || '';
                return `Bilibili 稿件：${title}${up ? ` (UP主: ${up})` : ''}`;
            },
            scrapeContext: () => {
                const posts = [];
                const seen = new Set();

                // 新版 / 舊版評論區選擇器
                const replyItems = document.querySelectorAll('.reply-item, .sub-reply-item, bili-comment-thread-renderer, bili-comment-renderer');
                replyItems.forEach(item => {
                    const userEl = item.querySelector('.user-name, .reply-user, bili-comment-user-info, .name');
                    const textEl = item.querySelector('.reply-content, .reply-content-container, bili-rich-text, .text-con, .text');
                    const handle = userEl?.textContent?.trim() || 'B站用戶';
                    const content = textEl?.textContent?.trim() || '';

                    if (content && content.length > 2 && !seen.has(content)) {
                        seen.add(content);
                        posts.push({ handle, content });
                    }
                });
                return posts;
            },
            injectButtons: (onSelectTarget) => {
                const replyItems = document.querySelectorAll('.reply-item, .sub-reply-item, bili-comment-renderer');
                replyItems.forEach(item => {
                    if (item.querySelector('.uda-inline-btn')) return;
                    const textEl = item.querySelector('.reply-content, .reply-content-container, bili-rich-text, .text-con, .text');
                    const content = textEl?.textContent?.trim();
                    if (!content || content.length < 2) return;

                    const infoBar = item.querySelector('.reply-info, .info-wrap, .action-box, bili-comment-action-buttons-renderer');
                    if (infoBar) {
                        const btn = createActionBadge('⚔️ 筆戰', () => onSelectTarget(content));
                        infoBar.appendChild(btn);
                    }
                });
            },
            fillComposer: (text) => {
                // 尋找 B 站評論發布框
                const composer = document.querySelector('textarea.reply-box-textarea, .ipt-txt, textarea[placeholder*="發一條友善的評論"], bili-comment-textarea textarea');
                if (composer) {
                    composer.focus();
                    composer.value = text;
                    composer.dispatchEvent(new Event('input', { bubbles: true }));
                    composer.dispatchEvent(new Event('change', { bubbles: true }));
                    return true;
                }
                return false;
            }
        },

        // 3. 通用備援適配器 (適用全網所有網頁，包含 YouTube, PTT, Dcard, 貼吧等)
        {
            id: 'generic',
            name: '全網通用',
            matches: () => true,
            getPageContext: () => {
                const h1 = document.querySelector('h1')?.textContent?.trim();
                return `網頁標題：${document.title}${h1 ? ` (${h1})` : ''}`;
            },
            scrapeContext: () => {
                // 抓取頁面中段落或主要討論文字
                const posts = [];
                const paragraphs = document.querySelectorAll('p, blockquote, [class*="comment"], [class*="reply"], [id*="comment"]');
                const seen = new Set();
                paragraphs.forEach(p => {
                    const text = p.textContent.trim();
                    if (text.length > 15 && text.length < 600 && !seen.has(text)) {
                        seen.add(text);
                        posts.push({ handle: '網頁內容', content: text });
                    }
                });
                return posts.slice(0, 15);
            },
            injectButtons: (onSelectTarget) => {
                // 通用適配器依靠全網劃詞浮動按鈕，不主動大面積破壞宿主版面
            },
            fillComposer: (text) => {
                // 探測當前 active 或常見的輸入框
                const active = document.activeElement;
                if (active && (active.tagName === 'TEXTAREA' || active.getAttribute('contenteditable') === 'true' || active.tagName === 'INPUT')) {
                    if (active.getAttribute('contenteditable') === 'true') {
                        document.execCommand('insertText', false, text);
                    } else {
                        active.value = text;
                        active.dispatchEvent(new Event('input', { bubbles: true }));
                    }
                    return true;
                }
                const anyComposer = document.querySelector('textarea:not([readonly]), div[contenteditable="true"]:not([readonly])');
                if (anyComposer) {
                    anyComposer.focus();
                    if (anyComposer.getAttribute('contenteditable') === 'true') {
                        document.execCommand('insertText', false, text);
                    } else {
                        anyComposer.value = text;
                        anyComposer.dispatchEvent(new Event('input', { bubbles: true }));
                    }
                    return true;
                }
                return false;
            }
        }
    ];

    // 取得當前匹配的最佳適配器
    function getActiveAdapter() {
        for (const ad of PLATFORM_ADAPTERS) {
            if (ad.matches()) return ad;
        }
        return PLATFORM_ADAPTERS[PLATFORM_ADAPTERS.length - 1];
    }

    // 小巧標籤按鈕構造器
    function createActionBadge(text, onClick) {
        const btn = document.createElement('button');
        btn.className = 'uda-inline-btn';
        btn.type = 'button';
        btn.innerHTML = text;
        btn.title = '帶入此發言至筆戰戰情室';
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            e.preventDefault();
            onClick();
        });
        return btn;
    }

    // --- 樣式注入 ---
    const style = document.createElement('style');
    style.textContent = `
        .uda-inline-btn {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            padding: 3px 8px;
            margin-left: 6px;
            font-size: 11px;
            font-weight: 600;
            color: #ff4757;
            background: rgba(255, 71, 87, 0.12);
            border: 1px solid rgba(255, 71, 87, 0.3);
            border-radius: 9999px;
            cursor: pointer;
            transition: all 0.2s ease;
            user-select: none;
            vertical-align: middle;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        }
        .uda-inline-btn:hover {
            background: rgba(255, 71, 87, 0.25);
            transform: scale(1.05);
            border-color: #ff4757;
            color: #ff2d42;
        }
        #uda-floating-ball {
            position: fixed;
            right: 20px;
            bottom: 84px;
            width: 46px;
            height: 46px;
            background: linear-gradient(135deg, #ff416c, #ff4b2b);
            border-radius: 50%;
            box-shadow: 0 6px 20px rgba(255, 65, 108, 0.4);
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            z-index: 2147483640;
            transition: all 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275);
            user-select: none;
        }
        #uda-floating-ball:hover {
            transform: scale(1.1) rotate(10deg);
        }
        #uda-selection-bubble {
            position: absolute;
            display: none;
            z-index: 2147483645;
            background: #1e1e24;
            color: #ffffff;
            border: 1px solid rgba(255, 75, 43, 0.5);
            border-radius: 20px;
            padding: 4px 12px;
            font-size: 12px;
            font-weight: 600;
            cursor: pointer;
            box-shadow: 0 6px 18px rgba(0,0,0,0.35);
            user-select: none;
            transition: transform 0.15s ease;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        }
        #uda-selection-bubble:hover {
            transform: scale(1.06);
            background: #ff4b2b;
        }
        #uda-sidebar-panel {
            position: fixed;
            top: 0;
            right: -480px;
            width: 450px;
            height: 100vh;
            background: #1a1a1f;
            color: #e4e6eb;
            box-shadow: -10px 0 35px rgba(0,0,0,0.55);
            z-index: 2147483646;
            transition: right 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            display: flex;
            flex-direction: column;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            border-left: 1px solid rgba(255,255,255,0.1);
            box-sizing: border-box;
        }
        #uda-sidebar-panel.uda-open {
            right: 0;
        }
        .uda-panel-header {
            padding: 16px 20px;
            border-bottom: 1px solid rgba(255,255,255,0.08);
            display: flex;
            justify-content: space-between;
            align-items: center;
            background: #24242c;
        }
        .uda-panel-title {
            font-size: 16px;
            font-weight: 700;
            display: flex;
            align-items: center;
            gap: 8px;
            color: #ffffff;
        }
        .uda-platform-badge {
            font-size: 11px;
            padding: 2px 7px;
            background: rgba(255, 75, 43, 0.2);
            color: #ff7675;
            border-radius: 4px;
            border: 1px solid rgba(255, 75, 43, 0.4);
            font-weight: 500;
        }
        .uda-close-btn {
            background: transparent;
            border: none;
            color: #a4b0be;
            font-size: 20px;
            cursor: pointer;
            padding: 4px 8px;
            border-radius: 6px;
        }
        .uda-close-btn:hover {
            background: rgba(255,255,255,0.1);
            color: #ffffff;
        }
        .uda-panel-body {
            padding: 16px 20px;
            overflow-y: auto;
            flex: 1;
            display: flex;
            flex-direction: column;
            gap: 14px;
        }
        .uda-form-group {
            display: flex;
            flex-direction: column;
            gap: 6px;
        }
        .uda-label {
            font-size: 12.5px;
            font-weight: 600;
            color: #b2bec3;
            display: flex;
            justify-content: space-between;
        }
        .uda-input, .uda-textarea {
            width: 100%;
            background: #24242c;
            border: 1px solid rgba(255,255,255,0.12);
            border-radius: 8px;
            color: #e4e6eb;
            padding: 8px 12px;
            font-size: 13px;
            box-sizing: border-box;
            outline: none;
            transition: border-color 0.2s;
            font-family: inherit;
        }
        .uda-input:focus, .uda-textarea:focus {
            border-color: #ff4b2b;
        }
        .uda-textarea {
            resize: vertical;
            min-height: 65px;
        }
        .uda-action-row {
            display: flex;
            gap: 8px;
        }
        .uda-btn-primary {
            flex: 1;
            background: linear-gradient(135deg, #ff416c, #ff4b2b);
            color: #ffffff;
            border: none;
            border-radius: 8px;
            padding: 10px;
            font-size: 14px;
            font-weight: 600;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 6px;
            transition: opacity 0.2s, transform 0.1s;
        }
        .uda-btn-primary:hover {
            opacity: 0.95;
            transform: translateY(-1px);
        }
        .uda-btn-secondary {
            background: rgba(255,255,255,0.07);
            color: #e4e6eb;
            border: 1px solid rgba(255,255,255,0.1);
            border-radius: 8px;
            padding: 8px 12px;
            font-size: 12px;
            font-weight: 500;
            cursor: pointer;
            transition: background 0.2s;
        }
        .uda-btn-secondary:hover {
            background: rgba(255,255,255,0.14);
        }
        .uda-result-card {
            background: #24242c;
            border: 1px solid rgba(255,255,255,0.1);
            border-radius: 10px;
            padding: 14px;
            display: flex;
            flex-direction: column;
            gap: 10px;
            animation: udaFadeIn 0.25s ease;
        }
        .uda-result-title {
            font-size: 13px;
            font-weight: 700;
            color: #ff7675;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        .uda-result-text {
            font-size: 13.5px;
            line-height: 1.55;
            color: #f1f2f6;
            white-space: pre-wrap;
            word-break: break-word;
            background: rgba(0,0,0,0.3);
            padding: 10px;
            border-radius: 6px;
            border-left: 3px solid #ff4b2b;
        }
        .uda-result-actions {
            display: flex;
            gap: 8px;
            justify-content: flex-end;
        }
        .uda-pill-btn {
            background: rgba(255,255,255,0.08);
            border: 1px solid rgba(255,255,255,0.12);
            color: #dfe4ea;
            border-radius: 6px;
            padding: 4px 10px;
            font-size: 12px;
            cursor: pointer;
            transition: all 0.2s;
        }
        .uda-pill-btn:hover {
            background: #ff4b2b;
            color: #ffffff;
            border-color: #ff4b2b;
        }
        .uda-collapsible-content {
            display: none;
            flex-direction: column;
            gap: 8px;
            padding-top: 6px;
        }
        .uda-collapsible-content.uda-show {
            display: flex;
        }
        .uda-toast {
            position: fixed;
            bottom: 24px;
            left: 50%;
            transform: translateX(-50%);
            background: rgba(20, 20, 26, 0.95);
            color: #ffffff;
            padding: 10px 20px;
            border-radius: 30px;
            font-size: 13px;
            box-shadow: 0 4px 20px rgba(0,0,0,0.5);
            border: 1px solid rgba(255,255,255,0.15);
            z-index: 2147483647;
            pointer-events: none;
            opacity: 0;
            transition: opacity 0.3s ease;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        }
        .uda-toast.uda-show {
            opacity: 1;
        }
        @keyframes udaFadeIn {
            from { opacity: 0; transform: translateY(5px); }
            to { opacity: 1; transform: translateY(0); }
        }
    `;
    document.head.appendChild(style);

    // --- Toast 提示 ---
    function showToast(msg) {
        let toast = document.getElementById('uda-toast');
        if (!toast) {
            toast = document.createElement('div');
            toast.id = 'uda-toast';
            toast.className = 'uda-toast';
            document.body.appendChild(toast);
        }
        toast.textContent = msg;
        toast.classList.add('uda-show');
        clearTimeout(toast._timer);
        toast._timer = setTimeout(() => {
            toast.classList.remove('uda-show');
        }, 2500);
    }

    // --- 呼叫 Google Gemini API ---
    function callGeminiAPI(apiKey, model, userStance, targetPost, threadContext, pageSummary, onSuccess, onError) {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
        const myHandle = GM_getValue(STORAGE_KEY_MY_HANDLE, DEFAULT_MY_HANDLE);

        let contextText = '';
        if (threadContext && threadContext.length > 0) {
            contextText = threadContext.map((p, idx) => `[樓層 ${idx + 1}] @${p.handle}: ${p.content}`).join('\n\n');
        } else {
            contextText = '（無更長串文脈絡）';
        }

        const promptText = `
【當前戰場背景】：
${pageSummary}

【我方帳號】：@${myHandle}
【我方核心立場與補充資訊】：
${userStance ? userStance : '展示客觀數值與實機機制是正常討論；反駁不了事實就只能訴諸群體道德、貼標籤與扣帽子。對方是在掩飾無能與邏輯破產。'}

【完整討論/串文脈絡】：
${contextText}

【本次主要反擊目標言論】：
${targetPost}

請依據系統人設規範進行攻擊：
1. 先剖析對手的邏輯漏洞（1~2 點）。
2. 提供 3 個切入點不同、符合 3~4 句字數限制、刀刀見血的精準回擊選項（選項 A、B、C）。
`;

        const requestBody = {
            contents: [{ role: 'user', parts: [{ text: promptText }] }],
            systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
            generationConfig: {
                temperature: 0.8,
                topK: 40,
                topP: 0.95,
                maxOutputTokens: 1200
            }
        };

        GM_xmlhttpRequest({
            method: 'POST',
            url: url,
            headers: { 'Content-Type': 'application/json' },
            data: JSON.stringify(requestBody),
            onload: function (response) {
                if (response.status >= 200 && response.status < 300) {
                    try {
                        const json = JSON.parse(response.responseText);
                        const candidates = json.candidates;
                        if (candidates && candidates.length > 0 && candidates[0].content && candidates[0].content.parts) {
                            const generatedText = candidates[0].content.parts.map(p => p.text).join('');
                            onSuccess(generatedText);
                        } else {
                            onError('Gemini API 未回傳有效候選內容：' + response.responseText);
                        }
                    } catch (e) {
                        onError('解析回應 JSON 失敗：' + e.message);
                    }
                } else {
                    onError(`API 請求失敗 (HTTP ${response.status})：${response.responseText}`);
                }
            },
            onerror: function () {
                onError('網路連線或 API 請求異常，請檢查網路狀態或 API Key。');
            }
        });
    }

    // --- 建立戰情室側邊面板 ---
    let sidebar = null;
    function createSidebar() {
        if (sidebar) return sidebar;

        const currentAdapter = getActiveAdapter();

        sidebar = document.createElement('div');
        sidebar.id = 'uda-sidebar-panel';
        sidebar.innerHTML = `
            <div class="uda-panel-header">
                <div class="uda-panel-title">
                    <span>⚔️</span>
                    <span>AI 筆戰戰情室</span>
                    <span class="uda-platform-badge" id="uda-platform-indicator">${currentAdapter.name}</span>
                </div>
                <button class="uda-close-btn" id="uda-close-btn" title="關閉 (Esc)">✕</button>
            </div>
            <div class="uda-panel-body">
                <!-- API 設定區塊 -->
                <div style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 8px; padding: 10px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; cursor: pointer;" id="uda-settings-toggle">
                        <span style="font-size: 12px; font-weight: 600; color: #ff7675;">⚙️ API 與身分設定</span>
                        <span style="font-size: 11px; color: #a4b0be;" id="uda-settings-arrow">▼</span>
                    </div>
                    <div class="uda-collapsible-content" id="uda-settings-content">
                        <div class="uda-form-group" style="margin-top: 6px;">
                            <label class="uda-label">Gemini API Key</label>
                            <input type="password" id="uda-api-key" class="uda-input" placeholder="AIzaSy..." />
                        </div>
                        <div class="uda-form-group">
                            <label class="uda-label">Gemini 模型名稱</label>
                            <input type="text" id="uda-model-name" class="uda-input" placeholder="gemini-2.5-flash" />
                        </div>
                        <div class="uda-form-group">
                            <label class="uda-label">我的帳號名稱 (Handle)</label>
                            <input type="text" id="uda-my-handle" class="uda-input" placeholder="fine1101105351" />
                        </div>
                        <div style="display: flex; justify-content: flex-end; margin-top: 4px;">
                            <button class="uda-btn-secondary" id="uda-save-settings">儲存設定</button>
                        </div>
                    </div>
                </div>

                <!-- 目標反擊言論 -->
                <div class="uda-form-group">
                    <div class="uda-label">
                        <span>🎯 主要反擊目標言論</span>
                        <span style="font-size: 11px; color: #ff6b6b; cursor: pointer;" id="uda-clear-target">清空</span>
                    </div>
                    <textarea id="uda-target-post" class="uda-textarea" rows="3" placeholder="反白網頁任意文字、點選留言旁「⚔️」，或在此手動貼上對方發言..."></textarea>
                </div>

                <!-- 我方立場說明 -->
                <div class="uda-form-group">
                    <div class="uda-label">
                        <span>🛡️ 我方立場與重點攻擊方向</span>
                    </div>
                    <textarea id="uda-user-stance" class="uda-textarea" rows="3" placeholder="輸入你想強調的事實、反擊切入點，或堅持的立場..."></textarea>
                </div>

                <!-- 操作按鈕列 -->
                <div class="uda-action-row">
                    <button class="uda-btn-secondary" id="uda-scrape-btn" title="抓取當前頁面評論或串文脈絡">📥 擷取脈絡 (<span id="uda-post-count">0</span>)</button>
                    <button class="uda-btn-primary" id="uda-generate-btn">🔥 生成致命回擊</button>
                </div>

                <!-- 戰術產出結果區 -->
                <div id="uda-output-container" style="display: flex; flex-direction: column; gap: 12px; margin-top: 8px;">
                    <!-- 動態插入生成結果 -->
                </div>
            </div>
        `;

        document.body.appendChild(sidebar);

        // 填入儲存的值
        const apiKeyInput = sidebar.querySelector('#uda-api-key');
        const modelInput = sidebar.querySelector('#uda-model-name');
        const handleInput = sidebar.querySelector('#uda-my-handle');
        const stanceInput = sidebar.querySelector('#uda-user-stance');

        apiKeyInput.value = GM_getValue(STORAGE_KEY_API_KEY, '');
        modelInput.value = GM_getValue(STORAGE_KEY_MODEL, DEFAULT_MODEL);
        handleInput.value = GM_getValue(STORAGE_KEY_MY_HANDLE, DEFAULT_MY_HANDLE);
        stanceInput.value = GM_getValue(STORAGE_KEY_CUSTOM_STANCE, '六命一精開自動過是客觀戰力與機制測試之一；反駁不了數據就只能訴諸群體道德批判，到底誰才是邏輯死角。');

        // 事件綁定
        sidebar.querySelector('#uda-close-btn').addEventListener('click', closeSidebar);

        // 設定摺疊
        const settingsToggle = sidebar.querySelector('#uda-settings-toggle');
        const settingsContent = sidebar.querySelector('#uda-settings-content');
        const settingsArrow = sidebar.querySelector('#uda-settings-arrow');
        settingsToggle.addEventListener('click', () => {
            const isShown = settingsContent.classList.toggle('uda-show');
            settingsArrow.textContent = isShown ? '▲' : '▼';
        });

        // 儲存設定
        sidebar.querySelector('#uda-save-settings').addEventListener('click', () => {
            GM_setValue(STORAGE_KEY_API_KEY, apiKeyInput.value.trim());
            GM_setValue(STORAGE_KEY_MODEL, modelInput.value.trim() || DEFAULT_MODEL);
            GM_setValue(STORAGE_KEY_MY_HANDLE, handleInput.value.trim() || DEFAULT_MY_HANDLE);
            showToast('✅ 設定已保存！');
        });

        // 清空目標
        sidebar.querySelector('#uda-clear-target').addEventListener('click', () => {
            sidebar.querySelector('#uda-target-post').value = '';
        });

        // 擷取脈絡按鈕
        sidebar.querySelector('#uda-scrape-btn').addEventListener('click', () => {
            const adapter = getActiveAdapter();
            const posts = adapter.scrapeContext();
            sidebar.querySelector('#uda-post-count').textContent = posts.length;
            showToast(`📥 [${adapter.name}] 已擷取 ${posts.length} 則討論脈絡`);
        });

        // 立場變更自動保存
        stanceInput.addEventListener('change', () => {
            GM_setValue(STORAGE_KEY_CUSTOM_STANCE, stanceInput.value);
        });

        // 生成按鈕
        sidebar.querySelector('#uda-generate-btn').addEventListener('click', handleGenerate);

        return sidebar;
    }

    function openSidebar(initialTargetText = '') {
        const sb = createSidebar();
        const adapter = getActiveAdapter();
        sb.querySelector('#uda-platform-indicator').textContent = adapter.name;

        sb.classList.add('uda-open');
        if (initialTargetText) {
            sb.querySelector('#uda-target-post').value = initialTargetText;
        }
        // 自動更新上下文數
        const posts = adapter.scrapeContext();
        sb.querySelector('#uda-post-count').textContent = posts.length;
    }

    function closeSidebar() {
        if (sidebar) {
            sidebar.classList.remove('uda-open');
        }
    }

    // --- 建立右下角全網懸浮球 ---
    function createFloatingBall() {
        if (document.getElementById('uda-floating-ball')) return;

        const ball = document.createElement('div');
        ball.id = 'uda-floating-ball';
        ball.title = '開啟 AI 筆戰戰情室 (Alt + B)';
        ball.innerHTML = '<span style="font-size: 21px;">⚔️</span>';

        ball.addEventListener('click', () => {
            if (sidebar && sidebar.classList.contains('uda-open')) {
                closeSidebar();
            } else {
                openSidebar();
            }
        });

        document.body.appendChild(ball);
    }

    // --- 全網劃詞快捷反駁徽章 (Universal Selection Bubble) ---
    let selectionBubble = null;
    function createSelectionBubble() {
        if (selectionBubble) return selectionBubble;
        selectionBubble = document.createElement('div');
        selectionBubble.id = 'uda-selection-bubble';
        selectionBubble.innerHTML = '⚔️ 筆戰反駁';
        document.body.appendChild(selectionBubble);

        selectionBubble.addEventListener('mousedown', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const selectedText = window.getSelection().toString().trim();
            if (selectedText) {
                openSidebar(selectedText);
            }
            selectionBubble.style.display = 'none';
        });

        // 監聽選取事件
        document.addEventListener('mouseup', (e) => {
            setTimeout(() => {
                const sel = window.getSelection();
                const text = sel ? sel.toString().trim() : '';

                // 如果點擊是在側邊欄內，忽略
                if (sidebar && sidebar.contains(e.target)) return;

                if (text && text.length >= 3) {
                    const range = sel.getRangeAt(0);
                    const rect = range.getBoundingClientRect();
                    selectionBubble.style.left = `${window.scrollX + rect.right + 8}px`;
                    selectionBubble.style.top = `${window.scrollY + rect.top - 28}px`;
                    selectionBubble.style.display = 'block';
                } else {
                    selectionBubble.style.display = 'none';
                }
            }, 10);
        });

        document.addEventListener('mousedown', (e) => {
            if (e.target !== selectionBubble) {
                selectionBubble.style.display = 'none';
            }
        });
    }

    // --- 處理生成 ---
    function handleGenerate() {
        const apiKey = GM_getValue(STORAGE_KEY_API_KEY, '').trim();
        if (!apiKey) {
            showToast('⚠️ 請先點開「⚙️ API 與身分設定」填寫 Gemini API Key！');
            sidebar.querySelector('#uda-settings-content').classList.add('uda-show');
            sidebar.querySelector('#uda-settings-arrow').textContent = '▲';
            return;
        }

        const model = GM_getValue(STORAGE_KEY_MODEL, DEFAULT_MODEL).trim();
        const targetPost = sidebar.querySelector('#uda-target-post').value.trim();
        const userStance = sidebar.querySelector('#uda-user-stance').value.trim();
        const outputContainer = sidebar.querySelector('#uda-output-container');

        if (!targetPost) {
            showToast('⚠️ 請先輸入或選取要反擊的目標言論！');
            return;
        }

        const adapter = getActiveAdapter();
        const threadContext = adapter.scrapeContext();
        const pageSummary = adapter.getPageContext();

        outputContainer.innerHTML = `
            <div style="text-align: center; padding: 24px; color: #ff7675; font-size: 13px;">
                <div style="font-size: 26px; margin-bottom: 8px; animation: spin 1s linear infinite;">⏳</div>
                正在以米哈遊言詞交鋒哲學拆解邏輯漏洞中...
            </div>
        `;

        callGeminiAPI(
            apiKey,
            model,
            userStance,
            targetPost,
            threadContext,
            pageSummary,
            (responseText) => {
                renderDebateResult(responseText);
            },
            (errorMsg) => {
                outputContainer.innerHTML = `
                    <div style="padding: 12px; background: rgba(255, 71, 87, 0.15); border: 1px solid #ff4757; border-radius: 8px; color: #ff6b81; font-size: 13px;">
                        ❌ 生成失敗：${errorMsg}
                    </div>
                `;
            }
        );
    }

    // --- 渲染生成結果 ---
    function renderDebateResult(markdownText) {
        const outputContainer = sidebar.querySelector('#uda-output-container');
        outputContainer.innerHTML = '';

        const sections = markdownText.split(/(?=###\s*選項|【回擊選項】|【對手邏輯漏洞剖析】)/g);
        let analysisBlock = '';
        const options = [];

        sections.forEach(sec => {
            const trimmed = sec.trim();
            if (trimmed.includes('【對手邏輯漏洞剖析】')) {
                analysisBlock = trimmed.replace('【對手邏輯漏洞剖析】', '').trim();
            } else if (trimmed.startsWith('### 選項') || trimmed.includes('選項 A') || trimmed.includes('選項 B') || trimmed.includes('選項 C')) {
                options.push(trimmed);
            }
        });

        // 1. 邏輯漏洞分析卡片
        if (analysisBlock) {
            const analysisCard = document.createElement('div');
            analysisCard.className = 'uda-result-card';
            analysisCard.innerHTML = `
                <div class="uda-result-title">
                    <span>🔍 對手邏輯漏洞剖析</span>
                </div>
                <div style="font-size: 13px; color: #ced6e0; line-height: 1.5; white-space: pre-wrap;">${escapeHTML(analysisBlock)}</div>
            `;
            outputContainer.appendChild(analysisCard);
        }

        // 2. 三大回擊卡片
        if (options.length > 0) {
            options.forEach((optText) => {
                const lines = optText.split('\n');
                const title = lines[0].replace(/^###\s*/, '').trim();
                const contentLines = lines.slice(1).join('\n').replace(/^>\s*/gm, '').trim();

                const card = document.createElement('div');
                card.className = 'uda-result-card';
                card.innerHTML = `
                    <div class="uda-result-title">
                        <span>${escapeHTML(title)}</span>
                    </div>
                    <div class="uda-result-text">${escapeHTML(contentLines)}</div>
                    <div class="uda-result-actions">
                        <button class="uda-pill-btn uda-copy-btn">📋 複製</button>
                        <button class="uda-pill-btn uda-fill-btn" style="background: rgba(255, 75, 43, 0.2); border-color: #ff4b2b; color: #ff7675;">🚀 填入回覆</button>
                    </div>
                `;

                // 複製
                card.querySelector('.uda-copy-btn').addEventListener('click', () => {
                    navigator.clipboard.writeText(contentLines);
                    showToast('📋 已複製回擊至剪貼簿！');
                });

                // 填入回覆 (調用適配器)
                card.querySelector('.uda-fill-btn').addEventListener('click', () => {
                    const adapter = getActiveAdapter();
                    const success = adapter.fillComposer(contentLines);
                    if (success) {
                        showToast(`✅ 已自動填入 ${adapter.name} 輸入框！`);
                    } else {
                        navigator.clipboard.writeText(contentLines);
                        showToast('📋 已複製至剪貼簿（未探測到輸入框，請手動貼上）');
                    }
                });

                outputContainer.appendChild(card);
            });
        } else {
            // 備援輸出
            const rawCard = document.createElement('div');
            rawCard.className = 'uda-result-card';
            rawCard.innerHTML = `
                <div class="uda-result-title"><span>戰術產出</span></div>
                <div class="uda-result-text">${escapeHTML(markdownText)}</div>
                <div class="uda-result-actions">
                    <button class="uda-pill-btn" id="uda-raw-copy">📋 複製全部</button>
                </div>
            `;
            rawCard.querySelector('#uda-raw-copy').addEventListener('click', () => {
                navigator.clipboard.writeText(markdownText);
                showToast('📋 已複製至剪貼簿！');
            });
            outputContainer.appendChild(rawCard);
        }
    }

    function escapeHTML(str) {
        return str
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    // --- 快捷鍵監聽 (Alt + B) ---
    window.addEventListener('keydown', (e) => {
        if (e.altKey && (e.key === 'b' || e.key === 'B')) {
            e.preventDefault();
            // 若當前有選取文字，直接帶入
            const sel = window.getSelection()?.toString().trim();
            if (sidebar && sidebar.classList.contains('uda-open')) {
                if (sel) {
                    sidebar.querySelector('#uda-target-post').value = sel;
                } else {
                    closeSidebar();
                }
            } else {
                openSidebar(sel || '');
            }
        }
        if (e.key === 'Escape' && sidebar && sidebar.classList.contains('uda-open')) {
            closeSidebar();
        }
    });

    // 右鍵選單命令
    if (typeof GM_registerMenuCommand !== 'undefined') {
        GM_registerMenuCommand('⚔️ 開啟 AI 筆戰戰情室 (Alt + B)', () => {
            const sel = window.getSelection()?.toString().trim();
            openSidebar(sel || '');
        });
    }

    // --- 初始化執行 ---
    createFloatingBall();
    createSelectionBubble();

    // 週期性調用當前適配器的按鈕注入邏輯
    function runAdapterInjection() {
        const adapter = getActiveAdapter();
        if (adapter && adapter.injectButtons) {
            adapter.injectButtons((targetText) => {
                openSidebar(targetText);
            });
        }
    }

    setInterval(runAdapterInjection, 1500);

    const observer = new MutationObserver(() => {
        runAdapterInjection();
    });
    observer.observe(document.body, { childList: true, subtree: true });

})();
