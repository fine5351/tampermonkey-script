// ==UserScript==
// @name         TWKAN 鍵盤左右鍵翻頁
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  使用鍵盤方向鍵左、右來點擊上一章、下一章
// @match        *://twkan.com/*
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    document.addEventListener('keydown', function (event) {
        // 避免在輸入框等元素中觸發
        const tagName = event.target.tagName.toLowerCase();
        if (tagName === 'input' || tagName === 'textarea') {
            return;
        }

        let linkTextToFind = "";

        if (event.key === 'ArrowLeft') {
            linkTextToFind = "上一章";
        } else if (event.key === 'ArrowRight') {
            linkTextToFind = "下一章";
        }

        if (linkTextToFind !== "") {
            const links = document.querySelectorAll('a');
            for (let i = 0; i < links.length; i++) {
                if (links[i].textContent.includes(linkTextToFind)) {
                    links[i].click();
                    break;
                }
            }
        }
    });
})();