// ==UserScript==
// @name         Universal-HTML5影片一鍵高畫質原圖截圖-Alt-S
// @namespace    https://github.com/
// @version      1.1
// @description  支援 Bilibili、YouTube 等全網 HTML5 播放器一鍵無損原畫截圖（Alt+S），自動提取原始解析度（如 1080p/4K）、時間戳記命名下載，並自動複製至剪貼簿
// @author       Antigravity
// @match        *://*/*
// @run-at       document-end
// @grant        GM_registerMenuCommand
// ==/UserScript==

(function () {
    'use strict';

    // --- 快門閃爍特效 ---
    function triggerFlashEffect() {
        const flash = document.createElement('div');
        flash.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100vw;
            height: 100vh;
            background: rgba(255, 255, 255, 0.4);
            z-index: 1000000;
            pointer-events: none;
            transition: opacity 0.25s ease-out;
        `;
        document.body.appendChild(flash);
        requestAnimationFrame(() => {
            flash.style.opacity = '0';
            setTimeout(() => flash.remove(), 250);
        });
    }

    // --- Toast 狀態通知 ---
    function showToast(msg, isError = false) {
        const toast = document.createElement('div');
        toast.textContent = msg;
        toast.style.cssText = `
            position: fixed;
            top: 40px;
            right: 40px;
            background: ${isError ? 'rgba(239, 68, 68, 0.95)' : 'rgba(16, 185, 129, 0.95)'};
            color: #fff;
            padding: 12px 20px;
            border-radius: 8px;
            font-size: 14px;
            font-weight: 600;
            z-index: 1000001;
            box-shadow: 0 6px 18px rgba(0, 0, 0, 0.25);
            pointer-events: none;
            transition: opacity 0.3s ease;
        `;
        document.body.appendChild(toast);
        setTimeout(() => {
            toast.style.opacity = '0';
            setTimeout(() => toast.remove(), 300);
        }, 2800);
    }

    // --- 尋找當前焦點或正在播放的 video ---
    function findActiveVideo() {
        const videos = Array.from(document.querySelectorAll('video'));
        if (videos.length === 0) return null;
        if (videos.length === 1) return videos[0];

        // 優先挑選正在播放且尺寸正常的影片
        const playing = videos.find(v => !v.paused && v.offsetWidth > 200 && v.offsetHeight > 100);
        if (playing) return playing;

        // 其次挑選可見面積最大的影片
        return videos.reduce((max, v) => (v.offsetWidth * v.offsetHeight > max.offsetWidth * max.offsetHeight ? v : max), videos[0]);
    }

    // --- 格式化秒數為 mm分ss秒 ---
    function formatTime(seconds) {
        const total = Math.floor(seconds);
        const m = Math.floor(total / 60);
        const s = total % 60;
        const pad = (n) => String(n).padStart(2, '0');
        return `${pad(m)}分${pad(s)}秒`;
    }

    // --- 取得安全乾淨的影片標題 ---
    function getCleanTitle() {
        let title = document.title || 'video';
        // 去除常見後綴
        title = title.replace(/_哔哩哔哩_bilibili.*$/i, '')
            .replace(/- YouTube.*$/i, '')
            .replace(/[\\/:*?"<>|]/g, '_')
            .trim();
        return title.substring(0, 60);
    }

    // --- 截圖核心流程 ---
    async function captureVideoFrame() {
        const video = findActiveVideo();
        if (!video) {
            showToast('⚠️ 畫面上未偵測到正在播放的 HTML5 影片', true);
            return;
        }

        if (!video.videoWidth || !video.videoHeight) {
            showToast('⚠️ 影片尚未載入影格數據', true);
            return;
        }

        try {
            const canvas = document.createElement('canvas');
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;

            const ctx = canvas.getContext('2d');
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

            triggerFlashEffect();

            canvas.toBlob(async (blob) => {
                if (!blob) {
                    showToast('❌ 截圖生成失敗 (Canvas toBlob null)', true);
                    return;
                }

                const timeStr = formatTime(video.currentTime);
                const filename = `${getCleanTitle()}_${timeStr}_${canvas.width}x${canvas.height}.png`;

                // 1. 自動觸發檔案下載
                const downloadUrl = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = downloadUrl;
                a.download = filename;
                document.body.appendChild(a);
                a.click();
                setTimeout(() => {
                    a.remove();
                    URL.revokeObjectURL(downloadUrl);
                }, 1000);

                // 2. 嘗試寫入剪貼簿 (現代瀏覽器原生支援)
                let clipboardSuccess = false;
                if (navigator.clipboard && window.ClipboardItem) {
                    try {
                        await navigator.clipboard.write([
                            new ClipboardItem({ 'image/png': blob })
                        ]);
                        clipboardSuccess = true;
                    } catch (e) {
                        // 某些網站限制非使用者主動點擊權限，忽略
                    }
                }

                const clipText = clipboardSuccess ? '已下載並複製至剪貼簿' : '已自動下載';
                showToast(`📸 截圖成功！(${canvas.width}×${canvas.height}) ${clipText}`);
            }, 'image/png');
        } catch (err) {
            console.error('[Video Screenshot] 截圖發生錯誤:', err);
            // 常見於跨域 video 標籤觸發 CORS 污點畫布
            if (err.name === 'SecurityError') {
                showToast('❌ 截圖失敗：影片伺服器限制跨域存取 (CORS Tainted Canvas)', true);
            } else {
                showToast(`❌ 截圖異常: ${err.message}`, true);
            }
        }
    }

    // --- 鍵盤快速鍵監聽 (Alt + S，採用捕獲階段 Capture Phase 避開 YouTube 播放器內部攔截) ---
    function onKeyDown(e) {
        const activeTag = document.activeElement ? document.activeElement.tagName.toLowerCase() : '';
        if (activeTag === 'input' || activeTag === 'textarea' || document.activeElement?.isContentEditable) {
            return;
        }

        // Alt + S 啟動截圖 (支援實體鍵 code 與 key，相容微軟注音輸入法模式)
        if (e.altKey && !e.shiftKey && !e.ctrlKey && (e.code === 'KeyS' || e.key === 's' || e.key === 'S')) {
            e.preventDefault();
            e.stopPropagation();
            captureVideoFrame();
        }
    }

    window.addEventListener('keydown', onKeyDown, true);
    document.addEventListener('keydown', onKeyDown, true);

    // --- 註冊 Tampermonkey 選單指令 ---
    if (typeof GM_registerMenuCommand === 'function') {
        GM_registerMenuCommand("📸 HTML5 影片截圖 (Alt+S)", () => {
            captureVideoFrame();
        });
    }

    console.log('[Video Screenshot] ✅ 腳本已就緒 (v1.1)，快捷鍵: Alt + S');
})();
