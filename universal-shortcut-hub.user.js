// ==UserScript==
// @name         Universal-全域快捷鍵速查與指揮中心-Alt-Shift-Slash
// @namespace    https://github.com/
// @version      1.0
// @description  按 Alt+Shift+/（或 Ctrl+Shift+K）隨時呼叫半透明懸浮面板，即時偵測目前網址並列出已生效的所有 UserScript 快捷鍵與操作指南
// @author       Antigravity
// @match        *://*/*
// @run-at       document-end
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    // --- 快捷鍵庫定義 ---
    const SCRIPT_REGISTRY = [
        {
            category: "Bilibili 專用",
            matches: (h, p) => h.includes('bilibili.com') && (p.includes('/video/') || p.includes('/list/') || p.includes('/festival/')),
            items: [
                { key: "F8", name: "一鍵三連", desc: "自動依序點贊、勾選默認收藏夾、分享到動態並發布" },
                { key: "Shift + F9", name: "內鬼/未公布資訊檢舉", desc: "一鍵直達稿件舉報並填寫「散布未公布資訊」理由" },
                { key: "Alt + S", name: "影片原圖截圖", desc: "擷取當前播放影格原始解析度無損 PNG 並自動命名下載" }
            ]
        },
        {
            category: "Bilibili 直播間專用",
            matches: (h) => h.includes('live.bilibili.com'),
            items: [
                { key: "F8", name: "自動點讚開關", desc: "每 5 秒定時點擊直播間點讚按鈕（按一次開啟，再按一次停止）" },
                { key: "F9", name: "自動彈幕開關", desc: "設定彈幕內容與間隔秒數定時循環發送（再次按下 F9 停止）" },
                { key: "Alt + S", name: "直播原圖截圖", desc: "擷取當前直播畫面無損 PNG" }
            ]
        },
        {
            category: "YouTube 專用",
            matches: (h, p) => h.includes('youtube.com') && p.includes('/watch'),
            items: [
                { key: "Shift + F8", name: "批量加入播放清單", desc: "彈出自訂面板批次勾選或取消多個播放清單，無需手動等待" },
                { key: "Shift + F9", name: "錯誤資訊檢舉", desc: "自動點選檢舉、錯誤資訊並填寫官方未公布理由" },
                { key: "Alt + S", name: "影片原圖截圖", desc: "擷取 YouTube 當前影格原始解析度無損 PNG 並命名下載" }
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
            category: "全網通用常駐功能",
            matches: () => true,
            items: [
                { key: "Alt + S", name: "HTML5 影片無損截圖", desc: "在任何包含 video 的網頁擷取原始影格並複製到剪貼簿" },
                { key: "Shift + F9", name: "米哈遊爆料/內鬼檢舉", desc: "呼叫全域彈窗產生發送給米哈遊客服與法務之 Gmail 檢舉信" },
                { key: "常駐背景", name: "網址去追蹤與外鏈直達", desc: "自動移除 utm_*, fbclid 參數，繞過各平台「即將離開」警告頁" },
                { key: "常駐背景", name: "解除複製與右鍵限制", desc: "強制開啟 user-select: text，防止網頁反選取與限制選單" }
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
            z-index: 999998;
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
        const style = document.createElement('style');
        style.textContent = `
            @keyframes ush-fade-in { from { opacity: 0; } to { opacity: 1; } }
            .ush-badge-active { background: #dcfce7; color: #15803d; border: 1px solid #86efac; }
            .ush-badge-global { background: #f1f5f9; color: #475569; border: 1px solid #cbd5e1; }
            .ush-key { background: #f8fafc; border: 1px solid #cbd5e1; border-bottom: 2px solid #94a3b8; border-radius: 5px; padding: 2px 7px; font-family: monospace; font-size: 12px; font-weight: 700; color: #0f172a; display: inline-block; }
            .ush-scroll::-webkit-scrollbar { width: 6px; }
            .ush-scroll::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 3px; }
        `;
        document.head.appendChild(style);

        // 構建內容 HTML
        let sectionsHtml = '';
        SCRIPT_REGISTRY.forEach(group => {
            const isActiveHere = group.matches(host, path);
            const badgeClass = isActiveHere && group.category !== "全網通用常駐功能" ? "ush-badge-active" : "ush-badge-global";
            const badgeText = isActiveHere && group.category !== "全網通用常駐功能" ? "🟢 當前頁面已生效" : "通用";

            let itemsHtml = '';
            group.items.forEach(item => {
                itemsHtml += `
                    <div style="display: flex; align-items: baseline; justify-content: space-between; padding: 7px 0; border-bottom: 1px dashed #f1f5f9;">
                        <div style="flex: 1; padding-right: 12px;">
                            <span style="font-weight: 600; font-size: 14px; color: #1e293b;">${item.name}</span>
                            <div style="font-size: 12px; color: #64748b; margin-top: 2px;">${item.desc}</div>
                        </div>
                        <span class="ush-key">${item.key}</span>
                    </div>
                `;
            });

            sectionsHtml += `
                <div style="margin-bottom: 18px;">
                    <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
                        <span style="font-weight: 700; font-size: 14px; color: #334155;">${group.category}</span>
                        <span class="${badgeClass}" style="font-size: 11px; padding: 2px 8px; border-radius: 12px; font-weight: 600;">${badgeText}</span>
                    </div>
                    <div style="background: #f8fafc; border-radius: 8px; padding: 8px 14px; border: 1px solid #e2e8f0;">
                        ${itemsHtml}
                    </div>
                </div>
            `;
        });

        modal.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; border-bottom: 1px solid #e2e8f0; padding-bottom: 12px;">
                <div style="display: flex; align-items: center; gap: 8px;">
                    <span style="font-size: 20px;">⚡</span>
                    <div>
                        <div style="font-size: 17px; font-weight: 700; color: #0f172a;">UserScript 快捷鍵指揮中心</div>
                        <div style="font-size: 12px; color: #64748b;">目前網域: ${host}</div>
                    </div>
                </div>
                <span id="ush-close-btn" style="cursor: pointer; font-size: 22px; color: #94a3b8; line-height: 1;">&times;</span>
            </div>

            <div class="ush-scroll" style="overflow-y: auto; flex: 1; padding-right: 4px;">
                ${sectionsHtml}
            </div>

            <div style="margin-top: 14px; padding-top: 10px; border-top: 1px solid #f1f5f9; display: flex; justify-content: space-between; align-items: center; font-size: 12px; color: #94a3b8;">
                <span>按 <span class="ush-key">Esc</span> 或點擊外部關閉</span>
                <span>呼叫本面板：<span class="ush-key">Alt + Shift + /</span></span>
            </div>
        `;

        overlay.appendChild(modal);
        document.body.appendChild(overlay);

        function close() {
            overlay.remove();
            style.remove();
        }

        document.getElementById('ush-close-btn').onclick = close;
        overlay.onclick = (e) => {
            if (e.target === overlay) close();
        };

        const escHandler = (e) => {
            if (e.key === 'Escape') {
                close();
                window.removeEventListener('keydown', escHandler);
            }
        };
        window.addEventListener('keydown', escHandler);
    }

    // --- 鍵盤監聽 ---
    window.addEventListener('keydown', function (e) {
        // Alt + Shift + / (即 Alt + ?) 或 Ctrl + Shift + K
        if ((e.altKey && e.shiftKey && (e.key === '/' || e.key === '?')) ||
            (e.ctrlKey && e.shiftKey && (e.key === 'k' || e.key === 'K'))) {
            e.preventDefault();
            showPalette();
        }
    });
})();
