// ==UserScript==
// @name         YouTube 批量加入播放清單 (適配全新介面版)
// @namespace    http://tampermonkey.net/
// @version      5.0
// @description  支援 2024 最新 yt-list-item-view-model 結構，純實體按鈕
// @match        *://*.youtube.com/*
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    // window.addEventListener('yt-navigate-finish', checkAndInjectButton);
    // if (document.body) checkAndInjectButton();
    // else document.addEventListener('DOMContentLoaded', checkAndInjectButton);

    // function checkAndInjectButton() {
    //     const isWatchPage = window.location.pathname.includes('/watch');
    //     const existingBtn = document.getElementById('my-batch-save-btn');

    //     if (!isWatchPage) {
    //         if (existingBtn) existingBtn.style.display = 'none';
    //         return;
    //     }

    //     if (!existingBtn) {
    //         createFloatingButton();
    //     } else {
    //         existingBtn.style.display = 'block';
    //     }
    // }

    // function createFloatingButton() {
    //     const btn = document.createElement('button');
    //     btn.id = 'my-batch-save-btn';
    //     btn.innerHTML = '📚 批量加入清單';
    //     btn.style.cssText = `
    //         position: fixed; bottom: 20px; left: 20px; z-index: 9999999;
    //         background: #3ea6ff; color: #000; border: none; border-radius: 20px;
    //         padding: 10px 16px; font-weight: bold; font-size: 14px;
    //         cursor: pointer; box-shadow: 0 4px 10px rgba(0,0,0,0.5);
    //         transition: transform 0.2s, background 0.2s;
    //     `;

    //     btn.onmouseover = () => { btn.style.background = '#65b8ff'; btn.style.transform = 'scale(1.05)'; };
    //     btn.onmouseout = () => { btn.style.background = '#3ea6ff'; btn.style.transform = 'scale(1)'; };

    //     btn.onclick = async () => {
    //         btn.innerText = '處理中...';
    //         btn.style.pointerEvents = 'none';
    //         await initBatchSave();
    //         setTimeout(() => {
    //             btn.innerText = '📚 批量加入清單';
    //             btn.style.pointerEvents = 'auto';
    //         }, 2000);
    //     };

    //     document.body.appendChild(btn);
    // }

    async function initBatchSave() {
        let playlists = getPlaylistsFromDOM();

        if (playlists.length === 0) {
            const saveBtn = findSaveButton();
            if (!saveBtn) {
                alert('❌ 找不到 YouTube 的「儲存」按鈕！');
                return;
            }
            saveBtn.click();

            for (let i = 0; i < 20; i++) {
                await sleep(250);
                playlists = getPlaylistsFromDOM();
                if (playlists.length > 0) break;
            }
        }

        if (playlists.length === 0) {
            alert('❌ 依然無法讀取播放清單內容！請確認您的帳號有建立播放清單。');
            return;
        }

        // 新增隱藏新版容器 .ytContextualSheetLayoutContentContainer
        const dialogs = document.querySelectorAll('ytd-popup-container, tp-yt-paper-dialog, ytd-add-to-playlist-renderer, [role="dialog"], .ytContextualSheetLayoutContentContainer');
        dialogs.forEach(d => {
            if (d.offsetHeight > 0 || d.closest('[role="dialog"]')) {
                d.style.opacity = '0';
                d.style.pointerEvents = 'none';
                d.dataset.isHiddenByScript = 'true';
            }
        });

        showCustomUI(playlists);
    }

    // 核心解析邏輯 (加入對 yt-list-item-view-model 的支援)
    function getPlaylistsFromDOM() {
        // 新版與舊版的節點一網打盡
        const nodes = document.querySelectorAll('yt-list-item-view-model, ytd-playlist-add-to-option-renderer, tp-yt-paper-checkbox, [role="menuitemcheckbox"], [role="checkbox"]');
        const results = [];
        const seenNames = new Set();

        nodes.forEach(node => {
            if (!node.offsetParent) return; // 排除畫面外隱藏的元素

            let text = '';
            let isChecked = false;
            let clickTarget = node;

            // 判斷是否為全新的 yt-list-item-view-model 結構
            if (node.tagName.toLowerCase() === 'yt-list-item-view-model') {
                const titleEl = node.querySelector('.ytListItemViewModelTitle');
                if (titleEl) text = titleEl.textContent.trim();

                // 新版使用 aria-pressed 來標記是否勾選
                isChecked = node.getAttribute('aria-pressed') === 'true';

                const btn = node.querySelector('button');
                if (btn) {
                    clickTarget = btn; // 點擊目標是裡面的 button
                    if (btn.getAttribute('aria-pressed') === 'true') isChecked = true;
                }
            } else {
                // 相容舊版邏輯
                text = node.textContent.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();
                isChecked = node.classList.contains('checked') || node.getAttribute('aria-checked') === 'true';
                if (!isChecked) {
                    const child = node.querySelector('[aria-checked="true"], .checked');
                    if (child) isChecked = true;
                }
                clickTarget = node.querySelector('tp-yt-paper-checkbox') || node;
            }

            if (!text || text.includes('儲存至') || text.includes('新增播放清單') || text.includes('Save to') || text.includes('Create new')) return;
            if (seenNames.has(text)) return;

            seenNames.add(text);
            results.push({ name: text, element: clickTarget, isChecked: isChecked });
        });

        return results;
    }

    function findSaveButton() {
        const allButtons = document.querySelectorAll('button, yt-button-shape');
        for (let btn of allButtons) {
            const text = (btn.textContent || '').trim();
            const ariaLabel = btn.getAttribute('aria-label') || '';
            const title = btn.getAttribute('title') || '';

            if ((text.includes('儲存') || text.includes('Save') || ariaLabel.includes('儲存') || ariaLabel.includes('Save') || title.includes('儲存') || title.includes('Save'))) {
                if (btn.tagName.toLowerCase() !== 'button') {
                    const innerBtn = btn.querySelector('button');
                    if (innerBtn) return innerBtn;
                }
                return btn;
            }
        }
        return null;
    }

    function showCustomUI(playlists) {
        const overlay = document.createElement('div');
        overlay.id = 'batch-save-overlay';
        overlay.style.cssText = `
            position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
            background: rgba(0, 0, 0, 0.7); z-index: 9999999;
            display: flex; justify-content: center; align-items: center;
            font-family: sans-serif;
        `;

        const dialog = document.createElement('div');
        dialog.style.cssText = `
            background: #282828; color: #fff; padding: 20px 30px;
            border-radius: 12px; width: 420px; max-width: 90%;
            box-shadow: 0 10px 30px rgba(0,0,0,0.8);
            max-height: 80vh; display: flex; flex-direction: column;
        `;

        const title = document.createElement('h2');
        title.innerText = '批量加入播放清單';
        title.style.cssText = 'margin: 0 0 15px 0; font-size: 18px; border-bottom: 1px solid #444; padding-bottom: 10px; text-align: center;';
        dialog.appendChild(title);

        const listContainer = document.createElement('div');
        listContainer.style.cssText = 'overflow-y: auto; flex-grow: 1; margin-bottom: 20px; padding-right: 10px;';

        const checkboxes = [];
        playlists.forEach((pl, index) => {
            const label = document.createElement('label');
            label.style.cssText = `
                display: flex; align-items: center; padding: 12px 8px;
                cursor: pointer; border-bottom: 1px solid #383838;
                transition: background 0.2s; border-radius: 6px;
            `;
            label.onmouseover = () => label.style.background = '#3f3f3f';
            label.onmouseout = () => label.style.background = 'transparent';

            const input = document.createElement('input');
            input.type = 'checkbox';
            input.checked = pl.isChecked;
            input.style.cssText = 'margin-right: 15px; width: 20px; height: 20px; accent-color: #3ea6ff; cursor: pointer;';

            const text = document.createElement('span');
            text.innerText = pl.name;
            text.style.fontSize = '15px';
            text.style.userSelect = 'none';

            label.appendChild(input);
            label.appendChild(text);
            listContainer.appendChild(label);
            checkboxes.push(input);
        });
        dialog.appendChild(listContainer);

        const btnContainer = document.createElement('div');
        btnContainer.style.cssText = 'display: flex; justify-content: space-between; gap: 10px;';

        const selectAllBtn = document.createElement('button');
        selectAllBtn.innerText = '全選/全不選';
        selectAllBtn.style.cssText = 'padding: 8px 12px; border: 1px solid #555; background: #333; color: #fff; cursor: pointer; border-radius: 18px; font-size: 13px;';
        selectAllBtn.onclick = () => {
            const allChecked = checkboxes.every(cb => cb.checked);
            checkboxes.forEach(cb => cb.checked = !allChecked);
        };

        const rightBtns = document.createElement('div');
        rightBtns.style.cssText = 'display: flex; gap: 10px;';

        const cancelBtn = document.createElement('button');
        cancelBtn.innerText = '取消';
        cancelBtn.style.cssText = 'padding: 8px 16px; border: none; background: transparent; color: #aaa; cursor: pointer; border-radius: 18px; font-weight: bold; font-size: 14px;';
        cancelBtn.onclick = () => closeAll(overlay, false);

        const confirmBtn = document.createElement('button');
        confirmBtn.innerText = '確認加入';
        confirmBtn.style.cssText = 'padding: 8px 16px; border: none; background: #3ea6ff; color: #000; cursor: pointer; border-radius: 18px; font-weight: bold; font-size: 14px;';

        confirmBtn.onclick = async () => {
            confirmBtn.innerText = '處理中...';
            confirmBtn.disabled = true;
            cancelBtn.disabled = true;

            for (let i = 0; i < checkboxes.length; i++) {
                if (checkboxes[i].checked !== playlists[i].isChecked && playlists[i].element) {
                    playlists[i].element.click();
                    await sleep(250);
                }
            }

            closeAll(overlay, true);
        };

        rightBtns.appendChild(cancelBtn);
        rightBtns.appendChild(confirmBtn);
        btnContainer.appendChild(selectAllBtn);
        btnContainer.appendChild(rightBtns);
        dialog.appendChild(btnContainer);

        overlay.appendChild(dialog);
        document.body.appendChild(overlay);
    }

    function closeAll(overlay, showSuccess) {
        if (overlay) overlay.remove();

        const closeBtn = document.querySelector('ytd-popup-container #close-button, ytd-add-to-playlist-renderer #close-button');
        if (closeBtn) {
            closeBtn.click();
        } else {
            // 新版關閉方式有時候依賴背景點擊或 Escape
            document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
        }

        setTimeout(() => {
            document.querySelectorAll('[data-is-hidden-by-script="true"]').forEach(d => {
                d.style.opacity = '1';
                d.style.pointerEvents = 'auto';
                delete d.dataset.isHiddenByScript;
            });
        }, 500);

        if (showSuccess) showToast('✅ 已成功將影片加入指定的播放清單！');
    }

    function showToast(msg) {
        const toast = document.createElement('div');
        toast.innerText = msg;
        toast.style.cssText = `
            position: fixed; bottom: 30px; left: 50%; transform: translateX(-50%);
            background: #3ea6ff; color: #000; padding: 12px 24px; border-radius: 8px;
            font-weight: bold; z-index: 9999999; box-shadow: 0 4px 15px rgba(0,0,0,0.3);
            transition: opacity 0.5s; pointer-events: none;
        `;
        document.body.appendChild(toast);
        setTimeout(() => {
            toast.style.opacity = '0';
            setTimeout(() => toast.remove(), 500);
        }, 2500);
    }

    function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

    // 變更為 Shift + F8 啟動
    window.addEventListener('keydown', function (e) {
        if (e.key === 'F8') {
            initBatchSave();
        }
    });

})();