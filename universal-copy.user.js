// ==UserScript==
// @name         萬能網頁複製與解除右鍵限制
// @namespace    https://github.com/
// @version      1.0
// @description  自動解除任何網頁的複製限制、右鍵選單限制、文字選取限制，並提供選單自訂強制解除模式
// @author       Antigravity
// @match        *://*/*
// @run-at       document-start
// @grant        GM_registerMenuCommand
// @grant        GM_unregisterMenuCommand
// @grant        GM_getValue
// @grant        GM_setValue
// ==/UserScript==

(function() {
    'use strict';

    // Global toggle for Aggressive Force Mode
    let isForceMode = GM_getValue('force_copy_mode', false);
    let menuCommandId = null;

    // Helper to register/update Tampermonkey menu command
    function updateMenuCommand() {
        if (menuCommandId !== null) {
            GM_unregisterMenuCommand(menuCommandId);
        }
        const label = isForceMode ? "🔴 關閉「超強強制解鎖模式」" : "⚡ 開啟「超強強制解鎖模式」(針對頑固站點)";
        menuCommandId = GM_registerMenuCommand(label, () => {
            isForceMode = !isForceMode;
            GM_setValue('force_copy_mode', isForceMode);
            alert(isForceMode ? "已開啟超強強制解鎖模式！\n頁面將會重新整理以載入設定。" : "已關閉超強解鎖模式。\n頁面將會重新整理。");
            location.reload();
        });
    }
    updateMenuCommand();

    // 1. CSS User-Select Override
    function injectStyles() {
        if (document.getElementById('uc-global-styles')) return;
        const style = document.createElement('style');
        style.id = 'uc-global-styles';
        style.textContent = `
            /* Force select capability on all elements */
            html, body, *, p, span, div, article, section, pre, code, blockquote, h1, h2, h3, h4, h5, h6 {
                user-select: text !important;
                -webkit-user-select: text !important;
                -moz-user-select: text !important;
                -ms-user-select: text !important;
            }
            /* Bypass transparent selection mask overlays */
            .uc-no-pointer {
                pointer-events: none !important;
            }
        `;
        document.documentElement.appendChild(style);
    }
    
    // Inject style immediately at document-start (on documentElement)
    if (document.documentElement) {
        injectStyles();
    } else {
        const observer = new MutationObserver((mutations, obs) => {
            if (document.documentElement) {
                injectStyles();
                obs.disconnect();
            }
        });
        observer.observe(document, { childList: true, subtree: true });
    }

    // 2. Capture-phase Event Interception
    // By calling stopPropagation in the capture phase, we prevent the webpage's custom scripts
    // from intercepting the event and executing e.preventDefault() to block the action.
    const bypassEvents = ['contextmenu', 'copy', 'cut', 'selectstart', 'dragstart'];
    
    function eventHandler(e) {
        e.stopPropagation();
        return true;
    }

    bypassEvents.forEach(eventName => {
        document.addEventListener(eventName, eventHandler, true);
        window.addEventListener(eventName, eventHandler, true);
    });

    // 3. Clear Inline Attributes & Stubborn Restrictions on DOMContentLoaded
    function cleanRestrictions() {
        const targets = [document, document.body, document.documentElement];
        targets.forEach(target => {
            if (!target) return;
            // Remove inline script event blocks
            target.oncontextmenu = null;
            target.oncopy = null;
            target.oncut = null;
            target.onselectstart = null;
            target.ondragstart = null;
            target.onmousedown = null;
            target.onmouseup = null;
            target.onkeydown = null;
            target.onkeypress = null;
        });

        // Clean classes or attributes that block copy
        const allElements = document.getElementsByTagName('*');
        for (let i = 0; i < allElements.length; i++) {
            const el = allElements[i];
            
            // Clean common attribute-based locks
            if (el.getAttribute('oncontextmenu')) el.removeAttribute('oncontextmenu');
            if (el.getAttribute('oncopy')) el.removeAttribute('oncopy');
            if (el.getAttribute('onselectstart')) el.removeAttribute('onselectstart');
            
            // Clean absolute-positioned transparent overlays in Force Mode
            if (isForceMode) {
                const style = window.getComputedStyle(el);
                if (style.position === 'absolute' || style.position === 'fixed') {
                    const zIndex = parseInt(style.zIndex, 10);
                    const opacity = parseFloat(style.opacity);
                    const bg = style.backgroundColor;
                    const isTransparent = bg === 'transparent' || bg.includes('rgba(0, 0, 0, 0)') || opacity === 0;
                    if (zIndex > 0 && isTransparent) {
                        // Mark transparent absolute layers to ignore mouse events
                        el.classList.add('uc-no-pointer');
                    }
                }
            }
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', cleanRestrictions);
    } else {
        cleanRestrictions();
    }

    // Secondary cleanup on full load
    window.addEventListener('load', cleanRestrictions);

    // 4. Force Mode Aggressive Overrides
    if (isForceMode) {
        // Prevent keydown checks that disable Developer Tools or copy hotkeys
        window.addEventListener('keydown', function(e) {
            // Allow Ctrl+C, Ctrl+V, Ctrl+X, Ctrl+A, F12, Ctrl+Shift+I
            const key = e.key.toLowerCase();
            const isCopyPaste = (e.ctrlKey || e.metaKey) && ['c', 'v', 'x', 'a'].includes(key);
            const isDevTools = e.keyCode === 123 || ((e.ctrlKey || e.metaKey) && e.shiftKey && key === 'i');
            
            if (isCopyPaste || isDevTools) {
                e.stopPropagation();
                return true;
            }
        }, true);
    }
})();
