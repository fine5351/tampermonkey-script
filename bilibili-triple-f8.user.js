// ==UserScript==
// @name         Bilibili-三連-F8
// @namespace    http://tampermonkey.net/
// @version      4.2
// @description  F8 一鍵 B 站 三連：點贊、收藏到默認、分享到動態自動發布（每步驟皆為 function）
// @match        https://www.bilibili.com/video/*
// @match        https://www.bilibili.com/list/*
// @match        https://t.bilibili.com/share/card/index?*
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    // 判斷是否在分享 iframe 中
    if (window.location.hostname === 't.bilibili.com' && window.location.pathname.includes('/share/card/index')) {
        runIframeLogic();
        return;
    }

    // --- Helper Functions ---

    /**
     * 等待元素出現並符合過濾條件
     * @param {string} stepName 步驟名稱
     * @param {string} selector CSS 選擇器
     * @param {function} filterFn 過濾函數 (element) => boolean
     * @returns {Promise<Element>}
     */
    async function waitForElement(stepName, selector, filterFn = (el) => true) {
        while (true) {
            const elements = document.querySelectorAll(selector);
            for (let el of elements) {
                if (filterFn(el)) {
                    console.log(`[Bilibili F8] 找到目標元素: ${selector}, 執行行為: ${stepName}`);
                    return el;
                }
            }
            console.log(`[Bilibili F8] 步驟 : ${stepName}, 持續尋找中 ${selector}...`);
            await new Promise(r => setTimeout(r, 500));
        }
    }

    /**
     * 等待元素出現並點擊
     * @param {string} stepName 步驟名稱
     * @param {string} selector CSS 選擇器
     * @param {function} filterFn 過濾函數
     */
    async function waitAndClick(stepName, selector, filterFn = (el) => true) {
        const el = await waitForElement(stepName, selector, filterFn);
        el.click();
        // 給予 UI 反應時間
        await new Promise(r => setTimeout(r, 800));
    }

    // --- Iframe 內部邏輯 ---

    async function runIframeLogic() {
        console.log('[Bilibili F8] Running inside share iframe.');

        // 1. 點擊發布按鈕
        await waitAndClick('發布動態', 'button.share-btn.clickable', (el) => el.innerText.includes('发布'));

        // 2. 點擊關閉按鈕
        await waitAndClick('關閉分享成功彈窗', 'button.success-btn', (el) => el.innerText.includes('关闭'));
    }

    // --- 主頁面邏輯 ---

    // 1. 點贊
    async function clickLike() {
        await waitAndClick('點贊', 'div[title="点赞（Q）"]');
    }

    // 2. 收藏到默認收藏夾
    async function clickFavorite() {
        // A. 點擊收藏按鈕
        await waitAndClick('開啟收藏彈窗', 'div[title="收藏（E）"]');

        // B. 尋找「默認收藏夾」並勾選
        const favLabel = await waitForElement('尋找默認收藏夾', '.group-list label', (label) => {
            const favSpan = label.querySelector('span.fav-title');
            return favSpan && favSpan.title === '默认收藏夹';
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

    // 3. 分享到動態
    async function clickShareToDynamic() {
        // A. 移入分享按鈕
        const shareBtn = await waitForElement('移入分享按鈕', '#share-btn-outer');
        console.log('[Bilibili F8] 執行行為: hover 分享按鈕');
        shareBtn.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true, cancelable: true }));
        await new Promise(r => setTimeout(r, 500));

        // B. 點擊「動態」
        await waitAndClick('點擊分享到動態', 'span.share-btn-text', (el) => el.innerText.trim() === '动态');

        // C. 監控分享彈窗關閉
        await monitorShareDialog(shareBtn);
    }

    // 監控分享視窗，等它關閉後再關閉分享菜單
    async function monitorShareDialog(shareBtn) {
        // 1. 等待 iframe 出現
        const iframe = await waitForElement('等待分享 iframe 出現', 'iframe[src*="t.bilibili.com/share/card/index"]');

        // 2. 等待 iframe 消失
        while (document.body.contains(iframe)) {
            console.log('[Bilibili F8] 步驟 : 等待分享完成 (iframe 消失), 持續監測中...');
            await new Promise(r => setTimeout(r, 1000));
        }

        console.log('[Bilibili F8] 找到目標元素: iframe 消失, 執行行為: 關閉分享菜單');
        shareBtn.dispatchEvent(new MouseEvent('mouseleave', { bubbles: true, cancelable: true }));
    }

    // --- 主流程（F8熱鍵） ---

    document.addEventListener('keydown', async function (e) {
        if (e.key === 'F8') {
            console.log('[Bilibili F8] 開始執行三連流程...');
            try {
                await clickLike();
                await clickFavorite();
                await clickShareToDynamic();
                console.log('[Bilibili F8] 三連流程全部執行完畢！');
            } catch (err) {
                console.error('[Bilibili F8] 流程中斷:', err);
            }
        }
    });
})();

