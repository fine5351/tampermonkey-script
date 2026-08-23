// ==UserScript==
// @name         小說鍵盤左右鍵翻頁
// @namespace    http://tampermonkey.net/
// @version      1.1
// @description  使用鍵盤方向鍵左、右來點擊上一章/頁、下一章/頁
// @match        *://*/*
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    // 定義翻頁關鍵字清單（繁簡通用）
    const PREV_KEYWORDS = ['上一章', '上一頁', '上一页', '上页', '上章', '前一章', '前一頁', '前一页', 'Previous'];
    const NEXT_KEYWORDS = ['下一章', '下一頁', '下一页', '下页', '下章', '後一章', '后一章', '後一頁', '后一页', 'Next'];

    document.addEventListener('keydown', function (event) {
        // 排除輸入框與可編輯區域
        const activeElement = document.activeElement;
        const tagName = activeElement ? activeElement.tagName.toLowerCase() : '';
        if (tagName === 'input' || tagName === 'textarea' || activeElement?.isContentEditable) {
            return;
        }

        let targetKeywords = null;
        if (event.key === 'ArrowLeft') {
            targetKeywords = PREV_KEYWORDS;
        } else if (event.key === 'ArrowRight') {
            targetKeywords = NEXT_KEYWORDS;
        }

        if (!targetKeywords) {
            return;
        }

        const links = document.querySelectorAll('a');
        for (const keyword of targetKeywords) {
            let found = false;
            for (const link of links) {
                const text = link.textContent.trim();
                // 優先精確匹配，避免誤觸包含關鍵字的長文本
                if (text === keyword || text.includes(keyword)) {
                    link.click();
                    found = true;
                    break;
                }
            }
            if (found) break;
        }
    });
})();