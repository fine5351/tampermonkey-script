// ==UserScript==
// @name         Bilibili-直播助手-點讚與彈幕-F8-F9
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  B站直播間雙輔助工具：按 F8 開啟/關閉定時自動點讚，按 F9 設定並開啟/關閉定時自動發送彈幕，附帶輕量狀態通知
// @author       You / Antigravity
// @match        *://live.bilibili.com/*
// @run-at       document-end
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    // --- 狀態管理 ---
    let likeTimer = null;
    let isLikeRunning = false;

    let danmakuTimer = null;
    let isDanmakuRunning = false;
    let danmakuContent = '';
    let danmakuIntervalSec = 10;

    // --- Toast 狀態通知 ---
    function showToast(msg, isWarning = false) {
        const toast = document.createElement('div');
        toast.textContent = msg;
        toast.style.cssText = `
            position: fixed;
            bottom: 30px;
            right: 30px;
            background: ${isWarning ? 'rgba(239, 68, 68, 0.92)' : 'rgba(35, 173, 229, 0.92)'};
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
    // 1. 自動點讚邏輯 (F8)
    // ==========================================
    function clickLikeBtn() {
        const btn = document.querySelector('.like-btn, .live-skin-highlight-bg .like-btn');
        if (btn) {
            btn.click();
            console.log('[Bilibili 直播助手] 觸發點讚');
        } else {
            console.warn('[Bilibili 直播助手] 未找到點讚按鈕 .like-btn');
        }
    }

    function toggleAutoLike() {
        if (isLikeRunning) {
            clearInterval(likeTimer);
            likeTimer = null;
            isLikeRunning = false;
            showToast('⏹️ 自動點讚已停止');
            console.log('[Bilibili 直播助手] 自動點讚已停止');
        } else {
            clickLikeBtn();
            likeTimer = setInterval(clickLikeBtn, 5000);
            isLikeRunning = true;
            showToast('👍 自動點讚已啟動 (每 5 秒點擊一次)');
            console.log('[Bilibili 直播助手] 自動點讚已啟動');
        }
    }

    // ==========================================
    // 2. 自動彈幕發送邏輯 (F9)
    // ==========================================
    // 觸發 Vue / React 雙向綁定更新
    function updateTextareaValue(textarea, text) {
        textarea.focus();
        // 透過原生 Setter 賦值，避免被框架攔截
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

        if (!textarea) {
            console.error('[Bilibili 直播助手] 未找到彈幕輸入框 textarea.chat-input');
            return;
        }

        // 寫入文字
        updateTextareaValue(textarea, text);

        // 延遲點擊或模擬 Enter
        setTimeout(() => {
            if (sendButton) {
                sendButton.click();
            }
            const enterEvent = new KeyboardEvent('keydown', {
                key: 'Enter',
                code: 'Enter',
                keyCode: 13,
                which: 13,
                bubbles: true,
                cancelable: true
            });
            textarea.dispatchEvent(enterEvent);
            console.log('[Bilibili 直播助手] 彈幕發送完成: ', text);
        }, 150);
    }

    function toggleAutoDanmaku() {
        if (isDanmakuRunning) {
            clearInterval(danmakuTimer);
            danmakuTimer = null;
            isDanmakuRunning = false;
            showToast('⏹️ 自動彈幕已停止發送');
            console.log('[Bilibili 直播助手] 自動彈幕已停止');
        } else {
            const text = prompt('【自動彈幕】請輸入要定期發送的彈幕內容：', danmakuContent || '');
            if (!text || text.trim() === '') {
                return;
            }

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
            console.log(`[Bilibili 直播助手] 自動彈幕啟動: "${danmakuContent}", 間隔: ${danmakuIntervalSec}s`);

            // 立即發送第一條
            sendDanmaku(danmakuContent);

            // 定時發送
            danmakuTimer = setInterval(() => {
                sendDanmaku(danmakuContent);
            }, danmakuIntervalSec * 1000);
        }
    }

    // ==========================================
    // 3. 鍵盤監聽與清理
    // ==========================================
    window.addEventListener('keydown', function (e) {
        // 若在輸入框內按下，避免誤觸
        const activeTag = document.activeElement ? document.activeElement.tagName.toLowerCase() : '';
        const isEditing = activeTag === 'input' || activeTag === 'textarea' || document.activeElement?.isContentEditable;

        // F8: 切換自動點讚
        if (e.key === 'F8' && !e.shiftKey && !e.ctrlKey && !e.altKey && !isEditing) {
            e.preventDefault();
            toggleAutoLike();
        }

        // F9: 切換自動彈幕
        if (e.key === 'F9' && !e.shiftKey && !e.ctrlKey && !e.altKey) {
            e.preventDefault();
            toggleAutoDanmaku();
        }
    });

    // 頁面卸載時清理定時器
    window.addEventListener('beforeunload', () => {
        if (likeTimer) clearInterval(likeTimer);
        if (danmakuTimer) clearInterval(danmakuTimer);
    });
})();
