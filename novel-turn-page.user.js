// ==UserScript==
// @name         小說鍵盤左右鍵翻頁與沉浸閱讀助手
// @namespace    https://github.com/fine5351/
// @version      2.0
// @description  支援鍵盤左右鍵上一章/下一章翻頁、S 鍵啟動平滑自動滾動（到底部自動翻下一章）、R 鍵切換純淨沉浸閱讀模式
// @author       fine5351 / Antigravity
// @match        *://*/*
// @run-at       document-start
// @grant        GM_registerMenuCommand
// @grant        GM_getValue
// @grant        GM_setValue
// ==/UserScript==

(function () {
    'use strict';

    const currentHost = location.hostname.toLowerCase();
    const DOMAINS_KEY = 'novel_turn_page_domains';
    let domains = GM_getValue(DOMAINS_KEY, []);

    // ==========================================
    // 子網域匹配邏輯
    // ==========================================
    function isDomainMatched() {
        return domains.some(function (domain) {
            const trimmed = domain.trim().toLowerCase();
            if (!trimmed) return false;
            return currentHost === trimmed || currentHost.endsWith('.' + trimmed);
        });
    }

    // 註冊選單命令（在所有網頁均可打開設定）
    GM_registerMenuCommand('⚙️ 小說翻頁與閱讀設定', showSettings);

    // 如果網域不符合，就不執行翻頁監聽邏輯
    if (!isDomainMatched()) {
        return;
    }

    // ==========================================
    // 狀態通知 Toast
    // ==========================================
    function showToast(msg) {
        let toast = document.getElementById('ntp-toast');
        if (!toast) {
            toast = document.createElement('div');
            toast.id = 'ntp-toast';
            toast.style.cssText = `
                position: fixed;
                bottom: 40px;
                left: 50%;
                transform: translateX(-50%);
                background: rgba(30, 41, 59, 0.92);
                color: #f8fafc;
                padding: 10px 20px;
                border-radius: 8px;
                font-size: 14px;
                font-weight: 500;
                z-index: 2147483646;
                box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
                pointer-events: none;
                transition: opacity 0.3s ease;
                font-family: system-ui, sans-serif;
            `;
            document.body.appendChild(toast);
        }
        toast.textContent = msg;
        toast.style.opacity = '1';
        clearTimeout(toast._timer);
        toast._timer = setTimeout(() => {
            toast.style.opacity = '0';
        }, 2200);
    }

    // ==========================================
    // 翻頁監聽邏輯
    // ==========================================
    const PREV_KEYWORDS = ['<', '上一話', '上一章', '上一頁', '上一页', '上页', '上章', '前一章', '前一頁', '前一页', 'Previous'];
    const NEXT_KEYWORDS = ['>', '下一話', '下一章', '下一頁', '下一页', '下页', '下章', '後一章', '后一章', '後一頁', '后一页', 'Next'];

    function turnPage(keywords) {
        const links = document.querySelectorAll('a');
        for (const keyword of keywords) {
            for (const link of links) {
                const text = link.textContent.trim();
                if (text === keyword || text.includes(keyword)) {
                    link.click();
                    return true;
                }
            }
        }
        return false;
    }

    // ==========================================
    // 平滑自動滾動 (Auto Scroll)
    // ==========================================
    let isAutoScrolling = false;
    let scrollSpeed = 1.8; // 每影格滾動像素
    let scrollAnimId = null;
    let isAtBottomTriggered = false;

    function autoScrollStep() {
        if (!isAutoScrolling) return;

        window.scrollBy(0, scrollSpeed);

        // 偵測是否已滾動至頁面最底部
        const scrollBottom = window.innerHeight + window.scrollY;
        const pageHeight = document.documentElement.scrollHeight || document.body.scrollHeight;

        if (scrollBottom >= pageHeight - 30) {
            if (!isAtBottomTriggered) {
                isAtBottomTriggered = true;
                showToast('🚀 已滾動到底部，自動切換下一章...');
                setTimeout(() => {
                    const success = turnPage(NEXT_KEYWORDS);
                    if (!success) {
                        toggleAutoScroll(false);
                    }
                }, 800);
            }
            return;
        }

        scrollAnimId = requestAnimationFrame(autoScrollStep);
    }

    function toggleAutoScroll(forceState) {
        isAutoScrolling = forceState !== undefined ? forceState : !isAutoScrolling;
        if (isAutoScrolling) {
            isAtBottomTriggered = false;
            showToast(`📜 自動滾動已啟動 (速度: ${scrollSpeed.toFixed(1)}) | S: 暫停, +/-: 調速`);
            scrollAnimId = requestAnimationFrame(autoScrollStep);
        } else {
            if (scrollAnimId) cancelAnimationFrame(scrollAnimId);
            showToast('⏸️ 自動滾動已暫停');
        }
    }

    function adjustScrollSpeed(delta) {
        scrollSpeed = Math.max(0.5, Math.min(10, scrollSpeed + delta));
        showToast(`⚡ 滾動速度已調整為: ${scrollSpeed.toFixed(1)}`);
    }

    // ==========================================
    // 純淨沉浸閱讀模式 (Reading Mode)
    // ==========================================
    let isReadingMode = false;
    function toggleReadingMode() {
        isReadingMode = !isReadingMode;
        let style = document.getElementById('ntp-reading-style');

        if (isReadingMode) {
            if (!style) {
                style = document.createElement('style');
                style.id = 'ntp-reading-style';
                style.textContent = `
                    body {
                        background-color: #f6f4ec !important;
                        color: #2c3e50 !important;
                    }
                    /* 限制主體閱讀寬度並置中 */
                    #content, #chaptercontent, .content, .read-content, article, main, .text-content, .entry-content {
                        max-width: 820px !important;
                        margin: 0 auto !important;
                        font-size: 20px !important;
                        line-height: 1.85 !important;
                        font-family: "PingFang TC", "Microsoft JhengHei", "Noto Serif CJK TC", serif !important;
                    }
                    /* 隱藏側邊廣告與多餘浮動條 */
                    aside, .sidebar, .ad, .ads, [class*="advertisement"], [id*="advertisement"] {
                        display: none !important;
                    }
                `;
                document.head.appendChild(style);
            }
            showToast('📖 已進入純淨沉浸閱讀模式 (R 鍵退出)');
        } else {
            if (style) style.remove();
            showToast('📖 已退出沉浸閱讀模式');
        }
    }

    // ==========================================
    // 快捷鍵總控監聽
    // ==========================================
    document.addEventListener('keydown', function (event) {
        const activeElement = document.activeElement;
        const tagName = activeElement ? activeElement.tagName.toLowerCase() : '';
        if (tagName === 'input' || tagName === 'textarea' || activeElement?.isContentEditable) {
            return;
        }

        // 左右鍵翻章節
        if (event.key === 'ArrowLeft') {
            turnPage(PREV_KEYWORDS);
        } else if (event.key === 'ArrowRight') {
            turnPage(NEXT_KEYWORDS);
        }
        // S 鍵：切換自動滾動
        else if (event.key === 's' || event.key === 'S') {
            if (!event.ctrlKey && !event.altKey && !event.metaKey) {
                event.preventDefault();
                toggleAutoScroll();
            }
        }
        // R 鍵：切換沉浸閱讀模式
        else if (event.key === 'r' || event.key === 'R') {
            if (!event.ctrlKey && !event.altKey && !event.metaKey) {
                event.preventDefault();
                toggleReadingMode();
            }
        }
        // +/- 或 ↑/↓ 調速 (僅在自動滾動開啟時)
        else if (isAutoScrolling) {
            if (event.key === '+' || event.key === '=') {
                event.preventDefault();
                adjustScrollSpeed(0.5);
            } else if (event.key === '-' || event.key === '_') {
                event.preventDefault();
                adjustScrollSpeed(-0.5);
            }
        }
    });

    // ==========================================
    // 網域設定管理 UI (Shadow DOM 封裝)
    // ==========================================
    function showSettings() {
        if (document.getElementById('ntp-settings-container')) return;

        const container = document.createElement('div');
        container.id = 'ntp-settings-container';

        // 建立 Shadow DOM 避免與原網頁樣式衝突
        const shadow = container.attachShadow({ mode: 'open' });

        // 插入 CSS 樣式
        const style = document.createElement('style');
        style.textContent = `
            #ntp-settings-overlay {
                position: fixed;
                top: 0;
                left: 0;
                width: 100vw;
                height: 100vh;
                background: rgba(0, 0, 0, 0.45);
                backdrop-filter: blur(8px);
                -webkit-backdrop-filter: blur(8px);
                z-index: 2147483647;
                display: flex;
                align-items: center;
                justify-content: center;
                font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
                color: #333333;
            }
            #ntp-settings-modal {
                background: rgba(255, 255, 255, 0.92);
                backdrop-filter: blur(16px);
                -webkit-backdrop-filter: blur(16px);
                border: 1px solid rgba(255, 255, 255, 0.35);
                border-radius: 16px;
                width: 460px;
                max-width: 90%;
                max-height: 85vh;
                box-shadow: 0 12px 40px rgba(0, 0, 0, 0.2);
                display: flex;
                flex-direction: column;
                overflow: hidden;
                animation: ntp-fade-in 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards;
                box-sizing: border-box;
            }
            @keyframes ntp-fade-in {
                from { opacity: 0; transform: scale(0.95) translateY(10px); }
                to { opacity: 1; transform: scale(1) translateY(0); }
            }
            #ntp-settings-header {
                padding: 20px 24px 16px;
                border-bottom: 1px solid rgba(0, 0, 0, 0.08);
                display: flex;
                justify-content: space-between;
                align-items: center;
            }
            #ntp-settings-header h3 {
                margin: 0;
                font-size: 18px;
                font-weight: 600;
                background: linear-gradient(135deg, #0284c7, #2563eb);
                -webkit-background-clip: text;
                -webkit-text-fill-color: transparent;
            }
            #ntp-settings-close {
                background: transparent;
                border: none;
                font-size: 22px;
                cursor: pointer;
                color: #666;
                padding: 0;
                width: 28px;
                height: 28px;
                display: flex;
                align-items: center;
                justify-content: center;
                border-radius: 50%;
                transition: background 0.2s;
            }
            #ntp-settings-close:hover {
                background: rgba(0, 0, 0, 0.05);
                color: #000;
            }
            #ntp-settings-content {
                padding: 20px 24px;
                overflow-y: auto;
                flex: 1;
                box-sizing: border-box;
            }
            .ntp-section {
                margin-bottom: 22px;
            }
            .ntp-section-title {
                font-size: 14px;
                font-weight: 600;
                margin-bottom: 8px;
                color: #4b5563;
            }
            #ntp-domain-list {
                border: 1px solid rgba(0, 0, 0, 0.08);
                border-radius: 8px;
                background: rgba(255, 255, 255, 0.4);
                max-height: 160px;
                overflow-y: auto;
                margin-bottom: 12px;
                padding: 4px;
            }
            .ntp-domain-item {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 6px 12px;
                border-radius: 6px;
                font-size: 13px;
                transition: background 0.15s;
            }
            .ntp-domain-item:hover {
                background: rgba(0, 0, 0, 0.04);
            }
            .ntp-domain-name {
                color: #374151;
                font-family: monospace;
                word-break: break-all;
            }
            .ntp-delete-btn {
                background: transparent;
                border: none;
                color: #ef4444;
                cursor: pointer;
                padding: 4px;
                display: flex;
                align-items: center;
                border-radius: 4px;
                transition: background 0.15s;
            }
            .ntp-delete-btn:hover {
                background: rgba(239, 68, 68, 0.1);
            }
            .ntp-add-actions {
                display: flex;
                flex-direction: column;
                gap: 8px;
            }
            .ntp-input-group {
                display: flex;
                gap: 8px;
            }
            .ntp-input {
                flex: 1;
                padding: 8px 12px;
                border: 1px solid rgba(0, 0, 0, 0.12);
                border-radius: 8px;
                background: rgba(255, 255, 255, 0.7);
                font-size: 13px;
                font-family: monospace;
                outline: none;
                transition: all 0.2s;
                box-sizing: border-box;
            }
            .ntp-input:focus {
                border-color: #0284c7;
                box-shadow: 0 0 0 2px rgba(2, 132, 199, 0.15);
                background: #fff;
            }
            .ntp-btn {
                padding: 8px 16px;
                border-radius: 8px;
                border: none;
                font-size: 13px;
                font-weight: 600;
                cursor: pointer;
                transition: all 0.2s;
                display: inline-flex;
                align-items: center;
                justify-content: center;
                gap: 6px;
                box-sizing: border-box;
            }
            .ntp-btn-primary {
                background: linear-gradient(135deg, #0284c7, #2563eb);
                color: #ffffff;
                box-shadow: 0 4px 12px rgba(2, 132, 199, 0.2);
            }
            .ntp-btn-primary:hover {
                opacity: 0.95;
                transform: translateY(-1px);
                box-shadow: 0 6px 16px rgba(2, 132, 199, 0.3);
            }
            .ntp-btn-primary:active {
                transform: translateY(0);
            }
            .ntp-btn-secondary {
                background: rgba(255, 255, 255, 0.6);
                border: 1px solid rgba(0, 0, 0, 0.1);
                color: #4b5563;
            }
            .ntp-btn-secondary:hover {
                background: rgba(255, 255, 255, 0.9);
                border-color: rgba(0, 0, 0, 0.15);
                color: #1f2937;
            }
            .ntp-textarea {
                width: 100%;
                height: 70px;
                padding: 8px 12px;
                border: 1px solid rgba(0, 0, 0, 0.12);
                border-radius: 8px;
                background: rgba(255, 255, 255, 0.7);
                font-size: 11px;
                font-family: monospace;
                resize: none;
                outline: none;
                box-sizing: border-box;
                transition: all 0.2s;
                margin-bottom: 8px;
            }
            .ntp-textarea:focus {
                border-color: #0284c7;
                box-shadow: 0 0 0 2px rgba(2, 132, 199, 0.15);
                background: #fff;
            }
            #ntp-settings-footer {
                padding: 16px 24px 20px;
                border-top: 1px solid rgba(0, 0, 0, 0.08);
                display: flex;
                justify-content: flex-end;
                gap: 12px;
                box-sizing: border-box;
            }
        `;
        shadow.appendChild(style);

        // 插入 HTML 結構
        const overlay = document.createElement('div');
        overlay.id = 'ntp-settings-overlay';
        overlay.innerHTML = `
            <div id="ntp-settings-modal">
                <div id="ntp-settings-header">
                    <h3>⚙️ 小說翻頁網域設定</h3>
                    <button id="ntp-settings-close" title="關閉">&times;</button>
                </div>
                <div id="ntp-settings-content">
                    <!-- 網域管理 -->
                    <div class="ntp-section">
                        <div class="ntp-section-title">已啟用的網域清單</div>
                        <div id="ntp-domain-list"></div>

                        <div class="ntp-add-actions">
                            <button class="ntp-btn ntp-btn-secondary" id="ntp-add-current-btn" style="width: 100%;">
                                ➕ 新增目前網站
                            </button>
                            <div class="ntp-input-group">
                                <input type="text" class="ntp-input" id="ntp-new-domain" placeholder="手動輸入網域 (例如: 69shuba.cx)...">
                                <button class="ntp-btn ntp-btn-primary" id="ntp-add-btn">新增</button>
                            </div>
                        </div>
                    </div>

                    <!-- 匯出與匯入 -->
                    <div class="ntp-section">
                        <div class="ntp-section-title">備份與匯出/匯入</div>
                        <textarea class="ntp-textarea" id="ntp-export-import-area" placeholder="網域 JSON 陣列會顯示在此處..."></textarea>
                        <div class="ntp-input-group">
                            <button class="ntp-btn ntp-btn-secondary" id="ntp-import-btn" style="flex: 1;">📥 匯入網域</button>
                            <button class="ntp-btn ntp-btn-secondary" id="ntp-copy-btn" style="flex: 1;">📋 複製內容</button>
                        </div>
                    </div>
                </div>
                <div id="ntp-settings-footer">
                    <button class="ntp-btn ntp-btn-secondary" id="ntp-cancel-btn">取消</button>
                    <button class="ntp-btn ntp-btn-primary" id="ntp-save-btn">儲存並重整</button>
                </div>
            </div>
        `;
        shadow.appendChild(overlay);
        (document.body || document.documentElement).appendChild(container);

        // 綁定 UI 變數與事件
        const localDomains = [...domains];

        // 渲染網域列表
        function renderDomains() {
            const listDiv = shadow.getElementById('ntp-domain-list');
            listDiv.innerHTML = '';
            if (localDomains.length === 0) {
                listDiv.innerHTML = '<div style="text-align:center;color:#888;padding:20px;font-size:13px;">目前沒有啟用任何網域（未啟用時不生效）</div>';
            } else {
                localDomains.forEach(function (domain, idx) {
                    const item = document.createElement('div');
                    item.className = 'ntp-domain-item';

                    const nameSpan = document.createElement('span');
                    nameSpan.className = 'ntp-domain-name';
                    nameSpan.textContent = domain;

                    const delBtn = document.createElement('button');
                    delBtn.className = 'ntp-delete-btn';
                    delBtn.innerHTML = `
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <polyline points="3 6 5 6 21 6"></polyline>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                        </svg>
                    `;
                    delBtn.onclick = function () {
                        localDomains.splice(idx, 1);
                        renderDomains();
                        updateExportArea();
                        updateAddCurrentBtn();
                    };

                    item.appendChild(nameSpan);
                    item.appendChild(delBtn);
                    listDiv.appendChild(item);
                });
            }
        }

        // 更新匯出文字框
        function updateExportArea() {
            const area = shadow.getElementById('ntp-export-import-area');
            area.value = JSON.stringify(localDomains);
        }

        // 新增目前網站網域按鈕狀態更新
        function updateAddCurrentBtn() {
            const addCurrentBtn = shadow.getElementById('ntp-add-current-btn');
            if (localDomains.includes(currentHost)) {
                addCurrentBtn.textContent = '當前網站已在清單中 (' + currentHost + ')';
                addCurrentBtn.disabled = true;
                addCurrentBtn.style.opacity = '0.6';
                addCurrentBtn.style.cursor = 'not-allowed';
                addCurrentBtn.onclick = null;
            } else {
                addCurrentBtn.textContent = '➕ 新增目前網站 (' + currentHost + ')';
                addCurrentBtn.disabled = false;
                addCurrentBtn.style.opacity = '1';
                addCurrentBtn.style.cursor = 'pointer';
                addCurrentBtn.onclick = function () {
                    localDomains.push(currentHost);
                    renderDomains();
                    updateExportArea();
                    updateAddCurrentBtn();
                };
            }
        }

        renderDomains();
        updateExportArea();
        updateAddCurrentBtn();

        // 手動新增網域
        const addBtn = shadow.getElementById('ntp-add-btn');
        const newDomainInput = shadow.getElementById('ntp-new-domain');

        function handleAddDomain() {
            const val = newDomainInput.value.trim().toLowerCase();
            if (!val) return;
            // 阻擋包含空格或不合法的網域格式
            if (/\s/.test(val) || !val.includes('.')) {
                alert('請輸入合法的網域格式 (例如: 69shuba.cx)！');
                return;
            }
            if (localDomains.includes(val)) {
                alert('此網域已在清單中。');
                return;
            }
            localDomains.push(val);
            newDomainInput.value = '';
            renderDomains();
            updateExportArea();
            updateAddCurrentBtn();
        }

        addBtn.onclick = handleAddDomain;
        newDomainInput.onkeydown = function (e) {
            if (e.key === 'Enter') {
                handleAddDomain();
            }
        };

        // 複製內容
        const copyBtn = shadow.getElementById('ntp-copy-btn');
        copyBtn.onclick = function () {
            const area = shadow.getElementById('ntp-export-import-area');
            if (!area.value) return;
            navigator.clipboard.writeText(area.value).then(function () {
                const originalText = copyBtn.textContent;
                copyBtn.textContent = '📋 已複製！';
                setTimeout(function () {
                    copyBtn.textContent = originalText;
                }, 1500);
            }).catch(function () {
                alert('複製失敗，請手動複製文字框內的內容。');
            });
        };

        // 匯入網域
        const importBtn = shadow.getElementById('ntp-import-btn');
        importBtn.onclick = function () {
            const area = shadow.getElementById('ntp-export-import-area');
            try {
                const parsed = JSON.parse(area.value.trim());
                if (Array.isArray(parsed) && parsed.every(function (x) { return typeof x === 'string'; })) {
                    const cleaned = parsed.map(function (x) { return x.trim().toLowerCase(); }).filter(Boolean);
                    const unique = [...new Set(cleaned)];

                    localDomains.length = 0;
                    localDomains.push(...unique);
                    renderDomains();
                    updateExportArea();
                    updateAddCurrentBtn();
                    alert('匯入成功！請記得點選下方的「儲存並重整」以套用設定。');
                } else {
                    throw new Error('格式錯誤，必須是字串陣列。例如: ["69shuba.cx"]');
                }
            } catch (e) {
                alert('匯入失敗: ' + e.message);
            }
        };

        // 關閉 Modal
        function closeModal() {
            container.remove();
        }

        shadow.getElementById('ntp-settings-close').onclick = closeModal;
        shadow.getElementById('ntp-cancel-btn').onclick = closeModal;

        // 點選遮罩關閉
        overlay.onclick = function (e) {
            if (e.target === overlay) {
                closeModal();
            }
        };

        // 儲存設定並重整
        shadow.getElementById('ntp-save-btn').onclick = function () {
            GM_setValue(DOMAINS_KEY, localDomains);
            closeModal();
            location.reload();
        };
    }
})();