// ==UserScript==
// @name         Bilibili-一鍵三連-F8 (全頁面通用版)
// @namespace    http://tampermonkey.net/
// @version      5.0
// @description  F8 一鍵 B 站 三連：點贊、收藏到默認、分享到動態自動發布。完整支援一般影片頁 (/video/*)、清單頁 (/list/*) 與慶典活動頁 (/festival/*)
// @author       You / Antigravity
// @match        https://www.bilibili.com/video/*
// @match        https://www.bilibili.com/list/*
// @match        https://www.bilibili.com/festival/*
// @match        https://t.bilibili.com/share/card/index?*
// @run-at       document-end
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    // 判斷是否在分享動態 iframe 中
    if (window.location.hostname === 't.bilibili.com' && window.location.pathname.includes('/share/card/index')) {
        runIframeLogic();
        return;
    }

    // --- Toast 狀態通知 ---
    function showToast(msg, isError = false) {
        const toast = document.createElement('div');
        toast.textContent = msg;
        toast.style.cssText = `
            position: fixed;
            bottom: 80px;
            right: 30px;
            background: ${isError ? 'rgba(239, 68, 68, 0.95)' : 'rgba(0, 161, 214, 0.95)'};
            color: #fff;
            padding: 10px 18px;
            border-radius: 6px;
            font-size: 14px;
            font-weight: 500;
            z-index: 999999;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
            pointer-events: none;
            transition: opacity 0.4s ease;
        `;
        document.body.appendChild(toast);
        setTimeout(() => {
            toast.style.opacity = '0';
            setTimeout(() => toast.remove(), 400);
        }, 2500);
    }

    // --- Helper Functions ---

    /**
     * 等待元素出現並符合過濾條件（具備重試上限，防止記憶體洩漏）
     * @param {string} stepName 步驟名稱
     * @param {string} selector CSS 選擇器
     * @param {function} filterFn 過濾函數 (element) => boolean
     * @param {number} maxAttempts 最大重試次數
     * @param {number} interval 重試間隔 (ms)
     * @returns {Promise<Element>}
     */
    async function waitForElement(stepName, selector, filterFn = () => true, maxAttempts = 30, interval = 500) {
        for (let i = 0; i < maxAttempts; i++) {
            const elements = document.querySelectorAll(selector);
            for (let el of elements) {
                if (filterFn(el)) {
                    console.log(`[Bilibili F8] 找到目標元素: ${selector}, 執行行為: ${stepName}`);
                    return el;
                }
            }
            console.log(`[Bilibili F8] 步驟: ${stepName}，持續尋找中 (${i + 1}/${maxAttempts}) ${selector}...`);
            await new Promise(r => setTimeout(r, interval));
        }
        throw new Error(`[Bilibili F8] 超時未找到目標元素: ${selector} (${stepName})`);
    }

    /**
     * 等待元素出現並點擊
     */
    async function waitAndClick(stepName, selector, filterFn = () => true) {
        const el = await waitForElement(stepName, selector, filterFn);
        el.click();
        await new Promise(r => setTimeout(r, 800));
    }

    // --- Iframe 內部邏輯 ---

    async function runIframeLogic() {
        console.log('[Bilibili F8] Running inside share iframe.');
        try {
            // 1. 點擊發布按鈕
            await waitAndClick('發布動態', 'button.share-btn.clickable', (el) =>
                el.innerText.includes('发布') || el.innerText.includes('發布')
            );
            // 2. 點擊關閉按鈕
            await waitAndClick('關閉分享成功彈窗', 'button.success-btn', (el) =>
                el.innerText.includes('关闭') || el.innerText.includes('關閉')
            );
        } catch (err) {
            console.error('[Bilibili F8] Iframe 內部操作失敗:', err);
        }
    }

    // --- 主頁面邏輯 ---

    // 1. 點贊 (相容一般影片與慶典頁面)
    async function clickLike() {
        await waitAndClick('點贊', 'div[title*="点赞"], div.video-toolbar-content_item', (el) => {
            return el.matches('div[title*="点赞"]') || el.querySelector('.ic_like') !== null;
        });
    }

    // 2. 收藏到默認收藏夾 (相容一般影片與慶典頁面)
    async function clickFavorite() {
        // A. 點擊收藏按鈕
        await waitAndClick('開啟收藏彈窗', 'div[title*="收藏"], div.video-toolbar-content_item', (el) => {
            return el.matches('div[title*="收藏"]') || el.querySelector('.ic_collection') !== null;
        });

        // B. 尋找「默認收藏夾」並勾選
        const favLabel = await waitForElement('尋找默認收藏夾', '.group-list label', (label) => {
            const favSpan = label.querySelector('span.fav-title');
            return favSpan && (favSpan.title === '默认收藏夹' || favSpan.textContent.includes('默认收藏夹'));
        });

        const checkbox = favLabel.querySelector('input[type="checkbox"]');
        if (checkbox && !checkbox.checked) {
            console.log('[Bilibili F8] 執行行為: 勾選默認收藏夾');
            checkbox.click();
            await new Promise(r => setTimeout(r, 500));
        } else {
            console.log('[Bilibili F8] 默認收藏夾已勾選，跳過');
        }

        // C. 點擊確定
        await waitAndClick('點擊收藏確定', '.bottom .btn.submit-move:not([disabled])');
    }

    // 3. 分享到動態 (相容一般影片與慶典頁面)
    async function clickShareToDynamic() {
        // A. 移入分享按鈕
        const shareBtn = await waitForElement('移入分享按鈕', '#share-btn-outer, div.video-toolbar-content_item.share');
        console.log('[Bilibili F8] 執行行為: hover 分享按鈕');
        shareBtn.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true, cancelable: true }));
        await new Promise(r => setTimeout(r, 500));

        // B. 點擊「動態」
        await waitAndClick('點擊分享到動態', 'span.share-btn-text, span.share-btn', (el) => {
            const text = el.textContent.trim();
            return text.includes('动态') || text.includes('動態');
        });

        // C. 監控分享彈窗關閉
        await monitorShareDialog(shareBtn);
    }

    // 監控分享視窗，等它關閉後再關閉分享菜單
    async function monitorShareDialog(shareBtn) {
        const iframe = await waitForElement('等待分享 iframe 出現', 'iframe[src*="t.bilibili.com/share/card/index"]');
        let waitCount = 0;
        const maxWait = 30; // 最多等待 30 秒

        while (document.body.contains(iframe) && waitCount++ < maxWait) {
            console.log('[Bilibili F8] 步驟: 等待分享完成 (iframe 消失), 持續監測中...');
            await new Promise(r => setTimeout(r, 1000));
        }

        console.log('[Bilibili F8] 目標 iframe 消失或超時, 關閉分享菜單');
        shareBtn.dispatchEvent(new MouseEvent('mouseleave', { bubbles: true, cancelable: true }));
    }

    // --- 主流程（F8熱鍵） ---
    let isProcessing = false;

    document.addEventListener('keydown', async function (e) {
        // 排除輸入框按鍵誤觸
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
            console.log('[Bilibili F8] 開始執行三連流程...');

            try {
                await clickLike();
                await clickFavorite();
                await clickShareToDynamic();
                showToast('🎉 一鍵三連全部執行完畢！');
                console.log('[Bilibili F8] 三連流程全部執行完畢！');
            } catch (err) {
                console.error('[Bilibili F8] 流程中斷:', err);
                showToast(`❌ 三連流程中斷: ${err.message}`, true);
            } finally {
                isProcessing = false;
            }
        }
    });
})();
