// ==UserScript==
// @name         VideoBlock 影片過濾助手
// @namespace    https://github.com/
// @version      1.1
// @description  全站過濾並屏蔽 unwanted 影片，支援自訂關鍵字、UP主/頻道、時長過濾、廣告淨化與自訂網站規則
// @author       Antigravity
// @match        *://*/*
// @grant        GM_xmlhttpRequest
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_registerMenuCommand
// @connect      api.bilibili.com
// @run-at       document-end
// ==/UserScript==

(function () {
    'use strict';

    // Bilibili Category/TID mapping
    const BILIBILI_TID_MAP = {
        "1": "动画", "24": "MAD·AMV", "25": "MMD·3D", "27": "综合(动画)", "32": "完结动画", "47": "短片·手书·配音", "86": "特摄", "210": "手办·模玩",
        "13": "番剧", "33": "连载动画(番剧)", "51": "资讯(番剧)", "152": "官方延伸", "153": "国产动画", "168": "国产原创相关", "169": "布袋戏", "170": "资讯(国创)", "195": "动态漫·广播剧",
        "3": "音乐", "28": "原创音乐", "29": "音乐现场", "30": "VOCALOID·UTAU", "31": "翻唱", "59": "演奏", "130": "音乐综合", "193": "MV(音乐)", "194": "电音",
        "20": "宅舞", "154": "舞蹈综合", "156": "舞蹈教程", "198": "街舞", "199": "明星舞蹈", "200": "中国舞",
        "4": "游戏", "17": "单机游戏", "19": "Mugen", "65": "网络游戏", "121": "GMV", "136": "音游", "171": "电子竞技", "172": "手机游戏", "173": "桌游棋牌",
        "122": "野生技术协会", "124": "社科人文", "201": "科学科普", "207": "财经", "208": "校园学习", "209": "职业职场",
        "95": "手机平板", "189": "电脑装机", "190": "摄影摄像", "191": "影音智能",
        "21": "日常", "75": "动物圈", "76": "美食圈", "138": "搞笑", "161": "手工", "162": "绘画", "163": "运动", "174": "其他(生活)", "176": "汽車",
        "22": "鬼畜调教", "26": "音MAD", "126": "人力VOCALOID", "127": "教程演示(鬼畜)",
        "155": "时尚", "157": "美妆", "158": "服饰", "159": "T台", "164": "健身(时尚)", "192": "风尚标",
        "202": "资讯", "203": "熱點", "204": "环球", "205": "社会", "206": "综合(资讯)",
        "71": "娱乐", "137": "明星(娱乐)",
        "181": "影视", "85": "短片(影视)", "182": "影视杂谈", "183": "影视剪辑", "184": "预告·资讯(影视)",
        "177": "纪录片", "37": "人文·历史", "178": "科学·探索·自然", "179": "军事", "180": "社会·美食·旅行",
        "23": "电影", "83": "其他国家(电影)", "145": "欧美电影", "146": "日本电影", "147": "华语电影",
        "11": "电视剧", "185": "国产剧", "187": "海外剧"
    };

    // Pre-configured Site Rules
    const DEFAULT_RULES = [
        {
            name: "Bilibili",
            domain: "bilibili.com",
            cardSelector: ".feed-card, .bili-feed-card, .bili-video-card, .video-card, .video-page-card-small",
            titleSelector: ".bili-video-card__info--tit, .video-name, .title",
            authorSelector: ".up-name__text, .bili-video-card__info--author, .upname .name, .up-name",
            durationSelector: ".bili-video-card__stats__duration, .duration, .bpx-player-homepage-time-label-total-time",
            bvidSelector: "a[href*='/BV']"
        },
        {
            name: "YouTube",
            domain: "youtube.com",
            cardSelector: "ytd-rich-item-renderer, ytd-video-renderer, ytd-grid-video-renderer, ytd-compact-video-renderer, ytd-reel-item-renderer, ytd-playlist-video-renderer",
            titleSelector: "#video-title, #video-title-link, .ytd-compact-video-renderer #video-title, #reel-title-container, #video-title.ytd-playlist-video-renderer",
            authorSelector: "#text.ytd-channel-name, .ytd-channel-name a, #channel-title, #text.ytd-playlist-video-renderer",
            durationSelector: "span.ytd-thumbnail-overlay-time-status-renderer, #time-status, ytd-thumbnail-overlay-time-status-renderer span"
        }
    ];

    // Get active rule for the current site
    function getActiveRule() {
        const hostname = location.hostname;
        // Check custom rules first
        const customRules = GM_getValue('custom_rules', []);
        const matchedCustom = customRules.find(r => hostname.includes(r.domain));
        if (matchedCustom) return matchedCustom;

        // Check default rules
        return DEFAULT_RULES.find(r => hostname.includes(r.domain));
    }

    const activeRule = getActiveRule();
    
    // Early exit if no active rule matches the current site to ensure zero performance overhead
    if (!activeRule) {
        return;
    }

    // Global style for hiding elements cleanly
    const globalStyle = document.createElement('style');
    globalStyle.id = 'yb-global-styles';
    globalStyle.textContent = `
        .yb-blocked {
            display: none !important;
        }
        .yb-float-btn {
            position: fixed;
            bottom: 80px;
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
        .yb-float-btn:hover {
            transform: scale(1.08);
            background: rgba(30, 41, 59, 0.95);
            box-shadow: 0 10px 20px -3px rgba(59, 130, 246, 0.4);
        }
    `;
    document.head.appendChild(globalStyle);

    // Universal Blocker Engine
    class UniversalBlocker {
        constructor(rule) {
            this.rule = rule;
            this.titleKeywords = [];
            this.authorKeywords = [];
            this.sectionKeywords = [];
            this.minDuration = 0;
            this.cleanMode = false;
            
            this.tidCache = new Map();
            this.observer = null;
            this.debounceTimer = null;
        }

        init() {
            this.loadSettings();
            this.filter();

            // Setup DOM change monitor
            this.observer = new MutationObserver((mutations) => {
                const hasNewNodes = mutations.some(mutation =>
                    Array.from(mutation.addedNodes).some(node => {
                        if (node.nodeType !== Node.ELEMENT_NODE) return false;
                        // Match card selector or clean-mode elements
                        return node.querySelector(this.rule.cardSelector) ||
                               node.classList.contains(this.rule.cardSelector.split(',')[0].replace('.', '').trim());
                    })
                );

                if (hasNewNodes) {
                    clearTimeout(this.debounceTimer);
                    this.debounceTimer = setTimeout(() => {
                        this.filter();
                    }, 300);
                }
            });

            this.observer.observe(document.body, {
                childList: true,
                subtree: true
            });
        }

        loadSettings() {
            const rawTitle = GM_getValue('title_keywords', '');
            const rawAuthor = GM_getValue('author_keywords', '');
            const rawSection = GM_getValue('bilibili_section_keywords', '');

            this.titleKeywords = rawTitle.split(/[|｜]/).map(k => k.trim().toLowerCase()).filter(Boolean);
            this.authorKeywords = rawAuthor.split(/[|｜]/).map(k => k.trim().toLowerCase()).filter(Boolean);
            this.sectionKeywords = rawSection.split(/[|｜]/).map(k => k.trim().toLowerCase()).filter(Boolean);
            this.minDuration = parseFloat(GM_getValue('min_duration', 0)) || 0;
            this.cleanMode = !!GM_getValue('clean_mode', false);
        }

        updateSettings() {
            this.loadSettings();
            // Reset processed elements to re-evaluate them
            document.querySelectorAll('[data-yb-processed]').forEach(el => {
                el.removeAttribute('data-yb-processed');
                el.classList.remove('yb-blocked');
            });
            this.filter();
        }

        async filter() {
            // Apply ad/live clean mode if enabled
            if (this.cleanMode) {
                this.cleanAdsAndPlatforms();
            }

            if (this.titleKeywords.length === 0 && this.authorKeywords.length === 0 && this.sectionKeywords.length === 0 && this.minDuration <= 0) {
                return;
            }

            const cards = document.querySelectorAll(`${this.rule.cardSelector}:not([data-yb-processed])`);
            if (cards.length === 0) return;

            const sectionCheckQueue = [];

            for (const cardElement of cards) {
                cardElement.setAttribute('data-yb-processed', 'true');

                const titleEl = cardElement.querySelector(this.rule.titleSelector);
                const authorEl = cardElement.querySelector(this.rule.authorSelector);
                const durationEl = cardElement.querySelector(this.rule.durationSelector);

                // 1. Check title keywords
                if (titleEl && this.titleKeywords.length > 0) {
                    const titleText = titleEl.textContent.toLowerCase();
                    if (this.titleKeywords.some(kw => titleText.includes(kw))) {
                        cardElement.classList.add('yb-blocked');
                        continue;
                    }
                }

                // 2. Check author/channel keywords
                if (authorEl && this.authorKeywords.length > 0) {
                    const authorText = authorEl.textContent.toLowerCase();
                    if (this.authorKeywords.some(kw => authorText.includes(kw))) {
                        cardElement.classList.add('yb-blocked');
                        continue;
                    }
                }

                // 3. Check video duration
                if (durationEl && this.minDuration > 0) {
                    const durationText = durationEl.textContent.trim();
                    const durationMinutes = this.parseDuration(durationText);
                    if (durationMinutes < this.minDuration) {
                        cardElement.classList.add('yb-blocked');
                        continue;
                    }
                }

                // 4. Specifically check Bilibili sections (using Bivid Selector to retrieve partition metadata)
                if (this.rule.name === "Bilibili" && this.rule.bvidSelector && this.sectionKeywords.length > 0) {
                    const bvidEl = cardElement.querySelector(this.rule.bvidSelector);
                    if (bvidEl) {
                        const bvidMatch = bvidEl.href.match(/\/BV[\w]+/);
                        if (bvidMatch) {
                            const bvid = bvidMatch[0].replace('/', '');
                            sectionCheckQueue.push({ cardElement, bvid });
                        }
                    }
                }
            }

            // Bilibili section check runner
            if (sectionCheckQueue.length > 0) {
                const batchSize = 10;
                for (let i = 0; i < sectionCheckQueue.length; i += batchSize) {
                    const batch = sectionCheckQueue.slice(i, i + batchSize);
                    await Promise.all(batch.map(async ({ cardElement, bvid }) => {
                        try {
                            const tid = await this.getBilibiliTid(bvid);
                            if (tid) {
                                const sectionName = BILIBILI_TID_MAP[tid] || "未知分区";
                                const sectionNameLower = sectionName.toLowerCase();
                                if (this.sectionKeywords.some(kw => sectionNameLower.includes(kw))) {
                                    cardElement.classList.add('yb-blocked');
                                }
                            }
                        } catch (err) {
                            console.error('Section query error:', err);
                        }
                    }));

                    if (i + batchSize < sectionCheckQueue.length) {
                        await new Promise(resolve => setTimeout(resolve, 100));
                    }
                }
            }
        }

        cleanAdsAndPlatforms() {
            if (this.rule.name === "Bilibili") {
                // Clean Bilibili Ads & Live streams
                const selectors = [
                    '.feed-card',
                    '.bili-video-card',
                    '.video-page-card-small'
                ];
                selectors.forEach(sel => {
                    document.querySelectorAll(sel).forEach(el => {
                        const isAd = el.querySelector('.bili-video-card__info--creative-ad, .bili-video-card__info--ad, svg.vui_icon.bili-video-card__stats--icon');
                        if (isAd) el.classList.add('yb-blocked');
                    });
                });

                const liveSelectors = ['.pop-live-small-mode', '.floor-single-card', '.bili-live-card'];
                liveSelectors.forEach(sel => {
                    document.querySelectorAll(sel).forEach(el => el.classList.add('yb-blocked'));
                });
            } else if (this.rule.name === "YouTube") {
                // Clean YouTube Ads & Shorts shelves
                const adSelectors = [
                    'ytd-promoted-sparkles-web-renderer',
                    'ytd-display-ad-renderer',
                    '#player-ads',
                    '.video-ads',
                    '.ytp-ad-module'
                ];
                adSelectors.forEach(sel => {
                    document.querySelectorAll(sel).forEach(el => el.classList.add('yb-blocked'));
                });

                const shortsSelectors = [
                    'ytd-reel-shelf-renderer',
                    'ytd-rich-shelf-renderer[is-shorts]',
                    'a[href*="/shorts/"]'
                ];
                shortsSelectors.forEach(sel => {
                    document.querySelectorAll(sel).forEach(el => {
                        // Closest video item container
                        const card = el.closest('ytd-rich-item-renderer, ytd-video-renderer, ytd-compact-video-renderer');
                        if (card) {
                            card.classList.add('yb-blocked');
                        } else {
                            el.classList.add('yb-blocked');
                        }
                    });
                });
            }
        }

        parseDuration(text) {
            const parts = text.split(':').map(Number);
            if (parts.length === 2) {
                return parts[0] + (parts[1] / 60); // mm:ss
            } else if (parts.length === 3) {
                return (parts[0] * 60) + parts[1] + (parts[2] / 60); // hh:mm:ss
            }
            return 0;
        }

        getBilibiliTid(bvid) {
            if (this.tidCache.has(bvid)) {
                return Promise.resolve(this.tidCache.get(bvid));
            }

            return new Promise((resolve) => {
                GM_xmlhttpRequest({
                    method: "GET",
                    url: `https://api.bilibili.com/x/web-interface/view?bvid=${bvid}`,
                    onload: (res) => {
                        try {
                            const json = JSON.parse(res.responseText);
                            if (json.code === 0 && json.data) {
                                const tid = json.data.tid;
                                this.tidCache.set(bvid, tid);
                                resolve(tid);
                            } else {
                                resolve(null);
                            }
                        } catch (e) {
                            resolve(null);
                        }
                    },
                    onerror: () => resolve(null)
                });
            });
        }
    }

    // Glassmorphism Settings UI
    const SettingsModal = {
        overlay: null,
        initStyles() {
            if (document.getElementById('yb-modal-styles')) return;
            const style = document.createElement('style');
            style.id = 'yb-modal-styles';
            style.textContent = `
                .yb-modal-overlay {
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
                .yb-modal-overlay.active {
                    opacity: 1;
                    pointer-events: auto;
                }
                .yb-modal-card {
                    background: rgba(30, 41, 59, 0.85);
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    border-radius: 20px;
                    width: 480px;
                    padding: 28px;
                    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
                    color: #f8fafc;
                    transform: translateY(20px) scale(0.95);
                    transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1);
                }
                .yb-modal-overlay.active .yb-modal-card {
                    transform: translateY(0) scale(1);
                }
                .yb-modal-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 20px;
                }
                .yb-modal-title {
                    font-size: 18px;
                    font-weight: 700;
                    background: linear-gradient(135deg, #60a5fa, #3b82f6);
                    -webkit-background-clip: text;
                    -webkit-text-fill-color: transparent;
                }
                .yb-modal-close {
                    background: none;
                    border: none;
                    color: #94a3b8;
                    cursor: pointer;
                    font-size: 20px;
                    transition: color 0.2s;
                }
                .yb-modal-close:hover {
                    color: #f8fafc;
                }
                
                /* Tabs */
                .yb-tabs {
                    display: flex;
                    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
                    margin-bottom: 20px;
                }
                .yb-tab {
                    padding: 10px 20px;
                    background: none;
                    border: none;
                    color: #94a3b8;
                    cursor: pointer;
                    font-weight: 600;
                    font-size: 14px;
                    position: relative;
                    transition: color 0.2s;
                }
                .yb-tab.active {
                    color: #3b82f6;
                }
                .yb-tab.active::after {
                    content: '';
                    position: absolute;
                    bottom: -1px;
                    left: 0;
                    width: 100%;
                    height: 2px;
                    background: #3b82f6;
                }
                .yb-tab-content {
                    display: none;
                }
                .yb-tab-content.active {
                    display: block;
                }
                
                /* Form Control */
                .yb-form-group {
                    margin-bottom: 16px;
                }
                .yb-label {
                    display: block;
                    font-size: 13px;
                    font-weight: 600;
                    color: #cbd5e1;
                    margin-bottom: 6px;
                }
                .yb-textarea {
                    width: 100%;
                    height: 60px;
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
                .yb-textarea:focus, .yb-input:focus {
                    border-color: #3b82f6;
                }
                .yb-input {
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
                .yb-input-row {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 6px 0;
                }
                .yb-input-desc {
                    font-size: 12px;
                    color: #94a3b8;
                }
                
                /* Toggle switch */
                .yb-switch {
                    position: relative;
                    display: inline-block;
                    width: 44px;
                    height: 24px;
                }
                .yb-switch input {
                    opacity: 0;
                    width: 0;
                    height: 0;
                }
                .yb-slider {
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
                .yb-slider:before {
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
                input:checked + .yb-slider {
                    background-color: #3b82f6;
                }
                input:checked + .yb-slider:before {
                    transform: translateX(20px);
                }
                
                /* Buttons */
                .yb-modal-buttons {
                    display: flex;
                    gap: 12px;
                    margin-top: 24px;
                }
                .yb-btn {
                    flex: 1;
                    padding: 12px;
                    border-radius: 12px;
                    font-size: 14px;
                    font-weight: 600;
                    cursor: pointer;
                    border: none;
                    transition: background 0.2s, transform 0.1s;
                }
                .yb-btn-primary {
                    background: linear-gradient(135deg, #3b82f6, #2563eb);
                    color: #fff;
                    box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
                }
                .yb-btn-primary:hover {
                    background: linear-gradient(135deg, #60a5fa, #3b82f6);
                }
                .yb-btn-primary:active {
                    transform: scale(0.98);
                }
                .yb-btn-secondary {
                    background: rgba(255, 255, 255, 0.05);
                    color: #f8fafc;
                    border: 1px solid rgba(255, 255, 255, 0.08);
                }
                .yb-btn-secondary:hover {
                    background: rgba(255, 255, 255, 0.1);
                }
                .yb-btn-secondary:active {
                    transform: scale(0.98);
                }
                .yb-hint {
                    font-size: 11px;
                    color: #64748b;
                    margin-top: 3px;
                }
                .yb-error {
                    color: #ef4444;
                    font-size: 12px;
                    margin-top: 5px;
                    display: none;
                }
            `;
            document.head.appendChild(style);
        },
        create(onSaveCallback) {
            if (this.overlay) return;
            this.initStyles();

            this.overlay = document.createElement('div');
            this.overlay.className = 'yb-modal-overlay';

            // Get settings
            const settings = {
                titleKeywords: GM_getValue('title_keywords', ''),
                authorKeywords: GM_getValue('author_keywords', ''),
                minDuration: GM_getValue('min_duration', ''),
                cleanMode: GM_getValue('clean_mode', false),
                biliSection: GM_getValue('bilibili_section_keywords', ''),
                customRules: JSON.stringify(GM_getValue('custom_rules', []), null, 2)
            };

            this.overlay.innerHTML = `
                <div class="yb-modal-card">
                    <div class="yb-modal-header">
                        <div class="yb-modal-title">VideoBlock 影片過濾設定</div>
                        <button class="yb-modal-close" id="yb-close-btn">✕</button>
                    </div>

                    <div class="yb-tabs">
                        <button class="yb-tab active" id="yb-tab-btn-kw">過濾關鍵字</button>
                        <button class="yb-tab" id="yb-tab-btn-clean">淨化與特別設定</button>
                        <button class="yb-tab" id="yb-tab-btn-custom">自訂網站規則</button>
                    </div>

                    <!-- Tab 1: Keywords -->
                    <div class="yb-tab-content active" id="yb-tab-content-kw">
                        <div class="yb-form-group">
                            <label class="yb-label">標題關鍵字 (用 | 或 ｜ 分隔)</label>
                            <textarea class="yb-textarea" id="yb-title-kw" placeholder="例如: 遊戲實況 | 劇透 | 抽卡">${settings.titleKeywords}</textarea>
                        </div>
                        <div class="yb-form-group">
                            <label class="yb-label">UP 主/頻道/作者名稱 (用 | 分隔)</label>
                            <textarea class="yb-textarea" id="yb-author-kw" placeholder="例如: 頻道A | UP主B">${settings.authorKeywords}</textarea>
                        </div>
                        <div class="yb-form-group">
                            <div class="yb-input-row">
                                <span class="yb-label">最少影片時長 (分鐘)</span>
                                <input type="number" id="yb-min-dur" class="yb-input" style="width: 80px;" min="0" step="0.5" value="${settings.minDuration}">
                            </div>
                            <div class="yb-hint" style="text-align: right;">低於此時長的影片將會被屏蔽 (0代表不限制)。</div>
                        </div>
                    </div>

                    <!-- Tab 2: Clean Mode -->
                    <div class="yb-tab-content" id="yb-tab-content-clean">
                        <div class="yb-form-group">
                            <div class="yb-input-row">
                                <div>
                                    <span class="yb-label">淨化模式 (廣告 & 推廣過濾)</span>
                                    <span class="yb-input-desc">自動過濾 B站廣告與直播、YouTube廣告與 Shorts 影片</span>
                                </div>
                                <label class="yb-switch">
                                    <input type="checkbox" id="yb-clean-mode" ${settings.cleanMode ? 'checked' : ''}>
                                    <span class="yb-slider"></span>
                                </label>
                            </div>
                        </div>
                        <div class="yb-form-group" id="yb-bili-only-group">
                            <label class="yb-label">Bilibili 專屬：分區名稱關鍵字 (用 | 分隔)</label>
                            <textarea class="yb-textarea" id="yb-bili-sec-kw" placeholder="例如: 游戏 | 动画">${settings.biliSection}</textarea>
                            <div class="yb-hint">屏蔽指定B站分區的影片。會自動向 B站 API 查詢影片所屬分區。</div>
                        </div>
                    </div>

                    <!-- Tab 3: Custom Rules -->
                    <div class="yb-tab-content" id="yb-tab-content-custom">
                        <div class="yb-form-group">
                            <label class="yb-label">自訂網站規則 (JSON 陣列)</label>
                            <textarea class="yb-textarea" id="yb-custom-json" style="height: 160px; font-family: monospace; font-size: 11px;" placeholder='[
  {
    "name": "Twitch",
    "domain": "twitch.tv",
    "cardSelector": "div.tw-hover-card-target",
    "titleSelector": "h3.tw-title",
    "authorSelector": "a.tw-link"
  }
]'>${settings.customRules}</textarea>
                            <div class="yb-error" id="yb-json-error">JSON 格式錯誤，請檢查後重試。</div>
                            <div class="yb-hint">進階使用者可在此貼上 CSS 選擇器規則，將過濾器套用到任何支援的影片網站。</div>
                        </div>
                    </div>

                    <div class="yb-modal-buttons">
                        <button class="yb-btn yb-btn-secondary" id="yb-btn-cancel">取消</button>
                        <button class="yb-btn yb-btn-primary" id="yb-btn-save">儲存設定</button>
                    </div>
                </div>
            `;

            document.body.appendChild(this.overlay);

            // Tab Switching Logic
            const tabKw = document.getElementById('yb-tab-btn-kw');
            const tabClean = document.getElementById('yb-tab-btn-clean');
            const tabCustom = document.getElementById('yb-tab-btn-custom');
            
            const contentKw = document.getElementById('yb-tab-content-kw');
            const contentClean = document.getElementById('yb-tab-content-clean');
            const contentCustom = document.getElementById('yb-tab-content-custom');

            const deactivateAll = () => {
                [tabKw, tabClean, tabCustom].forEach(t => t.classList.remove('active'));
                [contentKw, contentClean, contentCustom].forEach(c => c.classList.remove('active'));
            };

            tabKw.addEventListener('click', () => {
                deactivateAll();
                tabKw.classList.add('active');
                contentKw.classList.add('active');
            });

            tabClean.addEventListener('click', () => {
                deactivateAll();
                tabClean.classList.add('active');
                contentClean.classList.add('active');
            });

            tabCustom.addEventListener('click', () => {
                deactivateAll();
                tabCustom.classList.add('active');
                contentCustom.classList.add('active');
            });

            // Close actions
            const closeBtn = document.getElementById('yb-close-btn');
            const cancelBtn = document.getElementById('yb-btn-cancel');
            const hideModal = () => this.hide();

            closeBtn.addEventListener('click', hideModal);
            cancelBtn.addEventListener('click', hideModal);
            this.overlay.addEventListener('click', (e) => {
                if (e.target === this.overlay) hideModal();
            });

            // Save settings logic
            const saveBtn = document.getElementById('yb-btn-save');
            const jsonTextarea = document.getElementById('yb-custom-json');
            const jsonError = document.getElementById('yb-json-error');

            saveBtn.addEventListener('click', () => {
                // Validate JSON first
                let parsedRules = [];
                const jsonVal = jsonTextarea.value.trim();
                if (jsonVal) {
                    try {
                        parsedRules = JSON.parse(jsonVal);
                        if (!Array.isArray(parsedRules)) {
                            throw new Error("Must be an array");
                        }
                        jsonError.style.display = 'none';
                    } catch (err) {
                        jsonError.style.display = 'block';
                        tabCustom.click(); // Switch to custom tab to show error
                        return;
                    }
                }

                GM_setValue('title_keywords', document.getElementById('yb-title-kw').value);
                GM_setValue('author_keywords', document.getElementById('yb-author-kw').value);
                GM_setValue('min_duration', parseFloat(document.getElementById('yb-min-dur').value) || 0);
                GM_setValue('clean_mode', document.getElementById('yb-clean-mode').checked);
                GM_setValue('bilibili_section_keywords', document.getElementById('yb-bili-sec-kw').value);
                GM_setValue('custom_rules', parsedRules);

                hideModal();
                if (onSaveCallback) onSaveCallback();
            });
        },
        show(onSaveCallback) {
            this.create(onSaveCallback);
            this.overlay.classList.add('active');
        },
        hide() {
            if (this.overlay) {
                this.overlay.classList.remove('active');
                // Remove modal from DOM to re-create on next click (updates fields)
                this.overlay.remove();
                this.overlay = null;
            }
        }
    };

    // Inject Floating Button
    function addFloatingButton(onSaveCallback) {
        if (document.querySelector('.yb-float-btn')) return;
        const btn = document.createElement('div');
        btn.className = 'yb-float-btn';
        btn.title = 'VideoBlock 設定';
        btn.innerHTML = '🛡️';
        btn.addEventListener('click', () => {
            SettingsModal.show(onSaveCallback);
        });
        document.body.appendChild(btn);
    }

    // App Initialization
    function init() {
        const blocker = new UniversalBlocker(activeRule);
        blocker.init();

        GM_registerMenuCommand("VideoBlock 過濾設定", () => {
            SettingsModal.show(() => blocker.updateSettings());
        });

        setTimeout(() => {
            addFloatingButton(() => blocker.updateSettings());
        }, 2000);
    }

    init();
})();
