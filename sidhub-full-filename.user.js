// ==UserScript==
// @name         SeedHub (sidhub.cc) 磁力完整文件名显示
// @namespace    https://sidhub.cc/
// @version      2.0.0
// @description  SeedHub 电影/剧集/搜索页的磁力列表文件名被服务端截断（结尾"..."）。完整文件名其实就在链接的 title 属性里，本脚本将其还原显示，并支持悬停提示与一键复制。
// @author       you
// @match        *://sidhub.cc/*
// @match        *://*.sidhub.cc/*
// @run-at       document-idle
// @noframes
// @grant        GM_setClipboard
// @grant        GM_addStyle
// @grant        GM_registerMenuCommand
// ==/UserScript==

(function () {
    'use strict';

    const STORAGE_KEY = 'shf_mode';
    // expand  = 展开完整文件名（默认）
    // tooltip = 不改布局，仅悬停提示
    let mode = localStorage.getItem(STORAGE_KEY) || 'expand';

    GM_addStyle(`
        /* SeedHub 磁力列表：放开一切截断样式 */
        .seeds li a {
            white-space: normal !important;
            word-break: break-word !important;
            overflow-wrap: anywhere !important;
            overflow: visible !important;
            text-overflow: clip !important;
            max-width: none !important;
            max-height: none !important;
            height: auto !important;
            -webkit-line-clamp: unset !important;
        }
        .shf-parent {
            white-space: normal !important;
            overflow: visible !important;
            text-overflow: clip !important;
            max-height: none !important;
            height: auto !important;
            -webkit-line-clamp: unset !important;
        }
        .shf-anchor {
            white-space: normal !important;
            word-break: break-word !important;
            overflow-wrap: anywhere !important;
            overflow: visible !important;
            text-overflow: clip !important;
            max-width: none !important;
            max-height: none !important;
            height: auto !important;
            -webkit-line-clamp: unset !important;
        }
        .shf-copy {
            display: inline-block;
            margin: 0 4px;
            padding: 1px 6px;
            font-size: 12px;
            line-height: 1.4;
            border: 1px solid currentColor;
            border-radius: 4px;
            background: transparent;
            color: inherit;
            opacity: .6;
            cursor: pointer;
            vertical-align: middle;
            user-select: none;
        }
        .shf-copy:hover { opacity: 1; }
        .shf-tip {
            text-decoration: underline dotted;
            text-underline-offset: 3px;
        }
    `);

    /* ---------------- 工具 ---------------- */

    function copyText(text, btn) {
        const done = () => {
            if (!btn) return;
            const old = btn.textContent;
            btn.textContent = '✓ 已复制';
            setTimeout(() => { btn.textContent = old; }, 1200);
        };
        if (typeof GM_setClipboard === 'function') {
            GM_setClipboard(text);
            done();
        } else if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(text).then(done).catch(() => {});
        } else {
            const ta = document.createElement('textarea');
            ta.value = text;
            document.body.appendChild(ta);
            ta.select();
            try { document.execCommand('copy'); done(); } catch (e) {}
            document.body.removeChild(ta);
        }
    }

    function makeCopyBtn(text) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'shf-copy';
        btn.textContent = '⧉ 复制';
        btn.title = '点击复制：' + text;
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            copyText(text, btn);
        });
        return btn;
    }

    function looksTruncated(text) {
        return /(\u2026|\.{3,})\s*$/.test((text || '').trim());
    }

    /* ---------------- 核心逻辑 ----------------
       SeedHub 结构：
       <li>
         <a title="完整文件名" href="/link_start/?seed_id=...">截断文本...</a>
         / <code class="size">84.7G</code> ...
       </li>
       完整文件名在 title 属性中。 */

    function processSeedLink(a) {
        if (a.dataset.shfDone === '1') return;
        a.dataset.shfDone = '1';

        const full = (a.getAttribute('title') || '').trim();
        const shown = (a.textContent || '').trim();
        if (!full) return;

        if (mode === 'tooltip') {
            a.classList.add('shf-tip');
            return;
        }

        // 还原完整文件名：可见文本被截断、或比 title 短时才替换
        const truncated = looksTruncated(shown) || full.length > shown.length;
        if (truncated && shown !== full) {
            a.textContent = full;
            a.classList.add('shf-anchor');
            // 放开父级容器可能的钳制
            const li = a.closest('li') || a.parentElement;
            if (li) li.classList.add('shf-parent');
            // 复制按钮（插在链接后面，点击不会触发跳转）
            a.after(makeCopyBtn(full));
        }
    }

    // 兜底：万一其它页面出现标准 magnet 链接（搜索页/外链页等）
    function parseMagnet(href) {
        try {
            const q = href.slice(href.indexOf('?') + 1);
            return (new URLSearchParams(q).get('dn') || '').trim();
        } catch (e) { return ''; }
    }

    function processMagnetAnchor(a) {
        if (a.dataset.shfDone === '1') return;
        const href = a.getAttribute('href') || '';
        if (href.indexOf('magnet:') !== 0) return;
        a.dataset.shfDone = '1';

        const dn = parseMagnet(href);
        const shown = (a.textContent || '').trim();
        if (!dn) return;
        a.title = dn;
        if (mode !== 'expand') return;
        if (looksTruncated(shown) || dn.length > shown.length + 2) {
            a.textContent = dn;
        }
        a.classList.add('shf-anchor');
        if (a.parentElement) a.parentElement.classList.add('shf-parent');
        a.after(makeCopyBtn(dn));
    }

    function processAll() {
        // SeedHub 磁力列表（电影页 / 剧集页 / 搜索页共用）
        document.querySelectorAll('.seeds li a[title]').forEach(processSeedLink);
        document.querySelectorAll('a[href*="/link_start/"][title]').forEach(processSeedLink);
        // 标准 magnet 链接兜底
        document.querySelectorAll('a[href^="magnet:"]').forEach(processMagnetAnchor);
    }

    /* ---------------- 动态加载支持 ---------------- */

    let timer = null;
    const observer = new MutationObserver(() => {
        if (timer) clearTimeout(timer);
        timer = setTimeout(processAll, 200);
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });

    /* ---------------- 菜单：切换显示模式 ---------------- */

    if (typeof GM_registerMenuCommand === 'function') {
        GM_registerMenuCommand(
            '切换显示模式（当前：' + (mode === 'expand' ? '展开完整文件名' : '仅悬停提示') + '）',
            () => {
                mode = mode === 'expand' ? 'tooltip' : 'expand';
                localStorage.setItem(STORAGE_KEY, mode);
                document.querySelectorAll('[data-shf-done]').forEach((el) => { delete el.dataset.shfDone; });
                document.querySelectorAll('.shf-copy').forEach((el) => el.remove());
                document.querySelectorAll('.shf-tip').forEach((el) => el.classList.remove('shf-tip'));
                document.querySelectorAll('.shf-anchor').forEach((el) => el.classList.remove('shf-anchor'));
                document.querySelectorAll('.shf-parent').forEach((el) => el.classList.remove('shf-parent'));
                processAll();
            }
        );
    }

    processAll();
})();
