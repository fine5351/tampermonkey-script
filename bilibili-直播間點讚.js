// ==UserScript==
// @name         B站 - 直播自動點贊 - F8
// @namespace    http://tampermonkey.net/
// @version      0.2
// @description  每5秒自動點一次like-btn按鈕，僅限直播間
// @author       You
// @match        https://live.bilibili.com/*
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    let timer = null;

    function clickLikeBtn() {
        const btn = document.querySelector('.like-btn');
        if (btn) {
            btn.click();
        }
    }

    function start() {
        if (!timer) {
            clickLikeBtn();
            timer = setInterval(clickLikeBtn, 5000);
            console.log('自動點贊已啟動');
        }
    }

    function stop() {
        if (timer) {
            clearInterval(timer);
            timer = null;
            console.log('自動點贊已停止');
        }
    }

    document.addEventListener('keydown', function (e) {
        if (e.key === 'F8') {
            start();
        }
    });
})();
