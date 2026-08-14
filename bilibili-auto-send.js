// ==UserScript==
// @name         Bilibili 直播自動彈幕發送 (修正版)
// @namespace    http://tampermonkey.net/
// @version      1.1
// @description  按F9設定並開啟/關閉自動發送彈幕功能
// @match        *://live.bilibili.com/*
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    let timer = null;
    let isRunning = false;

    // 觸發 Vue 雙向綁定更新
    function updateTextareaValue(textarea, text) {
        textarea.focus();

        // 透過原型鏈 Setter 賦值，避免被框架攔截覆蓋
        const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set;
        nativeInputValueSetter.call(textarea, text);

        // 派發相關輸入事件
        textarea.dispatchEvent(new Event('input', { bubbles: true }));
        textarea.dispatchEvent(new Event('change', { bubbles: true }));
    }

    function sendDanmaku(text) {
        // 定位當前畫面中的 textarea
        const textarea = document.querySelector('textarea.chat-input');

        // 尋找包含「发送」文字的發送按鈕
        const buttons = Array.from(document.querySelectorAll('button, .bl-button, div'));
        const sendButton = buttons.find(el => el.textContent.trim() === '发送' && el.offsetParent !== null);

        if (!textarea) {
            console.error('未找到彈幕輸入框 textarea.chat-input');
            return;
        }

        // 1. 寫入內容並觸發事件
        updateTextareaValue(textarea, text);

        // 2. 延遲執行發送（同時嘗試點擊按鈕與模擬 Enter 鍵）
        setTimeout(() => {
            if (sendButton) {
                sendButton.click();
            }

            // 備用方案：在 textarea 觸發 Enter 鍵事件
            const enterEvent = new KeyboardEvent('keydown', {
                key: 'Enter',
                code: 'Enter',
                keyCode: 13,
                which: 13,
                bubbles: true,
                cancelable: true
            });
            textarea.dispatchEvent(enterEvent);
        }, 150);
    }

    window.addEventListener('keydown', function (event) {
        // 僅響應獨立按下 F9（防止在輸入文字時誤觸）
        if (event.key === 'F9') {
            event.preventDefault();

            if (isRunning) {
                // 停止發送
                clearInterval(timer);
                timer = null;
                isRunning = false;
                alert('自動彈幕：已停止發送');
            } else {
                // 啟動發送流程
                const text = prompt('請輸入要自動發送的彈幕內容：');
                if (!text || text.trim() === '') {
                    return;
                }

                const intervalInput = prompt('請輸入發送間隔時間（秒）：', '10');
                if (intervalInput === null) return;

                const interval = parseFloat(intervalInput);
                if (isNaN(interval) || interval < 1) {
                    alert('輸入的時間無效，請設定大於等於 1 的數字。');
                    return;
                }

                isRunning = true;
                alert(`自動彈幕：已啟動。\n內容：${text}\n間隔：${interval} 秒\n再次按下 F9 即可停止。`);

                // 立即發送第一條
                sendDanmaku(text);

                // 循環發送
                timer = setInterval(() => {
                    sendDanmaku(text);
                }, interval * 1000);
            }
        }
    });
})();