// ==UserScript==
// @name         YouTube-快速檢舉-Shift-F8
// @namespace    http://tampermonkey.net/
// @version      1.1
// @description  自動完成 YouTube 錯誤資訊檢舉流程（散佈官方未公布資訊, 是散佈錯誤資訊的行為）
// @author       Comet Assistant
// @match        https://www.youtube.com/watch*
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    // 主要流程入口
    async function reportMisinformation() {
        let moreBtn = document.querySelector('ytd-menu-renderer yt-icon-button');
        if (moreBtn) {
            moreBtn.click();
            await sleep(500);
        } else {
            alert('找不到更多選單按鈕');
            return;
        }

        let reportBtn = Array.from(document.querySelectorAll('yt-formatted-string.style-scope.ytd-menu-service-item-renderer'))
            .find(el => el.textContent.trim() === '檢舉');
        if (reportBtn) {
            reportBtn.click();
            await sleep(800);
        } else {
            alert('找不到檢舉按鈕');
            return;
        }

        let errorDiv = Array.from(document.querySelectorAll('div'))
            .find(div => div.textContent.trim() === '錯誤資訊');
        if (errorDiv) {
            errorDiv.click();
            await sleep(400);
        } else {
            alert('找不到「錯誤資訊」div');
            return;
        }

        let continueBtn = Array.from(document.querySelectorAll('yt-touch-feedback-shape.yt-spec-touch-feedback-shape--touch-response-inverse'))
            .find(el =>
                el.querySelector('.yt-spec-touch-feedback-shape__fill') &&
                // 可加強條件, 例如檢查附近有「繼續」文字
                (
                    el.parentElement && el.parentElement.textContent.includes('繼續')
                )
            );
        if (continueBtn) {
            continueBtn.click();
            await sleep(600);
        } else {
            alert('找不到「繼續」按鈕');
            return;
        }

        let textarea = document.querySelector('textarea.ytStandardsTextareaShapeTextarea');
        if (textarea) {
            textarea.focus();
            textarea.value = '散佈官方未公布資訊, 是散佈錯誤資訊的行為';
            textarea.dispatchEvent(new Event('input', { bubbles: true }));
            // 如需確保 DOM 更新可以再 sleep 一下
            await sleep(300);
        } else {
            alert('找不到輸入框');
            return;
        }

        let finalReportBtn = Array.from(document.querySelectorAll('yt-touch-feedback-shape.yt-spec-touch-feedback-shape--touch-response-inverse'))
            .find(el => el.parentElement && el.parentElement.textContent.includes('檢舉'));
        if (finalReportBtn) {
            finalReportBtn.click();
            await sleep(1000); // 加一秒等候
            let confirmFillBtn = document.querySelector('.yt-spec-touch-feedback-shape__fill');
            if (confirmFillBtn) {
                confirmFillBtn.dispatchEvent(new MouseEvent('click', {
                    bubbles: true,
                    cancelable: true,
                    view: window,
                    button: 0
                }));
            }
            await sleep(500);
        } else {
            alert('找不到檢舉送出按鈕');
            return;
        }

    }

    function sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // 變更為 Shift + F8 啟動
    window.addEventListener('keydown', function (e) {
        if (e.shiftKey && e.key === 'F8') {
            reportMisinformation();
        }
    });
})();
