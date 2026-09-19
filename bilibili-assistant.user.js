// ==UserScript==
// @name         Bilibili-綜合互動助手-F8-F9
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  B站全能互動助手：影片/活動頁按 F8 一鍵三連 (點贊/收藏/發布動態)；直播間按 F8 開啟/關閉自動點讚，按 F9 設定並開啟/關閉定時發送彈幕，附帶輕量狀態通知
// @author       You / Antigravity
// @match        https://www.bilibili.com/video/*
// @match        https://www.bilibili.com/list/*
// @match        https://www.bilibili.com/festival/*
// @match        https://live.bilibili.com/*
// @match        https://t.bilibili.com/share/card/index?*
// @run-at       document-end
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    const host = window.location.hostname;
    const isLive = host.includes('live.bilibili.com');
    const isShareIframe = host.includes('t.bilibili.com') && window.location.pathname.includes('/share/card/index');

    // ==========================================
    // 0. 通用 Toast 狀態通知
    // ==========================================
    function showToast(msg, isError = false) {
        const toast = document.createElement('div');
        toast.textContent = msg;
        toast.style.cssText = `
            position: fixed;
            bottom: ${isLive ? '30px' : '80px'};
            right: 30px;
            background: ${isError ? 'rgba(239, 68, 68, 0.95)' : 'rgba(0, 161, 214, 0.95)'};
            color: #fff;
            padding: 10px 18px;
            border-radius: 6px;
            font-size: 14px;
            font-weight: 500;
            z-index: 999999;
            box-shadow: 0 4px 14px rgba(0, 0, 0, 0.2);
            pointer-events: none;
            transition: opacity 0.4s ease;
        `;
        document.body.appendChild(toast);
        setTimeout(() => {
            toast.style.opacity = '0';
            setTimeout(() => toast.remove(), 400);
        }, 2500);
    }

    // ==========================================
    // 1. 分享 iframe 處理邏輯 (t.bilibili.com)
    // ==========================================
    if (isShareIframe) {
        console.log('[Bilibili 助手] Running inside share iframe.');
        async function runIframeLogic() {
            try {
                // 等待發布按鈕
                for (let i = 0; i < 20; i++) {
                    const publishBtn = document.querySelector('button.share-btn.clickable');
                    if (publishBtn && (publishBtn.innerText.includes('发布') || publishBtn.innerText.includes('發布'))) {
                        publishBtn.click();
                        break;
                    }
                    await new Promise(r => setTimeout(r, 500));
                }
                // 等待關閉按鈕
                for (let i = 0; i < 15; i++) {
                    const closeBtn = document.querySelector('button.success-btn');
                    if (closeBtn && (closeBtn.innerText.includes('关闭') || closeBtn.innerText.includes('關閉'))) {
                        closeBtn.click();
                        break;
                    }
                    await new Promise(r => setTimeout(r, 500));
                }
            } catch (e) {
                console.error('[Bilibili 助手] iframe 分享錯誤:', e);
            }
        }
        runIframeLogic();
        return;
    }

    // ==========================================
    // 2. 直播間專屬邏輯 (live.bilibili.com)
    // ==========================================
    if (isLive) {
        let likeTimer = null;
        let isLikeRunning = false;

        let danmakuTimer = null;
        let isDanmakuRunning = false;
        let danmakuContent = '';
        let danmakuIntervalSec = 10;

        // --- 自動點讚 ---
        function clickLikeBtn() {
            const btn = document.querySelector('.like-btn, .live-skin-highlight-bg .like-btn');
            if (btn) {
                btn.click();
                console.log('[Bilibili 直播] 觸發點讚');
            }
        }

        function toggleAutoLike() {
            if (isLikeRunning) {
                clearInterval(likeTimer);
                likeTimer = null;
                isLikeRunning = false;
                showToast('⏹️ 直播自動點讚已停止');
            } else {
                clickLikeBtn();
                likeTimer = setInterval(clickLikeBtn, 5000);
                isLikeRunning = true;
                showToast('👍 直播自動點讚已啟動 (每 5 秒)');
            }
        }

        // --- 自動彈幕 ---
        function updateTextareaValue(textarea, text) {
            textarea.focus();
            const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')?.set;
            if (nativeInputValueSetter) {
                nativeInputValueSetter.call(textarea, text);
            } else {
                textarea.value = text;
            }
            textarea.dispatchEvent(new Event('input', { bubbles: true }));
            textarea.dispatchEvent(new Event('change', { bubbles: true }));
        }

        function sendDanmaku(text) {
            const textarea = document.querySelector('textarea.chat-input');
            const buttons = Array.from(document.querySelectorAll('button, .bl-button, div'));
            const sendButton = buttons.find(el => el.textContent.trim() === '发送' && el.offsetParent !== null);

            if (!textarea) return;

            updateTextareaValue(textarea, text);

            setTimeout(() => {
                if (sendButton) sendButton.click();
                textarea.dispatchEvent(new KeyboardEvent('keydown', {
                    key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true, cancelable: true
                }));
            }, 150);
        }

        function toggleAutoDanmaku() {
            if (isDanmakuRunning) {
                clearInterval(danmakuTimer);
                danmakuTimer = null;
                isDanmakuRunning = false;
                showToast('⏹️ 自動彈幕已停止發送');
            } else {
                const text = prompt('【自動彈幕】請輸入要定期發送的彈幕內容：', danmakuContent || '');
                if (!text || text.trim() === '') return;

                const intervalInput = prompt('【自動彈幕】請輸入發送間隔時間（秒）：', String(danmakuIntervalSec || 10));
                if (intervalInput === null) return;

                const interval = parseFloat(intervalInput);
                if (isNaN(interval) || interval < 1) {
                    alert('間隔時間無效，請設定大於等於 1 的數字。');
                    return;
                }

                danmakuContent = text.trim();
                danmakuIntervalSec = interval;
                isDanmakuRunning = true;

                showToast(`🚀 自動彈幕已啟動！每 ${interval} 秒發送`);
                sendDanmaku(danmakuContent);

                danmakuTimer = setInterval(() => {
                    sendDanmaku(danmakuContent);
                }, danmakuIntervalSec * 1000);
            }
        }

        // 直播間按鍵監聽
        window.addEventListener('keydown', function (e) {
            const activeTag = document.activeElement ? document.activeElement.tagName.toLowerCase() : '';
            const isEditing = activeTag === 'input' || activeTag === 'textarea' || document.activeElement?.isContentEditable;

            // F8: 點讚開關 (避免輸入時誤觸)
            if (e.key === 'F8' && !e.shiftKey && !e.ctrlKey && !e.altKey && !isEditing) {
                e.preventDefault();
                toggleAutoLike();
            }

            // F9: 彈幕開關
            if (e.key === 'F9' && !e.shiftKey && !e.ctrlKey && !e.altKey) {
                e.preventDefault();
                toggleAutoDanmaku();
            }
        });

        window.addEventListener('beforeunload', () => {
            if (likeTimer) clearInterval(likeTimer);
            if (danmakuTimer) clearInterval(danmakuTimer);
        });

        return; // 直播間處理完畢
    }

    // ==========================================
    // 3. 影片 / 清單 / 活動頁一鍵三連邏輯 (F8)
    // ==========================================
    async function waitForElement(stepName, selector, filterFn = () => true, maxAttempts = 30, interval = 500) {
        for (let i = 0; i < maxAttempts; i++) {
            const elements = document.querySelectorAll(selector);
            for (let el of elements) {
                if (filterFn(el)) {
                    console.log(`[Bilibili 助手] 找到目標: ${selector}, 步驟: ${stepName}`);
                    return el;
                }
            }
            await new Promise(r => setTimeout(r, interval));
        }
        throw new Error(`[Bilibili 助手] 超時未找到目標元素: ${selector} (${stepName})`);
    }

    async function waitAndClick(stepName, selector, filterFn = () => true) {
        const el = await waitForElement(stepName, selector, filterFn);
        el.click();
        await new Promise(r => setTimeout(r, 800));
    }

    // 點贊 (相容普通影片與慶典頁)
    async function clickLike() {
        await waitAndClick('點贊', 'div[title*="点赞"], div.video-toolbar-content_item', (el) => {
            return el.matches('div[title*="点赞"]') || el.querySelector('.ic_like') !== null;
        });
    }

    // 收藏到默認收藏夾 (相容普通影片與慶典頁)
    async function clickFavorite() {
        await waitAndClick('開啟收藏彈窗', 'div[title*="收藏"], div.video-toolbar-content_item', (el) => {
            return el.matches('div[title*="收藏"]') || el.querySelector('.ic_collection') !== null;
        });

        const favLabel = await waitForElement('尋找默認收藏夾', '.group-list label', (label) => {
            const favSpan = label.querySelector('span.fav-title');
            return favSpan && (favSpan.title === '默认收藏夹' || favSpan.textContent.includes('默认收藏夹'));
        });

        const checkbox = favLabel.querySelector('input[type="checkbox"]');
        if (checkbox && !checkbox.checked) {
            checkbox.click();
            await new Promise(r => setTimeout(r, 500));
        }

        await waitAndClick('點擊收藏確定', '.bottom .btn.submit-move:not([disabled])');
    }

    // 分享到動態 (相容普通影片與慶典頁)
    async function clickShareToDynamic() {
        const shareBtn = await waitForElement('移入分享按鈕', '#share-btn-outer, div.video-toolbar-content_item.share');
        shareBtn.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true, cancelable: true }));
        await new Promise(r => setTimeout(r, 500));

        await waitAndClick('點擊分享到動態', 'span.share-btn-text, span.share-btn', (el) => {
            const text = el.textContent.trim();
            return text.includes('动态') || text.includes('動態');
        });

        // 等待分享 iframe 出現並消失
        const iframe = await waitForElement('等待分享 iframe 出現', 'iframe[src*="t.bilibili.com/share/card/index"]');
        let waitCount = 0;
        while (document.body.contains(iframe) && waitCount++ < 30) {
            await new Promise(r => setTimeout(r, 1000));
        }

        shareBtn.dispatchEvent(new MouseEvent('mouseleave', { bubbles: true, cancelable: true }));
    }

    // 影片頁按鍵監聽
    let isProcessing = false;
    document.addEventListener('keydown', async function (e) {
        const activeTag = document.activeElement ? document.activeElement.tagName.toLowerCase() : '';
        if (activeTag === 'input' || activeTag === 'textarea' || document.activeElement?.isContentEditable) {
            return;
        }

        if (e.key === 'F8' && !e.shiftKey && !e.ctrlKey && !e.altKey) {
            if (isProcessing) {
                showToast('⚠️ 三連流程正在執行中，請稍候...');
                return;
            }

            isProcessing = true;
            showToast('🚀 開始執行一鍵三連流程...');

            try {
                await clickLike();
                await clickFavorite();
                await clickShareToDynamic();
                showToast('🎉 一鍵三連全部執行完畢！');
            } catch (err) {
                console.error('[Bilibili 助手] 流程中斷:', err);
                showToast(`❌ 三連中斷: ${err.message}`, true);
            } finally {
                isProcessing = false;
            }
        }
    });
})();
