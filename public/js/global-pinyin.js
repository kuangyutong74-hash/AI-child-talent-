/**
 * global-pinyin.js — 全站拼音注音模块
 * 依赖：pinyin-pro（CDN 引入）、localStorage
 * 用法：每个 HTML 页面引入此文件 + pinyin-pro CDN 即可。
 *       Header 里放 <button class="btn-pinyin" id="btnPinyin">拼</button>
 *       页面主体容器加上 id="app-content"
 */
(function () {
  'use strict';

  // =============================================================
  //  状态读写（localStorage）
  // =============================================================
  function loadState() {
    try { return localStorage.getItem('pinyinEnabled') === 'true'; } catch (_) { return false; }
  }
  function saveState(v) {
    try { localStorage.setItem('pinyinEnabled', String(v)); } catch (_) {}
  }

  // =============================================================
  //  工具函数
  // =============================================================
  function isChinese(c) { return /^[一-鿿]$/.test(c); }

  /**
   * 把纯文本变成带 <ruby> 的 HTML 字符串
   */
  function textToRubyHTML(text) {
    if (typeof pinyinPro === 'undefined') return text;
    try {
      const pyArr = pinyinPro.pinyin(text, { type: 'array' });
      const chars = [...text];
      let out = '';
      for (let i = 0; i < chars.length; i++) {
        const ch = chars[i];
        const py = pyArr[i];
        if (isChinese(ch) && py && py !== ch) {
          out += '<ruby>' + ch + '<rt>' + py + '</rt></ruby>';
        } else {
          out += ch;
        }
      }
      return out;
    } catch (_) { return text; }
  }

  // =============================================================
  //  DOM 遍历：只处理文本节点，跳过 <script>/<style>/已有<ruby>
  // =============================================================
  function applyPinyin(root) {
    const walker = document.createTreeWalker(
      root,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode: function (node) {
          const parent = node.parentElement;
          if (!parent) return NodeFilter.FILTER_REJECT;
          const tag = parent.tagName.toLowerCase();
          if (tag === 'script' || tag === 'style' || tag === 'ruby' || tag === 'rt') return NodeFilter.FILTER_REJECT;
          if (parent.closest('ruby')) return NodeFilter.FILTER_REJECT;
          return /[一-鿿]/.test(node.textContent) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
        }
      }
    );
    const textNodes = [];
    while (walker.nextNode()) textNodes.push(walker.currentNode);
    textNodes.forEach(function (node) {
      const span = document.createElement('span');
      span.innerHTML = textToRubyHTML(node.textContent);
      node.parentNode.replaceChild(span, node);
      // 如果父节点只需要这一个 span，直接解包
      if (span.parentNode && span.parentNode.childNodes.length === 1) {
        const frag = document.createDocumentFragment();
        while (span.firstChild) frag.appendChild(span.firstChild);
        span.parentNode.replaceChild(frag, span);
      }
    });
  }

  function removePinyin(root) {
    const rubies = root.querySelectorAll('ruby');
    rubies.forEach(function (r) {
      const parent = r.parentNode;
      // 收集 <ruby> 内所有文本（跳过 <rt>）
      const text = [];
      r.childNodes.forEach(function (c) {
        if (c.nodeName.toLowerCase() !== 'rt') text.push(c.textContent);
      });
      const txt = document.createTextNode(text.join(''));
      parent.replaceChild(txt, r);
    });
    // 合并相邻文本节点
    root.normalize();
  }

  // =============================================================
  //  全局开关
  // =============================================================
  window.PinyinSwitch = {
    get enabled() { return loadState(); },
    set enabled(v) { saveState(v); },
    toggle: function () {
      const was = this.enabled;
      this.enabled = !was;
      return this.enabled;
    },
    apply: function (root) {
      if (this.enabled) applyPinyin(root);
    },
    remove: function (root) {
      removePinyin(root);
    },
    init: function () {
      const btn = document.getElementById('btnPinyin');
      if (btn) {
        // 同步 UI 状态
        if (this.enabled) btn.classList.add('on');
        btn.addEventListener('click', function () {
          const nowOn = window.PinyinSwitch.toggle();
          const root = document.getElementById('app-content') || document.body;
          if (nowOn) {
            applyPinyin(root);
            btn.classList.add('on');
          } else {
            removePinyin(root);
            btn.classList.remove('on');
          }
        });
      }
      // 页面加载时如果开关开着，自动注音
      if (this.enabled) {
        const root = document.getElementById('app-content') || document.body;
        applyPinyin(root);
      }
    }
  };

  // DOM ready 后自动初始化
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { window.PinyinSwitch.init(); });
  } else {
    window.PinyinSwitch.init();
  }
})();
