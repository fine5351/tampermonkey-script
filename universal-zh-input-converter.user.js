// ==UserScript==
// @name         Universal-繁簡輸入轉換器-Alt-S
// @namespace    https://github.com/fine5351/
// @version      1.0
// @description  在任何網頁打字時將繁體中文快速轉為簡體輸入：支援輸入框原地快捷鍵（Alt+S）轉換、反白文字快捷轉換複製，以及隨身浮動小視窗（Alt+Shift+S，支援純字形/詞彙轉換即打即轉與一鍵複製）
// @author       fine5351
// @match        *://*/*
// @run-at       document-end
// @require      https://cdn.jsdelivr.net/npm/opencc-js@1.4.0/dist/umd/full.js
// @grant        GM_registerMenuCommand
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_setClipboard
// ==/UserScript==

(function () {
    'use strict';

    // =========================================================================
    // 1. 設定與狀態管理
    // =========================================================================
    const MODE_STORAGE_KEY = 'zh_input_converter_mode';
    // 可選模式: 'tw' (純字形轉換，預設) 或 'twp' (包含兩岸常用詞彙轉換)
    let currentMode = GM_getValue(MODE_STORAGE_KEY, 'tw');

    // 轉換器快取
    let charConverter = null;    // tw -> cn (純字形)
    let phraseConverter = null;  // twp -> cn (詞彙)
    let reverseConverter = null; // cn -> tw (簡轉繁，供小工具互換)

    function initConverters() {
        if (typeof OpenCC === 'undefined' || !OpenCC.Converter) {
            console.error('[ZH-Input-Converter] OpenCC 函式庫未載入！');
            return false;
        }
        try {
            if (!charConverter) {
                charConverter = OpenCC.Converter({ from: 'tw', to: 'cn' });
            }
            if (!phraseConverter) {
                phraseConverter = OpenCC.Converter({ from: 'twp', to: 'cn' });
            }
            if (!reverseConverter) {
                reverseConverter = OpenCC.Converter({ from: 'cn', to: 'tw' });
            }
            return true;
        } catch (err) {
            console.error('[ZH-Input-Converter] 初始化 OpenCC 轉換器失敗:', err);
            return false;
        }
    }

    // 繁轉簡核心函式
    function convertToSimplified(text, mode) {
        if (!initConverters()) return text;
        const targetMode = mode || currentMode;
        const converter = (targetMode === 'twp') ? phraseConverter : charConverter;
        return converter(text);
    }

    // 簡轉繁核心函式（工具箱互換用）
    function convertToTraditional(text) {
        if (!initConverters()) return text;
        return reverseConverter(text);
    }

    // =========================================================================
    // 2. Toast 提示通知組件 (Shadow DOM 封裝，避免污染與受宿主影響)
    // =========================================================================
    let toastContainer = null;
    let toastShadow = null;
    let toastTimeout = null;

    function ensureToastContainer() {
        if (!toastContainer) {
            toastContainer = document.createElement('div');
            toastContainer.id = 'uz-toast-host';
            toastShadow = toastContainer.attachShadow({ mode: 'open' });
            const style = document.createElement('style');
            style.textContent = `
                .uz-toast {
                    position: fixed;
                    bottom: 28px;
                    left: 50%;
                    transform: translateX(-50%) translateY(20px);
                    background: rgba(26, 26, 26, 0.92);
                    color: #ffffff;
                    padding: 10px 20px;
                    border-radius: 24px;
                    font-size: 13px;
                    font-weight: 500;
                    letter-spacing: 0.2px;
                    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.25);
                    backdrop-filter: blur(12px);
                    -webkit-backdrop-filter: blur(12px);
                    border: 1px solid rgba(255, 255, 255, 0.15);
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    opacity: 0;
                    pointer-events: none;
                    transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
                    z-index: 2147483647;
                    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
                }
                .uz-toast.show {
                    opacity: 1;
                    transform: translateX(-50%) translateY(0);
                    pointer-events: auto;
                }
                .uz-toast-icon {
                    font-size: 15px;
                }
            `;
            toastShadow.appendChild(style);

            const toastDiv = document.createElement('div');
            toastDiv.className = 'uz-toast';
            toastDiv.id = 'uz-toast-elem';
            toastShadow.appendChild(toastDiv);

            (document.body || document.documentElement).appendChild(toastContainer);
        }
    }

    function showToast(message, type = 'info') {
        ensureToastContainer();
        const toastDiv = toastShadow.getElementById('uz-toast-elem');
        if (!toastDiv) return;

        let icon = 'ℹ️';
        if (type === 'success') icon = '✅';
        if (type === 'warn') icon = '⚠️';
        if (type === 'clipboard') icon = '📋';

        toastDiv.innerHTML = `<span class="uz-toast-icon">${icon}</span><span>${message}</span>`;
        toastDiv.classList.add('show');

        if (toastTimeout) clearTimeout(toastTimeout);
        toastTimeout = setTimeout(() => {
            toastDiv.classList.remove('show');
        }, 1800);
    }

    // 複製文字至剪貼簿（相容 GM_setClipboard 與原生 API）
    function copyToClipboard(text) {
        if (typeof GM_setClipboard === 'function') {
            GM_setClipboard(text, 'text');
            return true;
        }
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(text);
            return true;
        }
        return false;
    }

    // =========================================================================
    // 3. 原地輸入框轉換邏輯 (In-place Replacement)
    // =========================================================================

    // 觸發原生 input 與 change 事件，確保相容 React / Vue / Angular 雙向綁定
    function setNativeInputValue(element, value) {
        const isTextarea = element instanceof HTMLTextAreaElement;
        const proto = isTextarea ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
        const descriptor = Object.getOwnPropertyDescriptor(proto, 'value');

        if (descriptor && descriptor.set) {
            descriptor.set.call(element, value);
        } else {
            element.value = value;
        }
        element.dispatchEvent(new Event('input', { bubbles: true }));
        element.dispatchEvent(new Event('change', { bubbles: true }));
    }

    // 處理常規 <input> 與 <textarea>
    function handleInputOrTextarea(el) {
        const start = el.selectionStart;
        const end = el.selectionEnd;
        const val = el.value;

        if (!val) {
            showToast('輸入框為空', 'warn');
            return;
        }

        const isPartial = (start !== null && end !== null && start !== end);
        const textToConvert = isPartial ? val.substring(start, end) : val;

        if (!/[\u4e00-\u9fa5]/.test(textToConvert)) {
            showToast('沒有偵測到中文文字', 'info');
            return;
        }

        const converted = convertToSimplified(textToConvert);
        if (converted === textToConvert) {
            showToast('內容已是簡體或無須轉換', 'info');
            return;
        }

        el.focus();

        // 優先使用 execCommand('insertText')，可完整保留 Undo (Ctrl+Z) 紀錄並觸發輸入事件
        let replaced = false;
        try {
            if (!isPartial) {
                el.select();
            }
            replaced = document.execCommand('insertText', false, converted);
        } catch (e) {
            replaced = false;
        }

        // 檢查 execCommand 是否實際生效，若未生效則以 setNativeInputValue 降級執行
        const expectedVal = isPartial
            ? (val.substring(0, start) + converted + val.substring(end))
            : converted;

        if (!replaced || el.value !== expectedVal) {
            setNativeInputValue(el, expectedVal);
            if (isPartial) {
                el.setSelectionRange(start, start + converted.length);
            }
        }

        const modeLabel = currentMode === 'twp' ? '詞彙模式' : '字形模式';
        showToast(`已原地轉為簡體 (${modeLabel})`, 'success');
    }

    // 處理 contenteditable 富文本編輯器 (如 Notion、Slack、Discord、Twitter、Facebook 等)
    function handleContentEditable(el) {
        const selection = window.getSelection();
        if (!selection || selection.rangeCount === 0) return;

        const selectedText = selection.toString();

        if (selectedText && /[\u4e00-\u9fa5]/.test(selectedText)) {
            // 有反白選取文字
            const converted = convertToSimplified(selectedText);
            if (converted === selectedText) {
                showToast('選取內容已是簡體', 'info');
                return;
            }
            let success = false;
            try {
                success = document.execCommand('insertText', false, converted);
            } catch (e) {
                success = false;
            }
            if (!success) {
                const range = selection.getRangeAt(0);
                range.deleteContents();
                range.insertNode(document.createTextNode(converted));
            }
            showToast('選取文字已轉為簡體', 'success');
        } else {
            // 游標在編輯器內但未選取文字
            showToast('請先反白選取欲轉換的繁體文字，再按 Alt+S', 'warn');
        }
    }

    // 處理非編輯區域的普通文字選取（反白網頁文字按 Alt+S 直接轉為簡體並複製）
    function handleGeneralSelection() {
        const selection = window.getSelection();
        const text = selection ? selection.toString() : '';

        if (text && /[\u4e00-\u9fa5]/.test(text)) {
            const converted = convertToSimplified(text);
            copyToClipboard(converted);
            showToast('已轉為簡體並複製到剪貼簿！', 'clipboard');
            return true;
        }
        return false;
    }

    // 執行原地轉換的主路由
    function triggerInPlaceConversion() {
        const active = document.activeElement;

        // 檢查是否為密碼框，如果是則出於安全考慮略過
        if (active && active.tagName === 'INPUT' && active.type && active.type.toLowerCase() === 'password') {
            return false;
        }

        // 1. <input> 或 <textarea>
        if (active && (active.tagName === 'TEXTAREA' || (active.tagName === 'INPUT' && active.type !== 'file'))) {
            handleInputOrTextarea(active);
            return true;
        }

        // 2. contenteditable 元素
        if (active && active.isContentEditable) {
            handleContentEditable(active);
            return true;
        }

        // 3. 一般選取文字（轉簡體並複製到剪貼簿）
        if (handleGeneralSelection()) {
            return true;
        }

        // 4. 若皆無焦點且無選取，不攔截，讓其他腳本（如影片截圖 Alt+S）正常接收
        return false;
    }

    // =========================================================================
    // 4. 隨身浮動轉換工具箱視窗 (Shadow DOM 封裝)
    // =========================================================================
    let modalContainer = null;
    let modalShadow = null;
    let isModalOpen = false;

    function createModalUI() {
        if (modalContainer) return;

        modalContainer = document.createElement('div');
        modalContainer.id = 'uz-modal-host';
        modalShadow = modalContainer.attachShadow({ mode: 'open' });

        const style = document.createElement('style');
        style.textContent = `
            * {
                box-sizing: border-box;
                margin: 0;
                padding: 0;
            }
            #uz-modal-overlay {
                position: fixed;
                top: 0;
                left: 0;
                width: 100vw;
                height: 100vh;
                background: rgba(0, 0, 0, 0.4);
                backdrop-filter: blur(4px);
                -webkit-backdrop-filter: blur(4px);
                z-index: 2147483646;
                display: flex;
                align-items: center;
                justify-content: center;
                opacity: 0;
                visibility: hidden;
                transition: opacity 0.2s ease, visibility 0.2s ease;
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
            }
            #uz-modal-overlay.active {
                opacity: 1;
                visibility: visible;
            }
            #uz-modal-card {
                background: rgba(255, 255, 255, 0.95);
                backdrop-filter: blur(20px);
                -webkit-backdrop-filter: blur(20px);
                border: 1px solid rgba(255, 255, 255, 0.5);
                border-radius: 16px;
                width: 480px;
                max-width: 92vw;
                box-shadow: 0 16px 40px rgba(0, 0, 0, 0.22);
                display: flex;
                flex-direction: column;
                overflow: hidden;
                transform: scale(0.95) translateY(10px);
                transition: transform 0.2s cubic-bezier(0.16, 1, 0.3, 1);
                color: #262626;
            }
            #uz-modal-overlay.active #uz-modal-card {
                transform: scale(1) translateY(0);
            }
            /* 標題列與拖曳 */
            #uz-modal-header {
                padding: 14px 18px;
                background: rgba(245, 246, 250, 0.9);
                border-bottom: 1px solid rgba(0, 0, 0, 0.08);
                display: flex;
                align-items: center;
                justify-content: space-between;
                cursor: grab;
                user-select: none;
            }
            #uz-modal-header:active {
                cursor: grabbing;
            }
            .header-title-wrap {
                display: flex;
                align-items: center;
                gap: 8px;
            }
            .header-title {
                font-size: 15px;
                font-weight: 600;
                color: #1a1a1a;
            }
            /* 模式切換按鈕 */
            .mode-switch-badge {
                display: flex;
                background: #e2e8f0;
                border-radius: 20px;
                padding: 2px;
                cursor: pointer;
            }
            .mode-btn {
                padding: 3px 10px;
                font-size: 11px;
                font-weight: 500;
                border-radius: 16px;
                border: none;
                background: transparent;
                color: #64748b;
                cursor: pointer;
                transition: all 0.15s ease;
            }
            .mode-btn.active {
                background: #ffffff;
                color: #3b82f6;
                box-shadow: 0 1px 4px rgba(0, 0, 0, 0.12);
                font-weight: 600;
            }
            .close-btn {
                background: transparent;
                border: none;
                font-size: 18px;
                color: #8c8c8c;
                cursor: pointer;
                width: 28px;
                height: 28px;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                transition: background 0.15s, color 0.15s;
            }
            .close-btn:hover {
                background: rgba(0, 0, 0, 0.06);
                color: #ff4d4f;
            }
            /* 內容區域 */
            #uz-modal-body {
                padding: 16px 18px;
                display: flex;
                flex-direction: column;
                gap: 12px;
            }
            .area-block {
                display: flex;
                flex-direction: column;
                gap: 6px;
            }
            .area-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
            }
            .area-label {
                font-size: 12px;
                font-weight: 600;
                color: #595959;
                display: flex;
                align-items: center;
                gap: 4px;
            }
            .sub-action-btn {
                background: none;
                border: none;
                font-size: 11px;
                color: #3b82f6;
                cursor: pointer;
                padding: 2px 6px;
                border-radius: 4px;
            }
            .sub-action-btn:hover {
                background: rgba(59, 130, 246, 0.08);
            }
            .uz-textarea {
                width: 100%;
                height: 86px;
                padding: 10px 12px;
                border-radius: 8px;
                border: 1px solid #d9d9d9;
                background: #fafafa;
                font-size: 13.5px;
                line-height: 1.5;
                color: #1f2937;
                resize: vertical;
                font-family: inherit;
                outline: none;
                transition: border-color 0.2s, background 0.2s;
            }
            .uz-textarea:focus {
                border-color: #3b82f6;
                background: #ffffff;
                box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.15);
            }
            /* 中間工具條 */
            .middle-bar {
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding: 2px 0;
            }
            .mode-hint {
                font-size: 11px;
                color: #8c8c8c;
            }
            .swap-btn {
                background: #f0f5ff;
                border: 1px solid #adc6ff;
                color: #2f54eb;
                padding: 3px 10px;
                border-radius: 6px;
                font-size: 11.5px;
                font-weight: 500;
                cursor: pointer;
                display: flex;
                align-items: center;
                gap: 4px;
                transition: all 0.15s;
            }
            .swap-btn:hover {
                background: #d6e4ff;
            }
            /* 底部動作列 */
            #uz-modal-footer {
                padding: 12px 18px 16px;
                display: flex;
                align-items: center;
                justify-content: space-between;
                border-top: 1px solid rgba(0, 0, 0, 0.06);
                background: rgba(250, 250, 250, 0.6);
            }
            .shortcut-hint {
                font-size: 11px;
                color: #8c8c8c;
            }
            .shortcut-key {
                background: #e8e8e8;
                border-radius: 4px;
                padding: 1px 5px;
                font-size: 10.5px;
                font-family: monospace;
            }
            .copy-primary-btn {
                background: linear-gradient(135deg, #3b82f6, #2563eb);
                color: #ffffff;
                border: none;
                padding: 8px 18px;
                border-radius: 8px;
                font-size: 13px;
                font-weight: 600;
                cursor: pointer;
                display: flex;
                align-items: center;
                gap: 6px;
                box-shadow: 0 4px 12px rgba(37, 99, 235, 0.25);
                transition: all 0.15s ease;
            }
            .copy-primary-btn:hover {
                transform: translateY(-1px);
                box-shadow: 0 6px 16px rgba(37, 99, 235, 0.35);
            }
            .copy-primary-btn:active {
                transform: translateY(0);
            }
        `;
        modalShadow.appendChild(style);

        const overlay = document.createElement('div');
        overlay.id = 'uz-modal-overlay';
        overlay.innerHTML = `
            <div id="uz-modal-card">
                <div id="uz-modal-header">
                    <div class="header-title-wrap">
                        <span style="font-size: 16px;">🔤</span>
                        <span class="header-title">繁簡轉換工具箱</span>
                    </div>
                    <div class="mode-switch-badge">
                        <button class="mode-btn ${currentMode === 'tw' ? 'active' : ''}" id="uz-mode-char" title="僅純字形轉換，保留台灣習慣用語">純字形 (tw)</button>
                        <button class="mode-btn ${currentMode === 'twp' ? 'active' : ''}" id="uz-mode-phrase" title="包含兩岸常用詞彙與慣用語轉換">兩岸詞彙 (twp)</button>
                    </div>
                    <button class="close-btn" id="uz-modal-close" title="關閉 (Esc)">&times;</button>
                </div>
                <div id="uz-modal-body">
                    <div class="area-block">
                        <div class="area-header">
                            <span class="area-label">繁體中文（輸入）</span>
                            <button class="sub-action-btn" id="uz-clear-btn">清空</button>
                        </div>
                        <textarea class="uz-textarea" id="uz-source-input" placeholder="在此輸入或貼上繁體中文...（支援即打即轉）"></textarea>
                    </div>
                    <div class="middle-bar">
                        <span class="mode-hint" id="uz-mode-desc">${getModeDescription(currentMode)}</span>
                        <button class="swap-btn" id="uz-swap-btn" title="將簡體反向轉換為繁體">🔁 簡繁互換</button>
                    </div>
                    <div class="area-block">
                        <div class="area-header">
                            <span class="area-label">簡體中文（結果）</span>
                            <span class="mode-hint" id="uz-char-count">0 字</span>
                        </div>
                        <textarea class="uz-textarea" id="uz-target-output" placeholder="簡體結果即時產生於此..."></textarea>
                    </div>
                </div>
                <div id="uz-modal-footer">
                    <span class="shortcut-hint">
                        提示: <span class="shortcut-key">Ctrl+Enter</span> 複製簡體並關閉
                    </span>
                    <button class="copy-primary-btn" id="uz-copy-btn">
                        <span>📋</span>
                        <span>複製簡體</span>
                    </button>
                </div>
            </div>
        `;
        modalShadow.appendChild(overlay);
        (document.body || document.documentElement).appendChild(modalContainer);

        setupModalEvents();
    }

    function getModeDescription(mode) {
        if (mode === 'twp') {
            return '當前模式：兩岸詞彙轉換（例：軟體 ➔ 软件、滑鼠 ➔ 鼠标）';
        }
        return '當前模式：純字形轉換（例：軟體 ➔ 软体，保留原用語）';
    }

    function setupModalEvents() {
        const overlay = modalShadow.getElementById('uz-modal-overlay');
        const card = modalShadow.getElementById('uz-modal-card');
        const closeBtn = modalShadow.getElementById('uz-modal-close');
        const sourceInput = modalShadow.getElementById('uz-source-input');
        const targetOutput = modalShadow.getElementById('uz-target-output');
        const modeCharBtn = modalShadow.getElementById('uz-mode-char');
        const modePhraseBtn = modalShadow.getElementById('uz-mode-phrase');
        const modeDesc = modalShadow.getElementById('uz-mode-desc');
        const clearBtn = modalShadow.getElementById('uz-clear-btn');
        const copyBtn = modalShadow.getElementById('uz-copy-btn');
        const swapBtn = modalShadow.getElementById('uz-swap-btn');
        const charCount = modalShadow.getElementById('uz-char-count');
        const header = modalShadow.getElementById('uz-modal-header');

        function doConvert() {
            const val = sourceInput.value;
            charCount.textContent = `${val.length} 字`;
            if (!val) {
                targetOutput.value = '';
                return;
            }
            targetOutput.value = convertToSimplified(val, currentMode);
        }

        sourceInput.addEventListener('input', doConvert);

        function updateModeUI(newMode) {
            currentMode = newMode;
            GM_setValue(MODE_STORAGE_KEY, newMode);
            modeCharBtn.classList.toggle('active', newMode === 'tw');
            modePhraseBtn.classList.toggle('active', newMode === 'twp');
            modeDesc.textContent = getModeDescription(newMode);
            doConvert();
        }

        modeCharBtn.addEventListener('click', () => updateModeUI('tw'));
        modePhraseBtn.addEventListener('click', () => updateModeUI('twp'));

        clearBtn.addEventListener('click', () => {
            sourceInput.value = '';
            targetOutput.value = '';
            charCount.textContent = '0 字';
            sourceInput.focus();
        });

        function performCopyAndClose() {
            const text = targetOutput.value;
            if (!text) {
                showToast('無簡體內容可複製', 'warn');
                return;
            }
            copyToClipboard(text);
            showToast('已複製簡體至剪貼簿！', 'clipboard');
            closeModal();
        }

        copyBtn.addEventListener('click', performCopyAndClose);

        // 簡繁互換功能
        swapBtn.addEventListener('click', () => {
            const currentSimp = targetOutput.value || sourceInput.value;
            if (!currentSimp) return;
            const convertedTrad = convertToTraditional(currentSimp);
            sourceInput.value = convertedTrad;
            doConvert();
            showToast('已完成簡轉繁互換', 'info');
        });

        // 點擊背景遮罩關閉
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                closeModal();
            }
        });

        closeBtn.addEventListener('click', closeModal);

        // 快速鍵: Ctrl + Enter 複製並關閉，Esc 關閉
        card.addEventListener('keydown', (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                e.preventDefault();
                performCopyAndClose();
            } else if (e.key === 'Escape') {
                e.preventDefault();
                closeModal();
            }
        });

        // 拖曳視窗支援
        let isDragging = false;
        let startX, startY, initialLeft, initialTop;

        header.addEventListener('mousedown', (e) => {
            if (e.target.closest('button')) return;
            isDragging = true;
            const rect = card.getBoundingClientRect();
            startX = e.clientX;
            startY = e.clientY;
            initialLeft = rect.left;
            initialTop = rect.top;

            // 切換為 absolute 定位
            card.style.margin = '0';
            card.style.position = 'fixed';
            card.style.left = `${initialLeft}px`;
            card.style.top = `${initialTop}px`;
            card.style.transform = 'none';

            function onMouseMove(moveEvent) {
                if (!isDragging) return;
                const dx = moveEvent.clientX - startX;
                const dy = moveEvent.clientY - startY;
                card.style.left = `${Math.max(10, Math.min(window.innerWidth - rect.width - 10, initialLeft + dx))}px`;
                card.style.top = `${Math.max(10, Math.min(window.innerHeight - rect.height - 10, initialTop + dy))}px`;
            }

            function onMouseUp() {
                isDragging = false;
                window.removeEventListener('mousemove', onMouseMove);
                window.removeEventListener('mouseup', onMouseUp);
            }

            window.addEventListener('mousemove', onMouseMove);
            window.addEventListener('mouseup', onMouseUp);
        });
    }

    function openModal() {
        createModalUI();
        const overlay = modalShadow.getElementById('uz-modal-overlay');
        const sourceInput = modalShadow.getElementById('uz-source-input');
        const targetOutput = modalShadow.getElementById('uz-target-output');
        const charCount = modalShadow.getElementById('uz-char-count');

        // 若開啟時畫面上已有選取文字，自動帶入
        const selectionText = window.getSelection() ? window.getSelection().toString() : '';
        if (selectionText && /[\u4e00-\u9fa5]/.test(selectionText)) {
            sourceInput.value = selectionText;
            targetOutput.value = convertToSimplified(selectionText, currentMode);
            charCount.textContent = `${selectionText.length} 字`;
        }

        overlay.classList.add('active');
        isModalOpen = true;

        setTimeout(() => {
            sourceInput.focus();
            if (sourceInput.value) {
                sourceInput.select();
            }
        }, 100);
    }

    function closeModal() {
        if (!modalShadow) return;
        const overlay = modalShadow.getElementById('uz-modal-overlay');
        if (overlay) {
            overlay.classList.remove('active');
        }
        isModalOpen = false;
    }

    function toggleModal() {
        if (isModalOpen) {
            closeModal();
        } else {
            openModal();
        }
    }

    // =========================================================================
    // 5. 全域鍵盤快捷鍵監聽
    // =========================================================================
    window.addEventListener('keydown', function (e) {
        // 輸入法組合期間 (IME) 不觸發
        if (e.isComposing) return;

        // Alt + Shift + S: 開啟 / 關閉隨身浮動轉換工具箱
        if (e.code === 'KeyS' && e.altKey && e.shiftKey && !e.ctrlKey && !e.metaKey) {
            e.preventDefault();
            e.stopPropagation();
            toggleModal();
            return;
        }

        // Alt + S: 輸入框原地轉換 / 反白文字轉簡體並複製
        if (e.code === 'KeyS' && e.altKey && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
            // 如果浮動視窗已開，交由視窗內部處理
            if (isModalOpen) return;
            const handled = triggerInPlaceConversion();
            if (handled) {
                e.preventDefault();
                e.stopPropagation();
            }
            return;
        }

        // Esc: 關閉浮動視窗
        if (e.key === 'Escape' && isModalOpen) {
            e.preventDefault();
            closeModal();
        }
    }, true);

    // =========================================================================
    // 6. 註冊 Tampermonkey 選單命令
    // =========================================================================
    function updateMenuCommands() {
        const modeLabel = currentMode === 'tw' ? '純字形 (tw)' : '兩岸詞彙 (twp)';

        GM_registerMenuCommand('🔤 開啟繁簡轉換工具箱 (Alt+Shift+S)', () => {
            openModal();
        });

        GM_registerMenuCommand(`🔄 切換預設模式 [目前: ${modeLabel}]`, () => {
            const nextMode = currentMode === 'tw' ? 'twp' : 'tw';
            currentMode = nextMode;
            GM_setValue(MODE_STORAGE_KEY, nextMode);
            const desc = nextMode === 'tw' ? '純字形模式 (tw，保留習慣用語)' : '兩岸詞彙模式 (twp，含慣用語轉換)';
            showToast(`已切換預設為：${desc}`, 'success');
        });
    }

    updateMenuCommands();

    console.log('[ZH-Input-Converter] 繁簡輸入轉換器已載入 (Alt+S 原地轉換, Alt+Shift+S 工具箱)');
})();
