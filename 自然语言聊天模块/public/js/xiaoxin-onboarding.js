/**
 * 小新新手引导 — Xiaoxin Onboarding Tour
 *
 * 功能：
 * - 聚光灯高亮效果（box-shadow 镂空 + 呼吸发光环）
 * - 小新角色气泡提示（使用用户已选的小新logo头像）
 * - 粒子星光点缀
 * - 步骤导航 / localStorage 记住完成状态
 * - 新用户首次访问自动弹出，老用户可点击"引导"按钮重看
 *
 * 全局 API：
 *   window.startXiaoxinOnboarding(force)
 *     force=true  立即开始引导（忽略 localStorage 标记）
 *     force=false 仅在新用户时开始（默认行为）
 */
(function () {
  'use strict';

  // ===================== 工具函数 =====================
  const $ = (sel, ctx) => (ctx || document).querySelector(sel);
  const $$ = (sel, ctx) => Array.from((ctx || document).querySelectorAll(sel));

  // ===================== 常量 =====================
  const OVERLAY_Z = 99990;
  const SPARKLE_COUNT = 12;

  // ===================== 获取小新头像（用户已选或默认第一个） =====================
  function resolveMascotFace() {
    // 优先使用 avatar-config 提供的 getXiaoxinLogo（localStorage 读取，默认第一个）
    if (typeof window.getXiaoxinLogo === 'function') {
      var logo = window.getXiaoxinLogo();
      if (logo) return logo;
    }
    // 回退：尝试 DOM 中的 brand logo
    var brandImg = document.querySelector('.brand img');
    if (brandImg && brandImg.src) return brandImg.src;
    // 最终回退
    return 'assets/avatars/xiaoxin/xiaoxin-logo-1.png';
  }

  // ===================== 引导步骤定义 =====================
  var PAGE_TOURS = {

    '/home.html': [
      {
        target: null,
        title: '嗨，我是小新！',
        content: '欢迎来到属于你的小小世界～<br>让我带你逛逛，看看这里都有什么好玩的吧！',
        position: 'center',
        spotlightPadding: 0,
      },
      {
        target: '.primary-button',
        title: '和小新聊聊天 💬',
        content: '点这里就能和我说话啦！<br>什么都可以聊——讲故事、问问题、说悄悄话～',
        position: 'top',
        spotlightPadding: 12,
      },
      {
        target: '.feature-grid',
        title: '探索更多功能 🧭',
        content: '这里藏着好多宝藏：<b>历史对话</b>、<b>我的手账本</b>、<b>收藏夹</b>，<br>还能换上你喜欢的<b>新形象</b>哦！',
        position: 'top',
        spotlightPadding: 10,
      },
      {
        target: '#daily-discoveries',
        title: '每日小发现 🌟',
        content: '我每天都会帮你发现有趣的新知识，<br>记得常来看看，每次都有惊喜～',
        position: 'top',
        spotlightPadding: 12,
      },
      {
        target: '.top-actions',
        title: '随时找到我 👋',
        content: '<b>拼音</b>开关让文字更好读～<br>想再看一遍引导的话，点右上角<b>"引导"</b>按钮就行啦！',
        position: 'bottom',
        spotlightPadding: 10,
      },
    ],

    '/chat.html': [
      {
        target: null,
        title: '和小新聊天啦！',
        content: '这里是我们的聊天室～<br>想问什么就打出来，我随时都在！',
        position: 'center',
        spotlightPadding: 0,
      },
      {
        target: '.chat-input-area, textarea, [class*="input"]',
        title: '在这里打字 💬',
        content: '在这里输入你想说的话，<br>然后按发送键，我就会收到啦！',
        position: 'top',
        spotlightPadding: 10,
      },
      {
        target: '.top-button, [class*="top-button"]',
        title: '返回首页 🏠',
        content: '聊完了随时可以点这里回到首页，<br>或者看看其他的功能～',
        position: 'bottom',
        spotlightPadding: 8,
      },
    ],

    '/journal.html': [
      {
        target: null,
        title: '这是小新的手账本 📒',
        content: '我会把你的聊天收获都记在这里，<br>变成一本漂亮的手账～',
        position: 'center',
        spotlightPadding: 0,
      },
    ],

    '/favorites.html': [
      {
        target: null,
        title: '我的收藏夹 ⭐',
        content: '你喜欢的、收藏的内容都在这里，<br>随时可以翻出来再看一遍～',
        position: 'center',
        spotlightPadding: 0,
      },
    ],

    '/history.html': [
      {
        target: null,
        title: '历史对话 📜',
        content: '我们以前聊过的内容都在这儿，<br>想回顾的话随时可以翻看～',
        position: 'center',
        spotlightPadding: 0,
      },
    ],
  };

  // ===================== 匹配当前页面的步骤 =====================
  function matchSteps() {
    var path = window.location.pathname;
    if (PAGE_TOURS[path]) return PAGE_TOURS[path];
    var keys = Object.keys(PAGE_TOURS);
    for (var i = 0; i < keys.length; i++) {
      if (path.endsWith(keys[i]) || path.startsWith(keys[i])) return PAGE_TOURS[keys[i]];
    }
    return null;
  }

  // ===================== 构建 DOM =====================
  function buildDOM(mascotFace) {
    var container = document.createElement('div');
    container.id = 'xo-onboarding-root';
    container.innerHTML =
      '<!-- 透明点击拦截层（阻止引导期间点击下层元素，如收藏） -->' +
      '<div id="xo-click-blocker" class="xo-click-blocker"></div>' +
      '<!-- 暗色遮罩（box-shadow 镂空聚光灯） -->' +
      '<div id="xo-overlay" class="xo-overlay"></div>' +
      '<!-- 发光环 -->' +
      '<div id="xo-glow-ring" class="xo-glow-ring"></div>' +
      '<!-- 星光粒子容器 -->' +
      '<div id="xo-sparkles" class="xo-sparkles"></div>' +
      '<!-- 提示气泡 -->' +
      '<div id="xo-tooltip" class="xo-tooltip">' +
        '<div class="xo-tooltip-arrow"></div>' +
        '<div class="xo-tooltip-inner">' +
          '<div class="xo-mascot-row">' +
            '<img class="xo-mascot-face" src="' + mascotFace + '" alt="小新" />' +
            '<div class="xo-mascot-speech-dot"></div>' +
          '</div>' +
          '<div class="xo-tooltip-body">' +
            '<h3 class="xo-tooltip-title" id="xo-title"></h3>' +
            '<p class="xo-tooltip-text" id="xo-content"></p>' +
          '</div>' +
          '<div class="xo-tooltip-foot">' +
            '<div class="xo-steps" id="xo-dots"></div>' +
            '<div class="xo-actions">' +
              '<button class="xo-btn xo-btn-skip" id="xo-btn-skip">跳过</button>' +
              '<button class="xo-btn xo-btn-next" id="xo-btn-next">下一步</button>' +
              '<button class="xo-btn xo-btn-done" id="xo-btn-done" style="display:none">知道啦 ✨</button>' +
            '</div>' +
          '</div>' +
        '</div>' +
      '</div>' +
      '<style id="xo-styles"></style>';
    document.body.appendChild(container);
    return {
      overlay: $('#xo-overlay', container),
      glowRing: $('#xo-glow-ring', container),
      sparkles: $('#xo-sparkles', container),
      tooltip: $('#xo-tooltip', container),
      title: $('#xo-title', container),
      content: $('#xo-content', container),
      dots: $('#xo-dots', container),
      btnSkip: $('#xo-btn-skip', container),
      btnNext: $('#xo-btn-next', container),
      btnDone: $('#xo-btn-done', container),
      styleEl: $('#xo-styles', container),
      root: container,
    };
  }

  // ===================== 注入核心 CSS =====================
  function injectCoreStyles(styleEl) {
    styleEl.textContent =
      '#xo-onboarding-root, #xo-onboarding-root * { box-sizing: border-box; }' +

      '/* 透明点击拦截层 —— 阻止引导期间点击/触摸下层所有元素 */' +
      '.xo-click-blocker {' +
        'position: fixed; inset: 0; z-index: ' + (OVERLAY_Z - 1) + ';' +
        'pointer-events: auto; background: transparent;' +
      '}' +

      '/* 暗色遮罩 —— 用 box-shadow 做镂空 */' +
      '.xo-overlay {' +
        'position: fixed; z-index: ' + OVERLAY_Z + '; pointer-events: none;' +
        'background: transparent; border-radius: 16px;' +
        'transition: left 0.42s cubic-bezier(0.25, 0.8, 0.25, 1.2),' +
                    'top 0.42s cubic-bezier(0.25, 0.8, 0.25, 1.2),' +
                    'width 0.42s cubic-bezier(0.25, 0.8, 0.25, 1.2),' +
                    'height 0.42s cubic-bezier(0.25, 0.8, 0.25, 1.2),' +
                    'box-shadow 0.42s ease,' +
                    'border-radius 0.42s ease;' +
      '}' +
      '.xo-overlay.fullscreen {' +
        'left: 0 !important; top: 0 !important;' +
        'width: 100vw !important; height: 100vh !important;' +
        'border-radius: 0 !important;' +
        'background: rgba(0, 0, 0, 0.55);' +
        'box-shadow: none !important;' +
      '}' +

      '/* 发光环 —— pulsing glow */' +
      '.xo-glow-ring {' +
        'position: fixed; z-index: ' + (OVERLAY_Z + 1) + '; pointer-events: none;' +
        'border-radius: 20px;' +
        'border: 3px solid rgba(255, 180, 80, 0.7);' +
        'box-shadow: 0 0 18px 4px rgba(255, 200, 100, 0.55),' +
                    '0 0 45px 10px rgba(255, 150, 50, 0.28),' +
                    'inset 0 0 8px 2px rgba(255, 220, 140, 0.22);' +
        'animation: xo-ring-pulse 2s ease-in-out infinite;' +
        'transition: left 0.42s cubic-bezier(0.25, 0.8, 0.25, 1.2),' +
                    'top 0.42s cubic-bezier(0.25, 0.8, 0.25, 1.2),' +
                    'width 0.42s cubic-bezier(0.25, 0.8, 0.25, 1.2),' +
                    'height 0.42s cubic-bezier(0.25, 0.8, 0.25, 1.2),' +
                    'border-radius 0.42s ease, opacity 0.35s ease;' +
        'opacity: 1;' +
      '}' +
      '.xo-glow-ring.hidden { opacity: 0; }' +

      '@keyframes xo-ring-pulse {' +
        '0%, 100% {' +
          'box-shadow: 0 0 18px 4px rgba(255, 200, 100, 0.55),' +
                      '0 0 45px 10px rgba(255, 150, 50, 0.28),' +
                      'inset 0 0 8px 2px rgba(255, 220, 140, 0.22);' +
          'border-color: rgba(255, 180, 80, 0.7);' +
        '}' +
        '50% {' +
          'box-shadow: 0 0 30px 8px rgba(255, 200, 100, 0.78),' +
                      '0 0 70px 18px rgba(255, 150, 50, 0.42),' +
                      'inset 0 0 14px 4px rgba(255, 220, 140, 0.36);' +
          'border-color: rgba(255, 210, 120, 0.95);' +
        '}' +
      '}' +

      '/* 星光粒子 */' +
      '.xo-sparkles {' +
        'position: fixed; z-index: ' + (OVERLAY_Z + 2) + '; pointer-events: none;' +
        'transition: opacity 0.35s ease; opacity: 1;' +
      '}' +
      '.xo-sparkles.hidden { opacity: 0; }' +
      '.xo-sparkle {' +
        'position: absolute; width: 6px; height: 6px;' +
        'background: radial-gradient(circle, #ffe8a0 0%, #ffb840 60%, transparent 100%);' +
        'border-radius: 50%;' +
        'animation: xo-sparkle-flicker 1.6s ease-in-out infinite;' +
      '}' +
      '.xo-sparkle:nth-child(odd) {' +
        'width: 4px; height: 4px;' +
        'background: radial-gradient(circle, #fff 0%, #ffc860 50%, transparent 100%);' +
        'animation-duration: 2s;' +
      '}' +
      '.xo-sparkle:nth-child(3n) {' +
        'width: 8px; height: 8px;' +
        'background: radial-gradient(circle, #ffeeb0 0%, #ff9e30 60%, transparent 100%);' +
        'animation-duration: 1.3s; animation-delay: 0.4s;' +
      '}' +

      '@keyframes xo-sparkle-flicker {' +
        '0%, 100% { transform: scale(0.4); opacity: 0.3; }' +
        '50% { transform: scale(1.3); opacity: 1; }' +
      '}' +

      '/* 提示气泡 */' +
      '.xo-tooltip {' +
        'position: fixed; z-index: ' + (OVERLAY_Z + 5) + ';' +
        'max-width: 360px; min-width: 260px;' +
        'animation: xo-bubble-in 0.45s cubic-bezier(0.34, 1.56, 0.64, 1);' +
        'transition: left 0.42s cubic-bezier(0.25, 0.8, 0.25, 1.2),' +
                    'top 0.42s cubic-bezier(0.25, 0.8, 0.25, 1.2),' +
                    'transform 0.42s cubic-bezier(0.25, 0.8, 0.25, 1.2);' +
      '}' +
      '@keyframes xo-bubble-in {' +
        'from { transform: scale(0.7); opacity: 0; }' +
        'to { transform: scale(1); opacity: 1; }' +
      '}' +
      '.xo-tooltip-inner {' +
        'position: relative;' +
        'background: linear-gradient(160deg, #fffef9 0%, #fff8ed 60%, #fff3de 100%);' +
        'border: 2.5px solid rgba(255, 200, 120, 0.55);' +
        'border-radius: 22px; padding: 18px 20px 14px;' +
        'box-shadow: 0 12px 38px rgba(0,0,0,0.18),' +
                    '0 0 0 8px rgba(255,200,130,0.10),' +
                    '0 0 60px 12px rgba(255,150,50,0.12);' +
        'overflow: visible;' +
      '}' +

      '/* 指向箭头 */' +
      '.xo-tooltip-arrow {' +
        'position: absolute; width: 0; height: 0;' +
        'border: 10px solid transparent; z-index: 1;' +
        'transition: all 0.42s cubic-bezier(0.25, 0.8, 0.25, 1.2);' +
      '}' +
      '.xo-tooltip.arrow-top .xo-tooltip-arrow {' +
        'top: -20px; left: 50%; margin-left: -10px;' +
        'border-bottom-color: #fffef9;' +
        'filter: drop-shadow(0 -2px 2px rgba(0,0,0,0.06));' +
      '}' +
      '.xo-tooltip.arrow-bottom .xo-tooltip-arrow {' +
        'bottom: -20px; left: 50%; margin-left: -10px;' +
        'border-top-color: #fff8ed;' +
        'filter: drop-shadow(0 2px 2px rgba(0,0,0,0.06));' +
      '}' +
      '.xo-tooltip.arrow-left .xo-tooltip-arrow {' +
        'left: -20px; top: 50%; margin-top: -10px;' +
        'border-right-color: #fffef9;' +
        'filter: drop-shadow(-2px 0 2px rgba(0,0,0,0.06));' +
      '}' +
      '.xo-tooltip.arrow-right .xo-tooltip-arrow {' +
        'right: -20px; top: 50%; margin-top: -10px;' +
        'border-left-color: #fff8ed;' +
        'filter: drop-shadow(2px 0 2px rgba(0,0,0,0.06));' +
      '}' +
      '.xo-tooltip.arrow-none .xo-tooltip-arrow { display: none; }' +

      '/* 小新头像行 */' +
      '.xo-mascot-row { display: flex; align-items: center; gap: 10px; margin-bottom: 10px; }' +
      '.xo-mascot-face {' +
        'width: 44px; height: 44px; border-radius: 50%;' +
        'border: 2px solid rgba(255, 180, 100, 0.5); object-fit: cover;' +
        'box-shadow: 0 4px 12px rgba(255, 140, 50, 0.18); flex-shrink: 0;' +
        'background: #ffe8d6;' +
        'animation: xo-mascot-bounce 2.8s ease-in-out infinite;' +
      '}' +
      '@keyframes xo-mascot-bounce {' +
        '0%, 100% { transform: translateY(0); }' +
        '30% { transform: translateY(-4px); }' +
        '60% { transform: translateY(0); }' +
        '80% { transform: translateY(-2px); }' +
      '}' +
      '.xo-mascot-speech-dot {' +
        'width: 10px; height: 10px; border-radius: 50%;' +
        'background: #ff9e40;' +
        'animation: xo-dot-blink 1.2s ease-in-out infinite;' +
      '}' +
      '@keyframes xo-dot-blink {' +
        '0%, 100% { opacity: 1; transform: scale(1); }' +
        '50% { opacity: 0.4; transform: scale(0.6); }' +
      '}' +

      '/* 标题和正文 */' +
      '.xo-tooltip-body { margin-bottom: 14px; }' +
      '.xo-tooltip-title { margin: 0 0 6px; font-size: 17px; font-weight: 950; color: #4c2418; line-height: 1.3; }' +
      '.xo-tooltip-text { margin: 0; font-size: 14px; color: #6b4535; line-height: 1.65; font-weight: 600; }' +
      '.xo-tooltip-text b { color: #d94a1e; font-weight: 900; }' +

      '/* 步骤圆点 + 按钮 */' +
      '.xo-tooltip-foot { display: flex; align-items: center; justify-content: space-between; gap: 10px; }' +
      '.xo-steps { display: flex; gap: 6px; }' +
      '.xo-step-dot {' +
        'width: 8px; height: 8px; border-radius: 50%; background: #e0d0c0;' +
        'transition: all 0.35s ease;' +
      '}' +
      '.xo-step-dot.active {' +
        'background: #ff7a3d; width: 24px; border-radius: 5px;' +
        'box-shadow: 0 0 8px rgba(255, 122, 61, 0.35);' +
      '}' +
      '.xo-step-dot.done { background: #b8d8a0; }' +
      '.xo-actions { display: flex; gap: 8px; }' +
      '.xo-btn {' +
        'padding: 8px 18px; border: none; border-radius: 999px;' +
        'font-size: 14px; font-weight: 800; cursor: pointer; font-family: inherit;' +
        'transition: all 0.2s ease; white-space: nowrap;' +
      '}' +
      '.xo-btn:active { transform: scale(0.95); }' +
      '.xo-btn-skip {' +
        'background: transparent; color: #a09080;' +
        'border: 1.5px solid rgba(160, 144, 128, 0.3);' +
      '}' +
      '.xo-btn-skip:hover {' +
        'color: #6b4535; border-color: rgba(160, 144, 128, 0.6);' +
        'background: rgba(255,255,255,0.5);' +
      '}' +
      '.xo-btn-next, .xo-btn-done {' +
        'background: linear-gradient(180deg, #ff8d4a, #ff642e); color: #fff;' +
        'box-shadow: 0 3px 0 #d94a1e, 0 8px 16px rgba(218, 77, 27, 0.18);' +
      '}' +
      '.xo-btn-next:hover, .xo-btn-done:hover {' +
        'transform: translateY(-1px);' +
        'box-shadow: 0 4px 0 #d94a1e, 0 10px 20px rgba(218, 77, 27, 0.22);' +
      '}' +
      '.xo-btn-done {' +
        'background: linear-gradient(180deg, #ffb347, #ff8c00);' +
        'box-shadow: 0 3px 0 #d97400, 0 8px 16px rgba(255, 140, 0, 0.2);' +
      '}' +

      '/* 响应式 */' +
      '@media (max-width: 500px) {' +
        '.xo-tooltip { max-width: calc(100vw - 24px); min-width: auto; left: 12px !important; right: 12px; }' +
        '.xo-tooltip-inner { padding: 14px 14px 10px; border-radius: 18px; }' +
        '.xo-tooltip-title { font-size: 15px; }' +
        '.xo-tooltip-text { font-size: 13px; }' +
        '.xo-btn { padding: 6px 14px; font-size: 13px; }' +
        '.xo-mascot-face { width: 36px; height: 36px; }' +
      '}' +

      '@media (prefers-reduced-motion: reduce) {' +
        '.xo-overlay, .xo-glow-ring, .xo-tooltip, .xo-tooltip-arrow { transition: none !important; }' +
        '.xo-glow-ring, .xo-sparkle, .xo-mascot-face, .xo-mascot-speech-dot { animation: none !important; }' +
      '}';
  }

  // ===================== 核心逻辑 =====================
  function isVisible(el) {
    if (!el) return false;
    var style = window.getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') return false;
    var rect = el.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  }

  function findTarget(step) {
    if (!step.target) return null;
    var selectors = step.target.split(',').map(function (s) { return s.trim(); });
    for (var i = 0; i < selectors.length; i++) {
      var el = $(selectors[i]);
      if (el && isVisible(el)) return el;
    }
    return null;
  }

  function updateSpotlight(dom, targetEl, padding) {
    if (!targetEl) {
      dom.overlay.className = 'xo-overlay fullscreen';
      dom.glowRing.classList.add('hidden');
      dom.sparkles.classList.add('hidden');
      return;
    }
    dom.overlay.classList.remove('fullscreen');
    dom.glowRing.classList.remove('hidden');
    dom.sparkles.classList.remove('hidden');

    var rect = targetEl.getBoundingClientRect();
    var p = padding || 8;
    var left = rect.left - p;
    var top = rect.top - p;
    var width = rect.width + p * 2;
    var height = rect.height + p * 2;
    var br = Math.max(10, Math.min(24, Math.min(width, height) * 0.18));

    dom.overlay.style.left = left + 'px';
    dom.overlay.style.top = top + 'px';
    dom.overlay.style.width = width + 'px';
    dom.overlay.style.height = height + 'px';
    dom.overlay.style.borderRadius = br + 'px';

    var spread = Math.max(window.innerWidth, window.innerHeight) * 2;
    dom.overlay.style.boxShadow = '0 0 0 ' + spread + 'px rgba(0, 0, 0, 0.58)';

    var ringPad = 4;
    dom.glowRing.style.left = (left - ringPad) + 'px';
    dom.glowRing.style.top = (top - ringPad) + 'px';
    dom.glowRing.style.width = (width + ringPad * 2) + 'px';
    dom.glowRing.style.height = (height + ringPad * 2) + 'px';
    dom.glowRing.style.borderRadius = (br + ringPad) + 'px';

    updateSparkles(dom, left, top, width, height);
  }

  function updateSparkles(dom, left, top, width, height) {
    dom.sparkles.innerHTML = '';
    for (var i = 0; i < SPARKLE_COUNT; i++) {
      var spark = document.createElement('div');
      spark.className = 'xo-sparkle';
      var side = i % 4;
      var t = i / SPARKLE_COUNT;
      var sx, sy;
      switch (side) {
        case 0: sx = t * width; sy = -4 - Math.random() * 10; break;
        case 1: sx = width + 4 + Math.random() * 10; sy = t * height; break;
        case 2: sx = t * width; sy = height + 4 + Math.random() * 10; break;
        case 3: sx = -4 - Math.random() * 10; sy = t * height; break;
      }
      spark.style.left = (left + sx) + 'px';
      spark.style.top = (top + sy) + 'px';
      spark.style.animationDelay = (Math.random() * 1.6) + 's';
      spark.style.animationDuration = (1.2 + Math.random() * 1.8) + 's';
      dom.sparkles.appendChild(spark);
    }
  }

  function positionTooltip(dom, targetEl, position) {
    var tooltip = dom.tooltip;
    var ttRect = tooltip.getBoundingClientRect();
    var vw = window.innerWidth;
    var vh = window.innerHeight;

    tooltip.className = 'xo-tooltip';

    var left, top;
    var gap = 18;
    var isMobile = vw <= 500;

    if (position === 'center' || !targetEl) {
      tooltip.classList.add('arrow-none');
      if (isMobile) {
        left = 12;
        top = Math.max(20, (vh - ttRect.height) / 2);
        tooltip.style.left = left + 'px';
        tooltip.style.right = '12px';
        tooltip.style.top = top + 'px';
        tooltip.style.transform = 'none';
      } else {
        left = Math.max(16, (vw - ttRect.width) / 2);
        top = Math.max(20, (vh - ttRect.height) / 2);
        tooltip.style.left = left + 'px';
        tooltip.style.right = 'auto';
        tooltip.style.top = top + 'px';
        tooltip.style.transform = 'none';
      }
      return;
    }

    var rect = targetEl.getBoundingClientRect();
    var ttW = isMobile ? Math.min(360, vw - 24) : ttRect.width || 360;
    var ttH = ttRect.height || 180;

    switch (position) {
      case 'top':
        left = rect.left + rect.width / 2 - ttW / 2;
        top = rect.top - ttH - gap;
        tooltip.classList.add('arrow-bottom');
        break;
      case 'bottom':
        left = rect.left + rect.width / 2 - ttW / 2;
        top = rect.bottom + gap;
        tooltip.classList.add('arrow-top');
        break;
      case 'left':
        left = rect.left - ttW - gap;
        top = rect.top + rect.height / 2 - ttH / 2;
        tooltip.classList.add('arrow-right');
        break;
      case 'right':
        left = rect.right + gap;
        top = rect.top + rect.height / 2 - ttH / 2;
        tooltip.classList.add('arrow-left');
        break;
      default:
        if (rect.bottom + ttH + gap < vh) {
          left = rect.left + rect.width / 2 - ttW / 2;
          top = rect.bottom + gap;
          tooltip.classList.add('arrow-top');
        } else {
          left = rect.left + rect.width / 2 - ttW / 2;
          top = rect.top - ttH - gap;
          tooltip.classList.add('arrow-bottom');
        }
    }

    if (!isMobile) {
      left = Math.max(8, Math.min(left, vw - ttW - 8));
      top = Math.max(8, Math.min(top, vh - ttH - 8));
    } else {
      left = 12;
      top = Math.max(8, Math.min(top, vh - ttH - 8));
      tooltip.style.right = '12px';
    }

    tooltip.style.left = left + 'px';
    tooltip.style.top = top + 'px';
    if (!isMobile) tooltip.style.right = 'auto';
    tooltip.style.transform = 'none';
  }

  // ===================== 主初始化函数 =====================
  function init(force) {
    var STEPS = matchSteps();
    if (window.__dbg) window.__dbg('dbg-obo', 'init('+!!force+') STEPS='+(STEPS?STEPS.length:0), '#ff0');
    if (!STEPS || STEPS.length === 0) {
      if (window.__dbg) window.__dbg('dbg-obo', '无匹配步骤，退出', '#f44');
      return;
    }

    // 检查是否已完成（force=true 时跳过检查）
    // onboardingDone 由登录接口/me 接口返回，home.html 设置到 window.__onboardingDone
    if (!force && window.__onboardingDone) {
      if (window.__dbg) window.__dbg('dbg-obo', 'onboardingDone已true, 跳过引导', '#888');
      return;
    }

    // 记录本次是否为强制触发（手动点"引导"按钮），强制触发时不通知服务端
    var isForceRun = !!force;

    // 清除已有的引导（如果重复调用）
    var existing = document.getElementById('xo-onboarding-root');
    if (existing) existing.remove();

    // 获取小新头像
    var mascotFace = resolveMascotFace();

    // 构建 DOM
    var dom = buildDOM(mascotFace);
    injectCoreStyles(dom.styleEl);

    var currentStep = -1;
    var isAnimating = false;

    // 步骤圆点
    function buildDots() {
      dom.dots.innerHTML = STEPS.map(function (_, i) {
        return '<span class="xo-step-dot' + (i === 0 ? ' active' : '') + '" data-i="' + i + '"></span>';
      }).join('');
    }
    buildDots();

    // 显示步骤
    function showStep(idx) {
      if (idx < 0 || idx >= STEPS.length) return;
      if (isAnimating) return;
      isAnimating = true;

      var step = STEPS[idx];
      var targetEl = findTarget(step);

      // 先更新内容
      dom.title.innerHTML = step.title;
      dom.content.innerHTML = step.content;

      // 更新步骤圆点
      var dots = $$('.xo-step-dot', dom.dots);
      dots.forEach(function (dot, i) {
        dot.classList.remove('active', 'done');
        if (i === idx) dot.classList.add('active');
        else if (i < idx) dot.classList.add('done');
      });

      // 按钮状态
      var isLast = idx === STEPS.length - 1;
      dom.btnNext.style.display = isLast ? 'none' : '';
      dom.btnDone.style.display = isLast ? '' : 'none';
      dom.btnSkip.style.display = isLast ? 'none' : '';

      // 重新触发动效
      dom.tooltip.style.animation = 'none';
      dom.tooltip.offsetHeight;
      dom.tooltip.style.animation = 'xo-bubble-in 0.45s cubic-bezier(0.34, 1.56, 0.64, 1)';

      currentStep = idx;

      // 滚动 + 定位
      requestAnimationFrame(function () {
        if (targetEl) {
          targetEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
          setTimeout(function () {
            updateSpotlight(dom, targetEl, step.spotlightPadding);
            positionTooltip(dom, targetEl, step.position);
            isAnimating = false;
          }, 400);
        } else {
          updateSpotlight(dom, null, 0);
          requestAnimationFrame(function () {
            positionTooltip(dom, null, 'center');
            isAnimating = false;
          });
        }
      });
    }

    function nextStep() {
      if (currentStep >= STEPS.length - 1) {
        finish();
        return;
      }
      showStep(currentStep + 1);
    }

    function finish() {
      // 始终写入 DBG 条
      if (window.__dbg) {
        window.__dbg('dbg-force', 'finish() called, isForceRun=' + (!!isForceRun), '#ff0');
      }

      // 仅首次自动弹出时写入本地标记；手动重看不改动 onboardingDone
      if (!isForceRun) {
        window.__onboardingDone = true;
        localStorage.setItem('xo_onboarding_done', '1');
        if (window.__dbg) window.__dbg('dbg-fetch', 'onboardingDone 已保存到 localStorage', '#0f0');
      } else {
        if (window.__dbg) window.__dbg('dbg-fetch', 'isForceRun=true, 跳过保存', '#888');
      }

      dom.root.style.transition = 'opacity 0.4s ease';
      dom.root.style.opacity = '0';
      setTimeout(function () {
        dom.root.remove();
      }, 420);
    }

    // 事件绑定
    dom.btnNext.addEventListener('click', nextStep);
    dom.btnDone.addEventListener('click', finish);
    dom.btnSkip.addEventListener('click', finish);

    // 键盘导航
    function onKeydown(e) {
      if (e.key === 'ArrowRight' || e.key === 'Enter') {
        e.preventDefault();
        nextStep();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        if (currentStep > 0) showStep(currentStep - 1);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        finish();
      }
    }
    document.addEventListener('keydown', onKeydown);

    // resize
    var resizeTimer;
    function onResize() {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(function () {
        if (currentStep >= 0) {
          var step = STEPS[currentStep];
          var targetEl = findTarget(step);
          if (targetEl) {
            updateSpotlight(dom, targetEl, step.spotlightPadding);
            positionTooltip(dom, targetEl, step.position);
          } else {
            updateSpotlight(dom, null, 0);
            positionTooltip(dom, null, 'center');
          }
        }
      }, 200);
    }
    window.addEventListener('resize', onResize);

    // 启动
    setTimeout(function () {
      showStep(0);
    }, 100);

    console.log('🐣 小新新手引导已就绪 —', STEPS.length, '个步骤');
  }

  // ===================== 全局 API =====================
  window.startXiaoxinOnboarding = function (force) {
    init(force !== false);
  };

  // ===================== 手动触发引导（home.html 控制自动弹出时机） =====================
  // 自动弹出不再是脚本加载时无条件判断，而是由 home.html 读取 localStorage 的
  // xo_onboarding_done 标记，在 window.__onboardingDone 上设置标记，
  // 然后调用 window.startXiaoxinOnboarding(false) 触发。
  // 如果 home.html 设置了标记但没有调用（或由其他页面使用），
  // 右上角"引导"按钮始终可调用 startXiaoxinOnboarding(true) 强制弹出。
})();
