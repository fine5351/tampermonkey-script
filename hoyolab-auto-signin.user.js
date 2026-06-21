// ==UserScript==
// @name         HoYoLAB 遊戲四合一自動簽到助手
// @namespace    https://github.com/
// @version      1.0
// @description  自動簽到 Genshin, Star Rail, Honkai 3rd, ZZZ，支援自訂時間與通知
// @author       Antigravity
// @match        https://*.hoyolab.com/*
// @match        https://*.youtube.com/*
// @match        https://*.bilibili.com/*
// @match        https://*.google.com/*
// @grant        GM_xmlhttpRequest
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_registerMenuCommand
// @grant        GM_notification
// @connect      sg-hk4e-api.hoyolab.com
// @connect      sg-public-api.hoyolab.com
// @run-at       document-end
// ==/UserScript==

(function () {
    'use strict';

    // Game definitions
    const GAMES = {
        ys: {
            id: 'ys',
            name: "原神",
            act_id: "e202102251931481",
            infoUrl: "https://sg-hk4e-api.hoyolab.com/event/sol/info?act_id=e202102251931481",
            signUrl: "https://sg-hk4e-api.hoyolab.com/event/sol/sign",
            headers: {}
        },
        sr: {
            id: 'sr',
            name: "崩壞：星穹鐵道",
            act_id: "e202303301540311",
            infoUrl: "https://sg-public-api.hoyolab.com/event/luna/os/info?act_id=e202303301540311",
            signUrl: "https://sg-public-api.hoyolab.com/event/luna/os/sign",
            headers: {}
        },
        hi3: {
            id: 'hi3',
            name: "崩壞3rd",
            act_id: "e202110291205111",
            infoUrl: "https://sg-public-api.hoyolab.com/event/mani/info?act_id=e202110291205111",
            signUrl: "https://sg-public-api.hoyolab.com/event/mani/sign",
            headers: {}
        },
        zzz: {
            id: 'zzz',
            name: "絕區零",
            act_id: "e202406031448091",
            infoUrl: "https://sg-public-api.hoyolab.com/event/luna/zzz/os/info?act_id=e202406031448091",
            signUrl: "https://sg-public-api.hoyolab.com/event/luna/zzz/os/sign",
            headers: {
                "x-rpc-signgame": "zzz"
            }
        }
    };

    // Helper: Wrap GM_xmlhttpRequest in a Promise
    function request(options) {
        return new Promise((resolve, reject) => {
            GM_xmlhttpRequest({
                method: options.method || "GET",
                url: options.url,
                headers: Object.assign({
                    "Content-Type": "application/json",
                    "Accept": "application/json, text/plain, */*",
                    "x-rpc-client_type": "4",
                    "x-rpc-app_version": "2.34.1"
                }, options.headers || {}),
                data: options.data ? JSON.stringify(options.data) : null,
                withCredentials: true,
                onload: (res) => {
                    try {
                        const data = JSON.parse(res.responseText);
                        resolve(data);
                    } catch (e) {
                        reject(new Error("Parsing JSON failed: " + res.responseText));
                    }
                },
                onerror: (err) => reject(err)
            });
        });
    }

    // Toast Notification System
    const Toast = {
        container: null,
        init() {
            if (this.container) return;
            this.container = document.createElement('div');
            this.container.className = 'hy-toast-container';
            document.body.appendChild(this.container);

            // Add styles
            const style = document.createElement('style');
            style.textContent = `
                .hy-toast-container {
                    position: fixed;
                    top: 20px;
                    right: 20px;
                    z-index: 10000000;
                    display: flex;
                    flex-direction: column;
                    gap: 10px;
                    pointer-events: none;
                    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
                }
                .hy-toast {
                    padding: 14px 24px;
                    background: rgba(30, 41, 59, 0.85);
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    backdrop-filter: blur(12px);
                    -webkit-backdrop-filter: blur(12px);
                    color: #f8fafc;
                    border-radius: 12px;
                    box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.3), 0 8px 10px -6px rgba(0, 0, 0, 0.3);
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    transform: translateX(120%);
                    transition: transform 0.4s cubic-bezier(0.16, 1, 0.3, 1);
                    pointer-events: auto;
                    font-size: 14px;
                    font-weight: 500;
                }
                .hy-toast.show {
                    transform: translateX(0);
                }
                .hy-toast-icon {
                    font-size: 18px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }
                .hy-toast-success .hy-toast-icon { color: #34d399; }
                .hy-toast-error .hy-toast-icon { color: #f87171; }
                .hy-toast-warning .hy-toast-icon { color: #fbbf24; }
                .hy-toast-info .hy-toast-icon { color: #60a5fa; }
            `;
            document.head.appendChild(style);
        },
        show(message, type = 'info') {
            this.init();
            const toast = document.createElement('div');
            toast.className = `hy-toast hy-toast-${type}`;

            let icon = 'ℹ️';
            if (type === 'success') icon = '✅';
            if (type === 'error') icon = '❌';
            if (type === 'warning') icon = '⚠️';

            toast.innerHTML = `<span class="hy-toast-icon">${icon}</span><span>${message}</span>`;
            this.container.appendChild(toast);

            // Trigger animation
            setTimeout(() => toast.classList.add('show'), 50);

            // Remove toast
            setTimeout(() => {
                toast.classList.remove('show');
                setTimeout(() => toast.remove(), 400);
            }, 4000);
        }
    };

    // Logging helper
    function addLog(text) {
        const logs = GM_getValue('logs', []);
        const timestamp = new Date().toLocaleTimeString();
        logs.unshift(`[${timestamp}] ${text}`);
        if (logs.length > 50) logs.pop(); // Keep last 50 logs
        GM_setValue('logs', logs);

        // Dispatch custom event to update settings modal in real-time
        window.dispatchEvent(new CustomEvent('hoyolab-log-updated'));
    }

    // Core Sign-in function
    async function runCheckIn(isManual = false) {
        const enabledGames = GM_getValue('enabled_games', { ys: true, sr: true, hi3: true, zzz: true });
        let successCount = 0;
        let alreadyCount = 0;
        let failCount = 0;
        let notLoggedInCount = 0;

        addLog(`=== 開始自動簽到 (模式: ${isManual ? '手動' : '自動'}) ===`);

        for (const key in GAMES) {
            if (!enabledGames[key]) {
                continue;
            }
            const game = GAMES[key];
            try {
                // 1. Get info
                const info = await request({ method: "GET", url: game.infoUrl, headers: game.headers });
                if (info.retcode === -100) {
                    addLog(`${game.name}: 尚未登入 HoYoLAB。`);
                    notLoggedInCount++;
                    continue;
                }
                if (info.retcode !== 0) {
                    addLog(`${game.name}: 獲取狀態失敗 (${info.message || info.retcode})`);
                    failCount++;
                    continue;
                }

                if (info.data.is_sign) {
                    addLog(`${game.name}: 今日已完成簽到。`);
                    alreadyCount++;
                    continue;
                }

                // 2. Perform sign-in
                const sign = await request({
                    method: "POST",
                    url: game.signUrl,
                    headers: game.headers,
                    data: { act_id: game.act_id }
                });

                if (sign.retcode === 0) {
                    addLog(`${game.name}: 簽到成功！`);
                    successCount++;
                } else if (sign.retcode === -5003) {
                    addLog(`${game.name}: 今日已完成簽到。`);
                    alreadyCount++;
                } else {
                    addLog(`${game.name}: 簽到失敗 (${sign.message || sign.retcode})`);
                    failCount++;
                }
            } catch (err) {
                addLog(`${game.name}: 網路錯誤 (${err.message})`);
                failCount++;
            }
        }

        addLog(`=== 簽到結束: 成功 ${successCount}, 已簽到 ${alreadyCount}, 失敗 ${failCount}, 未登入 ${notLoggedInCount} ===`);

        // Trigger Notifications
        if (successCount > 0) {
            Toast.show(`成功簽到 ${successCount} 個遊戲！`, 'success');
        } else if (failCount > 0) {
            Toast.show(`簽到過程中發生錯誤，請查看日誌。`, 'error');
        } else if (notLoggedInCount > 0 && isManual) {
            Toast.show(`請先登入 HoYoLAB 帳號。`, 'warning');
        } else if (isManual) {
            Toast.show(`所有遊戲今日皆已簽到。`, 'info');
        }
    }

    // Auto-trigger mechanism check
    function checkAndAutoTrigger() {
        const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
        const lastRun = GM_getValue('last_run_date', '');

        if (lastRun === today) {
            return; // Already run today
        }

        const signHour = GM_getValue('sign_hour', 0);
        const signMinute = GM_getValue('sign_minute', 5);
        const now = new Date();

        // Check if current time is past signTime
        if (now.getHours() > signHour || (now.getHours() === signHour && now.getMinutes() >= signMinute)) {
            GM_setValue('last_run_date', today);
            // Run check-in silently after a random delay (0-15s) to avoid bot-like pattern
            setTimeout(() => {
                runCheckIn(false);
            }, Math.random() * 15000);
        }
    }

    // Create Settings Modal UI
    const SettingsUI = {
        modal: null,
        initStyles() {
            if (document.getElementById('hy-settings-styles')) return;
            const style = document.createElement('style');
            style.id = 'hy-settings-styles';
            style.textContent = `
                .hy-modal-overlay {
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    background: rgba(15, 23, 42, 0.4);
                    backdrop-filter: blur(6px);
                    -webkit-backdrop-filter: blur(6px);
                    z-index: 10000000;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    opacity: 0;
                    pointer-events: none;
                    transition: opacity 0.3s ease;
                    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
                }
                .hy-modal-overlay.active {
                    opacity: 1;
                    pointer-events: auto;
                }
                .hy-modal-card {
                    background: rgba(30, 41, 59, 0.85);
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    border-radius: 20px;
                    width: 440px;
                    padding: 28px;
                    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
                    color: #f8fafc;
                    transform: translateY(20px) scale(0.95);
                    transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1);
                }
                .hy-modal-overlay.active .hy-modal-card {
                    transform: translateY(0) scale(1);
                }
                .hy-modal-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 20px;
                }
                .hy-modal-title {
                    font-size: 18px;
                    font-weight: 700;
                    background: linear-gradient(135deg, #60a5fa, #3b82f6);
                    -webkit-background-clip: text;
                    -webkit-text-fill-color: transparent;
                }
                .hy-modal-close {
                    background: none;
                    border: none;
                    color: #94a3b8;
                    cursor: pointer;
                    font-size: 20px;
                    transition: color 0.2s;
                }
                .hy-modal-close:hover {
                    color: #f8fafc;
                }
                .hy-settings-section {
                    margin-bottom: 20px;
                }
                .hy-section-title {
                    font-size: 12px;
                    text-transform: uppercase;
                    color: #94a3b8;
                    margin-bottom: 10px;
                    letter-spacing: 0.05em;
                    font-weight: 600;
                }
                .hy-game-row {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 8px 0;
                }
                .hy-game-info {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                }
                .hy-game-name {
                    font-size: 14px;
                    font-weight: 500;
                }
                /* Switch Toggle Styling */
                .hy-switch {
                    position: relative;
                    display: inline-block;
                    width: 44px;
                    height: 24px;
                }
                .hy-switch input {
                    opacity: 0;
                    width: 0;
                    height: 0;
                }
                .hy-slider {
                    position: absolute;
                    cursor: pointer;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background-color: rgba(255, 255, 255, 0.1);
                    transition: .3s cubic-bezier(0.16, 1, 0.3, 1);
                    border-radius: 24px;
                    border: 1px solid rgba(255, 255, 255, 0.05);
                }
                .hy-slider:before {
                    position: absolute;
                    content: "";
                    height: 18px;
                    width: 18px;
                    left: 2px;
                    bottom: 2px;
                    background-color: #f8fafc;
                    transition: .3s cubic-bezier(0.16, 1, 0.3, 1);
                    border-radius: 50%;
                }
                input:checked + .hy-slider {
                    background-color: #3b82f6;
                }
                input:checked + .hy-slider:before {
                    transform: translateX(20px);
                }
                .hy-time-settings {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    background: rgba(255, 255, 255, 0.03);
                    padding: 12px;
                    border-radius: 12px;
                    border: 1px solid rgba(255, 255, 255, 0.05);
                }
                .hy-time-label {
                    font-size: 13px;
                    color: #cbd5e1;
                }
                .hy-time-inputs {
                    display: flex;
                    align-items: center;
                    gap: 5px;
                }
                .hy-time-input {
                    background: rgba(15, 23, 42, 0.5);
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    color: #fff;
                    border-radius: 6px;
                    padding: 4px 8px;
                    width: 60px;
                    text-align: center;
                    font-size: 14px;
                    outline: none;
                    -moz-appearance: textfield;
                }
                .hy-time-input::-webkit-outer-spin-button,
                .hy-time-input::-webkit-inner-spin-button {
                    -webkit-appearance: none;
                    margin: 0;
                }
                .hy-time-input:focus {
                    border-color: #3b82f6;
                }
                .hy-logs-panel {
                    background: rgba(15, 23, 42, 0.5);
                    border: 1px solid rgba(255, 255, 255, 0.08);
                    border-radius: 12px;
                    padding: 12px;
                    font-family: monospace;
                    font-size: 11px;
                    height: 120px;
                    overflow-y: auto;
                    color: #cbd5e1;
                }
                .hy-log-line {
                    margin-bottom: 4px;
                    white-space: pre-wrap;
                }
                .hy-modal-buttons {
                    display: flex;
                    gap: 12px;
                    margin-top: 15px;
                }
                .hy-btn {
                    flex: 1;
                    padding: 12px;
                    border-radius: 12px;
                    font-size: 14px;
                    font-weight: 600;
                    cursor: pointer;
                    border: none;
                    transition: background 0.2s, transform 0.1s;
                }
                .hy-btn-primary {
                    background: linear-gradient(135deg, #3b82f6, #2563eb);
                    color: #fff;
                    box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
                }
                .hy-btn-primary:hover {
                    background: linear-gradient(135deg, #60a5fa, #3b82f6);
                }
                .hy-btn-primary:active {
                    transform: scale(0.98);
                }
                .hy-btn-secondary {
                    background: rgba(255, 255, 255, 0.05);
                    color: #f8fafc;
                    border: 1px solid rgba(255, 255, 255, 0.08);
                }
                .hy-btn-secondary:hover {
                    background: rgba(255, 255, 255, 0.1);
                }
                .hy-btn-secondary:active {
                    transform: scale(0.98);
                }
                /* Floating Settings Button */
                .hy-float-btn {
                    position: fixed;
                    bottom: 20px;
                    right: 20px;
                    width: 48px;
                    height: 48px;
                    background: rgba(30, 41, 59, 0.8);
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    backdrop-filter: blur(8px);
                    -webkit-backdrop-filter: blur(8px);
                    border-radius: 50%;
                    box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.3);
                    cursor: pointer;
                    z-index: 9999999;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: #3b82f6;
                    font-size: 20px;
                    transition: transform 0.2s, background 0.2s, box-shadow 0.2s;
                }
                .hy-float-btn:hover {
                    transform: scale(1.08);
                    background: rgba(30, 41, 59, 0.95);
                    box-shadow: 0 10px 20px -3px rgba(59, 130, 246, 0.4);
                }
            `;
            document.head.appendChild(style);
        },
        create() {
            if (this.modal) return;
            this.initStyles();

            // Create Modal Overlay
            this.modal = document.createElement('div');
            this.modal.className = 'hy-modal-overlay';

            // Get current values
            const enabledGames = GM_getValue('enabled_games', { ys: true, sr: true, hi3: true, zzz: true });
            const hour = GM_getValue('sign_hour', 0);
            const minute = GM_getValue('sign_minute', 5);

            this.modal.innerHTML = `
                <div class="hy-modal-card">
                    <div class="hy-modal-header">
                        <div class="hy-modal-title">HoYoLAB 自動簽到設定</div>
                        <button class="hy-modal-close" id="hy-close-btn">✕</button>
                    </div>
                    
                    <div class="hy-settings-section">
                        <div class="hy-section-title">選擇啟動遊戲</div>
                        <div class="hy-game-row">
                            <div class="hy-game-info">
                                <span class="hy-game-name">原神</span>
                            </div>
                            <label class="hy-switch">
                                <input type="checkbox" id="hy-chk-ys" ${enabledGames.ys ? 'checked' : ''}>
                                <span class="hy-slider"></span>
                            </label>
                        </div>
                        <div class="hy-game-row">
                            <div class="hy-game-info">
                                <span class="hy-game-name">崩壞：星穹鐵道</span>
                            </div>
                            <label class="hy-switch">
                                <input type="checkbox" id="hy-chk-sr" ${enabledGames.sr ? 'checked' : ''}>
                                <span class="hy-slider"></span>
                            </label>
                        </div>
                        <div class="hy-game-row">
                            <div class="hy-game-info">
                                <span class="hy-game-name">崩壞3rd</span>
                            </div>
                            <label class="hy-switch">
                                <input type="checkbox" id="hy-chk-hi3" ${enabledGames.hi3 ? 'checked' : ''}>
                                <span class="hy-slider"></span>
                            </label>
                        </div>
                        <div class="hy-game-row">
                            <div class="hy-game-info">
                                <span class="hy-game-name">絕區零</span>
                            </div>
                            <label class="hy-switch">
                                <input type="checkbox" id="hy-chk-zzz" ${enabledGames.zzz ? 'checked' : ''}>
                                <span class="hy-slider"></span>
                            </label>
                        </div>
                    </div>

                    <div class="hy-settings-section">
                        <div class="hy-section-title">自動觸發時間</div>
                        <div class="hy-time-settings">
                            <span class="hy-time-label">在以下時間之後訪問網頁時執行簽到：</span>
                            <div class="hy-time-inputs">
                                <input type="number" id="hy-time-hour" class="hy-time-input" min="0" max="23" value="${hour}">
                                <span>:</span>
                                <input type="number" id="hy-time-minute" class="hy-time-input" min="0" max="59" value="${String(minute).padStart(2, '0')}">
                            </div>
                        </div>
                    </div>

                    <div class="hy-settings-section">
                        <div class="hy-section-title">簽到日誌</div>
                        <div class="hy-logs-panel" id="hy-logs-panel"></div>
                    </div>

                    <div class="hy-modal-buttons">
                        <button class="hy-btn hy-btn-secondary" id="hy-btn-manual">立即執行簽到</button>
                        <button class="hy-btn hy-btn-primary" id="hy-btn-save">儲存設定</button>
                    </div>
                </div>
            `;

            document.body.appendChild(this.modal);
            this.updateLogs();

            // Event Listeners
            document.getElementById('hy-close-btn').addEventListener('click', () => this.hide());
            this.modal.addEventListener('click', (e) => {
                if (e.target === this.modal) this.hide();
            });

            document.getElementById('hy-btn-save').addEventListener('click', () => {
                const games = {
                    ys: document.getElementById('hy-chk-ys').checked,
                    sr: document.getElementById('hy-chk-sr').checked,
                    hi3: document.getElementById('hy-chk-hi3').checked,
                    zzz: document.getElementById('hy-chk-zzz').checked
                };
                let h = parseInt(document.getElementById('hy-time-hour').value) || 0;
                let m = parseInt(document.getElementById('hy-time-minute').value) || 0;

                h = Math.max(0, Math.min(23, h));
                m = Math.max(0, Math.min(59, m));

                GM_setValue('enabled_games', games);
                GM_setValue('sign_hour', h);
                GM_setValue('sign_minute', m);

                Toast.show("設定儲存成功！", "success");
                this.hide();
            });

            document.getElementById('hy-btn-manual').addEventListener('click', async () => {
                const btn = document.getElementById('hy-btn-manual');
                btn.disabled = true;
                btn.textContent = "簽到中...";
                try {
                    await runCheckIn(true);
                } finally {
                    btn.disabled = false;
                    btn.textContent = "立即執行簽到";
                }
            });

            // Listen for log updates
            window.addEventListener('hoyolab-log-updated', () => this.updateLogs());
        },
        updateLogs() {
            const panel = document.getElementById('hy-logs-panel');
            if (!panel) return;
            const logs = GM_getValue('logs', []);
            panel.innerHTML = logs.map(line => `<div class="hy-log-line">${line}</div>`).join('');
        },
        show() {
            this.create();
            this.updateLogs();
            this.modal.classList.add('active');
        },
        hide() {
            if (this.modal) {
                this.modal.classList.remove('active');
            }
        }
    };

    // Add floating button to HoYoLAB
    function addFloatingButton() {
        if (!location.hostname.includes('hoyolab.com')) return;
        SettingsUI.initStyles();

        const floatBtn = document.createElement('div');
        floatBtn.className = 'hy-float-btn';
        floatBtn.title = 'HoYoLAB 自動簽到設定';
        floatBtn.innerHTML = '📅';

        floatBtn.addEventListener('click', () => {
            SettingsUI.show();
        });

        document.body.appendChild(floatBtn);
    }

    // Initialize Menu Commands
    GM_registerMenuCommand("HoYoLAB 自動簽到設定", () => {
        SettingsUI.show();
    });

    // Run check & add buttons
    setTimeout(() => {
        addFloatingButton();
        checkAndAutoTrigger();
    }, 2000); // 2 second delay to let page stabilize

})();
