// ==UserScript==
// @name         B站 - 一鍵檢舉全自動 - Shift+F8
// @namespace    https://bilibili.com/
// @version      1.8
// @description  Shift+F9 自動完成舉報流程：點擊舉報、選理由、填描述、點提交
// @match        https://www.bilibili.com/video/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    function clickReportSpan() {
        let retry = 0;
        let tryFind = setInterval(() => {
            const span = document.querySelector('span.video-complaint-info.video-toolbar-item-text');
            if (span && span.textContent.includes('稿件举报')) {
                span.click();
                clearInterval(tryFind);
                setTimeout(selectRumorTag, 400); // 等待彈窗與iframe載入
            }
            if (++retry > 30) clearInterval(tryFind);
        }, 400);
    }

    function selectRumorTag() {
        let retry = 0;
        let tryFind = setInterval(() => {
            const iframe = document.querySelector('div.bili-dialog-m iframe[name="appeal"]');
            if (iframe && iframe.contentWindow && iframe.contentDocument) {
                const doc = iframe.contentDocument;
                const tag = doc.querySelector('div.web-tag.reason-tag[data-tag-key="10034"] .radio');
                if (tag) {
                    tag.click();
                    clearInterval(tryFind);
                    setTimeout(fillDescription, 400, doc);
                }
            }
            if (++retry > 30) clearInterval(tryFind);
        }, 500);
    }

    function fillDescription(doc) {
        let retry = 0;
        let tryFind = setInterval(() => {
            const textarea = doc.querySelector('.web-textarea.description textarea');
            if (textarea) {
                textarea.value = "散布米哈遊未公布資訊";
                textarea.dispatchEvent(new Event('input', { bubbles: true }));
                clearInterval(tryFind);
                setTimeout(clickSubmit, 400, doc);
            }
            if (++retry > 20) clearInterval(tryFind);
        }, 400);
    }

    function clickSubmit(doc) {
        let retry = 0;
        let tryFind = setInterval(() => {
            const btn = doc.querySelector('div.operation-btn.confirm-btn');
            if (btn) {
                btn.click();
                clearInterval(tryFind);
            }
            if (++retry > 15) clearInterval(tryFind);
        }, 400);
    }

    window.addEventListener('keydown', function(e) {
        if (e.key === 'F8' && e.shiftKey) {
        clickReportSpan();
        }
    });
})();
