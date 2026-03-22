// ==UserScript==
// @name         Pikabu 聊天紀錄匯出
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  匯出 Pikabu 聊天的對話紀錄，並標記時間與發言人
// @author       You
// @match        https://pikabu.cc/*
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    function exportChat() {
        // 根據使用者提供的 HTML 範例，對話容器為 .sc-1irw3gb-0
        const rows = document.querySelectorAll('.sc-1irw3gb-0');
        if (rows.length === 0) {
            alert("未找到對話紀錄 (找不到對應的對話元素)，請確認目前是否在聊天室頁面內，或網頁結構已改變。");
            return;
        }

        let chatText = "--- Pikabu 對話紀錄匯出 ---\n\n";

        rows.forEach(row => {
            // 判斷發言人：對方發言會帶有頭像 (img 標籤)，我方發言沒有 img 標籤
            const isSelf = !row.querySelector('img');
            const senderName = isSelf ? "我" : "對方";

            // 取得時間：結構中通常是最後一個子元素 (例如 class: .sc-cWxvLb)
            const timeEl = row.lastElementChild;
            const timeText = timeEl ? timeEl.innerText.trim() : "";

            // 取得對話內容：通常在 .sc-1irw3gb-3 內部的 span，或倒數第二個元素內
            let msgText = "";
            const msgContainer = row.querySelector('.sc-1irw3gb-3');

            if (msgContainer) {
                // 若有這層結構直接取文字
                msgText = msgContainer.innerText.trim();
            } else {
                // 如果結構改變的 fallback 機制：複製節點並剃除不需要的部分
                const clone = row.cloneNode(true);
                // 移除時間標籤
                if (clone.lastElementChild) {
                    clone.removeChild(clone.lastElementChild);
                }
                // 移除所有 img 及其頭像外層容器
                const imgs = clone.querySelectorAll('img');
                imgs.forEach(img => {
                    let parent = img.parentElement;
                    // 向上找幾層，避免刪除到整行
                    while (parent && parent !== clone && parent.innerText === "") {
                        parent = parent.parentElement;
                    }
                    if (parent && parent !== clone) {
                        parent.remove();
                    } else {
                        img.remove();
                    }
                });
                msgText = clone.innerText.trim().replace(/\n/g, ' ');
            }

            chatText += `[${timeText}] ${senderName}: ${msgText}\n`;
        });

        // 建立 Blob 並將對話內容寫入檔案下載
        const blob = new Blob([chatText], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');

        // 產出帶有時間格式的檔名
        const now = new Date();
        const timeStr = `${now.getFullYear()}${(now.getMonth() + 1).toString().padStart(2, '0')}${now.getDate().toString().padStart(2, '0')}_${now.getHours().toString().padStart(2, '0')}${now.getMinutes().toString().padStart(2, '0')}`;

        a.href = url;
        a.download = `pikabu_chat_${timeStr}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    // 將「匯出對話紀錄」按鈕加入畫面中
    function injectButton() {
        if (document.getElementById('pikabu-export-btn')) return;

        const btn = document.createElement('button');
        btn.id = 'pikabu-export-btn';
        btn.innerText = '匯出對話紀錄';
        btn.style.position = 'fixed';
        btn.style.bottom = '80px'; // 放右下角避免擋住上方導覽列
        btn.style.right = '20px';
        btn.style.zIndex = '999999';
        btn.style.padding = '12px 18px';
        btn.style.backgroundColor = '#0084FF'; // 使用藍色基調
        btn.style.color = '#FFFFFF';
        btn.style.border = 'none';
        btn.style.borderRadius = '24px';
        btn.style.cursor = 'pointer';
        btn.style.boxShadow = '0 4px 6px rgba(0,0,0,0.3)';
        btn.style.fontWeight = 'bold';
        btn.style.fontSize = '14px';

        // Hover 效果
        btn.onmouseover = () => { btn.style.backgroundColor = '#0066CC'; };
        btn.onmouseout = () => { btn.style.backgroundColor = '#0084FF'; };

        btn.addEventListener('click', exportChat);
        document.body.appendChild(btn);
    }

    // Pikabu 可能為 SPA (Single Page Application)，
    // 使用 MutationObserver 來確保路由切換到 /chat 頁面時，按鈕能重新顯示。
    const observer = new MutationObserver(() => {
        if (window.location.href.includes('/chat')) {
            injectButton();
        } else {
            const btn = document.getElementById('pikabu-export-btn');
            if (btn) btn.remove();
        }
    });

    observer.observe(document.body, { childList: true, subtree: true });

    // 初次載入時檢查是否在聊天室
    if (window.location.href.includes('/chat')) {
        injectButton();
    }
})();
