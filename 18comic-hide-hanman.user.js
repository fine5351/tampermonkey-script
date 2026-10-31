// ==UserScript==
// @name         18comic-韓漫過濾與標籤屏蔽-Alt-H
// @namespace    https://github.com/
// @version      1.0
// @description  在 18comic (禁漫天堂) 自動過濾或隱藏「韓漫」作品卡片與標籤，支援即時統計、整本漫畫隱藏與純標籤隱藏雙模式切換、自訂關鍵字與動態載入監聽
// @author       Antigravity
// @match        *://*.18comic.vip/*
// @match        *://*.18comic.org/*
// @match        *://*.jmcomic.me/*
// @match        *://*.jmcomic1.me/*
// @match        *://*.jmcomic2.me/*
// @match        *://*.jmcomic3.me/*
// @match        *://*.jmcomic.mobi/*
// @match        *://*.jmcomic.club/*
// @run-at       document-end
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
// ==/UserScript==

(function () {
    'use strict';

    // --- Trusted Types 策略支援 (相容 CSP 嚴格網站) ---
    let htmlPolicy = null;
    if (window.trustedTypes && window.trustedTypes.createPolicy) {
        try {
            htmlPolicy = window.trustedTypes.createPolicy('c18FilterPolicy', {
                createHTML: (s) => s
            });
        } catch (e) {
            htmlPolicy = (window.trustedTypes.getPolicy && window.trustedTypes.getPolicy('c18FilterPolicy')) || { createHTML: (s) => s };
        }
    }

    function setSafeHTML(elem, html) {
        if (htmlPolicy) {
            elem.innerHTML = htmlPolicy.createHTML(html);
        } else {
            try {
                elem.innerHTML = html;
            } catch (e) {
                const parser = new DOMParser();
                const doc = parser.parseFromString(html, 'text/html');
                elem.textContent = '';
                while (doc.body.firstChild) {
                    elem.appendChild(doc.body.firstChild);
                }
            }
        }
    }

    // --- 設定管理 ---
    const STORAGE_KEY = 'c18_hanman_filter_config';
    const DEFAULT_CONFIG = {
        enabled: true,
        mode: 'card', // 'card': 隱藏整本漫畫卡片, 'tag': 僅隱藏韓漫標籤元素
        keywords: ['韓漫', '韩漫', '韓國漫畫', '韩国漫画'],
        showBadge: true
    };

    function loadConfig() {
        const stored = GM_getValue(STORAGE_KEY, null);
        if (!stored) return { ...DEFAULT_CONFIG };
        try {
            return { ...DEFAULT_CONFIG, ...(typeof stored === 'string' ? JSON.parse(stored) : stored) };
        } catch (e) {
            return { ...DEFAULT_CONFIG };
        }
    }

    function saveConfig(cfg) {
        GM_setValue(STORAGE_KEY, cfg);
    }

    let config = loadConfig();

    // --- 樣式注入 ---
    function injectStyles() {
        if (document.getElementById('c18-filter-style')) return;
        const style = document.createElement('style');
        style.id = 'c18-filter-style';
        style.textContent = `
            .c18-filtered-hidden {
                display: none !important;
            }
            #c18-filter-badge {
                position: fixed;
                bottom: 24px;
                left: 24px;
                background: rgba(24, 24, 27, 0.92);
                color: #f4f4f5;
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
                font-size: 13px;
                font-weight: 500;
                padding: 7px 14px;
                border-radius: 9999px;
                border: 1px solid rgba(255, 153, 0, 0.5);
                box-shadow: 0 4px 14px rgba(0, 0, 0, 0.35);
                backdrop-filter: blur(8px);
                z-index: 2147483630;
                display: flex;
                align-items: center;
                gap: 8px;
                cursor: pointer;
                user-select: none;
                transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
            }
            #c18-filter-badge:hover {
                background: rgba(39, 39, 42, 0.98);
                border-color: #ff9900;
                transform: translateY(-2px);
                box-shadow: 0 6px 18px rgba(255, 153, 0, 0.25);
            }
            #c18-filter-badge.c18-badge-disabled {
                border-color: rgba(161, 161, 170, 0.3);
                color: #a1a1aa;
            }
            .c18-gear-btn {
                display: inline-flex;
                align-items: center;
                justify-content: center;
                padding: 2px 4px;
                border-radius: 4px;
                color: #ff9900;
                transition: transform 0.2s ease;
            }
            .c18-gear-btn:hover {
                transform: rotate(45deg);
            }
            #c18-filter-modal-overlay {
                position: fixed;
                top: 0;
                left: 0;
                width: 100vw;
                height: 100vh;
                background: rgba(0, 0, 0, 0.65);
                backdrop-filter: blur(4px);
                z-index: 2147483640;
                display: flex;
                align-items: center;
                justify-content: center;
                animation: c18-fade-in 0.18s ease-out;
            }
            @keyframes c18-fade-in {
                from { opacity: 0; }
                to { opacity: 1; }
            }
            #c18-filter-modal {
                background: #18181b;
                color: #f4f4f5;
                width: 90%;
                max-width: 480px;
                border-radius: 12px;
                border: 1px solid rgba(255, 255, 255, 0.12);
                box-shadow: 0 20px 40px rgba(0, 0, 0, 0.5);
                padding: 22px;
                box-sizing: border-box;
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
            }
            .c18-modal-header {
                display: flex;
                align-items: center;
                justify-content: space-between;
                border-bottom: 1px solid rgba(255, 255, 255, 0.1);
                padding-bottom: 12px;
                margin-bottom: 16px;
            }
            .c18-modal-title {
                font-size: 16px;
                font-weight: 600;
                color: #ff9900;
                display: flex;
                align-items: center;
                gap: 8px;
            }
            .c18-modal-close {
                background: transparent;
                border: none;
                color: #a1a1aa;
                font-size: 20px;
                cursor: pointer;
                line-height: 1;
                padding: 4px;
            }
            .c18-modal-close:hover {
                color: #ffffff;
            }
            .c18-form-group {
                margin-bottom: 16px;
            }
            .c18-form-label {
                display: block;
                font-size: 13px;
                font-weight: 500;
                margin-bottom: 6px;
                color: #e4e4e7;
            }
            .c18-radio-group {
                display: flex;
                flex-direction: column;
                gap: 8px;
                margin-top: 6px;
            }
            .c18-radio-item {
                display: flex;
                align-items: flex-start;
                gap: 8px;
                background: rgba(255, 255, 255, 0.04);
                padding: 8px 12px;
                border-radius: 8px;
                cursor: pointer;
                border: 1px solid transparent;
                transition: all 0.15s ease;
            }
            .c18-radio-item:hover {
                background: rgba(255, 255, 255, 0.08);
                border-color: rgba(255, 153, 0, 0.3);
            }
            .c18-radio-item input {
                margin-top: 3px;
                accent-color: #ff9900;
                cursor: pointer;
            }
            .c18-radio-desc {
                font-size: 12px;
                color: #a1a1aa;
                margin-top: 2px;
            }
            .c18-input-text {
                width: 100%;
                background: #27272a;
                border: 1px solid #3f3f46;
                color: #f4f4f5;
                padding: 8px 12px;
                border-radius: 6px;
                font-size: 13px;
                box-sizing: border-box;
                outline: none;
                transition: border-color 0.2s;
            }
            .c18-input-text:focus {
                border-color: #ff9900;
            }
            .c18-modal-footer {
                display: flex;
                justify-content: flex-end;
                gap: 10px;
                margin-top: 20px;
                border-top: 1px solid rgba(255, 255, 255, 0.1);
                padding-top: 14px;
            }
            .c18-btn {
                padding: 7px 16px;
                border-radius: 6px;
                font-size: 13px;
                font-weight: 500;
                cursor: pointer;
                transition: all 0.15s ease;
                border: none;
            }
            .c18-btn-secondary {
                background: #27272a;
                color: #d4d4d8;
            }
            .c18-btn-secondary:hover {
                background: #3f3f46;
                color: #ffffff;
            }
            .c18-btn-primary {
                background: #ff9900;
                color: #18181b;
                font-weight: 600;
            }
            .c18-btn-primary:hover {
                background: #e68a00;
            }
        `;
        (document.head || document.documentElement).appendChild(style);
    }

    // --- 清除所有過濾狀態 ---
    function unhideAll() {
        document.querySelectorAll('.c18-filtered-hidden').forEach(el => {
            el.classList.remove('c18-filtered-hidden');
            el.removeAttribute('data-c18-filtered');
        });
    }

    // --- 尋找最合適的作品卡片外層容器 (Bootstrap Grid Column / Card Container) ---
    function findComicCard(startElem) {
        if (!startElem) return null;

        // 優先尋找 Bootstrap 的格線欄位或專屬卡片容器
        let card = startElem.closest('.col-xs-6, .col-xs-4, .col-sm-6, .col-sm-4, .col-sm-3, .col-md-4, .col-md-3, .col-md-2, .col-lg-3, .col-lg-2, .thumb-overlay-albums, .well-sm');
        if (!card) {
            const col = startElem.closest('[class*="col-"]');
            if (col && !col.classList.contains('col-xs-12') && !col.classList.contains('col-md-12') && !col.classList.contains('col-12')) {
                card = col;
            }
        }
        if (!card) {
            card = startElem.closest('.well, .thumb-overlay') || startElem.parentElement;
        }

        // 防禦措施：若 card 內包含超過 3 本不同漫畫連結，代表誤選到了外層整列 row 或 list 容器，退回就近容器
        if (card) {
            const links = card.querySelectorAll('a[href*="/album/"]');
            const uniqueHrefs = new Set(Array.from(links).map(l => l.getAttribute('href')));
            if (uniqueHrefs.size > 2) {
                card = startElem.closest('.well, .thumb-overlay, .thumb-overlay-albums') || startElem.parentElement;
            }
        }

        return card;
    }

    // --- 核心過濾掃描邏輯 ---
    let lastHiddenCount = 0;

    function scanAndFilter() {
        if (!config.enabled) {
            unhideAll();
            updateBadge(0);
            return;
        }

        const keywords = (config.keywords || []).map(k => k.trim().toLowerCase()).filter(Boolean);
        if (keywords.length === 0) {
            unhideAll();
            updateBadge(0);
            return;
        }

        // 先移除無效或舊的過濾標記以利重新評估
        const previousFiltered = document.querySelectorAll('[data-c18-filtered]');
        previousFiltered.forEach(el => {
            el.classList.remove('c18-filtered-hidden');
            el.removeAttribute('data-c18-filtered');
        });

        const albumLinks = document.querySelectorAll('a[href*="/album/"]');
        const processedCards = new Set();
        let filteredCount = 0;

        albumLinks.forEach(link => {
            const card = findComicCard(link);
            if (!card || processedCards.has(card)) return;
            processedCards.add(card);

            let isTarget = false;
            let matchedTagElems = [];

            // 1. 檢測卡片內部的標籤與分類元素
            const tagSelectors = 'a[href*="tag"], a[href*="category"], .label, .badge, .label-category, .label-tag, .tag, [class*="tag-"]';
            const tagElements = card.querySelectorAll(tagSelectors);

            tagElements.forEach(tagEl => {
                const text = (tagEl.textContent || '').trim().toLowerCase();
                const href = decodeURIComponent(tagEl.getAttribute('href') || '').toLowerCase();
                for (const kw of keywords) {
                    if (text === kw || text.includes(kw) || href.includes(kw)) {
                        isTarget = true;
                        matchedTagElems.push(tagEl);
                        break;
                    }
                }
            });

            // 2. 檢測卡片標題文字 (例如 [韓漫]、(韓漫)、【韓漫】等常見格式)
            const titleElem = card.querySelector('.title-truncate, .video-title, [class*="title"]') || link;
            const titleText = ((titleElem.textContent || '') + ' ' + (titleElem.getAttribute('title') || '')).toLowerCase();
            for (const kw of keywords) {
                if (titleText.includes(kw)) {
                    isTarget = true;
                    break;
                }
            }

            // 3. 依據模式執行隱藏
            if (isTarget) {
                if (config.mode === 'card') {
                    card.classList.add('c18-filtered-hidden');
                    card.setAttribute('data-c18-filtered', 'card');
                    filteredCount++;
                } else if (config.mode === 'tag') {
                    if (matchedTagElems.length > 0) {
                        matchedTagElems.forEach(t => {
                            t.classList.add('c18-filtered-hidden');
                            t.setAttribute('data-c18-filtered', 'tag');
                        });
                        filteredCount++;
                    }
                }
            }
        });

        // 若為純標籤隱藏模式，額外掃描頁面上其他可能未在卡片內的獨立標籤區（如詳細頁標籤區）
        if (config.mode === 'tag') {
            const standaloneTags = document.querySelectorAll('a[href*="tag"], a[href*="category"], .label, .badge');
            standaloneTags.forEach(tagEl => {
                if (tagEl.hasAttribute('data-c18-filtered')) return;
                const text = (tagEl.textContent || '').trim().toLowerCase();
                const href = decodeURIComponent(tagEl.getAttribute('href') || '').toLowerCase();
                for (const kw of keywords) {
                    if (text === kw || text.includes(kw) || href.includes(kw)) {
                        tagEl.classList.add('c18-filtered-hidden');
                        tagEl.setAttribute('data-c18-filtered', 'tag');
                        filteredCount++;
                        break;
                    }
                }
            });
        }

        lastHiddenCount = filteredCount;
        updateBadge(filteredCount);
    }

    // --- 懸浮狀態徽章 (Floating Badge) ---
    function updateBadge(count) {
        let badge = document.getElementById('c18-filter-badge');
        if (!config.showBadge) {
            if (badge) badge.style.display = 'none';
            return;
        }

        if (!badge) {
            badge = document.createElement('div');
            badge.id = 'c18-filter-badge';
            badge.title = '點擊切換過濾狀態，右側齒輪可開啟詳細設定 (Alt+H)';

            badge.addEventListener('click', (e) => {
                if (e.target.closest('.c18-gear-btn')) return;
                config.enabled = !config.enabled;
                saveConfig(config);
                scanAndFilter();
            });

            badge.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                showSettingsModal();
            });

            (document.body || document.documentElement).appendChild(badge);
        }

        badge.style.display = 'flex';
        if (!config.enabled) {
            badge.className = 'c18-badge-disabled';
            setSafeHTML(badge, `
                <span>🚫 韓漫過濾: 已關閉</span>
                <span class="c18-gear-btn" title="開啟設定">⚙️</span>
            `);
        } else {
            badge.className = '';
            const modeText = config.mode === 'card' ? '部' : '標籤';
            const countText = count > 0 ? `已隱藏 ${count} ${modeText}` : '已啟用 (無韓漫)';
            setSafeHTML(badge, `
                <span>🚫 韓漫過濾: ${countText}</span>
                <span class="c18-gear-btn" title="開啟設定">⚙️</span>
            `);
        }

        const gear = badge.querySelector('.c18-gear-btn');
        if (gear) {
            gear.onclick = (e) => {
                e.stopPropagation();
                showSettingsModal();
            };
        }
    }

    // --- 設定彈窗 (Settings Modal) ---
    function showSettingsModal() {
        if (document.getElementById('c18-filter-modal-overlay')) return;

        const overlay = document.createElement('div');
        overlay.id = 'c18-filter-modal-overlay';

        const modal = document.createElement('div');
        modal.id = 'c18-filter-modal';

        const keywordsStr = (config.keywords || []).join(', ');

        setSafeHTML(modal, `
            <div class="c18-modal-header">
                <div class="c18-modal-title">
                    <span>⚙️</span> 18comic 韓漫過濾設定
                </div>
                <button class="c18-modal-close" id="c18-btn-close">×</button>
            </div>
            <div class="c18-form-group">
                <label class="c18-form-label">過濾模式</label>
                <div class="c18-radio-group">
                    <label class="c18-radio-item">
                        <input type="radio" name="c18-mode" value="card" ${config.mode === 'card' ? 'checked' : ''}>
                        <div>
                            <div style="font-weight: 500;">隱藏整本漫畫卡片 (推薦)</div>
                            <div class="c18-radio-desc">在漫畫列表直接屏蔽包含韓漫標籤或標題的所有作品卡片，版面自動遞補</div>
                        </div>
                    </label>
                    <label class="c18-radio-item">
                        <input type="radio" name="c18-mode" value="tag" ${config.mode === 'tag' ? 'checked' : ''}>
                        <div>
                            <div style="font-weight: 500;">僅隱藏「韓漫」標籤元素</div>
                            <div class="c18-radio-desc">保留作品封面與標題，只將「韓漫」徽章或標籤文字隱藏</div>
                        </div>
                    </label>
                </div>
            </div>
            <div class="c18-form-group">
                <label class="c18-form-label" for="c18-keywords-input">過濾關鍵字 (逗號分隔，支援繁簡)</label>
                <input type="text" id="c18-keywords-input" class="c18-input-text" value="${keywordsStr}" placeholder="韓漫, 韩漫, 韓國漫畫...">
                <div class="c18-radio-desc" style="margin-top: 5px;">命中標籤名稱、URL 或標題中包含上述字詞者即會被過濾</div>
            </div>
            <div class="c18-form-group" style="display: flex; align-items: center; gap: 8px;">
                <input type="checkbox" id="c18-show-badge-input" style="accent-color: #ff9900; cursor: pointer;" ${config.showBadge ? 'checked' : ''}>
                <label for="c18-show-badge-input" style="font-size: 13px; color: #e4e4e7; cursor: pointer; user-select: none;">
                    在左下角顯示狀態與過濾計數徽章
                </label>
            </div>
            <div class="c18-modal-footer">
                <button class="c18-btn c18-btn-secondary" id="c18-btn-cancel">取消</button>
                <button class="c18-btn c18-btn-primary" id="c18-btn-save">儲存設定</button>
            </div>
        `);

        overlay.appendChild(modal);
        (document.body || document.documentElement).appendChild(overlay);

        const closeModal = () => {
            overlay.remove();
        };

        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) closeModal();
        });

        modal.querySelector('#c18-btn-close').onclick = closeModal;
        modal.querySelector('#c18-btn-cancel').onclick = closeModal;

        modal.querySelector('#c18-btn-save').onclick = () => {
            const selectedMode = modal.querySelector('input[name="c18-mode"]:checked').value;
            const kwInput = modal.querySelector('#c18-keywords-input').value;
            const showBadge = modal.querySelector('#c18-show-badge-input').checked;

            const kwList = kwInput.split(/[,，]/).map(s => s.trim()).filter(Boolean);

            config.mode = selectedMode;
            config.keywords = kwList.length > 0 ? kwList : DEFAULT_CONFIG.keywords;
            config.showBadge = showBadge;

            saveConfig(config);
            closeModal();
            scanAndFilter();
        };
    }

    // --- 快捷鍵監聽 (Alt + H) ---
    window.addEventListener('keydown', (e) => {
        if (e.altKey && (e.key === 'h' || e.key === 'H') && !e.ctrlKey && !e.shiftKey) {
            const active = document.activeElement;
            if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.isContentEditable)) {
                return;
            }
            e.preventDefault();
            const existingModal = document.getElementById('c18-filter-modal-overlay');
            if (existingModal) {
                existingModal.remove();
            } else {
                showSettingsModal();
            }
        }
    });

    // --- 動態 DOM 變化監聽 (MutationObserver + Debounce) ---
    let debounceTimer = null;
    const observer = new MutationObserver((mutations) => {
        let shouldScan = false;
        for (const m of mutations) {
            // 忽略腳本自身注入的 UI 變動
            if (m.target && m.target.id && (m.target.id.startsWith('c18-') || (m.target.closest && m.target.closest('#c18-filter-badge, #c18-filter-modal-overlay')))) {
                continue;
            }
            if (m.addedNodes.length > 0) {
                shouldScan = true;
                break;
            }
        }
        if (shouldScan) {
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(scanAndFilter, 120);
        }
    });

    // --- SPA 路由切換監聽 ---
    window.addEventListener('popstate', () => setTimeout(scanAndFilter, 200));
    window.addEventListener('hashchange', () => setTimeout(scanAndFilter, 200));

    // --- Tampermonkey 選單指令 ---
    if (typeof GM_registerMenuCommand === 'function') {
        GM_registerMenuCommand("⚡ 切換韓漫過濾狀態 (目前: " + (config.enabled ? "啟用" : "關閉") + ")", () => {
            config.enabled = !config.enabled;
            saveConfig(config);
            scanAndFilter();
        });
        GM_registerMenuCommand("⚙️ 開啟韓漫過濾器設定 (Alt+H)", () => {
            showSettingsModal();
        });
    }

    // --- 初始化執行 ---
    function init() {
        injectStyles();
        scanAndFilter();
        observer.observe(document.body || document.documentElement, {
            childList: true,
            subtree: true
        });
        console.log('[18ComicFilter] ✅ 韓漫過濾器已啟動。快捷鍵: Alt+H | 支援網域: 18comic / jmcomic');
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
