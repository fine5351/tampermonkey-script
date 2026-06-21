// ==UserScript==
// @name         Gemini 網頁與影片摘要助手
// @namespace    https://github.com/
// @version      1.0
// @description  一鍵生成網頁與 YouTube 影片摘要，並提供內容問答聊天面板 (使用 Gemini 3.5 Flash)
// @author       Antigravity
// @match        *://*/*
// @grant        GM_xmlhttpRequest
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_registerMenuCommand
// @connect      generativelanguage.googleapis.com
// @run-at       document-end
// ==/UserScript==

(function() {
    'use strict';

    // Global Styles Injection
    const globalStyle = document.createElement('style');
    globalStyle.id = 'gpa-global-styles';
    globalStyle.textContent = `
        /* Floating Trigger Button */
        .gpa-float-btn {
            position: fixed;
            bottom: 20px;
            right: 20px;
            width: 48px;
            height: 48px;
            background: rgba(30, 41, 59, 0.85);
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
            color: #a855f7;
            font-size: 20px;
            transition: transform 0.2s, background 0.2s, box-shadow 0.2s;
        }
        .gpa-float-btn:hover {
            transform: scale(1.08);
            background: rgba(30, 41, 59, 0.95);
            box-shadow: 0 10px 20px -3px rgba(168, 85, 247, 0.4);
        }

        /* Glassmorphism Side Panel */
        .gpa-panel {
            position: fixed;
            top: 0;
            right: 0;
            width: 380px;
            height: 100%;
            background: rgba(15, 23, 42, 0.88);
            border-left: 1px solid rgba(255, 255, 255, 0.08);
            backdrop-filter: blur(12px);
            -webkit-backdrop-filter: blur(12px);
            box-shadow: -10px 0 30px rgba(0, 0, 0, 0.5);
            z-index: 10000000;
            display: flex;
            flex-direction: column;
            color: #f1f5f9;
            transform: translateX(100%);
            transition: transform 0.4s cubic-bezier(0.16, 1, 0.3, 1);
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            box-sizing: border-box;
        }
        .gpa-panel.active {
            transform: translateX(0);
        }

        .gpa-header {
            padding: 20px;
            border-bottom: 1px solid rgba(255, 255, 255, 0.08);
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        .gpa-title {
            font-size: 16px;
            font-weight: 700;
            background: linear-gradient(135deg, #c084fc, #a855f7);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            display: flex;
            align-items: center;
            gap: 8px;
        }
        .gpa-close-btn {
            background: none;
            border: none;
            color: #94a3b8;
            cursor: pointer;
            font-size: 20px;
            transition: color 0.2s;
            padding: 0;
            line-height: 1;
        }
        .gpa-close-btn:hover {
            color: #f8fafc;
        }

        /* Tabs */
        .gpa-tabs {
            display: flex;
            border-bottom: 1px solid rgba(255, 255, 255, 0.05);
            background: rgba(0, 0, 0, 0.15);
        }
        .gpa-tab {
            flex: 1;
            padding: 12px 0;
            background: none;
            border: none;
            color: #94a3b8;
            cursor: pointer;
            font-size: 13px;
            font-weight: 600;
            text-align: center;
            position: relative;
            transition: color 0.2s;
        }
        .gpa-tab.active {
            color: #c084fc;
        }
        .gpa-tab.active::after {
            content: '';
            position: absolute;
            bottom: -1px;
            left: 15%;
            width: 70%;
            height: 2px;
            background: #c084fc;
        }

        /* Content Views */
        .gpa-content-area {
            flex: 1;
            overflow-y: auto;
            padding: 20px;
            box-sizing: border-box;
            display: flex;
            flex-direction: column;
        }
        .gpa-view {
            display: none;
            height: 100%;
            flex-direction: column;
        }
        .gpa-view.active {
            display: flex;
        }

        /* Summary View Elements */
        .gpa-md-content {
            font-size: 14px;
            line-height: 1.6;
            color: #cbd5e1;
        }
        .gpa-md-content h1, .gpa-md-content h2, .gpa-md-content h3 {
            color: #f8fafc;
            margin-top: 16px;
            margin-bottom: 8px;
            font-weight: 600;
        }
        .gpa-md-content h1 { font-size: 18px; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 4px; }
        .gpa-md-content h2 { font-size: 16px; }
        .gpa-md-content h3 { font-size: 14px; }
        .gpa-md-content p { margin-bottom: 12px; }
        .gpa-md-content strong { color: #f1f5f9; font-weight: 600; }
        .gpa-md-content ul { margin-left: 18px; margin-bottom: 12px; list-style-type: disc; }
        .gpa-md-content li { margin-bottom: 4px; }
        
        .gpa-run-btn {
            background: linear-gradient(135deg, #c084fc, #a855f7);
            color: #fff;
            border: none;
            padding: 12px 20px;
            border-radius: 12px;
            font-size: 14px;
            font-weight: 600;
            cursor: pointer;
            box-shadow: 0 4px 12px rgba(168, 85, 247, 0.3);
            transition: background 0.2s, transform 0.1s;
            margin: auto;
            display: flex;
            align-items: center;
            gap: 8px;
        }
        .gpa-run-btn:hover {
            background: linear-gradient(135deg, #d8b4fe, #c084fc);
        }
        .gpa-run-btn:active {
            transform: scale(0.98);
        }
        
        /* Chat View Elements */
        .gpa-chat-log {
            flex: 1;
            overflow-y: auto;
            display: flex;
            flex-direction: column;
            gap: 12px;
            margin-bottom: 16px;
            padding-right: 4px;
        }
        .gpa-chat-bubble {
            max-width: 85%;
            padding: 10px 14px;
            border-radius: 14px;
            font-size: 13px;
            line-height: 1.5;
        }
        .gpa-chat-bubble-user {
            background: #a855f7;
            color: #fff;
            align-self: flex-end;
            border-bottom-right-radius: 2px;
        }
        .gpa-chat-bubble-ai {
            background: rgba(255, 255, 255, 0.05);
            border: 1px solid rgba(255, 255, 255, 0.05);
            color: #e2e8f0;
            align-self: flex-start;
            border-bottom-left-radius: 2px;
        }
        .gpa-chat-input-row {
            display: flex;
            gap: 8px;
            background: rgba(15, 23, 42, 0.5);
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 12px;
            padding: 6px 12px;
            box-sizing: border-box;
            align-items: center;
        }
        .gpa-chat-input {
            flex: 1;
            background: none;
            border: none;
            color: #fff;
            font-size: 13px;
            outline: none;
            padding: 6px 0;
            resize: none;
            max-height: 80px;
        }
        .gpa-send-btn {
            background: none;
            border: none;
            color: #c084fc;
            cursor: pointer;
            font-size: 18px;
            padding: 0;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: color 0.2s;
        }
        .gpa-send-btn:hover {
            color: #d8b4fe;
        }
        .gpa-send-btn:disabled {
            color: #475569;
            cursor: not-allowed;
        }

        /* Settings View */
        .gpa-form-group {
            margin-bottom: 16px;
        }
        .gpa-label {
            display: block;
            font-size: 12px;
            font-weight: 600;
            color: #94a3b8;
            margin-bottom: 6px;
        }
        .gpa-input {
            width: 100%;
            background: rgba(15, 23, 42, 0.5);
            border: 1px solid rgba(255, 255, 255, 0.1);
            color: #fff;
            border-radius: 8px;
            padding: 8px 12px;
            font-size: 13px;
            outline: none;
            box-sizing: border-box;
        }
        .gpa-input:focus, .gpa-textarea:focus {
            border-color: #a855f7;
        }
        .gpa-textarea {
            width: 100%;
            height: 100px;
            background: rgba(15, 23, 42, 0.5);
            border: 1px solid rgba(255, 255, 255, 0.1);
            color: #fff;
            border-radius: 8px;
            padding: 8px 12px;
            font-size: 13px;
            outline: none;
            resize: none;
            box-sizing: border-box;
        }
        
        /* Spinner & Loading */
        .gpa-loading-box {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            gap: 12px;
            margin: auto;
        }
        .gpa-spinner {
            width: 32px;
            height: 32px;
            border: 3px solid rgba(168, 85, 247, 0.2);
            border-top-color: #a855f7;
            border-radius: 50%;
            animation: gpa-spin 1s infinite linear;
        }
        @keyframes gpa-spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
        .gpa-loading-text {
            font-size: 12px;
            color: #94a3b8;
        }
    `;
    document.head.appendChild(globalStyle);

    // Markdown Parser Helper
    function renderMarkdown(md) {
        if (!md) return "";
        let html = md;
        // Escape HTML
        html = html.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        
        // Headers
        html = html.replace(/^### (.*?)$/gm, '<h3>$1</h3>');
        html = html.replace(/^## (.*?)$/gm, '<h2>$1</h2>');
        html = html.replace(/^# (.*?)$/gm, '<h1>$1</h1>');
        
        // Bold text
        html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        
        // Lists
        html = html.replace(/^\* (.*?)$/gm, '<li>$1</li>');
        html = html.replace(/^- (.*?)$/gm, '<li>$1</li>');
        
        // Wrap contiguous list items in ul
        html = html.replace(/(<li>.*?<\/li>\n?)+/gs, (match) => {
            return `<ul>${match}</ul>`;
        });
        
        // Paragraphs
        const blocks = html.split(/\n\n+/);
        const parsedBlocks = blocks.map(block => {
            block = block.trim();
            if (!block) return "";
            if (block.startsWith('<h') || block.startsWith('<ul') || block.startsWith('<li')) {
                return block;
            }
            return `<p>${block.replace(/\n/g, '<br>')}</p>`;
        });
        
        return parsedBlocks.join('');
    }

    // Text Extractors
    async function extractContent() {
        if (location.hostname.includes('youtube.com')) {
            return extractYoutubeTranscript();
        }
        return extractWebpageText();
    }

    async function getSubtitleUrlWithToken(videoId, targetLang = 'zh-TW', targetFmt = 'srv1') {
        const getTimedTextEntries = () => {
            const win = typeof unsafeWindow !== 'undefined' ? unsafeWindow : window;
            if (win.performance && typeof win.performance.getEntriesByType === 'function') {
                return win.performance.getEntriesByType('resource')
                    .filter(e => e.name.includes('/api/timedtext') && (!videoId || e.name.includes('v=' + videoId)));
            }
            return [];
        };

        let entries = getTimedTextEntries();
        if (entries.length === 0) {
            // If not found, try to force a request by toggling subtitles on the player
            const doc = typeof unsafeWindow !== 'undefined' ? unsafeWindow.document : document;
            const player = doc.querySelector('#movie_player');
            if (player && typeof player.toggleSubtitles === 'function') {
                const wasSubtitlesOn = typeof player.isSubtitlesOn === 'function' ? player.isSubtitlesOn() : false;
                player.toggleSubtitles();
                // Wait for network request to be fired
                await new Promise(r => setTimeout(r, 600));
                // Restore previous state
                const isNowOn = typeof player.isSubtitlesOn === 'function' ? player.isSubtitlesOn() : false;
                if (isNowOn !== wasSubtitlesOn) {
                    player.toggleSubtitles();
                }
                await new Promise(r => setTimeout(r, 100));
                entries = getTimedTextEntries();
            }
        }

        if (entries.length === 0) {
            throw new Error('無法取得帶有安全性驗證的字幕請求網址，請確認影片播放器已加載字幕。');
        }

        // Use the last captured entry as it is the most recent
        const latestEntry = entries[entries.length - 1].name;
        const authorizedUrl = new URL(latestEntry);

        // Override language and format while keeping all security parameters intact
        authorizedUrl.searchParams.set('lang', targetLang);
        if (targetFmt) {
            authorizedUrl.searchParams.set('fmt', targetFmt);
        } else {
            authorizedUrl.searchParams.delete('fmt');
        }

        return authorizedUrl.toString();
    }

    async function extractYoutubeTranscript() {
        try {
            let ytResponse = null;
            const player = document.querySelector('#movie_player');
            if (player && typeof player.getPlayerResponse === 'function') {
                ytResponse = player.getPlayerResponse();
            }
            if (!ytResponse) {
                ytResponse = unsafeWindow.ytInitialPlayerResponse || window.ytInitialPlayerResponse;
            }

            const title = ytResponse?.videoDetails?.title || document.title;
            const description = ytResponse?.videoDetails?.shortDescription || "";

            if (!ytResponse || !ytResponse.captions) {
                console.warn("[GPA] No captions object found. Falling back to video metadata.");
                if (title || description) {
                    return `[此影片沒有提供字幕軌，以下為影片標題與描述資訊]\n\n影片名稱: ${title}\n\n影片描述:\n${description}`;
                }
                throw new Error("找不到影片字幕資料。請確認此影片是否提供字幕軌。");
            }
            const tracklist = ytResponse.captions.playerCaptionsTracklistRenderer;
            if (!tracklist || !tracklist.captionTracks || tracklist.captionTracks.length === 0) {
                console.warn("[GPA] Caption tracks list is empty. Falling back to video metadata.");
                if (title || description) {
                    return `[此影片沒有提供字幕軌，以下為影片標題與描述資訊]\n\n影片名稱: ${title}\n\n影片描述:\n${description}`;
                }
                throw new Error("此影片不支援字幕。");
            }

            let videoId = '';
            if (ytResponse.videoDetails && ytResponse.videoDetails.videoId) {
                videoId = ytResponse.videoDetails.videoId;
            } else {
                const urlParams = new URLSearchParams(window.location.search);
                videoId = urlParams.get('v') || '';
            }

            // Find Taiwanese/Chinese first, then generic Chinese, then English
            let track = tracklist.captionTracks.find(t => t.languageCode === 'zh-Hant' || t.languageCode === 'zh-TW');
            if (!track) track = tracklist.captionTracks.find(t => t.languageCode.startsWith('zh'));
            if (!track) track = tracklist.captionTracks.find(t => t.languageCode.startsWith('en'));
            if (!track) track = tracklist.captionTracks[0];

            if (!track) {
                throw new Error("無法取得字幕下載網址。");
            }

            const targetLang = track.languageCode || 'zh-TW';

            // Get a fully authorized subtitle URL with safety parameters
            let finalUrl;
            try {
                finalUrl = await getSubtitleUrlWithToken(videoId, targetLang, 'srv1');
            } catch (tokenErr) {
                console.warn("[GPA] Fallback to raw baseUrl due to token error:", tokenErr);
                finalUrl = track.baseUrl;
            }

            try {
                const res = await fetch(finalUrl);
                if (!res.ok) {
                    throw new Error(`下載字幕失敗，伺服器回應狀態碼: ${res.status}`);
                }
                const responseText = await res.text();
                
                const parser = new DOMParser();
                const xmlDoc = parser.parseFromString(responseText, "text/xml");
                const textNodes = xmlDoc.getElementsByTagName('text');
                let transcript = [];
                for (let i = 0; i < textNodes.length; i++) {
                    const text = textNodes[i].textContent;
                    const start = parseFloat(textNodes[i].getAttribute('start'));
                    const mins = Math.floor(start / 60);
                    const secs = Math.floor(start % 60);
                    const timeStr = `[${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}]`;
                    transcript.push(`${timeStr} ${text}`);
                }
                if (transcript.length === 0) {
                    throw new Error("解析出的字幕內容為空。");
                }
                return transcript.join('\n');
            } catch (fetchErr) {
                console.warn("[GPA] Failed to fetch or parse subtitles. Falling back to video metadata:", fetchErr);
                if (title || description) {
                    return `[此影片字幕加載或解析失敗，以下為影片標題與描述資訊]\n\n影片名稱: ${title}\n\n影片描述:\n${description}`;
                }
                throw fetchErr;
            }
        } catch (err) {
            throw new Error("取得或解析字幕失敗: " + err.message);
        }
    }

    function extractWebpageText() {
        const clone = document.cloneNode(true);
        // Clean boilerplate elements
        const elementsToRemove = clone.querySelectorAll('script, style, iframe, noscript, nav, footer, header, #comments, .comments, .ads, .sidebar');
        elementsToRemove.forEach(el => el.remove());

        const article = clone.querySelector('article, main, [role="main"], .article, .post-content, .entry-content');
        if (article) {
            const text = article.innerText.replace(/\s+/g, ' ').trim();
            if (text.length > 200) return Promise.resolve(text);
        }

        const paragraphs = Array.from(clone.querySelectorAll('p, h1, h2, h3, h4, h5, h6'))
            .map(el => el.innerText.trim())
            .filter(t => t.length > 15);
        
        if (paragraphs.length > 0) {
            return Promise.resolve(paragraphs.join('\n\n'));
        }

        return Promise.resolve(clone.body.innerText.replace(/\s+/g, ' ').trim());
    }

    // Helper to get and validate model (migrates deprecated model versions in metadata)
    function getValidModel() {
        let model = GM_getValue('gemini_model', 'gemini-3.5-flash');
        if (model.includes('1.5-flash') || model.includes('1.0-pro') || model.includes('gemini-pro')) {
            model = 'gemini-3.5-flash';
            GM_setValue('gemini_model', model);
        } else if (model.includes('1.5-pro')) {
            model = 'gemini-3.1-pro';
            GM_setValue('gemini_model', model);
        }
        if (model !== 'gemini-3.5-flash' && model !== 'gemini-3.1-pro') {
            model = 'gemini-3.5-flash';
            GM_setValue('gemini_model', model);
        }
        return model;
    }

    // Gemini API Request Client
    async function callGemini(apiKey, prompt, content, chatHistory = []) {
        const model = getValidModel();
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
        
        let contents = [];

        if (chatHistory.length === 0) {
            // First call: Summary generation
            contents.push({
                role: 'user',
                parts: [{
                    text: `${prompt}\n\n[以下為要處理的影片字幕/網頁文章內容]\n\n${content}`
                }]
            });
        } else {
            // Subsequent calls: conversation history
            contents = chatHistory.map(item => ({
                role: item.role === 'user' ? 'user' : 'model',
                parts: [{ text: item.text }]
            }));
            // Add the new question
            contents.push({
                role: 'user',
                parts: [{ text: `${prompt}\n\n(參考本文章/影片內容進行回答。)` }]
            });
        }

        const payload = {
            contents: contents,
            generationConfig: {
                temperature: 0.2
            }
        };

        return new Promise((resolve, reject) => {
            GM_xmlhttpRequest({
                method: "POST",
                url: url,
                headers: {
                    "Content-Type": "application/json"
                },
                data: JSON.stringify(payload),
                onload: (res) => {
                    try {
                        const json = JSON.parse(res.responseText);
                        if (json.candidates && json.candidates[0] && json.candidates[0].content && json.candidates[0].content.parts[0]) {
                            resolve(json.candidates[0].content.parts[0].text);
                        } else if (json.error) {
                            reject(new Error(json.error.message || "Gemini API 錯誤。"));
                        } else {
                            reject(new Error("未預期的 API 回應格式。"));
                        }
                    } catch (e) {
                        reject(new Error("API 解析失敗: " + res.responseText));
                    }
                },
                onerror: (err) => reject(new Error("連線 API 失敗: " + err))
            });
        });
    }

    // Front-end UI Component
    const PanelUI = {
        panel: null,
        extractedText: "",
        chatHistory: [],
        init() {
            if (this.panel) return;

            // Create Panel Element
            this.panel = document.createElement('div');
            this.panel.className = 'gpa-panel';

            const apiKey = GM_getValue('gemini_api_key', '');
            const prompt = GM_getValue('gemini_summary_prompt', '請使用繁體中文，為以下內容撰寫一份結構化且精美的摘要。包含：\n1. 核心觀點 (Key Takeaways)\n2. 重點整理 (Bullet Points)\n3. 影片/文章的心智圖結構草稿 (Outline)');
            const model = getValidModel();

            this.panel.innerHTML = `
                <div class="gpa-header">
                    <div class="gpa-title">✨ Gemini AI 助理</div>
                    <button class="gpa-close-btn" id="gpa-close-btn">✕</button>
                </div>
                
                <div class="gpa-tabs">
                    <button class="gpa-tab active" id="gpa-tab-btn-sum">內容摘要</button>
                    <button class="gpa-tab" id="gpa-tab-btn-chat">對話問答</button>
                    <button class="gpa-tab" id="gpa-tab-btn-set">設定</button>
                </div>

                <div class="gpa-content-area">
                    <!-- Tab 1: Summary -->
                    <div class="gpa-view active" id="gpa-view-sum">
                        <div class="gpa-md-content" id="gpa-summary-content">
                            <button class="gpa-run-btn" id="gpa-btn-gensum">✨ 生成摘要</button>
                        </div>
                    </div>

                    <!-- Tab 2: Chat -->
                    <div class="gpa-view" id="gpa-view-chat">
                        <div class="gpa-chat-log" id="gpa-chat-log">
                            <div class="gpa-chat-bubble gpa-chat-bubble-ai">你好！我是你的 AI 助理。請先點擊「生成摘要」以載入頁面內容，載入後你可以問我任何關於本片/本文章的問題。</div>
                        </div>
                        <div class="gpa-chat-input-row">
                            <textarea class="gpa-chat-input" id="gpa-chat-input" placeholder="詢問關於本片內容..." rows="1" disabled></textarea>
                            <button class="gpa-send-btn" id="gpa-btn-send" disabled>✈️</button>
                        </div>
                    </div>

                    <!-- Tab 3: Settings -->
                    <div class="gpa-view" id="gpa-view-set">
                        <div class="gpa-form-group">
                            <label class="gpa-label">Gemini API 金鑰 (API Key)</label>
                            <input type="password" class="gpa-input" id="gpa-set-key" value="${apiKey}" placeholder="在此貼上 AI Studio 取得的 Key">
                            <div class="gpa-hint">你可以在 Google AI Studio 免費申請 API Key。</div>
                        </div>
                        <div class="gpa-form-group">
                            <label class="gpa-label">AI 模型選擇</label>
                            <select class="gpa-input" id="gpa-set-model" style="color: #fff; background: rgba(15, 23, 42, 0.8);">
                                <option value="gemini-3.5-flash" ${model === 'gemini-3.5-flash' ? 'selected' : ''}>gemini-3.5-flash (速度極快)</option>
                                <option value="gemini-3.1-pro" ${model === 'gemini-3.1-pro' ? 'selected' : ''}>gemini-3.1-pro (推理能力強)</option>
                            </select>
                        </div>
                        <div class="gpa-form-group">
                            <label class="gpa-label">預設摘要提示詞 (Prompt)</label>
                            <textarea class="gpa-textarea" id="gpa-set-prompt">${prompt}</textarea>
                        </div>
                        <button class="gpa-run-btn" id="gpa-btn-saveset" style="width: 100%; margin-top: 10px;">儲存設定</button>
                    </div>
                </div>
            `;

            document.body.appendChild(this.panel);

            // Bind Event Listeners
            this.bindEvents();
        },
        bindEvents() {
            // Tab switching
            const tabSum = document.getElementById('gpa-tab-btn-sum');
            const tabChat = document.getElementById('gpa-tab-btn-chat');
            const tabSet = document.getElementById('gpa-tab-btn-set');

            const viewSum = document.getElementById('gpa-view-sum');
            const viewChat = document.getElementById('gpa-view-chat');
            const viewSet = document.getElementById('gpa-view-set');

            const deactivateTabs = () => {
                [tabSum, tabChat, tabSet].forEach(t => t.classList.remove('active'));
                [viewSum, viewChat, viewSet].forEach(v => v.classList.remove('active'));
            };

            tabSum.addEventListener('click', () => {
                deactivateTabs();
                tabSum.classList.add('active');
                viewSum.classList.add('active');
            });

            tabChat.addEventListener('click', () => {
                deactivateTabs();
                tabChat.classList.add('active');
                viewChat.classList.add('active');
            });

            tabSet.addEventListener('click', () => {
                deactivateTabs();
                tabSet.classList.add('active');
                viewSet.classList.add('active');
            });

            // Close actions
            document.getElementById('gpa-close-btn').addEventListener('click', () => this.hide());

            // Save Settings
            document.getElementById('gpa-btn-saveset').addEventListener('click', () => {
                const key = document.getElementById('gpa-set-key').value.trim();
                const model = document.getElementById('gpa-set-model').value;
                const prompt = document.getElementById('gpa-set-prompt').value.trim();

                GM_setValue('gemini_api_key', key);
                GM_setValue('gemini_model', model);
                GM_setValue('gemini_summary_prompt', prompt);

                alert("設定儲存成功！");
                tabSum.click(); // Back to summary
            });

            // Generate Summary
            document.getElementById('gpa-btn-gensum').addEventListener('click', () => this.runSummaryGeneration());

            // Chat input auto-growing & send on enter
            const chatInput = document.getElementById('gpa-chat-input');
            chatInput.addEventListener('input', () => {
                chatInput.style.height = 'auto';
                chatInput.style.height = (chatInput.scrollHeight) + 'px';
            });
            chatInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    this.sendChatMessage();
                }
            });

            // Chat send button
            document.getElementById('gpa-btn-send').addEventListener('click', () => this.sendChatMessage());
        },
        show() {
            this.init();
            this.panel.classList.add('active');
        },
        hide() {
            if (this.panel) {
                this.panel.classList.remove('active');
            }
        },
        showLoading(text) {
            const container = document.getElementById('gpa-summary-content');
            container.innerHTML = `
                <div class="gpa-loading-box">
                    <div class="gpa-spinner"></div>
                    <div class="gpa-loading-text">${text}</div>
                </div>
            `;
        },
        showError(msg) {
            const container = document.getElementById('gpa-summary-content');
            container.innerHTML = `
                <div style="color: #f87171; padding: 15px; border-radius: 8px; background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.2); font-size: 13px;">
                    <strong>發生錯誤：</strong><br>${msg}
                </div>
                <button class="gpa-run-btn" id="gpa-btn-gensum" style="margin-top: 15px;">✨ 重新嘗試</button>
            `;
            // Rebind click listener
            document.getElementById('gpa-btn-gensum').addEventListener('click', () => this.runSummaryGeneration());
        },
        async runSummaryGeneration() {
            const apiKey = GM_getValue('gemini_api_key', '');
            if (!apiKey) {
                alert("請先進入「設定」分頁配置你的 Gemini API Key。");
                document.getElementById('gpa-tab-btn-set').click();
                return;
            }

            try {
                this.showLoading("正在擷取網頁/影片字幕內容...");
                this.extractedText = await extractContent();
                
                this.showLoading("正在呼叫 Gemini AI 進行分析與摘要...");
                const prompt = GM_getValue('gemini_summary_prompt', '請進行摘要...');
                const summary = await callGemini(apiKey, prompt, this.extractedText);
                
                // Render summary
                const container = document.getElementById('gpa-summary-content');
                container.innerHTML = renderMarkdown(summary);

                // Enable Chat Inputs
                document.getElementById('gpa-chat-input').disabled = false;
                document.getElementById('gpa-btn-send').disabled = false;
                
                // Add default context-loaded logs in chat view
                const chatLog = document.getElementById('gpa-chat-log');
                chatLog.innerHTML = `
                    <div class="gpa-chat-bubble gpa-chat-bubble-ai">內容載入成功！我已經讀完了整部影片/文章的文字。你可以問我任何關於它的問題了！</div>
                `;

                // Cache summary to chat history to keep context
                this.chatHistory = [
                    { role: 'user', text: `${prompt}\n\n[內容開始]\n${this.extractedText}\n[內容結束]` },
                    { role: 'model', text: summary }
                ];
            } catch (err) {
                console.error(err);
                this.showError(err.message || "發生未知錯誤");
            }
        },
        async sendChatMessage() {
            const input = document.getElementById('gpa-chat-input');
            const promptText = input.value.trim();
            if (!promptText) return;

            const apiKey = GM_getValue('gemini_api_key', '');
            if (!apiKey) return;

            // Reset input
            input.value = "";
            input.style.height = 'auto';

            // Add user bubble
            const chatLog = document.getElementById('gpa-chat-log');
            const userBubble = document.createElement('div');
            userBubble.className = 'gpa-chat-bubble gpa-chat-bubble-user';
            userBubble.textContent = promptText;
            chatLog.appendChild(userBubble);
            chatLog.scrollTop = chatLog.scrollHeight;

            // Add AI Loading bubble
            const aiBubble = document.createElement('div');
            aiBubble.className = 'gpa-chat-bubble gpa-chat-bubble-ai';
            aiBubble.innerHTML = '<span style="opacity: 0.6;">AI 思考中...</span>';
            chatLog.appendChild(aiBubble);
            chatLog.scrollTop = chatLog.scrollHeight;

            try {
                // Call Gemini with context
                const reply = await callGemini(apiKey, promptText, "", this.chatHistory);
                
                // Render AI bubble with text
                aiBubble.innerHTML = renderMarkdown(reply);
                chatLog.scrollTop = chatLog.scrollHeight;

                // Push to history
                this.chatHistory.push({ role: 'user', text: promptText });
                this.chatHistory.push({ role: 'model', text: reply });
            } catch (err) {
                aiBubble.innerHTML = `<span style="color: #f87171;">錯誤: ${err.message || "請求失敗"}</span>`;
                chatLog.scrollTop = chatLog.scrollHeight;
            }
        }
    };

    // Inject Trigger Button
    function addTriggerButton() {
        if (document.querySelector('.gpa-float-btn')) return;
        const btn = document.createElement('div');
        btn.className = 'gpa-float-btn';
        btn.title = 'Gemini AI 摘要助理';
        btn.innerHTML = '✨';
        btn.addEventListener('click', () => {
            if (PanelUI.panel && PanelUI.panel.classList.contains('active')) {
                PanelUI.hide();
            } else {
                PanelUI.show();
            }
        });
        document.body.appendChild(btn);
    }

    // App Initialization
    function init() {
        GM_registerMenuCommand("Gemini 網頁與影片摘要助手", () => {
            PanelUI.show();
        });

        // Add float button after 2 seconds
        setTimeout(() => {
            addTriggerButton();
        }, 2000);
    }

    init();
})();
