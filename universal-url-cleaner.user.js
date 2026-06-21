// ==UserScript==
// @name         Universal-網址去追蹤與重定向淨化器
// @namespace    https://github.com/
// @version      1.0
// @description  自動清除網址中的追蹤參數（如 utm_*, fbclid 等），並繞過各大平台的外鏈重定向警告頁面（如知乎、簡書、微博、CSDN 等）直接直達目標網站
// @author       Antigravity
// @match        *://*/*
// @run-at       document-start
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    // 1. URL Tracker Cleaner (Runs immediately on load)
    function cleanTrackingParams() {
        try {
            const url = new URL(window.location.href);
            const searchParams = url.searchParams;
            const trackers = [
                // General/Ad campaigns
                'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
                // Facebook, Google, Twitter, Microsoft Ads
                'fbclid', 'gclid', 'hmr', '_hsenc', '_hsmi', 'mc_cid', 'mc_eid',
                'yclid', 'gclsrc', 'dclid', 'twclid', 'msclkid', 'zanpid', 'origin',
                // E-commerce & Feeds
                'sp_atk', 'xptdk', 'spm', 'scm', 'ref', 'referer', 'si'
            ];
            
            let hasTracker = false;
            trackers.forEach(param => {
                if (searchParams.has(param)) {
                    searchParams.delete(param);
                    hasTracker = true;
                }
            });
            
            if (hasTracker) {
                const newSearch = searchParams.toString();
                url.search = newSearch ? '?' + newSearch : '';
                // Silently rewrite URL in address bar without reloading
                window.history.replaceState(window.history.state, document.title, url.toString());
                console.log("[URL Cleaner] Cleaned tracking parameters.");
            }
        } catch (e) {
            console.error("[URL Cleaner] Parameter cleaning failed:", e);
        }
    }
    cleanTrackingParams();

    // 2. Direct Link Redirector (Immediate Interception for warnings page)
    function checkRedirection() {
        try {
            const host = window.location.hostname;
            const searchParams = new URLSearchParams(window.location.search);
            let targetUrl = null;

            if (host.includes('link.zhihu.com')) {
                targetUrl = searchParams.get('target');
            } else if (host.includes('link.jianshu.com') || window.location.pathname.includes('go-wild')) {
                targetUrl = searchParams.get('url') || searchParams.get('t');
            } else if (host.includes('sinaurl')) {
                targetUrl = searchParams.get('u');
            } else if (host.includes('link.csdn.net')) {
                targetUrl = searchParams.get('target');
            } else if (host.includes('link.juejin.cn')) {
                targetUrl = searchParams.get('target');
            } else if (host.includes('pixiv.net') && window.location.pathname.includes('jump.php')) {
                targetUrl = searchParams.get('url') || window.location.search.substring(1);
            } else if (host.includes('c.pc.qq.com')) {
                targetUrl = searchParams.get('pfurl') || searchParams.get('url');
            } else if (host.includes('gitee.com') && window.location.pathname.includes('link')) {
                targetUrl = searchParams.get('target');
            } else if (host.includes('youtube.com') && window.location.pathname.includes('redirect')) {
                targetUrl = searchParams.get('q');
            }

            if (targetUrl) {
                let cleanTarget = decodeURIComponent(targetUrl);
                if (!cleanTarget.startsWith('http://') && !cleanTarget.startsWith('https://')) {
                    cleanTarget = 'https://' + cleanTarget;
                }
                // Instantly replace the interstitial warning page
                window.location.replace(cleanTarget);
                console.log("[URL Cleaner] Bypassing warning page. Redirecting directly to:", cleanTarget);
            }
        } catch (err) {
            console.error("[URL Cleaner] Redirection check failed:", err);
        }
    }
    checkRedirection();

    // 3. Anchor Link (<a> tag) Rewriter with MutationObserver
    function rewriteLink(a) {
        if (!a || !a.href) return;
        const href = a.href;
        if (!href.startsWith('http://') && !href.startsWith('https://')) return;

        try {
            const url = new URL(href);
            const host = url.hostname;
            const searchParams = url.searchParams;
            let targetUrl = null;

            if (host.includes('link.zhihu.com')) {
                targetUrl = searchParams.get('target');
            } else if (host.includes('link.jianshu.com') || url.pathname.includes('go-wild')) {
                targetUrl = searchParams.get('url') || searchParams.get('t');
            } else if (host.includes('sinaurl')) {
                targetUrl = searchParams.get('u');
            } else if (host.includes('link.csdn.net')) {
                targetUrl = searchParams.get('target');
            } else if (host.includes('link.juejin.cn')) {
                targetUrl = searchParams.get('target');
            } else if (host.includes('pixiv.net') && url.pathname.includes('jump.php')) {
                targetUrl = searchParams.get('url');
            } else if (host.includes('c.pc.qq.com')) {
                targetUrl = searchParams.get('pfurl') || searchParams.get('url');
            } else if (host.includes('gitee.com') && url.pathname.includes('link')) {
                targetUrl = searchParams.get('target');
            } else if (host.includes('youtube.com') && url.pathname.includes('redirect')) {
                targetUrl = searchParams.get('q');
            }

            if (targetUrl) {
                let cleanTarget = decodeURIComponent(targetUrl);
                if (!cleanTarget.startsWith('http://') && !cleanTarget.startsWith('https://')) {
                    cleanTarget = 'https://' + cleanTarget;
                }
                a.href = cleanTarget;
                // Add tooltip indicating purified status
                a.title = "✨ 直達網址：" + cleanTarget;
                console.log("[URL Cleaner] Purified outgoing link to:", cleanTarget);
            }
        } catch (e) {
            // Ignore relative URLs or parsing issues
        }
    }

    function rewriteAllLinks() {
        const anchors = document.getElementsByTagName('a');
        for (let i = 0; i < anchors.length; i++) {
            rewriteLink(anchors[i]);
        }
    }

    function initObserver() {
        rewriteAllLinks();

        // Listen for dynamically loaded elements
        const observer = new MutationObserver((mutations) => {
            mutations.forEach(mutation => {
                mutation.addedNodes.forEach(node => {
                    if (node.nodeType === Node.ELEMENT_NODE) {
                        if (node.tagName === 'A') {
                            rewriteLink(node);
                        } else {
                            const childAnchors = node.getElementsByTagName('a');
                            for (let i = 0; i < childAnchors.length; i++) {
                                rewriteLink(childAnchors[i]);
                            }
                        }
                    }
                });
            });
        });
        
        observer.observe(document.body || document.documentElement, {
            childList: true,
            subtree: true
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initObserver);
    } else {
        initObserver();
    }
})();
