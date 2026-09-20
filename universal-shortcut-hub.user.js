// ==UserScript==
// @name         Universal-全域快捷鍵速查與指揮中心-Alt-Shift-Slash
// @namespace    https://github.com/
// @version      1.7
// @description  按 F1、Alt+/、Alt+Shift+/ 或點擊右下角 ⚡ 圖示隨時呼叫半透明懸浮面板，即時偵測目前網址並列出已生效的所有 UserScript 快捷鍵與操作指南
// @author       Antigravity
// @match        *://*/*
// @match        *://*.youtube.com/*
// @match        *://*.bilibili.com/*
// @match        *://*.threads.net/*
// @match        *://*.threads.com/*
// @include      *
// @run-at       document-end
// @grant        GM_registerMenuCommand
// ==/UserScript==

(function () {
    'use strict';

    // --- 快捷鍵庫定義 ---
    const SCRIPT_REGISTRY = [
        {
            category: "Threads 專用",
            matches: (h) => h.includes('threads.net') || h.includes('threads.com'),
            items: [
                { key: "Alt + B", name: "筆戰戰情室", desc: "呼叫 AI 言詞交鋒助手，以直接犀利的冷嘲熱諷解構邏輯漏洞並產生 3 大回擊選項" },
                { key: "常駐按鈕", name: "⚔️ 反駁此留言", desc: "在每則串文卡片一鍵帶入目標言論至戰情室並提取串文脈絡" }
            ]
        },
        {
            category: "Bilibili 專用",
            matches: (h, p) => h.includes('bilibili.com') && (p.includes('/video/') || p.includes('/list/') || p.includes('/festival/')),
            items: [
                { key: "F8", name: "一鍵三連", desc: "自動依序點贊、勾選默認收藏夾、分享到動態並發布" },
                { key: "Shift + F9", name: "內鬼/未公布資訊檢舉", desc: "一鍵直達稿件舉報並填寫「散布未公布資訊」理由" },
                { key: "Alt + S", name: "影片原圖截圖", desc: "擷取當前播放影格原始解析度無損 PNG 並自動命名下載" },
                { key: "常駐按鈕", name: "⚔️ 評論筆戰", desc: "在評論區每則留言旁一鍵帶入至戰情室解構並填入回覆" }
            ]
        },
        {
            category: "Bilibili 直播間專用",
            matches: (h) => h.includes('live.bilibili.com'),
            items: [
                { key: "F8", name: "自動點讚開關", desc: "每 5 秒定時點擊直播間點讚按鈕（按一次開啟，再按一次停止）" },
                { key: "F9", name: "自動彈幕開關", desc: "設定彈幕內容與間隔秒數定時循環發送（再次按下 F9 停止）" }
            ]
        },
        {
            category: "YouTube 專用",
            matches: (h) => h.includes('youtube.com'),
            items: [
                { key: "Shift + F8", name: "批量加入播放清單", desc: "彈出自訂面板批次勾選或取消多個播放清單，無需手動等待" },
                { key: "Shift + F9", name: "錯誤資訊檢舉", desc: "自動點選檢舉、錯誤資訊並填寫官方未公布理由" }
            ]
        },
        {
            category: "長文 / 小說閱讀",
            matches: (h) => true, // 在所有頁面提供指引，可根據需要由小說腳本啟用
            items: [
                { key: "← / →", name: "章節翻頁", desc: "點擊上一章/頁、下一章/頁（支援自訂啟用網域）" },
                { key: "S", name: "自動平滑滾動", desc: "啟動/暫停平滑自動向下捲動（↑/↓ 調整速度）" },
                { key: "R", name: "純淨閱讀模式", desc: "切換隱藏兩側廣告與導航，提供居中護眼閱讀排版" }
            ]
        },
        {
            category: "繁簡中文輸入與轉換",
            matches: () => true,
            items: [
                { key: "Alt + S", name: "輸入框繁轉簡 / 選字複製", desc: "在輸入框按鍵原地轉簡體（保留 Ctrl+Z）；選取文字按鍵自動轉簡體並複製" },
                { key: "Alt + Shift + S", name: "繁簡轉換工具箱", desc: "呼叫隨身浮動小視窗，支援即打即轉、純字形/詞彙模式切換與一鍵複製" },
                { key: "Ctrl + Enter", name: "工具箱一鍵複製關閉", desc: "在繁簡轉換工具箱內快速複製簡體並自動關閉視窗" }
            ]
        },
        {
            category: "全網通用常駐功能",
            matches: () => true,
            items: [
                { key: "Shift + F9", name: "米哈遊爆料/內鬼檢舉", desc: "呼叫全域彈窗產生發送給米哈遊客服與法務之 Gmail 檢舉信" },
                { key: "常駐背景", name: "網址去追蹤與外鏈直達", desc: "自動移除 utm_*, fbclid 參數，繞過各平台「即將離開」警告頁" },
                { key: "常駐背景", name: "解除複製與右鍵限制", desc: "強制開啟 user-select: text，防止網頁反選取與限制選單" },
                { key: "Alt + B", name: "全網 AI 筆戰戰情室", desc: "專注直接清晰的冷嘲熱諷與邏輯解構，劃詞反駁並產出 3 大回擊選項" },
                { key: "滑鼠劃詞", name: "⚔️ 劃詞反駁徽章", desc: "反白選取網頁任何文字即浮現戰鬥徽章，一鍵發動邏輯回擊" },
                { key: "常駐背景", name: "VideoBlock 影片過濾", desc: "自訂關鍵字與頻道過濾屏蔽，支援右下角 🛡️ 圖示或選單設定" },
                { key: "常駐背景", name: "簡繁自動翻譯與字體調整", desc: "指定網域自動簡轉繁與字體縮放，支援選單開啟設定" }
            ]
        }
    ];

    function showPalette() {
        if (document.getElementById('ush-hub-overlay')) return;

        const host = window.location.hostname.toLowerCase();
        const path = window.location.pathname;

        // 遮罩
        const overlay = document.createElement('div');
        overlay.id = 'ush-hub-overlay';
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100vw;
            height: 100vh;
            background: rgba(15, 23, 42, 0.6);
            backdrop-filter: blur(4px);
            z-index: 2147483647;
            display: flex;
            align-items: center;
            justify-content: center;
            animation: ush-fade-in 0.2s ease-out;
        `;

        // 彈窗本體
        const modal = document.createElement('div');
        modal.id = 'ush-hub-modal';
        modal.style.cssText = `
            background: #ffffff;
            color: #1e293b;
            width: 90%;
            max-width: 580px;
            max-height: 80vh;
            border-radius: 14px;
            box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
            padding: 24px;
            box-sizing: border-box;
            display: flex;
            flex-direction: column;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
            position: relative;
        `;

        // 動畫樣式
        let style = document.getElementById('ush-hub-style');
        if (!style) {
            style = document.createElement('style');
            style.id = 'ush-hub-style';
            style.textContent = `
                @keyframes ush-fade-in { from { opacity: 0; } to { opacity: 1; } }
                .ush-badge-active { background: #dcfce7; color: #15803d; border: 1px solid #86efac; }
                .ush-badge-global { background: #f1f5f9; color: #475569; border: 1px solid #cbd5e1; }
                .ush-key { background: #f8fafc; border: 1px solid #cbd5e1; border-bottom: 2px solid #94a3b8; border-radius: 5px; padding: 2px 7px; font-family: monospace; font-size: 12px; font-weight: 700; color: #0f172a; display: inline-block; }
                .ush-scroll::-webkit-scrollbar { width: 6px; }
                .ush-scroll::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 3px; }
            `;
            (document.head || document.documentElement).appendChild(style);
        }

        // --- 標題列構建 (純 DOM API，完全相容 Trusted Types) ---
        const header = document.createElement('div');
        header.style.cssText = 'display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; border-bottom: 1px solid #e2e8f0; padding-bottom: 12px;';

        const headerLeft = document.createElement('div');
        headerLeft.style.cssText = 'display: flex; align-items: center; gap: 8px;';

        const headerIcon = document.createElement('span');
        headerIcon.style.fontSize = '20px';
        headerIcon.textContent = '⚡';

        const headerTitleWrap = document.createElement('div');
        const headerTitle = document.createElement('div');
        headerTitle.style.cssText = 'font-size: 17px; font-weight: 700; color: #0f172a;';
        headerTitle.textContent = 'UserScript 快捷鍵指揮中心';
        const headerSub = document.createElement('div');
        headerSub.style.cssText = 'font-size: 12px; color: #64748b;';
        headerSub.textContent = `目前網域: ${host}`;
        headerTitleWrap.appendChild(headerTitle);
        headerTitleWrap.appendChild(headerSub);

        headerLeft.appendChild(headerIcon);
        headerLeft.appendChild(headerTitleWrap);

        const closeBtn = document.createElement('span');
        closeBtn.id = 'ush-close-btn';
        closeBtn.style.cssText = 'cursor: pointer; font-size: 24px; color: #94a3b8; line-height: 1; padding: 0 4px;';
        closeBtn.textContent = '×';

        header.appendChild(headerLeft);
        header.appendChild(closeBtn);
        modal.appendChild(header);

        // --- 滾動內容容器 ---
        const scrollContainer = document.createElement('div');
        scrollContainer.className = 'ush-scroll';
        scrollContainer.style.cssText = 'overflow-y: auto; flex: 1; padding-right: 4px;';

        SCRIPT_REGISTRY.forEach(group => {
            const isActiveHere = group.matches(host, path);
            const isGlobal = group.category === "全網通用常駐功能";

            const groupWrap = document.createElement('div');
            groupWrap.style.marginBottom = '18px';

            const groupHeader = document.createElement('div');
            groupHeader.style.cssText = 'display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;';

            const catTitle = document.createElement('span');
            catTitle.style.cssText = 'font-weight: 700; font-size: 14px; color: #334155;';
            catTitle.textContent = group.category;

            const badge = document.createElement('span');
            badge.style.cssText = 'font-size: 11px; padding: 2px 8px; border-radius: 12px; font-weight: 600;';
            if (isActiveHere && !isGlobal) {
                badge.className = 'ush-badge-active';
                badge.textContent = '🟢 當前頁面已生效';
            } else {
                badge.className = 'ush-badge-global';
                badge.textContent = '通用';
            }

            groupHeader.appendChild(catTitle);
            groupHeader.appendChild(badge);
            groupWrap.appendChild(groupHeader);

            const card = document.createElement('div');
            card.style.cssText = 'background: #f8fafc; border-radius: 8px; padding: 8px 14px; border: 1px solid #e2e8f0;';

            group.items.forEach(item => {
                const row = document.createElement('div');
                row.style.cssText = 'display: flex; align-items: baseline; justify-content: space-between; padding: 7px 0; border-bottom: 1px dashed #f1f5f9;';

                const left = document.createElement('div');
                left.style.cssText = 'flex: 1; padding-right: 12px;';

                const itemName = document.createElement('span');
                itemName.style.cssText = 'font-weight: 600; font-size: 14px; color: #1e293b;';
                itemName.textContent = item.name;

                const itemDesc = document.createElement('div');
                itemDesc.style.cssText = 'font-size: 12px; color: #64748b; margin-top: 2px;';
                itemDesc.textContent = item.desc;

                left.appendChild(itemName);
                left.appendChild(itemDesc);

                const keyBadge = document.createElement('span');
                keyBadge.className = 'ush-key';
                keyBadge.textContent = item.key;

                row.appendChild(left);
                row.appendChild(keyBadge);
                card.appendChild(row);
            });

            groupWrap.appendChild(card);
            scrollContainer.appendChild(groupWrap);
        });

        modal.appendChild(scrollContainer);

        // --- 底部說明列 ---
        const footer = document.createElement('div');
        footer.style.cssText = 'margin-top: 14px; padding-top: 10px; border-top: 1px solid #f1f5f9; display: flex; justify-content: space-between; align-items: center; font-size: 12px; color: #94a3b8;';

        const footLeft = document.createElement('span');
        footLeft.textContent = '按 Esc 或點擊外部關閉';

        const footRight = document.createElement('span');
        footRight.textContent = '呼叫本面板：';

        const footKey1 = document.createElement('span');
        footKey1.className = 'ush-key';
        footKey1.textContent = 'Alt + /';

        const footKey2 = document.createElement('span');
        footKey2.className = 'ush-key';
        footKey2.textContent = 'F1';

        const footKey3 = document.createElement('span');
        footKey3.className = 'ush-key';
        footKey3.textContent = '⚡';

        footRight.appendChild(footKey1);
        footRight.appendChild(document.createTextNode(' 或 '));
        footRight.appendChild(footKey2);
        footRight.appendChild(document.createTextNode(' 或點擊 '));
        footRight.appendChild(footKey3);

        footer.appendChild(footLeft);
        footer.appendChild(footRight);
        modal.appendChild(footer);

        overlay.appendChild(modal);
        const mountTarget = document.body || document.documentElement;
        mountTarget.appendChild(overlay);

        function close() {
            window.removeEventListener('keydown', escHandler, true);
            document.removeEventListener('keydown', escHandler, true);
            overlay.remove();
            const existingStyle = document.getElementById('ush-hub-style');
            if (existingStyle) existingStyle.remove();
        }

        document.getElementById('ush-close-btn').onclick = close;
        overlay.onclick = (e) => {
            if (e.target === overlay) close();
        };

        const escHandler = (e) => {
            if (e.key === 'Escape' || e.code === 'Escape') {
                e.preventDefault();
                e.stopPropagation();
                e.stopImmediatePropagation();
                close();
            }
        };
        window.addEventListener('keydown', escHandler, true);
        document.addEventListener('keydown', escHandler, true);
    }

    // --- 快捷鍵判定邏輯 ---
    function isTriggerKey(e) {
        // 1. F1 鍵：國際標準說明熱鍵，單鍵直達，無任何輸入法與修飾鍵衝突
        if (e.code === 'F1' || e.key === 'F1') {
            return true;
        }

        const isSlash = e.code === 'Slash' || e.code === 'NumpadDivide' || e.key === '/' || e.key === '?';

        // 2. Alt + / (單修飾鍵，徹底避開 Windows 系統預設 Alt+Shift 語言切換衝突，單手即可秒開)
        if (e.altKey && !e.shiftKey && !e.ctrlKey && isSlash) {
            return true;
        }

        // 3. 原生 Alt + Shift + / (相容 e.code 與 e.key)
        if (e.altKey && e.shiftKey && isSlash) {
            return true;
        }

        // 4. 備用: Ctrl + Shift + K 或 Ctrl + Shift + /
        const isK = e.code === 'KeyK' || e.key === 'k' || e.key === 'K';
        if (e.ctrlKey && e.shiftKey && (isK || isSlash)) {
            return true;
        }

        return false;
    }

    function onKeyDown(e) {
        if (isTriggerKey(e)) {
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
            console.log('[ShortcutHub] ⚡ 快捷鍵觸發成功，開啟指揮中心面板');
            showPalette();
        }
    }

    // --- 鍵盤事件監聽（捕獲階段 Capture Phase） ---
    // 使用 capture: true 確保在 YouTube、Bilibili 等 SPA 宿主網頁的原生按鍵監聽或 stopPropagation 之前最優先攔截
    window.addEventListener('keydown', onKeyDown, true);
    document.addEventListener('keydown', onKeyDown, true);

    // --- 建立右下角懸浮觸發按鈕 (只在頂層視窗建立) ---
    function initFloatingTrigger() {
        if (window.self !== window.top) return; // 避免在子 iframe 中重複建立
        if (document.getElementById('ush-hub-floating-btn')) return;

        const btn = document.createElement('div');
        btn.id = 'ush-hub-floating-btn';
        btn.title = 'UserScript 快捷鍵指揮中心 (點擊或按 Alt+/、F1 開啟)';
        btn.textContent = '⚡';
        btn.style.cssText = `
            position: fixed;
            bottom: 24px;
            right: 24px;
            width: 42px;
            height: 42px;
            border-radius: 50%;
            background: rgba(15, 23, 42, 0.78);
            backdrop-filter: blur(8px);
            -webkit-backdrop-filter: blur(8px);
            color: #f8fafc;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 20px;
            cursor: pointer;
            z-index: 2147483640;
            box-shadow: 0 4px 14px rgba(0, 0, 0, 0.3);
            transition: all 0.2s ease;
            user-select: none;
            border: 1px solid rgba(255, 255, 255, 0.25);
            opacity: 0.85;
        `;

        btn.onmouseenter = () => {
            btn.style.opacity = '1';
            btn.style.transform = 'scale(1.1)';
            btn.style.boxShadow = '0 6px 20px rgba(0, 0, 0, 0.4)';
        };
        btn.onmouseleave = () => {
            btn.style.opacity = '0.85';
            btn.style.transform = 'scale(1)';
            btn.style.boxShadow = '0 4px 14px rgba(0, 0, 0, 0.3)';
        };
        btn.onclick = (e) => {
            e.stopPropagation();
            showPalette();
        };

        const target = document.body || document.documentElement;
        if (target) {
            target.appendChild(btn);
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initFloatingTrigger);
    } else {
        initFloatingTrigger();
    }

    // YouTube SPA 定期補掛檢查
    let checkCount = 0;
    const btnCheckInterval = setInterval(() => {
        initFloatingTrigger();
        if (++checkCount > 10) clearInterval(btnCheckInterval);
    }, 1000);

    // --- 註冊 Tampermonkey 選單指令 ---
    if (typeof GM_registerMenuCommand === 'function') {
        GM_registerMenuCommand("⚡ 開啟快捷鍵指揮中心 (Alt+/ 或 F1)", () => {
            showPalette();
        });
    }

    console.log('[ShortcutHub] ✅ 全域快捷鍵速查與指揮中心 (v1.3) 已就緒。支援方式: F1 / Alt+/ / 右下角 ⚡ 按鈕 / Tampermonkey 選單');
})();
