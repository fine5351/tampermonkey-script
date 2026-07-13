// ==UserScript==
// @name         Universal-簡繁自動翻譯與網域管理
// @namespace    https://github.com/fine5351/
// @version      1.0
// @description  在指定網域自動將簡體中文翻譯為繁體中文（台灣），支援動態載入內容與網域匯入/匯出長期保存
// @author       Antigravity
// @match        *://*/*
// @run-at       document-start
// @require      https://cdn.jsdelivr.net/npm/opencc-js@1.4.0/dist/umd/full.js
// @grant        GM_registerMenuCommand
// @grant        GM_getValue
// @grant        GM_setValue
// ==/UserScript==

(function () {
    'use strict';

    const currentHost = location.hostname.toLowerCase();
    let domains = GM_getValue('translated_domains', []);
    let translationMode = GM_getValue('translation_mode', 'twp');

    // 子網域匹配邏輯
    function isDomainMatched() {
        return domains.some(domain => {
            const trimmed = domain.trim().toLowerCase();
            if (!trimmed) return false;
            return currentHost === trimmed || currentHost.endsWith('.' + trimmed);
        });
    }

    // 註冊選單命令（在所有網頁均可打開設定）
    GM_registerMenuCommand("⚙️ 繁簡翻譯設定", showSettings);

    // 如果網域不符合，就不執行翻譯邏輯
    if (!isDomainMatched()) {
        return;
    }

    // 初始化 OpenCC 轉換器
    let converter;
    try {
        if (typeof OpenCC === 'undefined' || !OpenCC.Converter) {
            console.error("[Universal Translation] OpenCC 函式庫未正確載入！");
            return;
        }
        converter = OpenCC.Converter({
            from: 'cn',
            to: translationMode
        });
    } catch (e) {
        console.error("[Universal Translation] 初始化 OpenCC 轉換器失敗:", e);
        return;
    }

    // 忽略的 HTML 標籤
    const IGNORED_TAGS = new Set([
        'SCRIPT', 'STYLE', 'NOSCRIPT', 'TEXTAREA', 'CODE', 'PRE', 
        'INPUT', 'IFRAME', 'SVG', 'PATH', 'TEXT', 'AUDIO', 'VIDEO'
    ]);
    
    // 用於防止重複翻譯與無限迴圈的 WeakMap
    const nodeValuesMap = new WeakMap();

    // 翻譯單個文字節點
    function translateNode(node) {
        if (node.nodeType === Node.TEXT_NODE) {
            const val = node.nodeValue;
            if (nodeValuesMap.get(node) === val) {
                return; // 已經翻譯過該內容，跳過
            }
            if (val && /[\u4e00-\u9fa5]/.test(val)) {
                const converted = converter(val);
                if (converted !== val) {
                    nodeValuesMap.set(node, converted);
                    node.nodeValue = converted;
                }
            }
        }
    }

    // 遞迴遍歷 DOM 樹並進行翻譯
    function translateElement(element) {
        if (!element) return;
        
        if (element.nodeType === Node.ELEMENT_NODE) {
            if (IGNORED_TAGS.has(element.tagName)) return;
            if (element.isContentEditable) return;

            // 翻譯屬性（Placeholder / Title）
            if (element.hasAttribute('placeholder')) {
                const val = element.getAttribute('placeholder');
                if (val && /[\u4e00-\u9fa5]/.test(val)) {
                    const converted = converter(val);
                    if (converted !== val) {
                        element.setAttribute('placeholder', converted);
                    }
                }
            }
            if (element.hasAttribute('title')) {
                const val = element.getAttribute('title');
                if (val && /[\u4e00-\u9fa5]/.test(val)) {
                    const converted = converter(val);
                    if (converted !== val) {
                        element.setAttribute('title', converted);
                    }
                }
            }
        }

        let child = element.firstChild;
        while (child) {
            const next = child.nextSibling;
            if (child.nodeType === Node.TEXT_NODE) {
                translateNode(child);
            } else if (child.nodeType === Node.ELEMENT_NODE) {
                translateElement(child);
            }
            child = next;
        }
    }

    // 使用 MutationObserver 監聽動態內容
    const observer = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
            if (mutation.type === 'childList') {
                mutation.addedNodes.forEach(node => {
                    if (node.nodeType === Node.ELEMENT_NODE) {
                        translateElement(node);
                    } else if (node.nodeType === Node.TEXT_NODE) {
                        translateNode(node);
                    }
                });
            } else if (mutation.type === 'characterData') {
                translateNode(mutation.target);
            }
        }
    });

    function startObserving() {
        observer.observe(document.documentElement, {
            childList: true,
            subtree: true,
            characterData: true
        });
    }

    // 儘早開始執行與監聽
    if (document.documentElement) {
        translateElement(document.documentElement);
        startObserving();
    } else {
        const startObs = new MutationObserver((mutations, obs) => {
            if (document.documentElement) {
                translateElement(document.documentElement);
                startObserving();
                obs.disconnect();
            }
        });
        startObs.observe(document, { childList: true, subtree: true });
    }


    // ==========================================
    // 精美設定管理 UI (Shadow DOM 封裝)
    // ==========================================
    function showSettings() {
        if (document.getElementById('uzt-settings-container')) return;

        const container = document.createElement('div');
        container.id = 'uzt-settings-container';
        
        // 建立 Shadow DOM 避免與原網頁樣式衝突
        const shadow = container.attachShadow({ mode: 'open' });

        // 插入 CSS 樣式
        const style = document.createElement('style');
        style.textContent = `
            #uzt-settings-overlay {
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
            #uzt-settings-modal {
                background: rgba(255, 255, 255, 0.88);
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
                animation: uzt-fade-in 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards;
                box-sizing: border-box;
            }
            @keyframes uzt-fade-in {
                from { opacity: 0; transform: scale(0.95) translateY(10px); }
                to { opacity: 1; transform: scale(1) translateY(0); }
            }
            #uzt-settings-header {
                padding: 20px 24px 16px;
                border-bottom: 1px solid rgba(0, 0, 0, 0.08);
                display: flex;
                justify-content: space-between;
                align-items: center;
            }
            #uzt-settings-header h3 {
                margin: 0;
                font-size: 18px;
                font-weight: 600;
                background: linear-gradient(135deg, #4f46e5, #7c3aed);
                -webkit-background-clip: text;
                -webkit-text-fill-color: transparent;
            }
            #uzt-settings-close {
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
            #uzt-settings-close:hover {
                background: rgba(0, 0, 0, 0.05);
                color: #000;
            }
            #uzt-settings-content {
                padding: 20px 24px;
                overflow-y: auto;
                flex: 1;
                box-sizing: border-box;
            }
            .uzt-section {
                margin-bottom: 22px;
            }
            .uzt-section-title {
                font-size: 14px;
                font-weight: 600;
                margin-bottom: 8px;
                color: #4b5563;
            }
            .uzt-radio-group {
                display: flex;
                gap: 12px;
                margin-top: 6px;
            }
            .uzt-radio-label {
                flex: 1;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                padding: 10px;
                background: rgba(255, 255, 255, 0.5);
                border: 1px solid rgba(0, 0, 0, 0.1);
                border-radius: 8px;
                cursor: pointer;
                font-size: 13px;
                transition: all 0.2s;
                text-align: center;
                font-weight: 500;
            }
            .uzt-radio-label input {
                display: none;
            }
            .uzt-radio-label:hover {
                background: rgba(255, 255, 255, 0.8);
                border-color: rgba(79, 70, 229, 0.3);
            }
            .uzt-radio-label.active {
                background: #4f46e5;
                color: #fff;
                border-color: #4f46e5;
                box-shadow: 0 4px 12px rgba(79, 70, 229, 0.25);
            }
            #uzt-domain-list {
                border: 1px solid rgba(0, 0, 0, 0.08);
                border-radius: 8px;
                background: rgba(255, 255, 255, 0.4);
                max-height: 150px;
                overflow-y: auto;
                margin-bottom: 12px;
                padding: 4px;
            }
            .uzt-domain-item {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 6px 12px;
                border-radius: 6px;
                font-size: 13px;
                transition: background 0.15s;
            }
            .uzt-domain-item:hover {
                background: rgba(0, 0, 0, 0.04);
            }
            .uzt-domain-name {
                color: #374151;
                font-family: monospace;
                word-break: break-all;
            }
            .uzt-delete-btn {
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
            .uzt-delete-btn:hover {
                background: rgba(239, 68, 68, 0.1);
            }
            .uzt-add-actions {
                display: flex;
                flex-direction: column;
                gap: 8px;
            }
            .uzt-input-group {
                display: flex;
                gap: 8px;
            }
            .uzt-input {
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
            .uzt-input:focus {
                border-color: #4f46e5;
                box-shadow: 0 0 0 2px rgba(79, 70, 229, 0.15);
                background: #fff;
            }
            .uzt-btn {
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
            .uzt-btn-primary {
                background: linear-gradient(135deg, #4f46e5, #7c3aed);
                color: #ffffff;
                box-shadow: 0 4px 12px rgba(79, 70, 229, 0.2);
            }
            .uzt-btn-primary:hover {
                opacity: 0.95;
                transform: translateY(-1px);
                box-shadow: 0 6px 16px rgba(79, 70, 229, 0.3);
            }
            .uzt-btn-primary:active {
                transform: translateY(0);
            }
            .uzt-btn-secondary {
                background: rgba(255, 255, 255, 0.6);
                border: 1px solid rgba(0, 0, 0, 0.1);
                color: #4b5563;
            }
            .uzt-btn-secondary:hover {
                background: rgba(255, 255, 255, 0.9);
                border-color: rgba(0, 0, 0, 0.15);
                color: #1f2937;
            }
            .uzt-textarea {
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
            .uzt-textarea:focus {
                border-color: #4f46e5;
                box-shadow: 0 0 0 2px rgba(79, 70, 229, 0.15);
                background: #fff;
            }
            #uzt-settings-footer {
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
        overlay.id = 'uzt-settings-overlay';
        overlay.innerHTML = `
            <div id="uzt-settings-modal">
                <div id="uzt-settings-header">
                    <h3>⚙️ 繁簡翻譯設定</h3>
                    <button id="uzt-settings-close" title="關閉">&times;</button>
                </div>
                <div id="uzt-settings-content">
                    <!-- 翻譯模式 -->
                    <div class="uzt-section">
                        <div class="uzt-section-title">翻譯模式</div>
                        <div class="uzt-radio-group">
                            <label class="uzt-radio-label" id="uzt-label-twp">
                                <input type="radio" name="uzt-mode" value="twp">
                                台灣繁體<br><span style="font-size:10px;opacity:0.8;">(含常用詞彙轉換)</span>
                            </label>
                            <label class="uzt-radio-label" id="uzt-label-tw">
                                <input type="radio" name="uzt-mode" value="tw">
                                台灣繁體<br><span style="font-size:10px;opacity:0.8;">(僅字形轉換)</span>
                            </label>
                        </div>
                    </div>
                    
                    <!-- 網域管理 -->
                    <div class="uzt-section">
                        <div class="uzt-section-title">已啟用的網域清單</div>
                        <div id="uzt-domain-list"></div>
                        
                        <div class="uzt-add-actions">
                            <button class="uzt-btn uzt-btn-secondary" id="uzt-add-current-btn" style="width: 100%;">
                                ➕ 新增目前網站
                            </button>
                            <div class="uzt-input-group">
                                <input type="text" class="uzt-input" id="uzt-new-domain" placeholder="手動輸入網域 (例如: baidu.com)...">
                                <button class="uzt-btn uzt-btn-primary" id="uzt-add-btn">新增</button>
                            </div>
                        </div>
                    </div>
                    
                    <!-- 匯出與匯入 -->
                    <div class="uzt-section">
                        <div class="uzt-section-title">備份與匯出/匯入 (輸出)</div>
                        <textarea class="uzt-textarea" id="uzt-export-import-area" placeholder="網域 JSON 陣列會顯示在此處..."></textarea>
                        <div class="uzt-input-group">
                            <button class="uzt-btn uzt-btn-secondary" id="uzt-import-btn" style="flex: 1;">📥 匯入網域</button>
                            <button class="uzt-btn uzt-btn-secondary" id="uzt-copy-btn" style="flex: 1;">📋 複製內容</button>
                        </div>
                    </div>
                </div>
                <div id="uzt-settings-footer">
                    <button class="uzt-btn uzt-btn-secondary" id="uzt-cancel-btn">取消</button>
                    <button class="uzt-btn uzt-btn-primary" id="uzt-save-btn">儲存並重整</button>
                </div>
            </div>
        `;
        shadow.appendChild(overlay);
        document.body.appendChild(container);

        // 綁定 UI 變數與事件
        const localDomains = [...domains];
        let localMode = translationMode;

        const radioTwp = shadow.getElementById('uzt-label-twp');
        const radioTw = shadow.getElementById('uzt-label-tw');
        
        function updateModeUI() {
            if (localMode === 'twp') {
                radioTwp.classList.add('active');
                radioTw.classList.remove('active');
            } else {
                radioTw.classList.add('active');
                radioTwp.classList.remove('active');
            }
        }
        updateModeUI();

        radioTwp.onclick = () => { localMode = 'twp'; updateModeUI(); };
        radioTw.onclick = () => { localMode = 'tw'; updateModeUI(); };

        // 渲染網域列表
        function renderDomains() {
            const listDiv = shadow.getElementById('uzt-domain-list');
            listDiv.innerHTML = '';
            if (localDomains.length === 0) {
                listDiv.innerHTML = '<div style="text-align:center;color:#888;padding:20px;font-size:13px;">目前沒有設定任何網域</div>';
            } else {
                localDomains.forEach((domain, idx) => {
                    const item = document.createElement('div');
                    item.className = 'uzt-domain-item';
                    
                    const nameSpan = document.createElement('span');
                    nameSpan.className = 'uzt-domain-name';
                    nameSpan.textContent = domain;
                    
                    const delBtn = document.createElement('button');
                    delBtn.className = 'uzt-delete-btn';
                    delBtn.innerHTML = `
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <polyline points="3 6 5 6 21 6"></polyline>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                        </svg>
                    `;
                    delBtn.onclick = () => {
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
            const area = shadow.getElementById('uzt-export-import-area');
            area.value = JSON.stringify(localDomains);
        }

        // 新增目前網站網域按鈕狀態更新
        function updateAddCurrentBtn() {
            const addCurrentBtn = shadow.getElementById('uzt-add-current-btn');
            if (localDomains.includes(currentHost)) {
                addCurrentBtn.textContent = `當前網站已在清單中 (${currentHost})`;
                addCurrentBtn.disabled = true;
                addCurrentBtn.style.opacity = '0.6';
                addCurrentBtn.style.cursor = 'not-allowed';
                addCurrentBtn.onclick = null;
            } else {
                addCurrentBtn.textContent = `➕ 新增目前網站 (${currentHost})`;
                addCurrentBtn.disabled = false;
                addCurrentBtn.style.opacity = '1';
                addCurrentBtn.style.cursor = 'pointer';
                addCurrentBtn.onclick = () => {
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
        const addBtn = shadow.getElementById('uzt-add-btn');
        const newDomainInput = shadow.getElementById('uzt-new-domain');
        
        function handleAddDomain() {
            const val = newDomainInput.value.trim().toLowerCase();
            if (!val) return;
            // 阻擋包含空格或不合法的網域格式
            if (/\s/.test(val) || !val.includes('.')) {
                alert("請輸入合法的網域格式 (例如: google.com)！");
                return;
            }
            if (localDomains.includes(val)) {
                alert("此網域已在清單中。");
                return;
            }
            localDomains.push(val);
            newDomainInput.value = '';
            renderDomains();
            updateExportArea();
            updateAddCurrentBtn();
        }

        addBtn.onclick = handleAddDomain;
        newDomainInput.onkeydown = (e) => {
            if (e.key === 'Enter') {
                handleAddDomain();
            }
        };

        // 複製內容
        const copyBtn = shadow.getElementById('uzt-copy-btn');
        copyBtn.onclick = () => {
            const area = shadow.getElementById('uzt-export-import-area');
            if (!area.value) return;
            navigator.clipboard.writeText(area.value).then(() => {
                const originalText = copyBtn.textContent;
                copyBtn.textContent = "📋 已複製！";
                setTimeout(() => {
                    copyBtn.textContent = originalText;
                }, 1500);
            }).catch(err => {
                alert("複製失敗，請手動複製文字框內的內容。");
            });
        };

        // 匯入網域
        const importBtn = shadow.getElementById('uzt-import-btn');
        importBtn.onclick = () => {
            const area = shadow.getElementById('uzt-export-import-area');
            try {
                const parsed = JSON.parse(area.value.trim());
                if (Array.isArray(parsed) && parsed.every(x => typeof x === 'string')) {
                    const cleaned = parsed.map(x => x.trim().toLowerCase()).filter(Boolean);
                    const unique = [...new Set(cleaned)];
                    
                    localDomains.length = 0;
                    localDomains.push(...unique);
                    renderDomains();
                    updateExportArea();
                    updateAddCurrentBtn();
                    alert("匯入成功！請記得點選下方的「儲存並重整」以套用設定。");
                } else {
                    throw new Error("格式錯誤，必須是字串陣列。例如: [\"example.com\"]");
                }
            } catch (e) {
                alert("匯入失敗: " + e.message);
            }
        };

        // 關閉 Modal
        function closeModal() {
            container.remove();
        }

        shadow.getElementById('uzt-settings-close').onclick = closeModal;
        shadow.getElementById('uzt-cancel-btn').onclick = closeModal;
        
        // 點選遮罩關閉
        overlay.onclick = (e) => {
            if (e.target === overlay) {
                closeModal();
            }
        };

        // 儲存設定並重整
        shadow.getElementById('uzt-save-btn').onclick = () => {
            GM_setValue('translated_domains', localDomains);
            GM_setValue('translation_mode', localMode);
            closeModal();
            location.reload();
        };
    }

})();
