/**
 * 形象配置 — 所有页面共享
 *
 * 两套独立的形象系统：
 * - 小新形象（xiaoxin）：6个可选形象，每个配大图+logo图
 *   - 大图（xiaoxin-N.png）：1536×1024 横版，用于 hero 吉祥物、结束页大图
 *   - logo图（xiaoxin-logo-N.png）：用于品牌角标、聊天按钮、消息头像等小尺寸位置
 * - 学生形象（student）：6个可选形象（男生女生）
 *
 * 选中逻辑：存索引(1-6)，自动派生两个路径。
 */
(function () {
  var BASE = 'assets/avatars';

  // 小新形象 — 大图（横版，用于英雄区/结束页）
  var XIAOXIN_IMAGES = [
    BASE + '/xiaoxin/xiaoxin-1.png',
    BASE + '/xiaoxin/xiaoxin-2.png',
    BASE + '/xiaoxin/xiaoxin-3.png',
    BASE + '/xiaoxin/xiaoxin-4.png',
    BASE + '/xiaoxin/xiaoxin-5.png',
    BASE + '/xiaoxin/xiaoxin-6.png',
  ];

  // 小新形象 — logo图（用于角标/按钮/消息头像等小容器）
  var XIAOXIN_LOGO_IMAGES = [
    BASE + '/xiaoxin/xiaoxin-logo-1.png',
    BASE + '/xiaoxin/xiaoxin-logo-2.png',
    BASE + '/xiaoxin/xiaoxin-logo-3.png',
    BASE + '/xiaoxin/xiaoxin-logo-4.png',
    BASE + '/xiaoxin/xiaoxin-logo-5.png',
    BASE + '/xiaoxin/xiaoxin-logo-6.png',
  ];

  // 学生形象（男生女生，不需要额外 logo）
  var STUDENT_IMAGES = [
    BASE + '/student/student-1.png',
    BASE + '/student/student-2.png',
    BASE + '/student/student-3.png',
    BASE + '/student/student-4.png',
    BASE + '/student/student-5.png',
    BASE + '/student/student-6.png',
  ];

  // 窗口暴露
  window.XIAOXIN_AVATARS = XIAOXIN_IMAGES;
  window.XIAOXIN_LOGO_AVATARS = XIAOXIN_LOGO_IMAGES;
  window.STUDENT_AVATARS = STUDENT_IMAGES;

  /** 从 localStorage 读取选中小新的索引（1-6），默认1 */
  function _getXiaoxinIndex() {
    var raw = localStorage.getItem('xiaoxin_index');
    var idx = parseInt(raw, 10);
    if (idx >= 1 && idx <= XIAOXIN_IMAGES.length) return idx;

    // 旧版兼容：存的是完整路径
    var oldPath = localStorage.getItem('xiaoxin_avatar');
    if (oldPath) {
      for (var i = 0; i < XIAOXIN_IMAGES.length; i++) {
        if (XIAOXIN_IMAGES[i] === oldPath) return i + 1;
      }
    }
    return 1;
  }

  /** 获取当前选中的小新大图路径 */
  window.getXiaoxinAvatar = function () {
    return XIAOXIN_IMAGES[_getXiaoxinIndex() - 1];
  };

  /** 获取当前选中的小新 logo 图路径 */
  window.getXiaoxinLogo = function () {
    return XIAOXIN_LOGO_IMAGES[_getXiaoxinIndex() - 1];
  };

  /** 保存选中的小新形象（索引 1-6） */
  window.setXiaoxinAvatar = function (indexOrPath) {
    var idx;
    if (typeof indexOrPath === 'number') {
      idx = indexOrPath;
    } else {
      // 兼容旧的路径传入
      for (var i = 0; i < XIAOXIN_IMAGES.length; i++) {
        if (XIAOXIN_IMAGES[i] === indexOrPath) { idx = i + 1; break; }
      }
    }
    if (!idx || idx < 1 || idx > XIAOXIN_IMAGES.length) idx = 1;
    localStorage.setItem('xiaoxin_index', String(idx));
  };

  /** 获取当前选中的学生图片 */
  window.getStudentAvatar = function () {
    var saved = localStorage.getItem('student_avatar');
    if (saved && saved.indexOf(BASE) === 0) return saved;
    return STUDENT_IMAGES[0];
  };

  /** 保存选中的学生图片 */
  window.setStudentAvatar = function (path) {
    localStorage.setItem('student_avatar', path);
  };
})();
