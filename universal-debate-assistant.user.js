// ==UserScript==
// @name         Universal-全網AI筆戰吵架助手-Alt-B
// @namespace    https://github.com/
// @version      2.7
// @description  全網泛用型 AI 言詞交鋒助手（支援 Threads、Bilibili、YouTube 及全網任意網頁）。專注直接清晰的冷嘲熱諷與邏輯解構、B站主樓/樓中樓垂直爬樓追溯、自動排除我方發言按鈕、深層穿透 Shadow DOM、Gemini 3.8-flash 旗艦驅動、4096 Tokens 防截斷、支援一鍵填入回覆。
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

    const DEFAULT_MODEL = 'gemini-3.8-flash';
    const FALLBACK_MODELS = ['gemini-3.8-flash', 'gemini-3.5-flash', 'gemini-3.0-flash', 'gemini-2.5-flash', 'gemini-2.0-flash'];
    const DEFAULT_MY_HANDLE = 'fine1101105351';

    // --- AI 筆戰交鋒系統提示詞 (犀利冷嘲熱諷與邏輯解構) ---
    const SYSTEM_PROMPT = `你是一位頂尖的社群辯論交鋒專家與邏輯解構大師。
你的專長是精準抓住對手言論中的邏輯破綻、自相矛盾與情緒破防，運用直接、清晰且極具殺傷力的冷嘲熱諷進行精確打擊。

## 核心人設與回擊原則（Strict Invariants）
1. 直接清晰的冷嘲熱諷：
   - 拋棄一切晦澀的比喻與特定領域/遊戲術語。
   - 用最純粹、銳利且通俗的大白話，直接拆穿對方的「邏輯破綻」、「雙重標準」、「惱羞成怒」、「道德綁架」與「試圖代表群體抱團取暖」。
2. 善良本質與邏輯打擊：所有火力必須且只能針對「對方的言論盲點、邏輯破綻與認知漏洞」。嚴格禁止針對家世、長相、智商或現實人格發動無關人身攻擊。
3. 嚴格字數限制（鐵律）：每個回擊選項嚴格控制在 3 到 4 句以內！節奏短促、一針見血、刀刀見肉，杜絕冗長說教與廢話。
4. 核心修辭武器：
   - 【反問直刺】：用連續銳利的反問，逼對方直視自身的荒謬與前後矛盾。
   - 【正話反說 (Irony)】：看似順著對方的荒謬邏輯推演，實則將其推向極致可笑的境地。
   - 【以彼之矛攻彼之盾】：直接拿對方自己講過的話或預設立場反打回去，讓對方自打嘴巴。
   - 【戳破偽裝】：直接撕破對方「假裝客觀講理，實則無能狂怒/嫉妒破防」的遮羞布。
5. 嚴防代表大眾：自身嚴禁使用「大家都...」、「我們一般人...」等試圖拉群體墊背的詞語，必須始終保持冷靜、高姿態的獨立審判者姿態。
6. 高姿態終結：在徹底拆穿對手無能扣帽子或精神勝利後，可用節奏明快的大白話俐落收尾（如「反駁不了事實就只能急著抓態度，除了跳腳你還剩下什麼？」、「勸你別自討沒趣了」）。
7. 語言：一律使用繁體中文（台灣）。

## 輸出結構規範（必須嚴格遵守以下格式）
【對手邏輯漏洞剖析】
- 列出 1~2 點對手最致命的邏輯謬誤（如：轉移焦點、稻草人打靶、雙重標準、代表大眾、自相矛盾等）。

【回擊選項】
### 選項 A（反問直擊・邏輯拆解：切入點簡述）
> 「（3~4 句極致精煉、直接清晰的致命反駁）」

### 選項 B（正話反說・降維嘲諷：切入點簡述）
> 「（3~4 句極致精煉、直接清晰的致命反駁）」

### 選項 C（直白戳破・高姿態審判：切入點簡述）
> 「（3~4 句極致精煉、直接清晰的致命反駁）」`;

    // ==========================================
    // 通用 Shadow DOM 穿透與邊界向上溯源器 (相容 Web Components 架構)
    // ==========================================
    function queryDeep(selector, root = document) {
        const results = [];
        const visited = new Set();

        function walk(node) {
            if (!node || visited.has(node)) return;
            visited.add(node);

            if (node.querySelectorAll) {
                try {
                    const matched = node.querySelectorAll(selector);
                    for (let i = 0; i < matched.length; i++) {
                        results.push(matched[i]);
                    }
                } catch (e) {}

                // 遞迴穿透所有子節點之 shadowRoot
                const all = node.querySelectorAll('*');
                for (let i = 0; i < all.length; i++) {
                    const el = all[i];
                    if (el.shadowRoot) {
                        walk(el.shadowRoot);
                    }
                }
            }
        }

        walk(root);
        return results;
    }

    function findComposedParent(el, selector) {
        let curr = el;
        while (curr) {
            if (curr.matches && curr.matches(selector)) return curr;
            if (curr.parentElement) {
                curr = curr.parentElement;
            } else if (curr.parentNode) {
                curr = curr.parentNode;
            } else if (curr.host) { // 穿透 shadowRoot 邊界回到宿主元件
                curr = curr.host;
            } else {
                break;
            }
        }
    }

    // 判斷某篇發言是否屬於「我」自己的發言（避免在自己的言論下出現反駁/筆戰按鈕）
    function isSelfPost(authorName, containerEl) {
        const configuredHandle = (GM_getValue(STORAGE_KEY_MY_HANDLE, DEFAULT_MY_HANDLE) || '').trim().toLowerCase();
        const author = (authorName || '').trim().toLowerCase();

        // 1. 與設定之「我的帳號名稱 (Handle)」比對
        if (configuredHandle && author) {
            const cleanAuthor = author.replace(/^@/, '');
            const cleanConfigured = configuredHandle.replace(/^@/, '');
            if (cleanAuthor === cleanConfigured || cleanAuthor.includes(cleanConfigured) || cleanConfigured.includes(cleanAuthor)) {
                return true;
            }
        }

        // 2. 元素特徵探測：在各大社群（特別是 B 站）中，只有自己發布的發言才有「刪除」操作按鈕
        if (containerEl) {
            const actionElements = queryDeep('button, a, span, div[role="button"], bili-comment-action-buttons-renderer', containerEl);
            for (let i = 0; i < actionElements.length; i++) {
                const el = actionElements[i];
                const text = (el.textContent || '').trim();
                // 排除「已删除」純狀態字樣
                if ((text === '删除' || text === '刪除' || text.toLowerCase() === 'delete') && !text.includes('已')) {
                    return true;
                }
                const label = (el.getAttribute('aria-label') || el.getAttribute('title') || '').toLowerCase();
                if ((label.includes('删除') || label.includes('刪除') || label.includes('delete')) && !label.includes('已')) {
                    return true;
                }
                const cls = (el.className || '').toString().toLowerCase();
                if (cls.includes('delete') || cls.includes('del-btn') || cls.includes('reply-delete')) {
                    return true;
                }
            }

            // 檢查 class 或屬性 (如 data-is-me)
            if (containerEl.classList) {
                const cls = containerEl.className.toString().toLowerCase();
                if (cls.includes('is-me') || cls.includes('my-comment') || cls.includes('my-reply')) {
                    return true;
                }
            }
            if (containerEl.hasAttribute && (containerEl.hasAttribute('is-me') || containerEl.hasAttribute('data-is-me'))) {
                return true;
            }
        }

        // 3. 平台原生當前登入者探測
        if (location.hostname.includes('bilibili.com')) {
            const myBiliAvatar = document.querySelector('.header-entry-avatar, .header-avatar-wrap, .bili-avatar, .mini-avatar');
            const myBiliName = (myBiliAvatar?.getAttribute('alt') || myBiliAvatar?.getAttribute('title') || '').trim().toLowerCase();
            if (myBiliName && author && (author === myBiliName || author.includes(myBiliName))) {
                return true;
            }
        }

        return false;
    }

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
                    const userLink = art.querySelector('a[href*="/@"]');
                    let handle = '';
                    if (userLink) {
                        const href = userLink.getAttribute('href') || '';
                        const m = href.match(/@([a-zA-Z0-9._]+)/);
                        handle = m ? m[1] : userLink.textContent.trim().replace(/^@/, '');
                    }

                    // 若屬於我方發言，移除已有按鈕並跳過
                    if (isSelfPost(handle, art)) {
                        art.querySelectorAll('.uda-inline-btn').forEach(b => b.remove());
                        return;
                    }

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

        // 2. Bilibili 適配器 (B站視頻、動態、評論區 - 全面穿透 Web Components / Shadow DOM)
        {
            id: 'bilibili',
            name: 'Bilibili',
            matches: () => location.hostname.includes('bilibili.com'),
            getPageContext: () => {
                const title = document.querySelector('h1.video-title, .video-info-title, .opus-module-title, .title')?.textContent?.trim() || document.title;
                const up = document.querySelector('.up-name, .username, .up-info--name')?.textContent?.trim() || '';
                return `Bilibili 稿件：${title}${up ? ` (UP主: ${up})` : ''}`;
            },
            // 向上追溯特定評論所屬的主樓與樓中樓完整對話鏈 (支援深層穿透 Shadow DOM)
            traceThread: (targetEl) => {
                // 向上穿透 ShadowRoot host 邊界尋找當前樓層頂部容器
                const threadRoot = findComposedParent(targetEl, 'bili-comment-thread-renderer, .reply-item, .comment-thread-item')
                    || findComposedParent(targetEl, 'bili-comment-renderer, bili-comment-reply-renderer, .root-reply-container, .sub-reply-item')
                    || targetEl.parentElement;
                if (!threadRoot) return null;

                const posts = [];

                // 輔助擷取使用者與內文
                const extractUserInfo = (el) => {
                    if (!el) return '用戶';
                    const userEl = queryDeep('bili-comment-user-info, .user-name, .sub-user-name, .reply-user, .name', el)[0] || el;
                    return userEl?.textContent?.trim().replace(/\s+/g, ' ') || '用戶';
                };
                const extractContent = (el) => {
                    if (!el) return '';
                    const textEl = queryDeep('bili-rich-text, .reply-content, .text-con, .text, #contents', el)[0] || el;
                    return (textEl?.innerText || textEl?.textContent || '').trim();
                };

                // 1. 取得頂樓（主評論）
                const rootCommentEl = queryDeep('bili-comment-renderer#comment, bili-comment-renderer, .root-reply-container, .reply-wrap', threadRoot)[0] || threadRoot;
                const rootUser = extractUserInfo(rootCommentEl);
                const rootText = extractContent(rootCommentEl);

                if (rootText) {
                    const isTarget = rootCommentEl.contains(targetEl) || targetEl.contains(rootCommentEl);
                    posts.push({
                        handle: `${rootUser} (頂樓主評${isTarget ? ' - 反擊目標' : ''})`,
                        content: rootText
                    });
                }

                // 2. 遍歷該主樓下的所有二級樓中樓回覆
                const subReplies = queryDeep('bili-comment-reply-renderer, .sub-reply-item, .reply-item-sub', threadRoot);
                subReplies.forEach((sub, idx) => {
                    const subUser = extractUserInfo(sub);
                    const subText = extractContent(sub);
                    if (subText) {
                        const isTarget = sub.contains(targetEl) || targetEl.contains(sub);
                        posts.push({
                            handle: `${subUser} (樓中樓 #${idx + 1}${isTarget ? ' - 反擊目標' : ''})`,
                            content: subText
                        });
                    }
                });

                return posts.length > 0 ? posts : null;
            },
            scrapeContext: () => {
                const posts = [];
                const seen = new Set();

                const extractUserInfo = (el) => {
                    if (!el) return '用戶';
                    const userEl = queryDeep('bili-comment-user-info, .user-name, .sub-user-name, .reply-user, .name', el)[0] || el;
                    return userEl?.textContent?.trim().replace(/\s+/g, ' ') || '用戶';
                };
                const extractContent = (el) => {
                    if (!el) return '';
                    const textEl = queryDeep('bili-rich-text, .reply-content, .text-con, .text, #contents', el)[0] || el;
                    return (textEl?.innerText || textEl?.textContent || '').trim();
                };

                // 穿透遍歷頁面上所有主樓及其前列回覆
                const threads = queryDeep('bili-comment-thread-renderer, .reply-item');
                threads.forEach((th, tIdx) => {
                    const rootCommentEl = queryDeep('bili-comment-renderer#comment, bili-comment-renderer, .root-reply-container, .reply-wrap', th)[0] || th;
                    const handle = extractUserInfo(rootCommentEl) || `樓主 #${tIdx + 1}`;
                    const content = extractContent(rootCommentEl);

                    if (content && !seen.has(content)) {
                        seen.add(content);
                        posts.push({ handle: `${handle} (第${tIdx + 1}樓主評)`, content });
                    }

                    // 附帶該樓前 2 則子回覆，加深脈絡理解
                    const subReplies = queryDeep('bili-comment-reply-renderer, .sub-reply-item', th).slice(0, 2);
                    subReplies.forEach((sub) => {
                        const sUser = extractUserInfo(sub);
                        const sText = extractContent(sub);
                        if (sText && !seen.has(sText)) {
                            seen.add(sText);
                            posts.push({ handle: `  ↳ ${sUser} (樓中樓)`, content: sText });
                        }
                    });
                });
                return posts.slice(0, 25);
            },
            injectButtons: (onSelectTarget) => {
                const extractUserInfo = (el) => {
                    if (!el) return '用戶';
                    const userEl = queryDeep('bili-comment-user-info, .user-name, .sub-user-name, .reply-user, .name', el)[0] || el;
                    return userEl?.textContent?.trim().replace(/\s+/g, ' ') || '用戶';
                };
                const extractContent = (el) => {
                    if (!el) return '';
                    const textEl = queryDeep('bili-rich-text, .reply-content, .text-con, .text, #contents', el)[0] || el;
                    return (textEl?.innerText || textEl?.textContent || '').trim();
                };

                // 輔助將按鈕掛載至 action-buttons 列或容器
                const mountButton = (containerEl, btn) => {
                    const actionBars = queryDeep('bili-comment-action-buttons-renderer, .reply-info, .info-wrap', containerEl);
                    const bar = actionBars[0];
                    if (bar) {
                        if (bar.shadowRoot) {
                            const innerTarget = bar.shadowRoot.querySelector('#buttons, .action-buttons, .buttons-wrapper') || bar.shadowRoot;
                            innerTarget.appendChild(btn);
                            return true;
                        } else {
                            bar.appendChild(btn);
                            return true;
                        }
                    }
                    if (containerEl.shadowRoot) {
                        const fallbackTarget = containerEl.shadowRoot.querySelector('#action-buttons, #footer, #body') || containerEl.shadowRoot;
                        fallbackTarget.appendChild(btn);
                        return true;
                    }
                    containerEl.appendChild(btn);
                    return true;
                };

                // 1. 在主樓注入按鈕 (穿透 Shadow DOM)
                const rootReplies = queryDeep('bili-comment-renderer#comment, bili-comment-renderer, .reply-item > .root-reply-container, .reply-item > .reply-wrap');
                rootReplies.forEach(rootEl => {
                    const content = extractContent(rootEl);
                    const user = extractUserInfo(rootEl) || '樓主';
                    if (!content || content.length < 2) return;

                    // 若屬於我方發言，主動清理已有按鈕並跳過
                    if (isSelfPost(user, rootEl)) {
                        queryDeep('.uda-inline-btn', rootEl).forEach(b => b.remove());
                        return;
                    }

                    if (queryDeep('.uda-inline-btn', rootEl).length > 0) return;

                    const btn = createActionBadge('⚔️ 筆戰', () => {
                        const adapter = getActiveAdapter();
                        const threadChain = adapter.traceThread ? adapter.traceThread(rootEl) : null;
                        onSelectTarget(`@${user} (頂樓): ${content}`, threadChain);
                    });
                    mountButton(rootEl, btn);
                });

                // 2. 在樓中樓（子評論）注入按鈕 (穿透 Shadow DOM)
                const subReplies = queryDeep('bili-comment-reply-renderer, .sub-reply-item');
                subReplies.forEach(subEl => {
                    const content = extractContent(subEl);
                    const user = extractUserInfo(subEl) || '用戶';
                    if (!content || content.length < 2) return;

                    // 若屬於我方發言，主動清理已有按鈕並跳過
                    if (isSelfPost(user, subEl)) {
                        queryDeep('.uda-inline-btn', subEl).forEach(b => b.remove());
                        return;
                    }

                    if (queryDeep('.uda-inline-btn', subEl).length > 0) return;

                    const btn = createActionBadge('⚔️ 筆戰', () => {
                        const adapter = getActiveAdapter();
                        const threadChain = adapter.traceThread ? adapter.traceThread(subEl) : null;
                        onSelectTarget(`@${user}: ${content}`, threadChain);
                    });
                    mountButton(subEl, btn);
                });
            },
            fillComposer: (text) => {
                const textareas = queryDeep('textarea.reply-box-textarea, bili-comment-textarea textarea, textarea, .ipt-txt');
                const composer = textareas.find(ta => !ta.readOnly && !ta.disabled && (ta.offsetParent !== null || ta.offsetWidth > 0)) || textareas[0];
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
        btn.style.cssText = `
            display: inline-flex;
            align-items: center;
            justify-content: center;
            padding: 2px 8px;
            margin-left: 8px;
            font-size: 11px;
            font-weight: 600;
            color: #ff4757;
            background: rgba(255, 71, 87, 0.12);
            border: 1px solid rgba(255, 71, 87, 0.3);
            border-radius: 9999px;
            cursor: pointer;
            vertical-align: middle;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            box-shadow: 0 1px 3px rgba(0,0,0,0.1);
            line-height: 1.4;
            z-index: 10;
            transition: all 0.2s ease;
        `;
        btn.addEventListener('mouseenter', () => {
            btn.style.background = 'rgba(255, 71, 87, 0.25)';
            btn.style.color = '#ff2d42';
            btn.style.borderColor = '#ff4757';
        });
        btn.addEventListener('mouseleave', () => {
            btn.style.background = 'rgba(255, 71, 87, 0.12)';
            btn.style.color = '#ff4757';
            btn.style.borderColor = 'rgba(255, 71, 87, 0.3)';
        });
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
        .uda-model-chip {
            display: inline-block;
            font-size: 11px;
            padding: 2px 7px;
            background: rgba(255,255,255,0.06);
            border: 1px solid rgba(255,255,255,0.12);
            border-radius: 4px;
            color: #dfe4ea;
            cursor: pointer;
            transition: all 0.15s;
            user-select: none;
        }
        .uda-model-chip:hover {
            background: #ff4b2b;
            color: #ffffff;
            border-color: #ff4b2b;
        }
        .uda-model-chip.uda-active {
            background: rgba(255, 75, 43, 0.25);
            border-color: #ff4b2b;
            color: #ff7675;
            font-weight: 600;
        }
        .uda-fallback-banner {
            background: rgba(255, 177, 66, 0.15);
            border: 1px solid #ffb142;
            border-radius: 8px;
            padding: 8px 12px;
            font-size: 12px;
            color: #f1f2f6;
            display: flex;
            justify-content: space-between;
            align-items: center;
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

    // --- 呼叫 Google Gemini API (支援多模型自動故障轉移 / 503 輪替機制) ---
    function callGeminiAPI(apiKey, primaryModel, userStance, targetPost, threadContext, pageSummary, onStatusUpdate, onSuccess, onError) {
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
${userStance ? userStance : '客觀分享事實與數據是正常討論；反駁不了事實就只能訴諸群體道德、急著抓態度扣帽子。對方本質上是自卑破防轉移為攻擊。'}

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
                temperature: 0.85,
                topK: 40,
                topP: 0.95,
                maxOutputTokens: 4096
            }
        };

        // 構建候選模型鏈：首選模型 -> 其餘備援模型
        const candidateModels = [primaryModel, ...FALLBACK_MODELS.filter(m => m !== primaryModel)];
        let attemptIdx = 0;

        function attemptNextModel() {
            if (attemptIdx >= candidateModels.length) {
                onError(`所有備援模型（${candidateModels.join(', ')}）目前均處於尖峰高負載狀態 (503)，請稍後再試。`);
                return;
            }

            const currentModel = candidateModels[attemptIdx];
            if (attemptIdx > 0 && onStatusUpdate) {
                onStatusUpdate(`⚠️ 原模型負載過高 (503)，正在自動切換至備援模型【${currentModel}】...`);
            }

            const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(currentModel)}:generateContent?key=${encodeURIComponent(apiKey)}`;

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
                                onSuccess(generatedText, currentModel, attemptIdx > 0);
                            } else {
                                onError('Gemini API 未回傳有效候選內容：' + response.responseText);
                            }
                        } catch (e) {
                            onError('解析回應 JSON 失敗：' + e.message);
                        }
                    } else if (response.status === 503 || response.status === 429) {
                        // 遇到 503 (High demand) 或 429 (Rate Limit)，自動嘗試下一個備援模型
                        console.warn(`[UDA] 模型 ${currentModel} 返回 ${response.status}，嘗試自動切換備援模型...`);
                        attemptIdx++;
                        setTimeout(attemptNextModel, 1000);
                    } else {
                        onError(`API 請求失敗 (HTTP ${response.status})：${response.responseText}`);
                    }
                },
                onerror: function () {
                    onError('網路連線或 API 請求異常，請檢查網路連線或 API Key。');
                }
            });
        }

        attemptNextModel();
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
                            <div class="uda-label">
                                <span>Gemini 模型名稱</span>
                                <span style="font-size: 11px; color: #74b9ff;">點選切換：</span>
                            </div>
                            <div style="display: flex; gap: 4px; flex-wrap: wrap; margin-bottom: 5px;">
                                <span class="uda-model-chip" data-model="gemini-3.8-flash" title="3.8 旗艦推理，戰力最高">3.8-flash (推薦)</span>
                                <span class="uda-model-chip" data-model="gemini-3.5-flash" title="3.5 高能效主力">3.5-flash</span>
                                <span class="uda-model-chip" data-model="gemini-3.0-flash" title="3.0 極致穩定防503">3.0-flash</span>
                                <span class="uda-model-chip" data-model="gemini-2.5-flash" title="2.5 經典模型">2.5-flash</span>
                                <span class="uda-model-chip" data-model="gemini-2.0-flash" title="2.0 極速備援">2.0-flash</span>
                            </div>
                            <input type="text" id="uda-model-name" class="uda-input" placeholder="gemini-3.8-flash" />
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
        stanceInput.value = GM_getValue(STORAGE_KEY_CUSTOM_STANCE, '客觀分享事實與數據是正常討論；反駁不了事實就只能訴諸群體道德、急著抓態度扣帽子。對方本質上是自卑破防轉移為攻擊。');

        // 模型快捷標籤點擊事件
        const chips = sidebar.querySelectorAll('.uda-model-chip');
        function updateChipActive(activeModel) {
            chips.forEach(c => {
                c.classList.toggle('uda-active', c.dataset.model === activeModel);
            });
        }
        chips.forEach(chip => {
            chip.addEventListener('click', () => {
                modelInput.value = chip.dataset.model;
                updateChipActive(chip.dataset.model);
            });
        });
        updateChipActive(modelInput.value);

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
            pinnedThreadContext = null;
            const adapter = getActiveAdapter();
            const posts = adapter.scrapeContext();
            sidebar.querySelector('#uda-post-count').textContent = posts.length;
        });

        // 擷取脈絡按鈕
        sidebar.querySelector('#uda-scrape-btn').addEventListener('click', () => {
            const adapter = getActiveAdapter();
            pinnedThreadContext = null;
            const posts = adapter.scrapeContext();
            sidebar.querySelector('#uda-post-count').textContent = posts.length;
            showToast(`📥 [${adapter.name}] 已重新掃描全頁 ${posts.length} 則討論脈絡`);
        });

        // 立場變更自動保存
        stanceInput.addEventListener('change', () => {
            GM_setValue(STORAGE_KEY_CUSTOM_STANCE, stanceInput.value);
        });

        // 生成按鈕
        sidebar.querySelector('#uda-generate-btn').addEventListener('click', handleGenerate);

        return sidebar;
    }

    let pinnedThreadContext = null;

    function openSidebar(initialTargetText = '', threadChain = null) {
        const sb = createSidebar();
        const adapter = getActiveAdapter();
        sb.querySelector('#uda-platform-indicator').textContent = adapter.name;

        sb.classList.add('uda-open');
        if (initialTargetText) {
            sb.querySelector('#uda-target-post').value = initialTargetText;
        }

        // 優先採用特定鎖定的爬樓脈絡
        pinnedThreadContext = threadChain;
        if (pinnedThreadContext && pinnedThreadContext.length > 0) {
            sb.querySelector('#uda-post-count').textContent = `${pinnedThreadContext.length} (已鎖定本樓脈絡)`;
        } else {
            const posts = adapter.scrapeContext();
            sb.querySelector('#uda-post-count').textContent = posts.length;
        }
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
        const threadContext = (pinnedThreadContext && pinnedThreadContext.length > 0) ? pinnedThreadContext : adapter.scrapeContext();
        const pageSummary = adapter.getPageContext();

        outputContainer.innerHTML = `
            <div style="text-align: center; padding: 24px; color: #ff7675; font-size: 13px;">
                <div style="font-size: 26px; margin-bottom: 8px; animation: spin 1s linear infinite;">⏳</div>
                正在精準解構對方邏輯漏洞並組織犀利回擊中...
            </div>
        `;

        callGeminiAPI(
            apiKey,
            model,
            userStance,
            targetPost,
            threadContext,
            pageSummary,
            (statusMsg) => {
                outputContainer.innerHTML = `
                    <div style="text-align: center; padding: 24px; color: #ffb142; font-size: 13px; line-height: 1.6;">
                        <div style="font-size: 26px; margin-bottom: 8px;">🔄</div>
                        ${escapeHTML(statusMsg)}
                    </div>
                `;
            },
            (responseText, usedModel, isFallback) => {
                renderDebateResult(responseText, usedModel, isFallback);
            },
            (errorMsg) => {
                outputContainer.innerHTML = `
                    <div style="padding: 12px; background: rgba(255, 71, 87, 0.15); border: 1px solid #ff4757; border-radius: 8px; color: #ff6b81; font-size: 13px; line-height: 1.5;">
                        ❌ 生成失敗：${escapeHTML(errorMsg)}
                        <div style="margin-top: 8px; font-size: 11.5px; color: #a4b0be;">
                            💡 建議：可點開上方「⚙️ API 與身分設定」，點選 <b>1.5-flash</b> 或 <b>2.0-flash</b> 切換為最穩定的模型。
                        </div>
                    </div>
                `;
            }
        );
    }

    // --- 渲染生成結果 ---
    function renderDebateResult(markdownText, usedModel, isFallback) {
        const outputContainer = sidebar.querySelector('#uda-output-container');
        outputContainer.innerHTML = '';

        // 若發生自動切換備援模型，顯示提示條
        if (isFallback) {
            const banner = document.createElement('div');
            banner.className = 'uda-fallback-banner';
            banner.innerHTML = `
                <span>⚡ 原模型暫時擁塞 (503)，已自動切換至備援模型 <b>${escapeHTML(usedModel)}</b> 產出！</span>
                <button class="uda-pill-btn" id="uda-set-fallback-default" style="font-size: 11px; padding: 2px 6px;">設為預設</button>
            `;
            banner.querySelector('#uda-set-fallback-default').addEventListener('click', () => {
                GM_setValue(STORAGE_KEY_MODEL, usedModel);
                sidebar.querySelector('#uda-model-name').value = usedModel;
                showToast(`✅ 已將 ${usedModel} 設為預設模型！`);
                banner.style.display = 'none';
            });
            outputContainer.appendChild(banner);
        }

        // 增強型正則切分器：支援 ### 選項、**選項、選項 A/B/C、選項 1/2/3、方案 A/B/C
        const sections = markdownText.split(/(?=(?:###|\*\*|【)\s*(?:選項|方案)|\b(?:選項|方案)\s*[A-Ca-c1-3]|【對手邏輯漏洞剖析】|【回擊選項】)/gi);
        let analysisBlock = '';
        const options = [];

        sections.forEach(sec => {
            const trimmed = sec.trim();
            if (trimmed.includes('邏輯漏洞剖析') || trimmed.includes('邏輯漏洞')) {
                analysisBlock = trimmed.replace(/^.*?(?:邏輯漏洞剖析|邏輯漏洞)[】\s:]*/i, '').trim();
            } else if (/(?:選項|方案)\s*[A-Ca-c1-3]/i.test(trimmed)) {
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
                    <span style="font-size: 11px; color: #a4b0be;">${usedModel ? `[${escapeHTML(usedModel)}]` : ''}</span>
                </div>
                <div style="font-size: 13px; color: #ced6e0; line-height: 1.5; white-space: pre-wrap;">${escapeHTML(analysisBlock)}</div>
            `;
            outputContainer.appendChild(analysisCard);
        }

        // 2. 三大回擊卡片
        if (options.length > 0) {
            options.forEach((optText) => {
                const lines = optText.split('\n');
                let title = lines[0].replace(/^[#*【>\s]+|[】*]+/g, '').trim();
                let contentLines = lines.slice(1).join('\n')
                    .replace(/^>\s*/gm, '')
                    .replace(/\*+精煉.*?句.*?\*+/gi, '')
                    .trim();

                if (!contentLines && lines.length === 1) {
                    contentLines = title;
                    title = '回擊論點';
                }

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
            // 備援輸出 (附帶填入回覆功能)
            const cleanText = markdownText.replace(/\*+精煉.*?句.*?\*+/gi, '').trim();
            const rawCard = document.createElement('div');
            rawCard.className = 'uda-result-card';
            rawCard.innerHTML = `
                <div class="uda-result-title">
                    <span>⚔️ 戰術產出</span>
                    <span style="font-size: 11px; color: #a4b0be;">${usedModel ? `[${escapeHTML(usedModel)}]` : ''}</span>
                </div>
                <div class="uda-result-text">${escapeHTML(cleanText)}</div>
                <div class="uda-result-actions">
                    <button class="uda-pill-btn" id="uda-raw-copy">📋 複製全部</button>
                    <button class="uda-pill-btn uda-fill-btn" id="uda-raw-fill" style="background: rgba(255, 75, 43, 0.2); border-color: #ff4b2b; color: #ff7675;">🚀 填入回覆</button>
                </div>
            `;
            rawCard.querySelector('#uda-raw-copy').addEventListener('click', () => {
                navigator.clipboard.writeText(cleanText);
                showToast('📋 已複製至剪貼簿！');
            });
            rawCard.querySelector('#uda-raw-fill').addEventListener('click', () => {
                const adapter = getActiveAdapter();
                const success = adapter.fillComposer(cleanText);
                if (success) {
                    showToast(`✅ 已自動填入 ${adapter.name} 輸入框！`);
                } else {
                    navigator.clipboard.writeText(cleanText);
                    showToast('📋 已複製至剪貼簿（請手動貼上）');
                }
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
            adapter.injectButtons((targetText, threadChain) => {
                openSidebar(targetText, threadChain);
            });
        }
    }

    setInterval(runAdapterInjection, 1500);

    const observer = new MutationObserver(() => {
        runAdapterInjection();
    });
    observer.observe(document.body, { childList: true, subtree: true });

})();
