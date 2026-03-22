// ==UserScript==
// @name         內鬼影片一鍵檢舉(Popup表單版)-Shift+F9
// @namespace    http://tampermonkey.net/
// @version      1.2.2
// @description  Shift+F9出現中央popup，由表單輸入內容，點寄出才開 Gmail
// @author       You
// @match        *://*/*
// @grant        none
// @run-at       document-end
// ==/UserScript==

(function () {
    'use strict';

    // Trusted Types workaround：只建立一次
    let htmlPolicy = null;
    if (window.trustedTypes && window.trustedTypes.createPolicy) {
        try {
            htmlPolicy = window.trustedTypes.createPolicy('default', {
                createHTML: (s) => s
            });
        } catch (e) {
            htmlPolicy = window.trustedTypes.getPolicy('default');
        }
    }

    function showPopup() {
        // 建立遮罩背景
        let overlay = document.createElement('div');
        overlay.style.position = "fixed";
        overlay.style.top = "0";
        overlay.style.left = "0";
        overlay.style.width = "100vw";
        overlay.style.height = "100vh";
        overlay.style.background = "rgba(0,0,0,0.2)";
        overlay.style.zIndex = "9998";

        // 建立popup表單
        let box = document.createElement('div');
        box.style.position = "fixed";
        box.style.top = "50%";
        box.style.left = "50%";
        box.style.transform = "translate(-50%,-50%)";
        box.style.background = "#fff";
        box.style.border = "2px solid #333";
        box.style.zIndex = "9999";
        box.style.padding = "32px 24px";
        box.style.boxShadow = "0 8px 24px rgba(0,0,0,.15)";
        box.style.fontSize = "16px";
        box.style.borderRadius = "10px";
        box.style.minWidth = "320px";
        box.style.textAlign = "left";

        let popupHtml = `
            <div style="font-weight:700;margin-bottom:12px;font-size:20px;">內鬼影片檢舉</div>
            <div>
                <label>遊戲代碼:&nbsp;
                    <select id="tp-game">
                        <option value="1">1=原神</option>
                        <option value="2">2=崩壞:星穹鐵道</option>
                        <option value="3">3=絕區零</option>
                    </select>
                </label>
            </div>
            <div style="margin-top:8px">
                <label>角色:&nbsp;<input id="tp-char" type="text" style="width:180px"></label>
            </div>
            <div style="margin-top:8px">
                <label>版本:&nbsp;<input id="tp-ver" type="text" style="width:100px"></label>
            </div>
            <div style="margin-top:8px">
                <label>網址(預設為目前頁):<br>
                    <input id="tp-url" type="text" value="${window.location.href}" style="width:240px">
                </label>
            </div>
            <div style="margin-top:18px;text-align:center;">
                <button id="tp-send" style="padding:8px 24px;font-size:16px;background:#e53e3e;color:#fff;border:none;border-radius:6px;cursor:pointer;">寄出</button>
                <button id="tp-cancel" style="padding:6px 20px;margin-left:12px;">取消</button>
            </div>
        `;

        // 使用 Trusted Types Policy
        if (htmlPolicy) {
            box.innerHTML = htmlPolicy.createHTML(popupHtml);
        } else {
            box.innerHTML = popupHtml;
        }

        document.body.appendChild(overlay);
        document.body.appendChild(box);

        // 寄出
        document.getElementById("tp-send").onclick = function () {
            let gameKey = document.getElementById("tp-game").value;
            let gameMap = {
                "1": { name: "原神", extra: "genshin_cs@nijigengames.com" },
                "2": { name: "崩壞:星穹鐵道", extra: "honkaistarrail_cs@nijigengames.com" },
                "3": { name: "絕區零", extra: "zzzcs@nijigengames.com" }
            };
            let gameName = gameMap[gameKey].name;
            let extraMail = gameMap[gameKey].extra;
            let url = document.getElementById("tp-url").value;
            let characters = document.getElementById("tp-char").value || "-";
            let version = document.getElementById("tp-ver").value || "-";
            let subject = encodeURIComponent(gameName + "內鬼檢舉");
            let toMail = "notice@service.mihoyo.com";
            let allMail = [toMail, extraMail].join(",");
            let contentArr = [
                "以下影片散佈未公布資訊",
                url,
                "角色:",
                characters,
                "版本:",
                version
            ];
            let body = encodeURIComponent(contentArr.join("\n"));
            let gmailURL = "https://mail.google.com/mail/?view=cm&fs=1&to=" + encodeURIComponent(allMail) + "&su=" + subject + "&body=" + body;

            window.open(gmailURL, "_blank");
            box.remove();
            overlay.remove();
        };

        // 取消
        document.getElementById("tp-cancel").onclick = function () {
            box.remove();
            overlay.remove();
        };
    }

    document.addEventListener('keydown', function (e) {
        if (e.shiftKey && e.key === 'F9') {
            showPopup();
        }
    });
})();
