// ==UserScript==
// @name         Universal-米哈遊未公布資訊/內鬼影片檢舉套件-Shift-F9
// @namespace    http://tampermonkey.net/
// @version      2.0
// @description  跨平台米哈遊爆料/內鬼檢舉整合工具（Shift+F9）：支援 Bilibili/YouTube 站內自動檢舉流程，以及全站通用法務與客服檢舉信生成 (Gmail)
// @author       Antigravity
// @match        *://*/*
// @run-at       document-end
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    // Trusted Types 策略支援
    let htmlPolicy = null;
    if (window.trustedTypes && window.trustedTypes.createPolicy) {
        try {
            htmlPolicy = window.trustedTypes.createPolicy('leakerReportSuite', {
                createHTML: (s) => s
            });
        } catch (e) {
            htmlPolicy = window.trustedTypes.getPolicy('leakerReportSuite') || { createHTML: (s) => s };
        }
    }

    // --- Toast 狀態通知 ---
    function showToast(msg, isError = false) {
        const toast = document.createElement('div');
        toast.textContent = msg;
        toast.style.cssText = `
            position: fixed;
            bottom: 30px;
            left: 50%;
            transform: translateX(-50%);
            background: ${isError ? 'rgba(220, 38, 38, 0.95)' : 'rgba(37, 99, 235, 0.95)'};
            color: #fff;
            padding: 12px 24px;
            border-radius: 8px;
            font-size: 15px;
            font-weight: bold;
            z-index: 100000;
            box-shadow: 0 4px 16px rgba(0, 0, 0, 0.25);
            pointer-events: none;
            transition: opacity 0.4s ease;
        `;
        document.body.appendChild(toast);
        setTimeout(() => {
            toast.style.opacity = '0';
            setTimeout(() => toast.remove(), 400);
        }, 3000);
    }

    const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

    // ==========================================
    // 1. Bilibili 站內自動檢舉流程
    // ==========================================
    async function runBilibiliSiteReport() {
        showToast('🚀 啟動 Bilibili 稿件自動檢舉...');

        // 1. 點擊「稿件举报」
        let retry = 0;
        let reportSpan = null;
        while (retry++ < 25) {
            reportSpan = Array.from(document.querySelectorAll('span.video-complaint-info, span.video-toolbar-item-text'))
                .find(el => el.textContent.includes('举报') || el.textContent.includes('舉報'));
            if (reportSpan) break;
            await sleep(400);
        }

        if (!reportSpan) {
            showToast('❌ 找不到 B站「稿件舉報」按鈕', true);
            return;
        }
        reportSpan.click();
        await sleep(600);

        // 2. 在 dialog iframe 尋找「散布米哈游未公布信息」標籤 (Tag key: 10034)
        retry = 0;
        let iframeDoc = null;
        while (retry++ < 30) {
            const iframe = document.querySelector('div.bili-dialog-m iframe[name="appeal"], iframe[name="appeal"]');
            if (iframe && iframe.contentDocument) {
                iframeDoc = iframe.contentDocument;
                const tag = iframeDoc.querySelector('div.web-tag.reason-tag[data-tag-key="10034"] .radio') ||
                    Array.from(iframeDoc.querySelectorAll('.reason-tag')).find(el => el.textContent.includes('未公布') || el.textContent.includes('谣言'));
                if (tag) {
                    tag.click();
                    break;
                }
            }
            await sleep(500);
        }

        if (!iframeDoc) {
            showToast('⚠️ 未能自動選取舉報標籤，請於彈窗中手動確認', true);
            return;
        }

        await sleep(400);

        // 3. 填寫描述
        const textarea = iframeDoc.querySelector('.web-textarea.description textarea, textarea');
        if (textarea) {
            textarea.value = "散布米哈遊未公布資訊";
            textarea.dispatchEvent(new Event('input', { bubbles: true }));
            textarea.dispatchEvent(new Event('change', { bubbles: true }));
        }

        await sleep(400);

        // 4. 點擊提交
        const submitBtn = iframeDoc.querySelector('div.operation-btn.confirm-btn, button.confirm-btn');
        if (submitBtn) {
            submitBtn.click();
            showToast('✅ B站檢舉流程已自動送出！');
        } else {
            showToast('⚠️ 已填寫檢舉理由，請手動點擊提交確認', false);
        }
    }

    // ==========================================
    // 2. YouTube 站內自動檢舉流程
    // ==========================================
    async function runYouTubeSiteReport() {
        showToast('🚀 啟動 YouTube 錯誤資訊自動檢舉...');

        // 1. 更多選單
        const moreBtn = document.querySelector('ytd-menu-renderer yt-icon-button');
        if (!moreBtn) {
            showToast('❌ 找不到 YouTube 更多選單按鈕', true);
            return;
        }
        moreBtn.click();
        await sleep(600);

        // 2. 點擊「檢舉」
        const reportBtn = Array.from(document.querySelectorAll('yt-formatted-string.style-scope.ytd-menu-service-item-renderer, tp-yt-paper-item'))
            .find(el => el.textContent.trim().includes('檢舉') || el.textContent.trim().includes('Report'));
        if (!reportBtn) {
            showToast('❌ 找不到「檢舉」選單項目', true);
            return;
        }
        reportBtn.click();
        await sleep(800);

        // 3. 尋找「錯誤資訊」
        const errorDiv = Array.from(document.querySelectorAll('div, yt-formatted-string'))
            .find(el => el.textContent.trim() === '錯誤資訊' || el.textContent.trim() === 'Misinformation');
        if (!errorDiv) {
            showToast('❌ 找不到「錯誤資訊」選項', true);
            return;
        }
        errorDiv.click();
        await sleep(500);

        // 4. 點擊「繼續」
        const continueBtn = Array.from(document.querySelectorAll('yt-touch-feedback-shape, button'))
            .find(el => el.parentElement && (el.parentElement.textContent.includes('繼續') || el.parentElement.textContent.includes('Next')));
        if (continueBtn) {
            continueBtn.click();
            await sleep(700);
        }

        // 5. 填寫理由
        const textarea = document.querySelector('textarea.ytStandardsTextareaShapeTextarea, textarea');
        if (textarea) {
            textarea.focus();
            textarea.value = '散佈官方未公布資訊, 是散佈錯誤資訊的行為';
            textarea.dispatchEvent(new Event('input', { bubbles: true }));
            await sleep(400);
        }

        // 6. 點擊送出檢舉
        const finalBtn = Array.from(document.querySelectorAll('yt-touch-feedback-shape, button'))
            .find(el => el.parentElement && (el.parentElement.textContent.includes('檢舉') || el.parentElement.textContent.includes('Report')));
        if (finalBtn) {
            finalBtn.click();
            await sleep(800);
            showToast('✅ YouTube 檢舉流程已自動完成！');
        } else {
            showToast('⚠️ 已填寫理由，請手動確認送出', false);
        }
    }

    // ==========================================
    // 3. 通用 Gmail 官方/法務檢舉信彈窗
    // ==========================================
    function showReportModal() {
        if (document.getElementById('lr-suite-modal')) return;

        const host = window.location.hostname;
        const isBilibiliVideo = host.includes('bilibili.com') && window.location.pathname.startsWith('/video/');
        const isYouTubeWatch = host.includes('youtube.com') && window.location.pathname.startsWith('/watch');

        // 遮罩
        const overlay = document.createElement('div');
        overlay.id = 'lr-suite-overlay';
        overlay.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:100vh;background:rgba(0,0,0,0.4);z-index:99998;backdrop-filter:blur(2px);';

        // 彈窗外框
        const modal = document.createElement('div');
        modal.id = 'lr-suite-modal';
        modal.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: #ffffff;
            color: #1f2937;
            border-radius: 12px;
            box-shadow: 0 20px 25px -5px rgba(0,0,0,0.2), 0 10px 10px -5px rgba(0,0,0,0.1);
            z-index: 99999;
            width: 90%;
            max-width: 440px;
            padding: 24px;
            box-sizing: border-box;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
            text-align: left;
        `;

        let siteActionHtml = '';
        if (isBilibiliVideo) {
            siteActionHtml = `
                <div style="margin-bottom: 16px; padding: 12px; background: #e0f2fe; border-radius: 8px; border-left: 4px solid #0284c7;">
                    <div style="font-size: 13px; font-weight: 600; color: #0369a1; margin-bottom: 6px;">偵測到 B站 影片頁面</div>
                    <button id="lr-btn-site-bili" style="width:100%; padding:8px 0; background:#0284c7; color:#fff; border:none; border-radius:6px; font-weight:bold; cursor:pointer;">
                        ⚡ 執行 B站 站內自動檢舉 (未公布資訊)
                    </button>
                </div>
            `;
        } else if (isYouTubeWatch) {
            siteActionHtml = `
                <div style="margin-bottom: 16px; padding: 12px; background: #fee2e2; border-radius: 8px; border-left: 4px solid #dc2626;">
                    <div style="font-size: 13px; font-weight: 600; color: #b91c1c; margin-bottom: 6px;">偵測到 YouTube 影片頁面</div>
                    <button id="lr-btn-site-yt" style="width:100%; padding:8px 0; background:#dc2626; color:#fff; border:none; border-radius:6px; font-weight:bold; cursor:pointer;">
                        ⚡ 執行 YouTube 站內自動檢舉 (錯誤資訊)
                    </button>
                </div>
            `;
        }

        const modalInner = `
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px; border-bottom:1px solid #f3f4f6; padding-bottom:10px;">
                <span style="font-size: 17px; font-weight: bold; color: #111827;">🛡️ 散佈未公佈資訊 / 內鬼檢舉</span>
                <span id="lr-close-x" style="cursor:pointer; font-size:20px; color:#9ca3af; line-height:1;">&times;</span>
            </div>

            ${siteActionHtml}

            <div style="font-size: 14px; font-weight: 600; color: #374151; margin-bottom: 10px;">✉️ 產生官方/法務檢舉信件 (Gmail)</div>

            <div style="margin-bottom: 10px;">
                <label style="font-size: 13px; color: #4b5563; display:block; margin-bottom: 4px;">遊戲所屬:</label>
                <select id="lr-game" style="width:100%; padding:6px 10px; border:1px solid #d1d5db; border-radius:6px; font-size:14px; background:#fff;">
                    <option value="1">原神 (Genshin Impact)</option>
                    <option value="2">崩壞：星穹鐵道 (Honkai: Star Rail)</option>
                    <option value="3">絕區零 (Zenless Zone Zero)</option>
                </select>
            </div>

            <div style="display: flex; gap: 10px; margin-bottom: 10px;">
                <div style="flex: 1;">
                    <label style="font-size: 13px; color: #4b5563; display:block; margin-bottom: 4px;">涉及角色:</label>
                    <input id="lr-char" type="text" placeholder="例: 隊長 / 散兵" style="width:100%; padding:6px 8px; border:1px solid #d1d5db; border-radius:6px; font-size:14px; box-sizing:border-box;">
                </div>
                <div style="width: 100px;">
                    <label style="font-size: 13px; color: #4b5563; display:block; margin-bottom: 4px;">版本號:</label>
                    <input id="lr-ver" type="text" placeholder="例: 5.2" style="width:100%; padding:6px 8px; border:1px solid #d1d5db; border-radius:6px; font-size:14px; box-sizing:border-box;">
                </div>
            </div>

            <div style="margin-bottom: 16px;">
                <label style="font-size: 13px; color: #4b5563; display:block; margin-bottom: 4px;">違規網址:</label>
                <input id="lr-url" type="text" value="${window.location.href}" style="width:100%; padding:6px 8px; border:1px solid #d1d5db; border-radius:6px; font-size:13px; box-sizing:border-box;">
            </div>

            <div style="display:flex; justify-content:flex-end; gap:8px;">
                <button id="lr-btn-cancel" style="padding:7px 16px; background:#f3f4f6; color:#4b5563; border:none; border-radius:6px; font-size:14px; cursor:pointer;">取消</button>
                <button id="lr-btn-send-mail" style="padding:7px 20px; background:#ef4444; color:#fff; border:none; border-radius:6px; font-size:14px; font-weight:600; cursor:pointer;">寄出檢舉信 (Gmail)</button>
            </div>
        `;

        if (htmlPolicy) {
            modal.innerHTML = htmlPolicy.createHTML(modalInner);
        } else {
            modal.innerHTML = modalInner;
        }

        document.body.appendChild(overlay);
        document.body.appendChild(modal);

        // 關閉邏輯
        function closeModal() {
            modal.remove();
            overlay.remove();
        }

        document.getElementById('lr-close-x').onclick = closeModal;
        document.getElementById('lr-btn-cancel').onclick = closeModal;
        overlay.onclick = closeModal;

        // B站站內檢舉綁定
        const biliBtn = document.getElementById('lr-btn-site-bili');
        if (biliBtn) {
            biliBtn.onclick = () => {
                closeModal();
                runBilibiliSiteReport();
            };
        }

        // YouTube 站內檢舉綁定
        const ytBtn = document.getElementById('lr-btn-site-yt');
        if (ytBtn) {
            ytBtn.onclick = () => {
                closeModal();
                runYouTubeSiteReport();
            };
        }

        // 寄出 Gmail 邏輯
        document.getElementById('lr-btn-send-mail').onclick = () => {
            const gameKey = document.getElementById('lr-game').value;
            const gameMap = {
                "1": { name: "原神", extra: "genshin_cs@nijigengames.com" },
                "2": { name: "崩壞:星穹鐵道", extra: "honkaistarrail_cs@nijigengames.com" },
                "3": { name: "絕區零", extra: "zzzcs@nijigengames.com" }
            };
            const game = gameMap[gameKey] || gameMap["1"];
            const targetUrl = document.getElementById('lr-url').value || window.location.href;
            const character = document.getElementById('lr-char').value.trim() || "-";
            const version = document.getElementById('lr-ver').value.trim() || "-";

            const subject = encodeURIComponent(`${game.name} 散佈未公開資訊 / 內鬼檢舉`);
            const toMail = "notice@service.mihoyo.com";
            const allMail = [toMail, game.extra].join(",");
            const content = [
                "【檢舉信件】以下頁面/影片涉及散佈未公佈機密資訊：",
                targetUrl,
                "",
                `涉及遊戲: ${game.name}`,
                `涉及角色: ${character}`,
                `涉及版本: ${version}`,
                "",
                "請法務及相關維權團隊儘速處理，謝謝。"
            ].join("\n");

            const body = encodeURIComponent(content);
            const gmailURL = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(allMail)}&su=${subject}&body=${body}`;

            window.open(gmailURL, '_blank');
            closeModal();
        };
    }

    // ==========================================
    // 4. 快捷鍵監聽 (Shift + F9 全域觸發)
    // ==========================================
    window.addEventListener('keydown', function (e) {
        if (e.shiftKey && e.key === 'F9') {
            e.preventDefault();
            showReportModal();
        }
    });
})();
